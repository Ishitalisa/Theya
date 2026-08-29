import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { portfolioByAddress } from "@/lib/agent-chain";

export async function GET(request: NextRequest) {
  const rawAddress = request.nextUrl.searchParams.get("address");
  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      { error: "A valid wallet address is required." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await portfolioByAddress(getAddress(rawAddress)), {
      headers: { "cache-control": "no-store" },
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? cause.message : "Could not load portfolio.",
      },
      { status: 500 },
    );
  }
}
