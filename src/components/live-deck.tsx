"use client";

import { NewsDeck } from "@/components/news-deck";
import { WalletButton } from "@/components/wallet-button";
import { useMarkets } from "@/hooks/use-markets";
import type { MarketView } from "@/lib/types";

export function LiveDeck({ initialMarkets = [] }: { initialMarkets?: MarketView[] }) {
  const { markets, isLoading, error, refresh } = useMarkets(initialMarkets);
  return (
    <NewsDeck
      markets={markets}
      isLoading={isLoading}
      error={error}
      refresh={refresh}
      headerAction={<WalletButton />}
    />
  );
}
