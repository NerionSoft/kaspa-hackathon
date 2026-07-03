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
          Les agents se coordonnent uniquement via des commitments immuables publiés sur le
          Mission Ledger Kaspa. Si ce n&apos;est pas sur le ledger, ça n&apos;a pas eu lieu.
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
            ? "Commitments réellement publiés sur le testnet Kaspa (txids vérifiables)."
            : "Ledger simulé, déterministe, hors-ligne — bascule via LEDGER=kaspa dans .env."}
        </p>
      </div>

      <p className="font-mono text-xs text-[var(--color-muted)]">
        Socle prêt · dashboard cockpit à venir (étape 4)
      </p>
    </main>
  );
}
