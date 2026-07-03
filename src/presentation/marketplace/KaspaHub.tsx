"use client";

/**
 * The central Kaspa Mission Ledger hub — the on-chain layer both sides connect
 * to. Demand posts missions into it; supply is recruited out of it. Teal here is
 * intentional: this IS the Kaspa / on-chain element.
 */
const CAPABILITIES = [
  "commitments",
  "shared budget",
  "human gates",
  "settlement",
  "on-chain reputation",
] as const;

export function KaspaHub() {
  return (
    <div className="mkt-hub">
      <div className="hk">The Kaspa layer</div>
      <div className="ht">Kaspa Mission Ledger</div>
      <div className="hs">domain-agnostic governance</div>
      <div className="hchips">
        {CAPABILITIES.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flowlbl">
        <span>posts mission</span>
        <span>recruits team</span>
      </div>
    </div>
  );
}

export default KaspaHub;
