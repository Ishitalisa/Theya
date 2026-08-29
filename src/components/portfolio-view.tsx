"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";

import { AppHeader } from "@/components/app-header";
import { WalletButton } from "@/components/wallet-button";
import { monadTestnet } from "@/lib/chain";
import type { PortfolioPosition, PortfolioView as PortfolioData } from "@/lib/types";

type Filter = "all" | PortfolioPosition["status"];

function mon(value: string, signed = false) {
  const amount = Number(formatEther(BigInt(value)));
  const prefix = signed && amount > 0 ? "+" : "";
  return `${prefix}${amount.toFixed(4)} MON`;
}

export function PortfolioView() {
  const { address, chainId, isConnected } = useAccount();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!address || chainId !== monadTestnet.id) {
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/portfolio?address=${address}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as PortfolioData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load portfolio.");
        if (active) setPortfolio(body);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Could not load portfolio.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [address, chainId]);

  const positions = useMemo(
    () =>
      portfolio?.positions.filter(
        (position) => filter === "all" || position.status === filter,
      ) ?? [],
    [filter, portfolio],
  );
  const isCurrentPortfolio =
    portfolio?.address.toLowerCase() === address?.toLowerCase();

  return (
    <main className="portfolio-shell">
      <AppHeader
        current="portfolio"
        walletAction={<WalletButton />}
      />
      <section className="portfolio-main">
        <div className="portfolio-heading">
          <p className="eyebrow">YOUR LEDGER</p>
          <h1>Positions, without the guesswork.</h1>
          <p>
            Settled profit uses final onchain pools. Open positions show exposure,
            never invented unrealized gains.
          </p>
        </div>

        {!isConnected && (
          <div className="portfolio-empty">
            <span>WALLET REQUIRED</span>
            <h2>Connect from the header to see your bets.</h2>
          </div>
        )}
        {isConnected && chainId !== monadTestnet.id && (
          <div className="portfolio-empty">
            <span>WRONG NETWORK</span>
            <h2>Switch to Monad Testnet from the header.</h2>
          </div>
        )}
        {loading && !isCurrentPortfolio && (
          <div className="portfolio-empty">
            <span>READING ONCHAIN HISTORY</span>
          </div>
        )}
        {error && (
          <div className="portfolio-empty" role="alert">
            <span>PORTFOLIO INTERRUPTED</span>
            <h2>{error}</h2>
          </div>
        )}

        {portfolio && isCurrentPortfolio && (
          <>
            <div className="portfolio-stats" aria-label="Portfolio summary">
              <article>
                <span>Total staked</span>
                <strong>{mon(portfolio.totalStakedWei)}</strong>
                <small>{portfolio.totalBets} bets</small>
              </article>
              <article>
                <span>Settled P&amp;L</span>
                <strong
                  data-tone={
                    BigInt(portfolio.settledPnlWei) >= 0n ? "positive" : "negative"
                  }
                >
                  {mon(portfolio.settledPnlWei, true)}
                </strong>
                <small>
                  {portfolio.wins} won · {portfolio.losses} lost
                </small>
              </article>
              <article>
                <span>Open exposure</span>
                <strong>{mon(portfolio.openExposureWei)}</strong>
                <small>{portfolio.ongoing} ongoing</small>
              </article>
              <article>
                <span>Claimable</span>
                <strong>{mon(portfolio.claimableWei)}</strong>
                <small>Available on settled cards</small>
              </article>
            </div>

            <div className="portfolio-list-head">
              <h2>Bet history</h2>
              <nav className="portfolio-filters" aria-label="Portfolio filters">
                {(["all", "ongoing", "won", "lost", "void"] as const).map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {value}
                    </button>
                  ),
                )}
              </nav>
            </div>

            {positions.length === 0 ? (
              <div className="portfolio-empty portfolio-empty-small">
                <span>NO {filter === "all" ? "" : filter.toUpperCase()} BETS</span>
              </div>
            ) : (
              <div className="position-list">
                {positions.map((position) => (
                  <article className="position-row" key={position.marketId}>
                    <div className="position-copy">
                      <span>
                        #{position.marketId} · {position.category} · {position.source}
                      </span>
                      <h3>{position.title}</h3>
                      <time dateTime={new Date(position.closeAt * 1_000).toISOString()}>
                        Closes{" "}
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(position.closeAt * 1_000))}
                      </time>
                    </div>
                    <div className="position-side">
                      <span>Side</span>
                      <strong>{position.side.toUpperCase()}</strong>
                    </div>
                    <div className="position-return">
                      <span>{position.status === "ongoing" ? "Stake" : "P&L"}</span>
                      <strong
                        data-tone={
                          BigInt(position.pnlWei) >= 0n ? "positive" : "negative"
                        }
                      >
                        {position.status === "ongoing"
                          ? mon(position.stakeWei)
                          : mon(position.pnlWei, true)}
                      </strong>
                    </div>
                    <div className="position-status">
                      <span data-status={position.status}>{position.status}</span>
                      {BigInt(position.claimableWei) > 0n && (
                        <small>{mon(position.claimableWei)} claimable</small>
                      )}
                      {position.claimed && <small>Claimed</small>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
