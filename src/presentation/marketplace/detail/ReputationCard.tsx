import type { Reputation } from "@/marketplace/contracts";
import "./detail.css";

/**
 * Reputation, framed as derived from a team's on-chain mission history rather
 * than self-reported. Renders the ★ rating plus the underlying metrics as
 * labelled percentage bars.
 */

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="stars" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rounded ? "on" : "off"}>
          ★
        </span>
      ))}
    </span>
  );
}

function Metric({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="det-metric">
      <div className="mrow">
        <span className="ml">{label}</span>
        <span className="mv">{pct(value)}</span>
      </div>
      <div className="track">
        <div
          className={warn ? "fill warnfill" : "fill"}
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function ReputationCard({
  reputation,
  registeredTxid,
}: {
  reputation: Reputation;
  registeredTxid?: string | null;
}) {
  return (
    <div className="det-card det-rep">
      <h2>Reputation · on-chain</h2>
      <div className="rep-top">
        <div>
          <Stars rating={reputation.rating} />
          <div className="rating">
            {reputation.rating.toFixed(1)}
            <small> / 5.0</small>
          </div>
        </div>
        <span
          className="onchain"
          aria-label={`${reputation.missionsCompleted} missions completed on-chain`}
        >
          {reputation.missionsCompleted} missions
        </span>
      </div>

      <Metric label="Success rate" value={reputation.successRate} />
      <Metric label="Budget adherence" value={reputation.budgetAdherence} />
      <Metric label="Human-approval rate" value={reputation.humanApprovalRate} warn />

      <p className="derived">
        Derived from this team&apos;s on-chain mission history — completed
        missions, budgets respected and the share of actions escalated to a
        human. Verifiable, not self-reported.
        {registeredTxid ? (
          <>
            {" "}
            Registered in tx <span className="det-mono">{registeredTxid}</span>.
          </>
        ) : null}
      </p>
    </div>
  );
}
