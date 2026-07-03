import type { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import { getLogger } from "@/infrastructure/logging/logger";
import { isLive } from "./model";

const logger = getLogger("Reason");

export type ReasoningSource = "venice" | "seed" | "seed-fallback";

export interface ReasoningResult<T> {
  output: T;
  source: ReasoningSource;
}

/**
 * Run an agent's open-ended reasoning, returning validated structured output.
 *
 * - Seeded mode (demo-safe default): return the deterministic seed — no network.
 * - Live mode: call Venice with a Zod-constrained structured output. On any LLM or
 *   validation failure, fall back gracefully to the seed (§8) rather than crashing.
 *
 * Either way the caller gets schema-valid data; the governance layer never sees a
 * malformed generation.
 */
export async function reason<T>(opts: {
  agent: Agent;
  label: string;
  prompt: string;
  schema: z.ZodType<T>;
  seed: T;
}): Promise<ReasoningResult<T>> {
  if (!isLive()) {
    return { output: opts.seed, source: "seed" };
  }

  try {
    const res = await opts.agent.generate(opts.prompt, {
      structuredOutput: { schema: opts.schema },
    });
    const parsed = opts.schema.safeParse(res.object);
    if (!parsed.success) {
      throw new Error(`output failed schema validation: ${parsed.error.issues[0]?.message}`);
    }
    logger.info("Agent reasoning via Venice", { agent: opts.label });
    return { output: parsed.data, source: "venice" };
  } catch (err) {
    logger.warn("Agent reasoning failed; falling back to seed", {
      agent: opts.label,
      error: err instanceof Error ? err.message : String(err),
    });
    return { output: opts.seed, source: "seed-fallback" };
  }
}
