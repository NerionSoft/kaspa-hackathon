import type { ReactNode } from "react";
import Link from "next/link";
import "./marketplace-theme.css";

/**
 * Marketplace section layout. Establishes the LIGHT "SOC" theme (the global body
 * is dark) by wrapping every marketplace route in `.mkt`, which fully covers the
 * viewport. The header (brand + nav) is shared across the board and all nested
 * routes (teams / missions / post) that inherit this layout.
 */
export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mkt">
      <header className="mkt-header">
        <Link href="/marketplace" className="mkt-brand">
          <span className="dot" />
          <span>Kaspa Mission Control</span>
          <span className="sep">·</span>
          <span className="tag">Marketplace</span>
        </Link>
        <nav className="mkt-nav">
          <Link href="/marketplace">Board</Link>
          <Link href="/marketplace/post" className="primary">
            Post mission
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
