import { NextResponse } from "next/server";

import { resolveMarket, validateResolution } from "@/lib/agent";
import { closedMarkets, publishResolution } from "@/lib/agent-chain";
import { isCronAuthorized } from "@/lib/cron";
import { fetchNews } from "@/lib/news";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [markets, evidence] = await Promise.all([
      closedMarkets(),
      fetchNews(240),
    ]);
    const decisions = await Promise.all(
      markets.map(async (market) => {
        const decision = await resolveMarket(market, evidence);
        return validateResolution(decision, market, evidence);
      }),
    );

    const settlements = [];
    for (let index = 0; index < markets.length; index += 1) {
      settlements.push({
        marketId: markets[index].id.toString(),
        outcome: decisions[index].outcome,
        transaction: await publishResolution(markets[index].id, decisions[index]),
      });
    }
    return NextResponse.json({ settled: settlements.length, settlements });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Resolution failed.";
    return NextResponse.json({ error }, { status: 500 });
  }
}
