import { PortfolioView } from "@/components/portfolio-view";
import { CONTRACT_ADDRESS } from "@/lib/chain";

export default function PortfolioPage() {
  if (!CONTRACT_ADDRESS) {
    return (
      <main className="setup-shell">
        <p>THEYA / SETUP</p>
        <h1>Market contract is not configured.</h1>
        <span>Set a non-zero NEXT_PUBLIC_CONTRACT_ADDRESS to load portfolios.</span>
      </main>
    );
  }
  return <PortfolioView />;
}
