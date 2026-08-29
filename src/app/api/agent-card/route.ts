import { ERC8004_IDENTITY_REGISTRY } from "@/lib/chain";

export async function GET(request: Request) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const agentId = process.env.NEXT_PUBLIC_AGENT_ID;
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const wallet = process.env.X402_PAY_TO_ADDRESS;

  return Response.json(
    {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "THEYA Evidence Resolver",
      description:
        "Resolver for same-day news prediction markets using allowlisted public evidence and conservative VOID outcomes.",
      image: `${origin}/icon-512.png`,
      services: [
        { name: "web", endpoint: origin },
        {
          name: "evidence-audit",
          endpoint: `${origin}/api/oracle/audit`,
          version: "x402-v2",
        },
        ...(contract
          ? [{ name: "market-contract", endpoint: `eip155:10143:${contract}` }]
          : []),
        ...(wallet ? [{ name: "wallet", endpoint: `eip155:10143:${wallet}` }] : []),
      ],
      x402Support: true,
      active: true,
      registrations: agentId
        ? [
            {
              agentId: Number(agentId),
              agentRegistry: `eip155:10143:${ERC8004_IDENTITY_REGISTRY}`,
            },
          ]
        : [],
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
