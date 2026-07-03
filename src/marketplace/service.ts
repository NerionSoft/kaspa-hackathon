import { MODEL_CATALOG, ROLE_CATALOG, modelById, roleByKey } from "./catalog";
import { PostMissionInput, RegisterTeamInput } from "./contracts";
import type {
  AgentTeam,
  Client,
  Marketplace,
  MissionRequest,
  MissionRequestStatus,
  RecruitmentPlan,
  Reputation,
  RoleAssignment,
  Domain,
} from "./contracts";
import { SEED_CLIENTS, SEED_MISSION_REQUESTS, SEED_TEAMS } from "./seeds";

/**
 * In-memory Agent Marketplace, seeded with example teams and mission requests.
 *
 * The recruit() logic is the orchestrator's value-add made concrete: given a
 * posted mission, pick the best-fit registered team, then select roles from the
 * catalog, assign the cheapest capable model to each, and allocate a cost-aware
 * budget with a reserve. Reputation stands in for a value derived from each
 * team's on-chain history.
 */
class InMemoryMarketplace implements Marketplace {
  private teams = new Map<string, AgentTeam>();
  private missions = new Map<string, MissionRequest>();
  private clients = new Map<string, Client>();
  private seq = 0;

  constructor() {
    SEED_TEAMS.forEach((t) => this.teams.set(t.id, t));
    SEED_MISSION_REQUESTS.forEach((m) => this.missions.set(m.id, m));
    SEED_CLIENTS.forEach((c) => this.clients.set(c.id, c));
  }

  listRoles() {
    return ROLE_CATALOG;
  }
  listModels() {
    return MODEL_CATALOG;
  }

  async registerTeam(input: RegisterTeamInput): Promise<AgentTeam> {
    const parsed = RegisterTeamInput.parse(input);
    const id = `team-${slug(parsed.name)}-${this.seq++}`;
    const team: AgentTeam = {
      ...parsed,
      id,
      // A freshly registered team starts with a neutral, unproven reputation.
      reputation: { missionsCompleted: 0, successRate: 0, budgetAdherence: 0, humanApprovalRate: 0, rating: 0 },
      registeredTxid: null,
    };
    this.teams.set(id, team);
    return team;
  }

  async listTeams(filter?: { domain?: Domain }): Promise<AgentTeam[]> {
    const all = [...this.teams.values()];
    const list = filter?.domain ? all.filter((t) => t.domains.includes(filter.domain!)) : all;
    return list.sort((a, b) => b.reputation.rating - a.reputation.rating);
  }
  async getTeam(id: string) {
    return this.teams.get(id) ?? null;
  }
  async getReputation(teamId: string): Promise<Reputation | null> {
    return this.teams.get(teamId)?.reputation ?? null;
  }

  async postMission(input: PostMissionInput): Promise<MissionRequest> {
    const parsed = PostMissionInput.parse(input);
    const id = `req-${slug(parsed.title)}-${this.seq++}`;
    const mission: MissionRequest = {
      ...parsed,
      id,
      status: "open",
      assignedTeamId: null,
      createdAt: new Date().toISOString(),
    };
    this.missions.set(id, mission);
    return mission;
  }

  async listMissionRequests(filter?: { status?: MissionRequestStatus }): Promise<MissionRequest[]> {
    const all = [...this.missions.values()];
    return filter?.status ? all.filter((m) => m.status === filter.status) : all;
  }
  async getMissionRequest(id: string) {
    return this.missions.get(id) ?? null;
  }
  async listClients() {
    return [...this.clients.values()];
  }

  async recruit(missionRequestId: string): Promise<RecruitmentPlan> {
    const mission = this.missions.get(missionRequestId);
    if (!mission) throw new Error(`mission request not found: ${missionRequestId}`);

    // 1. Pick the best-fit team: matches the domain, highest rating.
    const candidates = (await this.listTeams({ domain: mission.domain }));
    const team = candidates[0] ?? (await this.listTeams())[0];
    if (!team) throw new Error("no registered teams available");

    // 2. Select the team's roles for this domain (cap for a lean team).
    const domainRoleKeys = team.roles.filter((k) => roleByKey(k)?.domain === mission.domain);
    const chosenKeys = domainRoleKeys.slice(0, 6);

    // 3. Cost-aware budget: reserve ~20%, split the rest by each role's typical weight.
    const reserveKas = round(mission.budgetKas * 0.2);
    const allocatable = mission.budgetKas - reserveKas;
    const weights = chosenKeys.map((k) => roleByKey(k)?.typicalBudgetKas ?? 1);
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

    const assignments: RoleAssignment[] = chosenKeys.map((k, i) => {
      const role = roleByKey(k)!;
      const model = team.workerModels[k] ?? cheapestForTier(role.suggestedTier);
      const budgetKas = round((weights[i] / weightSum) * allocatable);
      return {
        roleKey: k,
        roleName: role.name,
        model,
        tier: modelById(model)?.tier ?? role.suggestedTier,
        budgetKas,
        rationale: role.description,
      };
    });

    // 4. Rejected roles for the domain (not staffed / not needed), with reasons.
    const rejectedRoles = ROLE_CATALOG.filter(
      (r) => r.domain === mission.domain && !chosenKeys.includes(r.key),
    ).map((r) => ({
      key: r.key,
      name: r.name,
      reason: team.roles.includes(r.key) ? "not required for this mission's scope" : "not staffed by this team",
    }));

    const totalAllocatedKas = round(assignments.reduce((a, x) => a + x.budgetKas, 0));

    return {
      missionRequestId,
      teamId: team.id,
      teamName: team.name,
      assignments,
      rejectedRoles,
      totalAllocatedKas,
      reserveKas: round(mission.budgetKas - totalAllocatedKas),
      rationale:
        `${team.name} (★${team.reputation.rating}) best fits a ${mission.domain} mission. ` +
        `${assignments.length} roles staffed, cheapest capable model each, ` +
        `${totalAllocatedKas} KAS allocated with a ${reserveKas} KAS reserve.`,
    };
  }
}

function cheapestForTier(tier: "$" | "$$" | "$$$"): string {
  return (MODEL_CATALOG.find((m) => m.tier === tier) ?? MODEL_CATALOG[0]).id;
}
function round(n: number): number {
  return Math.round(n * 10) / 10;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

let singleton: Marketplace | undefined;
/** Process-wide marketplace singleton (seeded). */
export function getMarketplace(): Marketplace {
  if (!singleton) singleton = new InMemoryMarketplace();
  return singleton;
}
