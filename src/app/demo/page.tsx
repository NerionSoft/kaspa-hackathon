"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./demo.css";

type Commitment = {
  id: string; seq: number; type: string; actor: string; budgetDelta: number;
  rationale: string; txid: string | null; onchain: "pending" | "confirmed" | "failed";
  explorerUrl: string | null;
};
type Mission = {
  id: string; title: string; target: string; budgetKas: number;
  escrowMode: "covenant" | "simple"; budgetAddress: string; covenantId: string | null; backend: string;
};
type Budget = { budgetKas: number; spentKas: number; remainingKas: number };
type Escrow = {
  mode: "covenant" | "simple"; escrowAddress: string; covenantId: string | null;
  lockTxid: string | null; releaseTxid: string | null; settled: boolean;
};

const AGENTS = ["planner", "recon", "scanner", "exploit_validator", "report_generator"] as const;
const AGENT_LABEL: Record<string, string> = {
  planner: "planner", recon: "recon", scanner: "scanner",
  exploit_validator: "validator", report_generator: "report",
};
const ICON: Record<string, string> = {
  planner: '<path d="M4 5h16M4 12h10M4 19h16"/>',
  recon: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  scanner: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/>',
  exploit_validator: '<path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
  report_generator: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13h6M10 17h6"/>',
};
const REST = "https://api-tn10.kaspa.org/transactions/";

export default function DemoPage() {
  const [mission, setMission] = useState<Mission | null>(null);
  const [commits, setCommits] = useState<Commitment[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [backend, setBackend] = useState("");
  const [running, setRunning] = useState(false);
  const [settling, setSettling] = useState(false);
  const byId = useRef<Map<string, Commitment>>(new Map());

  useEffect(() => {
    const es = new EventSource("/api/mission/latest/events");
    es.addEventListener("hello", (e) => setBackend(JSON.parse((e as MessageEvent).data).backend));
    es.addEventListener("mission", (e) => setMission(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("budget", (e) => setBudget(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("escrow", (e) => setEscrow(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("commitment", (e) => {
      const c: Commitment = JSON.parse((e as MessageEvent).data);
      byId.current.set(c.id, c);
      setCommits([...byId.current.values()].sort((a, b) => b.seq - a.seq));
    });
    return () => es.close();
  }, []);

  async function run() {
    setRunning(true);
    byId.current.clear();
    setCommits([]); setMission(null); setBudget(null); setEscrow(null);
    try { await fetch("/api/mission/run", { method: "POST" }); }
    finally { setTimeout(() => setRunning(false), 3000); }
  }
  async function settle() {
    setSettling(true);
    try { await fetch("/api/mission/settle", { method: "POST" }); }
    finally { setTimeout(() => setSettling(false), 4000); }
  }

  const lastActor = commits[0]?.actor?.replace("agent:", "");
  const acted = new Set(commits.map((c) => c.actor.replace("agent:", "")).filter((r) => r !== "user:sam"));
  const pct = budget ? Math.max(0, (budget.remainingKas / budget.budgetKas) * 100) : 100;
  const gaugeCls = pct <= 20 ? "gauge crit" : pct <= 45 ? "gauge low" : "gauge";
  const released = Boolean(escrow?.releaseTxid);
  const isCovenant = (escrow?.mode ?? mission?.escrowMode) === "covenant";

  return (
    <main className="demo">
      <div className="top">
        <span className="brand"><span className="dot" /><b>Kaspa Mission Control</b></span>
        {backend && <span className="backend">{backend === "kaspa" ? "kaspa · testnet-10 · LIVE" : "mock"}</span>}
        <div className="actions">
          <button className="runbtn" onClick={run} disabled={running}>{running ? "Starting…" : "▶ Run mission"}</button>
          <button className="settlebtn" onClick={settle} disabled={settling || !mission || released}>
            {released ? "✓ Settled" : settling ? "Releasing…" : "Settle & release escrow"}
          </button>
        </div>
      </div>

      <div className="card mission">
        <span className="label">Mission {mission ? "· running" : ""}</span>
        <h1>{mission?.title ?? "No mission yet — press Run"}</h1>
        {mission && (
          <div className="meta">
            <div><span className="label">Target</span><span className="v">{mission.target}</span></div>
            <div><span className="label">Budget</span><span className="v num">{mission.budgetKas} KAS</span></div>
            <div><span className="label">Mission id (genesis tx)</span><span className="v">{mission.id.slice(0, 20)}…</span></div>
          </div>
        )}
      </div>

      <div className="card pipeline" style={{ maxWidth: 1120, margin: "0 auto 14px" }}>
        <span className="label">Orchestrator · agent fleet</span>
        <div className="fleet" style={{ marginTop: 14 }}>
          <div className="track" />
          {AGENTS.map((a) => {
            const active = lastActor === a;
            const done = acted.has(a) && !active;
            return (
              <div key={a} className={`agent ${active ? "active" : done ? "done" : ""}`}>
                <div className="node" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24">${ICON[a]}</svg>` }} />
                <span className="role">{AGENT_LABEL[a]}</span>
                <span className="st">{active ? "working" : done ? "done" : "idle"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="chead">
            <span className="label"><span className="kdot" />Mission Ledger · Kaspa testnet</span>
            <span className="label num">{commits.length} tx</span>
          </div>
          {commits.length === 0 ? (
            <div className="empty">Commitments will stream here as real Kaspa transactions…</div>
          ) : (
            <div className="feed">
              <AnimatePresence initial={false}>
                {commits.map((c) => (
                  <motion.div
                    key={c.id} layout
                    initial={{ opacity: 0, y: -14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className={`commit ${c.onchain === "confirmed" ? "confirmed" : ""}`}
                  >
                    <span className="seq">#{c.seq}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="type">{c.type}</div>
                      <div className="sub"><b>{c.actor}</b> · {c.rationale}</div>
                    </div>
                    <div className="right">
                      <span className={`delta ${c.budgetDelta < 0 ? "spend" : "zero"}`}>
                        {c.budgetDelta < 0 ? c.budgetDelta.toFixed(1) : "0"} KAS
                      </span>
                      <span className="tx">
                        {c.txid ? (
                          <a href={c.explorerUrl ?? REST + c.txid} target="_blank" rel="noopener noreferrer">{c.txid.slice(0, 10)}…</a>
                        ) : (<span style={{ color: "var(--faint)" }}>—</span>)}
                        <span className={`chip ${c.onchain}`}>{c.onchain}</span>
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="rcol">
          {/* COVENANT ESCROW — the highlight */}
          <div className={`card covenant ${released ? "released" : "locked"}`}>
            <div className="chead">
              <span className="label" style={{ color: "var(--kaspa-ink)" }}>◆ Covenant budget escrow</span>
              <motion.span key={released ? "r" : "l"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`estate ${released ? "released" : "locked"}`}>
                {isCovenant ? (released ? "RELEASED" : "LOCKED") : "code-enforced"}
              </motion.span>
            </div>
            <div className="cov-body">
              <div className="lockwrap">
                <motion.svg viewBox="0 0 48 48" width="46" height="46" className="lockicon">
                  <motion.path
                    d="M15 22 V16 a9 9 0 0 1 18 0 V22"
                    fill="none" strokeWidth="3" strokeLinecap="round"
                    animate={released ? { y: -4, rotate: -18, x: 6 } : { y: 0, rotate: 0, x: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    style={{ originX: "15px", originY: "22px" }}
                  />
                  <rect x="11" y="22" width="26" height="18" rx="3" fill="currentColor" />
                </motion.svg>
                <div className="lockamt">
                  <div className="num big">{mission?.budgetKas ?? 0}<small> KAS</small></div>
                  <div className="label">{released ? "released to treasury" : "locked under covenant"}</div>
                </div>
              </div>
              <div className="cov-rows">
                <div className="cr"><span className="label">Escrow (P2SH)</span><span className="mono val">{escrow?.escrowAddress?.slice(0, 26) ?? mission?.budgetAddress?.slice(0, 26) ?? "—"}…</span></div>
                <div className="cr"><span className="label">Covenant id · KIP-20</span><span className="mono val">{(escrow?.covenantId ?? mission?.covenantId)?.slice(0, 22) ?? "—"}…</span></div>
                <div className="cr"><span className="label">Lock tx</span>
                  {escrow?.lockTxid && escrow.lockTxid !== "reconstructed"
                    ? <a className="mono val txlink" href={REST + escrow.lockTxid} target="_blank" rel="noopener noreferrer">{escrow.lockTxid.slice(0, 14)}…</a>
                    : <span className="mono val" style={{ color: "var(--faint)" }}>on-chain</span>}
                </div>
                <div className="cr"><span className="label">Release tx</span>
                  {escrow?.releaseTxid
                    ? <a className="mono val txlink" href={REST + escrow.releaseTxid} target="_blank" rel="noopener noreferrer">{escrow.releaseTxid.slice(0, 14)}…</a>
                    : <span className="mono val" style={{ color: "var(--faint)" }}>— awaiting settlement</span>}
                </div>
              </div>
              <div className="covnote">
                Budget is held in a <b>covenant-governed P2SH</b> on Kaspa. Only the human arbiter can
                release it — no agent moves the budget on its own. Lock &amp; release are real, verifiable txs.
              </div>
            </div>
          </div>

          {/* BUDGET */}
          <div className="card budget">
            <span className="label">Budget · cost control</span>
            <div className="big">
              {budget ? budget.remainingKas.toFixed(1) : mission?.budgetKas.toFixed(1) ?? "0.0"}
              <small> / {budget?.budgetKas ?? mission?.budgetKas ?? 0} KAS</small>
            </div>
            <div className={gaugeCls}><motion.i animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} /></div>
            <div className="brow">
              <span>spent {budget?.spentKas.toFixed(1) ?? "0.0"}</span>
              <span>{budget ? Math.round(pct) : 100}% left</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
