import { z } from "zod";
import { AgentRole } from "@/domain/enums";

/**
 * Structured I/O contracts for the fleet agents. Every LLM output is validated
 * against these on the way out of the model (§8), so a malformed generation never
 * reaches the governance layer.
 */

// --- Planner ---------------------------------------------------------------
export const PlanTask = z.object({
  title: z.string().min(1),
  assignedRole: AgentRole,
  budgetCapKas: z.number().nonnegative(),
  rationale: z.string().min(1),
});
export type PlanTask = z.infer<typeof PlanTask>;

export const PlannerOutput = z.object({
  tasks: z.array(PlanTask).min(1),
  reserveMarginKas: z.number().nonnegative(),
  rationale: z.string().min(1),
});
export type PlannerOutput = z.infer<typeof PlannerOutput>;

// --- Recon -----------------------------------------------------------------
export const ReconOutput = z.object({
  endpoints: z.array(z.string().min(1)).min(1),
  technologies: z.array(z.string().min(1)),
  entryPoints: z.array(z.string().min(1)),
  summary: z.string().min(1),
});
export type ReconOutput = z.infer<typeof ReconOutput>;
