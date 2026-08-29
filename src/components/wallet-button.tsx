"use client";

import { useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

import { monadTestnet } from "@/lib/chain";

const short = (address: string) =>
  `${address.slice(0, 5)}…${address.slice(-4)}`;

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    try {
      if (!isConnected) {
        const connector = connectors[0];
        if (!connector) throw new Error("Install an EVM wallet to continue.");
        await connectAsync({ connector, chainId: monadTestnet.id });
      } else if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      } else {
        disconnect();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet request failed.");
    }
  }

  const label = !isConnected
    ? isPending
      ? "Connecting"
      : "Connect"
    : chainId !== monadTestnet.id
      ? isSwitching
        ? "Switching"
        : "Switch network"
      : short(address ?? "");

  return (
    <div className="wallet-wrap">
      <button
        className="wallet-button"
        type="button"
        onClick={handleClick}
        disabled={isPending || isSwitching}
        aria-describedby={error ? "wallet-error" : undefined}
      >
        <span className="status-dot" aria-hidden="true" />
        {label}
      </button>
      {error && (
        <span id="wallet-error" className="wallet-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
