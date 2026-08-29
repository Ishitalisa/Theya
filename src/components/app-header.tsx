"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  current: "briefs" | "portfolio";
  categoryNav?: ReactNode;
  walletAction: ReactNode;
  onBrandClick?: () => void;
};

export function AppHeader({
  current,
  categoryNav,
  walletAction,
  onBrandClick,
}: Props) {
  return (
    <header className={`app-header ${categoryNav ? "" : "app-header-compact"}`}>
      <Link
        className="brand"
        href="/"
        aria-label="THEYA briefs"
        onClick={onBrandClick}
      >
        <Image src="/theya-mark.png" alt="" width={38} height={38} priority />
        <span>THEYA</span>
      </Link>
      <div className="header-navigation">
        <nav className="page-tabs" aria-label="Primary navigation">
          <Link href="/" aria-current={current === "briefs" ? "page" : undefined}>
            Briefs
          </Link>
          <Link
            href="/portfolio"
            aria-current={current === "portfolio" ? "page" : undefined}
          >
            Portfolio
          </Link>
        </nav>
        {categoryNav}
      </div>
      {walletAction}
    </header>
  );
}
