import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402 } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";
import { keccak256, toBytes, zeroAddress } from "viem";

import { resolveMarket, validateResolution } from "@/lib/agent";
import { marketById } from "@/lib/agent-chain";
import { fetchNews } from "@/lib/news";

const network = "eip155:10143";
const usdc = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const payTo = process.env.X402_PAY_TO_ADDRESS;
const server = new x402ResourceServer(
  new HTTPFacilitatorClient({
    url: "https://x402-facilitator.molandak.org",
  }),
).register(network, new ExactEvmScheme());

async function audit(request: NextRequest): Promise<NextResponse> {
  const rawId = request.nextUrl.searchParams.get("marketId");
  if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
    return NextResponse.json(
      { error: "A positive marketId query parameter is required." },
      { status: 400 },
    );
  }

  const market = await marketById(BigInt(rawId));
  if (!market) {
    return NextResponse.json({ error: "Market not found." }, { status: 404 });
  }
  if (market.closeAt > Date.now() / 1_000) {
    return NextResponse.json(
      { error: "Audit becomes available after market close." },
      { status: 409 },
    );
  }

  const evidence = await fetchNews(240);
  const decision = validateResolution(
    await resolveMarket(market, evidence),
    market,
    evidence,
  );
  return NextResponse.json({
    marketId: rawId,
    decision,
    auditHash: keccak256(toBytes(JSON.stringify(decision))),
    auditedAt: new Date().toISOString(),
  });
}

const paidAudit = withX402(
  audit,
  {
    accepts: {
      scheme: "exact",
      network,
      payTo: payTo ?? zeroAddress,
      price: {
        amount: "1000",
        asset: usdc,
        extra: { name: "USDC", version: "2" },
      },
      maxTimeoutSeconds: 120,
    },
    description: "Independent THEYA market evidence audit",
    mimeType: "application/json",
  },
  server,
);

export async function GET(request: NextRequest) {
  if (!payTo) {
    return NextResponse.json(
      { error: "x402 payment recipient is not configured." },
      { status: 503 },
    );
  }
  return paidAudit(request);
}
