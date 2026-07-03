import type { ModelInfo, RoleCatalogEntry } from "./contracts";

/**
 * The role & model catalogs the orchestrator selects from. The catalog is broad
 * and multi-domain on purpose — the point of the marketplace is that the same
 * governed layer serves any kind of agent team, security being one example.
 */

export const MODEL_CATALOG: ModelInfo[] = [
  { id: "llama-3.1-8b", label: "Llama 3.1 8B", tier: "$", strengths: ["fast", "cheap", "enumeration"] },
  { id: "qwen-2.5-coder", label: "Qwen 2.5 Coder", tier: "$$", strengths: ["code", "PoC", "payloads"] },
  { id: "venice-uncensored", label: "Venice Uncensored", tier: "$$", strengths: ["security", "uncensored"] },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", tier: "$$$", strengths: ["reasoning", "writing"] },
  { id: "gpt-oss-120b", label: "GPT-OSS 120B", tier: "$$$", strengths: ["deep reasoning", "synthesis"] },
];

export const ROLE_CATALOG: RoleCatalogEntry[] = [
  // --- security ---
  { key: "recon-osint", name: "Recon / OSINT", domain: "security", description: "Passive external footprinting.", suggestedTier: "$", typicalBudgetKas: 1.5, highImpact: [] },
  { key: "attack-surface", name: "Attack-surface mapper", domain: "security", description: "Map endpoints, tech & entry points (passive).", suggestedTier: "$", typicalBudgetKas: 2, highImpact: [] },
  { key: "web-scanner", name: "Web-app scanner", domain: "security", description: "Scan entry points, triage by severity.", suggestedTier: "$$", typicalBudgetKas: 3, highImpact: [] },
  { key: "network-scanner", name: "Network scanner", domain: "security", description: "Port/service sweep across a range.", suggestedTier: "$$", typicalBudgetKas: 4, highImpact: [] },
  { key: "auth-tester", name: "Auth tester", domain: "security", description: "Probe auth flows, tokens & sessions.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "injection", name: "Injection specialist", domain: "security", description: "Craft non-destructive PoC payloads.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "exploit-validator", name: "Exploit validator", domain: "security", description: "Confirm exploitability; active testing is gated.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: ["active_exploit"] },
  { key: "secrets-hunter", name: "Secrets hunter", domain: "security", description: "Hunt exposed keys, tokens & files.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "privesc", name: "Privilege escalation", domain: "security", description: "Assess escalation paths (needs host access).", suggestedTier: "$$", typicalBudgetKas: 3, highImpact: ["privilege_escalation"] },
  { key: "compliance", name: "Compliance checker", domain: "security", description: "Check controls against a baseline.", suggestedTier: "$$", typicalBudgetKas: 3, highImpact: [] },
  { key: "report-writer", name: "Report writer", domain: "security", description: "Compile the deliverable, cite on-chain proofs.", suggestedTier: "$$$", typicalBudgetKas: 1, highImpact: [] },
  // --- data ---
  { key: "data-ingest", name: "Data ingester", domain: "data", description: "Pull & normalize source data.", suggestedTier: "$", typicalBudgetKas: 2, highImpact: [] },
  { key: "data-validator", name: "Data validator", domain: "data", description: "Schema, integrity & quality checks.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "dedupe", name: "Deduplicator", domain: "data", description: "Entity resolution & dedup.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "data-report", name: "Data reporter", domain: "data", description: "QA report anchored on proofs.", suggestedTier: "$$$", typicalBudgetKas: 1, highImpact: [] },
  // --- research ---
  { key: "searcher", name: "Searcher", domain: "research", description: "Multi-source search & retrieval.", suggestedTier: "$", typicalBudgetKas: 1.5, highImpact: [] },
  { key: "reader", name: "Reader", domain: "research", description: "Deep-read & extract claims.", suggestedTier: "$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "synthesizer", name: "Synthesizer", domain: "research", description: "Cross-source synthesis.", suggestedTier: "$$$", typicalBudgetKas: 2, highImpact: [] },
  { key: "citation-checker", name: "Citation checker", domain: "research", description: "Adversarially verify claims & cite.", suggestedTier: "$$", typicalBudgetKas: 1, highImpact: [] },
  // --- devops ---
  { key: "incident-triage", name: "Incident triage", domain: "devops", description: "Classify & prioritize incidents.", suggestedTier: "$", typicalBudgetKas: 2, highImpact: [] },
  { key: "diagnoser", name: "Diagnoser", domain: "devops", description: "Root-cause analysis from telemetry.", suggestedTier: "$$", typicalBudgetKas: 4, highImpact: [] },
  { key: "remediator", name: "Remediator", domain: "devops", description: "Propose/apply fixes — prod changes are gated.", suggestedTier: "$$", typicalBudgetKas: 4, highImpact: ["prod_change"] },
  { key: "postmortem", name: "Postmortem writer", domain: "devops", description: "Incident report anchored on the timeline.", suggestedTier: "$$$", typicalBudgetKas: 2, highImpact: [] },
  // --- finance ---
  { key: "reconciler", name: "Reconciler", domain: "finance", description: "Match ledgers & flag breaks.", suggestedTier: "$$", typicalBudgetKas: 3, highImpact: [] },
  { key: "anomaly-detector", name: "Anomaly detector", domain: "finance", description: "Flag outliers & suspicious flows.", suggestedTier: "$$", typicalBudgetKas: 3, highImpact: [] },
  { key: "finance-report", name: "Finance reporter", domain: "finance", description: "Reconciliation report on-chain.", suggestedTier: "$$$", typicalBudgetKas: 2, highImpact: [] },
];

export function rolesForDomain(domain: RoleCatalogEntry["domain"]): RoleCatalogEntry[] {
  return ROLE_CATALOG.filter((r) => r.domain === domain);
}

export function roleByKey(key: string): RoleCatalogEntry | undefined {
  return ROLE_CATALOG.find((r) => r.key === key);
}

export function modelById(id: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
