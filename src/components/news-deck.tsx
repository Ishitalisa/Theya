"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AppHeader } from "@/components/app-header";
import { NewsCard } from "@/components/news-card";
import type { MarketView, NewsCategory } from "@/lib/types";

type Props = {
  markets: MarketView[];
  isLoading?: boolean;
  error?: string;
  refresh: () => Promise<void>;
  headerAction: ReactNode;
};

const categoryOrder: NewsCategory[] = [
  "general",
  "world",
  "politics",
  "business",
  "technology",
  "science",
  "health",
  "sports",
  "entertainment",
  "crypto",
];
const categoryLabel: Record<NewsCategory, string> = {
  general: "Top",
  world: "World",
  politics: "Politics",
  business: "Business",
  technology: "Technology",
  science: "Science",
  health: "Health",
  sports: "Sports",
  entertainment: "Entertainment",
  crypto: "Crypto",
};

export function NewsDeck({
  markets,
  isLoading = false,
  error = "",
  refresh,
  headerAction,
}: Props) {
  const deckRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<"all" | NewsCategory>(
    "all",
  );
  const visibleMarkets = useMemo(
    () =>
      selectedCategory === "all"
        ? markets
        : markets.filter((market) => market.category === selectedCategory),
    [markets, selectedCategory],
  );

  const move = useCallback(
    (direction: number) => {
      const next = Math.max(
        0,
        Math.min(visibleMarkets.length - 1, active + direction),
      );
      deckRef.current
        ?.querySelectorAll<HTMLElement>("[data-testid='news-card']")
        [next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [active, visibleMarkets.length],
  );

  const selectCategory = useCallback((category: "all" | NewsCategory) => {
    setSelectedCategory(category);
    setActive(0);
    deckRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const root = deckRef.current;
    if (!root) return;
    const cards = root.querySelectorAll("[data-testid='news-card']");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Array.from(cards).indexOf(visible.target));
      },
      { root, threshold: [0.55, 0.8] },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [visibleMarkets]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "BUTTON"].includes(element.tagName)) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        move(1);
      }
      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  return (
    <main className="app-shell">
      <AppHeader
        current="briefs"
        onBrandClick={() => selectCategory("all")}
        walletAction={headerAction}
        categoryNav={
          <nav className="category-tabs" aria-label="News categories">
            <button
              type="button"
              aria-pressed={selectedCategory === "all"}
              onClick={() => selectCategory("all")}
            >
              All
            </button>
            {categoryOrder.map((category) => (
              <button
                type="button"
                key={category}
                aria-pressed={selectedCategory === category}
                onClick={() => selectCategory(category)}
              >
                {categoryLabel[category]}
              </button>
            ))}
          </nav>
        }
      />

      <div className="deck-frame">
        <div className="deck" ref={deckRef} aria-live="polite">
          {isLoading && (
            <div className="loading-card" aria-label="Loading news">
              <span>CURATING TODAY&apos;S SIGNAL</span>
            </div>
          )}
          {!isLoading && error && (
            <div className="empty-card">
              <p>FEED INTERRUPTED</p>
              <h1>Today&apos;s signal could not be loaded.</h1>
              <button type="button" onClick={() => refresh()}>
                Try again
              </button>
            </div>
          )}
          {!isLoading && !error && visibleMarkets.length === 0 && (
            <div className="empty-card">
              <p>NO MARKETS HERE</p>
              <h1>Fresh positions arrive throughout the day.</h1>
            </div>
          )}
          {visibleMarkets.map((market, index) => (
            <NewsCard
              key={market.id.toString()}
              market={market}
              index={index}
              total={visibleMarkets.length}
              isActive={index === active}
              onSettled={refresh}
            />
          ))}
        </div>

        {visibleMarkets.length > 1 && (
          <aside className="deck-controls" aria-label="Story navigation">
            <span className="active-count">
              {String(active + 1).padStart(2, "0")}
            </span>
            <div className="progress-track">
              <span
                style={{
                  height: `${((active + 1) / visibleMarkets.length) * 100}%`,
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={active === 0}
              aria-label="Previous story"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={active === visibleMarkets.length - 1}
              aria-label="Next story"
            >
              ↓
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
