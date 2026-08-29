import { LiveDeck } from "@/components/live-deck";
import { latestMarkets } from "@/lib/agent-chain";
import { CONTRACT_ADDRESS } from "@/lib/chain";

export const revalidate = 300;

export default async function Home() {
  if (CONTRACT_ADDRESS) {
    const initialMarkets = await latestMarkets().catch(() => []);
    return <LiveDeck initialMarkets={initialMarkets} />;
  }
  return (
    <main className="setup-shell">
      <p>THEYA / SETUP</p>
      <h1>Market contract is not configured.</h1>
      <span>Set a non-zero NEXT_PUBLIC_CONTRACT_ADDRESS to load live AI markets.</span>
    </main>
  );
}
