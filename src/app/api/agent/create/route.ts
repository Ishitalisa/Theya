import { NextResponse } from "next/server";

import { proposeMarkets } from "@/lib/agent";
import { publishMarket } from "@/lib/agent-chain";
import { isCronAuthorized } from "@/lib/cron";
import { fetchNews } from "@/lib/news";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const articles = await fetchNews(60);
    const proposals = await proposeMarkets(articles);
    const transactions: string[] = [];
    for (const proposal of proposals) {
      const hash = await publishMarket(proposal);
      if (hash) transactions.push(hash);
    }
    return NextResponse.json({
      created: transactions.length,
      skipped: proposals.length - transactions.length,
      transactions,
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Market creation failed.";
    return NextResponse.json({ error }, { status: 500 });
  }
}
