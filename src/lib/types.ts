export type MarketOutcome = "open" | "yes" | "no" | "void";
export type MarketSide = "yes" | "no";
export type NewsCategory =
  | "general"
  | "world"
  | "politics"
  | "business"
  | "technology"
  | "science"
  | "health"
  | "sports"
  | "entertainment"
  | "crypto";

export type ResolutionSource = {
  name: string;
  url: string;
};

export type MarketView = {
  id: bigint;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  category: NewsCategory;
  publishedAt: string;
  question: string;
  criteria: string;
  resolutionSources: ResolutionSource[];
  closeAt: number;
  yesCount: number;
  noCount: number;
  outcome: MarketOutcome;
  evidenceUri?: string;
  confidenceBps?: number;
};

export type NewsArticle = {
  title: string;
  description: string;
  link: string;
  source: string;
  sourceKey: string;
  pubDate: string;
  category: NewsCategory;
  resolutionSources: ResolutionSource[];
  image?: string;
  credibility?: number;
};

export type PortfolioPosition = {
  marketId: string;
  title: string;
  source: string;
  category: NewsCategory;
  side: MarketSide;
  status: "ongoing" | "won" | "lost" | "void";
  closeAt: number;
  claimed: boolean;
  stakeWei: string;
  payoutWei: string;
  pnlWei: string;
  claimableWei: string;
};

export type PortfolioView = {
  address: string;
  totalBets: number;
  wins: number;
  losses: number;
  ongoing: number;
  totalStakedWei: string;
  settledPnlWei: string;
  claimableWei: string;
  openExposureWei: string;
  positions: PortfolioPosition[];
};
