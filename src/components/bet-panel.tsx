"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";

import {
  CONTRACT_ADDRESS,
  FIXED_STAKE,
  explorerTx,
  theyaMarketAbi,
  monadTestnet,
} from "@/lib/chain";
import type { MarketSide, MarketView } from "@/lib/types";

type Props = {
  market: MarketView;
  onSettled: () => Promise<void>;
};

function useCountdown(closeAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = Math.max(0, closeAt - Math.floor(now / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  return seconds === 0
    ? "Closed"
    : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function BetPanel({ market, onSettled }: Props) {
  const countdown = useCountdown(market.closeAt);
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [selected, setSelected] = useState<MarketSide | null>(null);
  const [notice, setNotice] = useState("");
  const [txUrl, setTxUrl] = useState("");
  const [isPending, setIsPending] = useState(false);
  const enabled = Boolean(CONTRACT_ADDRESS && address);
  const contractAddress = CONTRACT_ADDRESS ?? zeroAddress;
  const agentId = process.env.NEXT_PUBLIC_AGENT_ID;

  const position = useReadContract({
    address: contractAddress,
    abi: theyaMarketAbi,
    functionName: "positions",
    args: [market.id, address ?? zeroAddress],
    query: { enabled },
  });
  const claimable = useReadContract({
    address: contractAddress,
    abi: theyaMarketAbi,
    functionName: "claimable",
    args: [market.id, address ?? zeroAddress],
    query: { enabled: enabled && market.outcome !== "open" },
  });

  const userSide = Number(position.data?.[0] ?? 0);
  const total = market.yesCount + market.noCount;
  const yesPercent = total ? Math.round((market.yesCount / total) * 100) : 50;
  const canBet =
    market.outcome === "open" &&
    countdown !== "Closed" &&
    userSide === 0;
  const claimAmount = claimable.data ?? 0n;

  const stateLabel = useMemo(() => {
    if (market.outcome === "void") return "VOID · FULL REFUND";
    if (market.outcome !== "open") return `${market.outcome.toUpperCase()} WON`;
    if (userSide) return `POSITION LOCKED · ${userSide === 1 ? "YES" : "NO"}`;
    return "ONE POSITION PER WALLET";
  }, [market.outcome, userSide]);

  async function transact(kind: "bet" | "claim") {
    setNotice("");
    setTxUrl("");
    if (!isConnected) {
      setNotice("Connect wallet from header first.");
      return;
    }
    if (chainId !== monadTestnet.id) {
      setNotice("Switch wallet to Monad Testnet.");
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setNotice("Market contract is not configured.");
      return;
    }
    if (kind === "bet" && !selected) {
      setNotice("Choose YES or NO.");
      return;
    }

    setIsPending(true);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: theyaMarketAbi,
        functionName: kind === "bet" ? "bet" : "claim",
        args:
          kind === "bet"
            ? [market.id, selected === "yes" ? 1 : 2]
            : [market.id],
        ...(kind === "bet" ? { value: FIXED_STAKE } : {}),
      });
      setTxUrl(explorerTx(hash));
      await publicClient?.waitForTransactionReceipt({ hash });
      setNotice("Transaction confirmed.");
      await Promise.all([position.refetch(), claimable.refetch(), onSettled()]);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message.split("\n")[0] : "Transaction failed.";
      setNotice(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="bet-panel" aria-label="Prediction market">
      <div className="bet-kicker">
        <span>{stateLabel}</span>
        <time dateTime={new Date(market.closeAt * 1_000).toISOString()}>
          {countdown}
        </time>
      </div>

      <h2>{market.question}</h2>
      <p className="criteria">{market.criteria}</p>
      <div className="resolution-sources" aria-label="Declared resolution sources">
        <span>RESOLUTION SOURCE</span>
        {market.resolutionSources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {source.name} ↗
          </a>
        ))}
      </div>
      {market.outcome !== "open" && market.evidenceUri && (
        <a
          className="evidence-link"
          href={market.evidenceUri}
          target="_blank"
          rel="noreferrer"
        >
          Final evidence · {((market.confidenceBps ?? 0) / 100).toFixed(0)}% ↗
        </a>
      )}
      {agentId && (
        <a className="agent-link" href="/api/agent-card" target="_blank">
          ERC-8004 resolver #{agentId} ↗
        </a>
      )}

      <div
        className="market-split"
        role="meter"
        aria-label="YES share"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={yesPercent}
      >
        <span style={{ width: `${yesPercent}%` }} />
      </div>
      <div className="pool-labels">
        <span>YES · {market.yesCount}</span>
        <span>NO · {market.noCount}</span>
      </div>

      <div className="choice-grid">
        <button
          type="button"
          className={`choice yes ${selected === "yes" ? "selected" : ""}`}
          onClick={() => setSelected("yes")}
          disabled={!canBet || isPending}
          aria-pressed={selected === "yes"}
        >
          <span>YES</span>
          <strong>0.01 MON</strong>
        </button>
        <button
          type="button"
          className={`choice no ${selected === "no" ? "selected" : ""}`}
          onClick={() => setSelected("no")}
          disabled={!canBet || isPending}
          aria-pressed={selected === "no"}
        >
          <span>NO</span>
          <strong>0.01 MON</strong>
        </button>
      </div>

      {canBet && (
        <button
          className="commit-button"
          type="button"
          onClick={() => transact("bet")}
          disabled={!selected || isPending}
        >
          {isPending ? "Confirm in wallet…" : `Lock ${selected?.toUpperCase() ?? "position"}`}
        </button>
      )}

      {claimAmount > 0n && (
        <button
          className="commit-button"
          type="button"
          onClick={() => transact("claim")}
          disabled={isPending}
        >
          Claim {Number(formatEther(claimAmount)).toFixed(4)} MON
        </button>
      )}

      {notice && <p className="tx-notice" role="status">{notice}</p>}
      {txUrl && (
        <a className="tx-link" href={txUrl} target="_blank" rel="noreferrer">
          View transaction ↗
        </a>
      )}
    </section>
  );
}
