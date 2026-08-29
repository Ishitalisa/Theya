import { defineChain, parseAbi, parseEther } from "viem";

export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MONAD_RPC_URL ??
          "https://testnet-rpc.monad.xyz",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadVision",
      url: "https://testnet.monadvision.com",
    },
  },
  ...(process.env.NEXT_PUBLIC_MONAD_RPC_URL?.includes("127.0.0.1")
    ? {}
    : {
        contracts: {
          multicall3: {
            address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const,
            blockCreated: 0,
          },
        },
      }),
  testnet: true,
});

export const theyaMarketAbi = parseAbi([
  "event MarketCreated(uint256 indexed marketId, bytes32 indexed termsHash, uint40 closeAt, string metadata)",
  "event MarketResolved(uint256 indexed marketId, uint8 outcome, string evidenceUri, bytes32 indexed evidenceHash, uint16 confidenceBps)",
  "event BetPlaced(uint256 indexed marketId, address indexed bettor, uint8 side, uint32 ordinal)",
  "function STAKE() view returns (uint256)",
  "function marketCount() view returns (uint256)",
  "function creationBlocks(uint256) view returns (uint64)",
  "function resolutionBlocks(uint256) view returns (uint64)",
  "function termsUsed(bytes32) view returns (bool)",
  "function markets(uint256) view returns (bytes32 termsHash, uint40 closeAt, uint32 yesCount, uint32 noCount, uint8 outcome)",
  "function positions(uint256,address) view returns (uint8 side, uint32 ordinal, bool claimed)",
  "function userMarketCount(address) view returns (uint256)",
  "function userMarketAt(address,uint256) view returns (uint256)",
  "function claimable(uint256,address) view returns (uint256)",
  "function bet(uint256 marketId, uint8 side) payable",
  "function claim(uint256 marketId) returns (uint256)",
  "function createMarket(bytes32 termsHash, uint40 closeAt, string metadata) returns (uint256)",
  "function resolve(uint256 marketId, uint8 outcome, string evidenceUri, bytes32 evidenceHash, uint16 confidenceBps)",
]);

const configuredAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as
  | `0x${string}`
  | undefined;
export const CONTRACT_ADDRESS =
  configuredAddress &&
  configuredAddress !== "0x0000000000000000000000000000000000000000"
    ? configuredAddress
    : undefined;

export const DEPLOYMENT_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? "0",
);

export const FIXED_STAKE = parseEther("0.01");
export const ERC8004_IDENTITY_REGISTRY =
  "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const ERC8004_REPUTATION_REGISTRY =
  "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;

export const explorerTx = (hash: string) =>
  `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
