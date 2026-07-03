import type { MissionSpecInput } from "@/mission-ledger/types";
import type { PlannerOutput, ReconOutput } from "../schemas";

/**
 * Reference mission + deterministic agent outputs (§7).
 *
 * The engine is real, but recon/scan outputs are pre-written so the scripted demo
 * is reproducible and never loops on the LLM live on stage. Target is the bundled,
 * authorized OWASP Juice Shop instance.
 */

export const AUTHORIZED_TARGET = "juice-shop.internal.staging";

export const referenceMissionSpec = {
  title: "Q3 external attack-surface audit — Juice Shop (staging)",
  objective:
    "Authorized security audit of the staging OWASP Juice Shop instance: map the attack " +
    "surface, identify and validate vulnerabilities, and produce an audit report. " +
    "Passive recon and non-destructive validation only.",
  target: AUTHORIZED_TARGET,
  budgetKas: 12,
  rules:
    "Passive recon and non-destructive validation only. Active exploitation requires " +
    "explicit human approval. Per-agent reservations are capped at 4 KAS; any single " +
    "reservation above 3 KAS requires the operator's approval.",
  policy: {
    perAgentBudgetCapKas: 4,
    humanApprovalThresholdKas: 3,
    highImpactActions: ["active_exploit"],
  },
  createdBy: "user:sam",
} satisfies MissionSpecInput;

/** Deterministic planner output — a conservative, ordered plan with a reserve margin. */
export const plannerSeed: PlannerOutput = {
  tasks: [
    {
      title: "Map the attack surface of the authorized target",
      assignedRole: "recon",
      budgetCapKas: 2,
      rationale: "Passive enumeration of endpoints, tech stack and entry points.",
    },
    {
      title: "Scan entry points for vulnerabilities and triage by severity",
      assignedRole: "scanner",
      budgetCapKas: 3,
      rationale: "Highest-ROI scans first; scope adapts to remaining budget.",
    },
    {
      title: "Validate candidate findings (non-destructive PoC)",
      assignedRole: "exploit_validator",
      budgetCapKas: 2,
      rationale: "Confirm exploitability passively; active exploitation gated to human.",
    },
    {
      title: "Compile the audit report anchored on on-chain proofs",
      assignedRole: "report_generator",
      budgetCapKas: 1,
      rationale: "Every conclusion cites its finding and on-chain commitment.",
    },
  ],
  reserveMarginKas: 4,
  rationale:
    "Conservative allocation (8 KAS across tasks) leaves a 4 KAS reserve so a mid-mission " +
    "budget request can be absorbed without exhausting the envelope.",
};

/** Deterministic recon output — a realistic Juice Shop attack-surface map. */
export const reconSeed: ReconOutput = {
  endpoints: [
    "/rest/user/login",
    "/rest/products/search",
    "/api/Feedbacks",
    "/api/BasketItems",
    "/rest/user/whoami",
    "/ftp",
    "/rest/products/reviews",
    "/#/login",
    "/#/search",
  ],
  technologies: ["Node.js/Express", "Angular SPA", "SQLite (Sequelize)", "JWT auth", "nginx reverse proxy"],
  entryPoints: [
    "Login form (email/password)",
    "Product search query parameter",
    "Feedback submission (comment, rating)",
    "Product review body",
    "Basket item quantity",
    "File access under /ftp",
  ],
  summary:
    "Angular SPA over an Express/Sequelize REST API with JWT auth. Most promising entry " +
    "points for the scanner: the product search parameter (classic SQLi), the feedback and " +
    "review bodies (stored XSS), the login flow (auth bypass), and the exposed /ftp path " +
    "(sensitive file access).",
};

/** Deterministic findings for the demo (§7: findings pre-written, report is real Venice). */
export interface SeedFinding {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  owaspRef: string;
  evidence: string;
}
export const findingsSeed: SeedFinding[] = [
  { severity: "critical", title: "SQL injection via product search parameter", owaspRef: "A03:2021", evidence: "/rest/products/search?q=' OR 1=1-- returns full catalog" },
  { severity: "critical", title: "Sensitive files exposed under /ftp", owaspRef: "A05:2021", evidence: "/ftp directory listing exposes backups and confidential docs" },
  { severity: "high", title: "Broken authentication — JWT 'none' algorithm accepted", owaspRef: "A07:2021", evidence: "/rest/user/login accepts unsigned tokens with alg=none" },
  { severity: "high", title: "IDOR on basket items", owaspRef: "A01:2021", evidence: "/api/BasketItems/{id} readable across users" },
  { severity: "medium", title: "Stored XSS in feedback comment", owaspRef: "A03:2021", evidence: "/api/Feedbacks persists <script> payloads rendered to admins" },
];

/** Fallback report markdown (used when Venice is unavailable). */
export const reportSeed = `# Security Audit — juice-shop.internal.staging

## Executive summary
An authorized, agent-driven audit identified **2 critical** and **2 high** severity issues on the staging web application, alongside lower-severity hygiene gaps. Overall risk is **high** pending remediation of the injection and exposed-file findings.

## Severity overview
- 2 critical
- 2 high
- 1 medium

## Key findings
- **SQL injection via product search parameter** — critical (A03:2021). Evidence: \`/rest/products/search\` is injectable. Remediation: parameterize queries / use the ORM safely.
- **Sensitive files exposed under /ftp** — critical (A05:2021). Remediation: remove directory listing and restrict access.
- **Broken authentication — JWT 'none'** — high (A07:2021). Remediation: reject unsigned tokens; pin the algorithm.
- **IDOR on basket items** — high (A01:2021). Remediation: enforce per-user authorization on object access.
- **Stored XSS in feedback comment** — medium (A03:2021). Remediation: output-encode and sanitize stored content.

## Methodology & governance
Passive recon and non-destructive validation only. Every step — task claims, budget reservations, proofs, and any human authorization — was published as an immutable commitment on the Kaspa Mission Ledger, giving a tamper-evident audit trail. Budget was held in a covenant escrow and released at settlement.
`;
