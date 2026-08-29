import "server-only";

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { ProposedMarket, Resolution } from "@/lib/agent";
import {
  CONTRACT_ADDRESS,
  FIXED_STAKE,
  theyaMarketAbi,
  monadTestnet,
} from "@/lib/chain";
import type { MarketView, PortfolioPosition, PortfolioView } from "@/lib/types";

function chainPublicClient() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured.");
  }
  return createPublicClient({
    batch: { multicall: true },
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });
}

function clients() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) throw new Error("AGENT_PRIVATE_KEY is not configured.");
  const account = privateKeyToAccount(privateKey);
  const publicClient = chainPublicClient();
  return {
    account,
    publicClient,
    walletClient: createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(process.env.MONAD_TESTNET_RPC_URL),
    }),
  };
}

export async function publishMarket(
  market: ProposedMarket,
): Promise<`0x${string}` | null> {
  const { account, publicClient, walletClient } = clients();
  const metadata = JSON.stringify(market);
  const termsHash = keccak256(toBytes(market.sourceUrl.toLowerCase()));
  const exists = await publicClient.readContract({
    address: CONTRACT_ADDRESS!,
    abi: theyaMarketAbi,
    functionName: "termsUsed",
    args: [termsHash],
  });
  if (exists) return null;
  const hash = await walletClient.writeContract({
    account,
    address: CONTRACT_ADDRESS!,
    abi: theyaMarketAbi,
    functionName: "createMarket",
    args: [termsHash, market.closeAt, metadata],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function closedMarkets(): Promise<MarketView[]> {
  const publicClient = chainPublicClient();
  const count = await publicClient.readContract({
    address: CONTRACT_ADDRESS!,
    abi: theyaMarketAbi,
    functionName: "marketCount",
  });
  const firstId = count > 256n ? count - 255n : 1n;
  const ids = Array.from(
    { length: Number(count >= firstId ? count - firstId + 1n : 0n) },
    (_, index) => count - BigInt(index),
  );

  const markets = await Promise.all(
    ids.map(async (id) => {
      const [state, creationBlock] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS!,
          abi: theyaMarketAbi,
          functionName: "markets",
          args: [id],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS!,
          abi: theyaMarketAbi,
          functionName: "creationBlocks",
          args: [id],
        }),
      ]);
      if (Number(state[4]) !== 0 || Number(state[1]) > Date.now() / 1_000) {
        return null;
      }
      const [event] = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS!,
        abi: theyaMarketAbi,
        eventName: "MarketCreated",
        args: { marketId: id },
        fromBlock: creationBlock,
        toBlock: creationBlock,
      });
      if (!event) return null;
      try {
        const metadata = JSON.parse(event.args.metadata ?? "") as Omit<
          MarketView,
          | "id"
          | "closeAt"
          | "yesCount"
          | "noCount"
          | "outcome"
        >;
        return {
          id,
          ...metadata,
          closeAt: Number(state[1]),
          yesCount: Number(state[2]),
          noCount: Number(state[3]),
          outcome: "open",
        } satisfies MarketView;
      } catch {
        return null;
      }
    }),
  );
  return markets.filter((market) => market !== null) as MarketView[];
}

async function readMarketById(
  publicClient: ReturnType<typeof chainPublicClient>,
  marketId: bigint,
): Promise<MarketView | null> {
  const [state, creationBlock, resolutionBlock] = await Promise.all([
    publicClient.readContract({
      address: CONTRACT_ADDRESS!,
      abi: theyaMarketAbi,
      functionName: "markets",
      args: [marketId],
    }),
    publicClient.readContract({
      address: CONTRACT_ADDRESS!,
      abi: theyaMarketAbi,
      functionName: "creationBlocks",
      args: [marketId],
    }),
    publicClient.readContract({
      address: CONTRACT_ADDRESS!,
      abi: theyaMarketAbi,
      functionName: "resolutionBlocks",
      args: [marketId],
    }),
  ]);
  if (creationBlock === 0n || Number(state[1]) === 0) return null;
  const [created, resolved] = await Promise.all([
    publicClient.getContractEvents({
      address: CONTRACT_ADDRESS!,
      abi: theyaMarketAbi,
      eventName: "MarketCreated",
      args: { marketId },
      fromBlock: creationBlock,
      toBlock: creationBlock,
    }),
    resolutionBlock === 0n
      ? Promise.resolve([])
      : publicClient.getContractEvents({
          address: CONTRACT_ADDRESS!,
          abi: theyaMarketAbi,
          eventName: "MarketResolved",
          args: { marketId },
          fromBlock: resolutionBlock,
          toBlock: resolutionBlock,
        }),
  ]);
  const event = created[0];
  if (!event) return null;
  try {
    const metadata = JSON.parse(event.args.metadata ?? "") as Omit<
      MarketView,
      "id" | "closeAt" | "yesCount" | "noCount" | "outcome"
    >;
    const resolution = resolved.at(-1)?.args;
    return {
      id: marketId,
      ...metadata,
      closeAt: Number(state[1]),
      yesCount: Number(state[2]),
      noCount: Number(state[3]),
      outcome: (["open", "yes", "no", "void"][Number(state[4])] ??
        "open") as MarketView["outcome"],
      evidenceUri: resolution?.evidenceUri,
      confidenceBps: Number(resolution?.confidenceBps ?? 0),
    };
  } catch {
    return null;
  }
}

export async function marketById(marketId: bigint): Promise<MarketView | null> {
  return readMarketById(chainPublicClient(), marketId);
}

export async function latestMarkets(limit = 80): Promise<MarketView[]> {
  const publicClient = chainPublicClient();
  const count = await publicClient.readContract({
    address: CONTRACT_ADDRESS!,
    abi: theyaMarketAbi,
    functionName: "marketCount",
  });
  const size = BigInt(Math.max(1, Math.min(limit, 80)));
  const firstId = count > size ? count - size + 1n : 1n;
  const ids = Array.from(
    { length: Number(count >= firstId ? count - firstId + 1n : 0n) },
    (_, index) => count - BigInt(index),
  );
  const markets = await Promise.all(
    ids.map((id) => readMarketById(publicClient, id)),
  );
  return markets.filter((market): market is MarketView => market !== null);
}

export async function portfolioByAddress(
  address: `0x${string}`,
): Promise<PortfolioView> {
  const publicClient = chainPublicClient();
  const count = await publicClient.readContract({
    address: CONTRACT_ADDRESS!,
    abi: theyaMarketAbi,
    functionName: "userMarketCount",
    args: [address],
  });
  const ids = await Promise.all(
    Array.from({ length: Number(count) }, (_, index) =>
      publicClient.readContract({
        address: CONTRACT_ADDRESS!,
        abi: theyaMarketAbi,
        functionName: "userMarketAt",
        args: [address, BigInt(index)],
      }),
    ),
  );
  const positions = await Promise.all(
    ids.reverse().map(async (marketId): Promise<PortfolioPosition | null> => {
      const [market, position, claimable] = await Promise.all([
        readMarketById(publicClient, marketId),
        publicClient.readContract({
          address: CONTRACT_ADDRESS!,
          abi: theyaMarketAbi,
          functionName: "positions",
          args: [marketId, address],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS!,
          abi: theyaMarketAbi,
          functionName: "claimable",
          args: [marketId, address],
        }),
      ]);
      if (!market || position[0] === 0) return null;

      const side = position[0] === 1 ? "yes" : "no";
      const won =
        (market.outcome === "yes" && side === "yes") ||
        (market.outcome === "no" && side === "no");
      const status =
        market.outcome === "open"
          ? "ongoing"
          : market.outcome === "void"
            ? "void"
            : won
              ? "won"
              : "lost";
      let payout = 0n;
      if (status === "void") {
        payout = FIXED_STAKE;
      } else if (status === "won") {
        const winnerCount = BigInt(
          side === "yes" ? market.yesCount : market.noCount,
        );
        const loserCount = BigInt(
          side === "yes" ? market.noCount : market.yesCount,
        );
        const rewardPool = (loserCount * FIXED_STAKE * 90n) / 100n;
        payout =
          FIXED_STAKE +
          rewardPool / winnerCount +
          (BigInt(position[1]) < rewardPool % winnerCount ? 1n : 0n);
      }
      const pnl = status === "ongoing" ? 0n : payout - FIXED_STAKE;

      return {
        marketId: marketId.toString(),
        title: market.title,
        source: market.source,
        category: market.category,
        side,
        status,
        closeAt: market.closeAt,
        claimed: position[2],
        stakeWei: FIXED_STAKE.toString(),
        payoutWei: payout.toString(),
        pnlWei: pnl.toString(),
        claimableWei: claimable.toString(),
      };
    }),
  );
  const valid = positions.filter(
    (position): position is PortfolioPosition => position !== null,
  );
  const settledPnl = valid.reduce(
    (total, position) => total + BigInt(position.pnlWei),
    0n,
  );
  const claimable = valid.reduce(
    (total, position) => total + BigInt(position.claimableWei),
    0n,
  );
  const ongoing = valid.filter((position) => position.status === "ongoing");

  return {
    address,
    totalBets: valid.length,
    wins: valid.filter((position) => position.status === "won").length,
    losses: valid.filter((position) => position.status === "lost").length,
    ongoing: ongoing.length,
    totalStakedWei: (BigInt(valid.length) * FIXED_STAKE).toString(),
    settledPnlWei: settledPnl.toString(),
    claimableWei: claimable.toString(),
    openExposureWei: (BigInt(ongoing.length) * FIXED_STAKE).toString(),
    positions: valid,
  };
}

export async function publishResolution(
  marketId: bigint,
  resolution: Resolution,
): Promise<`0x${string}`> {
  const { account, publicClient, walletClient } = clients();
  const evidence = JSON.stringify(resolution);
  const outcome = { YES: 1, NO: 2, VOID: 3 }[resolution.outcome];
  const evidenceUri = resolution.evidenceUrls[0] ?? "";
  const hash = await walletClient.writeContract({
    account,
    address: CONTRACT_ADDRESS!,
    abi: theyaMarketAbi,
    functionName: "resolve",
    args: [
      marketId,
      outcome,
      evidenceUri,
      keccak256(toBytes(evidence)),
      Math.round(resolution.confidence * 10_000),
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
