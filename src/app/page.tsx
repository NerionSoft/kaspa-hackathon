import Link from "next/link";
import { env } from "@/infrastructure/config/env";

/**
 * Placeholder landing for the socle (step 1). The real command-center cockpit
 * (F1/F2) lands in step 4. This just confirms the scaffold + active ledger backend.
 */
export default function HomePage() {
  const backend = env.LEDGER;
  const isKaspa = backend === "kaspa";

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: "var(--color-kaspa)", boxShadow: "0 0 10px var(--color-kaspa)" }}
        />
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          Kaspa Mission Control
        </span>
      </div>

      <div>
        <h1 className="text-3xl font-semibold text-[var(--color-text)]">
          Governance layer for autonomous agent teams
        </h1>
        <p className="mt-3 max-w-xl text-[var(--color-muted)]">
          Agents coordinate only through immutable commitments published on the Kaspa Mission
          Ledger. If it&apos;s not on the ledger, it didn&apos;t happen.
        </p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-muted)]">Ledger backend</span>
          <span
            className="font-mono text-sm"
            style={{ color: isKaspa ? "var(--color-kaspa)" : "var(--color-warn)" }}
          >
            {isKaspa ? "kaspa · testnet-10" : "mock · in-memory"}
          </span>
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          {isKaspa
            ? "Commitments really published on the Kaspa testnet (verifiable txids)."
            : "Simulated, deterministic, offline ledger — switch via LEDGER=kaspa in .env."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/showcase.html"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] px-4 py-2 font-mono text-sm font-semibold"
          style={{ background: "var(--color-kaspa)", color: "#05201b" }}
        >
          ▶ Guided demo
        </a>
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border px-4 py-2 font-mono text-sm"
          style={{ borderColor: "var(--color-kaspa)", color: "var(--color-kaspa)" }}
        >
          Live on-chain demo →
        </Link>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border px-4 py-2 font-mono text-sm"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}
        >
          Agent Marketplace →
        </Link>
      </div>
    </main>
  );
}
