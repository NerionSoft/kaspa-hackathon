import { env } from "@/infrastructure/config/env";

/**
 * Venice.ai via Mastra's model router (OpenAI-compatible endpoint).
 *
 * An uncensored Venice model is used deliberately: mainstream models refuse
 * offensive-security content, which would break an authorized audit demo. This
 * is a legitimate technical choice against an authorized target only.
 */
export function veniceModel() {
  return {
    id: `venice/${env.venice.model}` as `${string}/${string}`,
    url: env.venice.baseUrl,
    apiKey: env.venice.apiKey ?? "",
  };
}

export type AgentsMode = "live" | "seeded";

/**
 * Whether agents call Venice ("live") or return deterministic seeds ("seeded").
 *
 * Default is demo-safe: seeded (deterministic, offline, no key needed) unless
 * `AGENTS_MODE=live` is set AND a Venice key is configured. Seeded mode is also
 * what the scripted demo uses (§7) so the run is reproducible and never loops on
 * the LLM live on stage.
 */
export function agentsMode(): AgentsMode {
  if (process.env.AGENTS_MODE === "seeded") return "seeded";
  if (process.env.AGENTS_MODE === "live" && env.venice.apiKey) return "live";
  return env.venice.apiKey ? "live" : "seeded";
}

export function isLive(): boolean {
  return agentsMode() === "live";
}
