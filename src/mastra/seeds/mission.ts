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
