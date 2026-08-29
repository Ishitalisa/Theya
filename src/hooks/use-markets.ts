"use client";

import { useCallback, useEffect, useState } from "react";

import type { MarketView } from "@/lib/types";

type SerializedMarket = Omit<MarketView, "id"> & { id: string };

export function useMarkets(initialMarkets: MarketView[] = []) {
  const [markets, setMarkets] = useState<MarketView[]>(initialMarkets);
  const [isLoading, setIsLoading] = useState(initialMarkets.length === 0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/markets", { cache: "no-store" });
      const body = (await response.json()) as {
        markets?: SerializedMarket[];
        error?: string;
      };
      if (!response.ok || !body.markets) {
        throw new Error(body.error ?? "Could not load markets.");
      }
      setMarkets(
        body.markets.map((market) => ({ ...market, id: BigInt(market.id) })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load markets.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 30_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [load]);

  return { markets, isLoading, error, refresh: load };
}
