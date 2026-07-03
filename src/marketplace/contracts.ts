import { z } from "zod";

/**
 * Agent Marketplace — shared contracts.
 *
 * The universality layer on top of the Mission Ledger: teams of agents
 * (orchestrator + workers) REGISTER their capabilities and are RECRUITED per
 * mission, in any domain. Because every mission's commitments are on-chain, a
 * team's reputation is verifiable rather than self-reported — that provable track
 * record is what makes a trustless agent marketplace possible.
 *
 * This file is the single source of truth for every marketplace module. Do not
 * duplicate these shapes elsewhere — import them.
 */

export const Domain = z.enum(["security", "data", "research", "devops", "finance"]);
export type Domain = z.infer<typeof Domain>;

export const ModelTier = z.enum(["$", "$$", "$$$"]);
export type ModelTier = z.infer<typeof ModelTier>;

/** A model an orchestrator can assign to a worker, with a coarse cost tier. */
export const ModelInfo = z.object({
  id: z.string(), // e.g. "llama-3.1-8b", "venice-uncensored"
  label: z.string(),
  tier: ModelTier,
  strengths: z.array(z.string()).default([]),
});
export type ModelInfo = z.infer<typeof ModelInfo>;

/** One entry in the role catalog the orchestrator selects from. */
export const RoleCatalogEntry = z.object({
  key: z.string(), // e.g. "web-scanner"
  name: z.string(), // e.g. "Web-app scanner"
  domain: Domain,
  description: z.string(),
  suggestedTier: ModelTier,
  typicalBudgetKas: z.number().nonnegative(),
  /** Actions this role may attempt that require a human gate (e.g. "active_exploit"). */
  highImpact: z.array(z.string()).default([]),
});
export type RoleCatalogEntry = z.infer<typeof RoleCatalogEntry>;

/** Reputation derived from a team's on-chain mission history. */
export const Reputation = z.object({
  missionsCompleted: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1), // completed (not aborted) / total
  budgetAdherence: z.number().min(0).max(1), // stayed within allocation
  humanApprovalRate: z.number().min(0).max(1), // fraction of actions escalated to a human
  rating: z.number().min(0).max(5), // ★ derived from the above
});
export type Reputation = z.infer<typeof Reputation>;

/** A registered team (supply side). */
export const AgentTeam = z.object({
  id: z.string(),
  name: z.string(),
  domains: z.array(Domain).min(1),
  description: z.string(),
  orchestratorModel: z.string(),
  /** Catalog role keys this team can staff. */
  roles: z.array(z.string()).min(1),
  /** Preferred model per role key. */
  workerModels: z.record(z.string(), z.string()).default({}),
  priceKasPerMission: z.number().nonnegative(),
  reputation: Reputation,
  registeredTxid: z.string().nullable().default(null), // on-chain registration commitment
  tags: z.array(z.string()).default([]),
});
export type AgentTeam = z.infer<typeof AgentTeam>;

/** A requester (demand side) who posts missions with a budget. */
export const Client = z.object({
  id: z.string(),
  name: z.string(),
  org: z.string(),
  initials: z.string(), // avatar fallback
});
export type Client = z.infer<typeof Client>;

export const MissionPolicy = z.object({
  perAgentBudgetCapKas: z.number().nonnegative(),
  humanApprovalThresholdKas: z.number().nonnegative(),
  highImpactActions: z.array(z.string()).default([]),
});
export type MissionPolicy = z.infer<typeof MissionPolicy>;

export const MissionRequestStatus = z.enum([
  "open", // posted, awaiting recruitment
  "recruiting",
  "assigned",
  "running",
  "completed",
  "aborted",
]);
export type MissionRequestStatus = z.infer<typeof MissionRequestStatus>;

/** A posted mission with a budget (demand side). */
export const MissionRequest = z.object({
  id: z.string(),
  clientId: z.string(),
  title: z.string(),
  domain: Domain,
  objective: z.string(),
  target: z.string(),
  budgetKas: z.number().positive(),
  deadline: z.string(), // ISO date
  policy: MissionPolicy,
  status: MissionRequestStatus,
  assignedTeamId: z.string().nullable().default(null),
  createdAt: z.string(), // ISO
});
export type MissionRequest = z.infer<typeof MissionRequest>;

/** The orchestrator's recruitment result: team + costed, role/model/budget plan. */
export const RoleAssignment = z.object({
  roleKey: z.string(),
  roleName: z.string(),
  model: z.string(),
  tier: ModelTier,
  budgetKas: z.number().nonnegative(),
  rationale: z.string(),
});
export type RoleAssignment = z.infer<typeof RoleAssignment>;

export const RecruitmentPlan = z.object({
  missionRequestId: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  assignments: z.array(RoleAssignment),
  rejectedRoles: z.array(z.object({ key: z.string(), name: z.string(), reason: z.string() })),
  totalAllocatedKas: z.number().nonnegative(),
  reserveKas: z.number().nonnegative(),
  rationale: z.string(),
});
export type RecruitmentPlan = z.infer<typeof RecruitmentPlan>;

// --- Inputs ---------------------------------------------------------------

export const PostMissionInput = z.object({
  clientId: z.string(),
  title: z.string().min(1),
  domain: Domain,
  objective: z.string().min(1),
  target: z.string().min(1),
  budgetKas: z.number().positive(),
  deadline: z.string(),
  policy: MissionPolicy,
});
export type PostMissionInput = z.infer<typeof PostMissionInput>;

export const RegisterTeamInput = AgentTeam.omit({
  id: true,
  reputation: true,
  registeredTxid: true,
});
export type RegisterTeamInput = z.infer<typeof RegisterTeamInput>;

// --- Service contract ------------------------------------------------------

export interface Marketplace {
  listRoles(): RoleCatalogEntry[];
  listModels(): ModelInfo[];

  registerTeam(input: RegisterTeamInput): Promise<AgentTeam>;
  listTeams(filter?: { domain?: Domain }): Promise<AgentTeam[]>;
  getTeam(id: string): Promise<AgentTeam | null>;
  getReputation(teamId: string): Promise<Reputation | null>;

  postMission(input: PostMissionInput): Promise<MissionRequest>;
  listMissionRequests(filter?: { status?: MissionRequestStatus }): Promise<MissionRequest[]>;
  getMissionRequest(id: string): Promise<MissionRequest | null>;
  listClients(): Promise<Client[]>;

  /** Match a mission to the best-fit registered team and produce a costed plan. */
  recruit(missionRequestId: string): Promise<RecruitmentPlan>;
}
