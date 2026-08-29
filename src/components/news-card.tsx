"use client";

import dynamic from "next/dynamic";

import type { MarketView } from "@/lib/types";

const BetPanel = dynamic(
  () => import("@/components/bet-panel").then((module) => module.BetPanel),
  {
    ssr: false,
    loading: () => (
      <section className="bet-panel" aria-label="Loading prediction market">
        <p className="eyebrow">LOADING POSITION</p>
      </section>
    ),
  },
);

type Props = {
  market: MarketView;
  index: number;
  total: number;
  isActive: boolean;
  onSettled: () => Promise<void>;
};

export function NewsCard({ market, index, total, isActive, onSettled }: Props) {
  const published = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  }).format(new Date(market.publishedAt));

  return (
    <article className="news-card" data-testid="news-card">
      <section className="story-pane">
        <div className="story-meta">
          <span className="issue-number">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="story-tags">
            <span>{market.category}</span>
            <span className="source">{market.source}</span>
          </span>
        </div>

        <div className={`story-image ${market.imageUrl ? "has-image" : ""}`}>
          {market.imageUrl && isActive ? (
            // Publisher hosts vary at runtime, so native images avoid a brittle host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={market.imageUrl}
              alt={`Image for ${market.title}`}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          )}
        </div>

        <div className="story-copy">
          <p className="eyebrow">THE BRIEF</p>
          <h1>{market.title}</h1>
          <p className="summary">{market.summary}</p>
          <time className="published-at" dateTime={market.publishedAt}>
            Published {published}
          </time>
          <a
            className="source-link"
            href={market.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Read original at {market.source} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      {isActive ? (
        <BetPanel market={market} onSettled={onSettled} />
      ) : (
        <section className="bet-panel bet-panel-idle" aria-label="Prediction market">
          <p className="eyebrow">DAILY POSITION</p>
          <h2>{market.question}</h2>
          <span>
            {market.outcome === "open"
              ? "Swipe here to activate market"
              : `Resolved ${market.outcome.toUpperCase()}`}
          </span>
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
        </section>
      )}

      <p className="swipe-hint" aria-hidden="true">
        <span>↓</span> SWIPE FOR NEXT
      </p>
    </article>
  );
}
