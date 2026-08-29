import { NextResponse } from "next/server";

import { latestMarkets } from "@/lib/agent-chain";

export const revalidate = 15;

export async function GET() {
  try {
    const markets = await latestMarkets();
    return NextResponse.json(
      {
        markets: markets.map((market) => ({
          ...market,
          id: market.id.toString(),
        })),
      },
      {
        headers: {
          "cache-control": "public, s-maxage=15, stale-while-revalidate=60",
        },
      },
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Could not load markets." },
      { status: 503 },
    );
  }
}
