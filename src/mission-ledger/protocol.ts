import { createHash } from "node:crypto";
import { z } from "zod";
import { Actor, CommitmentType } from "@/domain/enums";
import { LedgerProtocolError } from "./errors";

/**
 * The on-chain wire protocol for Mission Control.
 *
 * Every commitment is the `payload` of one Kaspa transaction: a compact JSON
 * object, UTF-8 encoded, prefixed with a magic + version so the indexer can
 * cheaply recognise and reconstruct mission logs from arbitrary chain data.
 *
 *   payload bytes = "mc1" + JSON.stringify(envelope)
 *
 * Keys are intentionally short to keep transactions tiny (~fractions of a cent).
 * Two envelope kinds share the frame:
 *   - k:"mission"     → a mission genesis (createMission)
 *   - k:"commitment"  → a single interaction (publishCommitment / settle)
 */

export const MAGIC = "mc";
export const PROTOCOL_VERSION = 1;
/** Byte prefix every Mission Control payload starts with, e.g. "mc1". */
export const PROTOCOL_PREFIX = `${MAGIC}${PROTOCOL_VERSION}`;

// --- Genesis (mission creation) envelope -----------------------------------
export const MissionGenesisEnvelope = z.object({
  v: z.literal(PROTOCOL_VERSION),
  k: z.literal("mission"),
  title: z.string().min(1),
  objective: z.string().min(1),
  target: z.string().min(1),
  budgetKas: z.number().nonnegative(),
  rules: z.string().min(1),
  policy: z.object({
    perAgentBudgetCapKas: z.number().nonnegative(),
    humanApprovalThresholdKas: z.number().nonnegative(),
    highImpactActions: z.array(z.string()),
  }),
  createdBy: Actor,
  ts: z.number().int(), // epoch ms stamped by the client
});
export type MissionGenesisEnvelope = z.infer<typeof MissionGenesisEnvelope>;

// --- Commitment envelope ---------------------------------------------------
export const CommitmentEnvelope = z.object({
  v: z.literal(PROTOCOL_VERSION),
  k: z.literal("commitment"),
  m: z.string().min(1), // missionId (the genesis txid)
  t: CommitmentType, // commitment type
  a: Actor, // actor
  s: z.number().int().nonnegative(), // seq (monotonic per mission)
  p: z.string().nullable(), // prev commitment id (logical chain)
  d: z.number(), // budgetDelta in KAS (negative = consumed)
  h: z.string().nullable().optional(), // proofHash (sha256 hex)
  r: z.string().min(1), // rationale (mandatory)
  b: z.record(z.string(), z.unknown()).optional(), // optional structured body
});
export type CommitmentEnvelope = z.infer<typeof CommitmentEnvelope>;

export const AnyEnvelope = z.discriminatedUnion("k", [
  MissionGenesisEnvelope,
  CommitmentEnvelope,
]);
export type AnyEnvelope = z.infer<typeof AnyEnvelope>;

// --- Encoding --------------------------------------------------------------

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: false });

/** Encode a validated envelope to the on-chain payload bytes. */
export function encodeEnvelope(envelope: AnyEnvelope): Uint8Array {
  const parsed = AnyEnvelope.parse(envelope);
  return textEncoder.encode(PROTOCOL_PREFIX + JSON.stringify(parsed));
}

/** Encode to a lowercase hex string (the form Kaspa REST returns / accepts). */
export function encodeEnvelopeHex(envelope: AnyEnvelope): string {
  return Buffer.from(encodeEnvelope(envelope)).toString("hex");
}

function toBytes(payload: Uint8Array | string): Uint8Array {
  if (typeof payload !== "string") return payload;
  // A Kaspa payload read from REST/RPC is hex; anything else, treat as utf-8.
  if (/^[0-9a-fA-F]*$/.test(payload) && payload.length % 2 === 0) {
    return new Uint8Array(Buffer.from(payload, "hex"));
  }
  return textEncoder.encode(payload);
}

/**
 * Try to decode a raw transaction payload as a Mission Control envelope.
 * Returns `null` for payloads that are not ours (wrong/absent magic) — this is
 * the fast path the indexer uses to skip unrelated chain traffic. Throws only
 * when the magic matches but the body is corrupt.
 */
export function tryDecodeEnvelope(payload: Uint8Array | string | null | undefined): AnyEnvelope | null {
  if (payload == null) return null;
  const bytes = toBytes(payload);
  if (bytes.length < PROTOCOL_PREFIX.length) return null;

  const text = textDecoder.decode(bytes);
  if (!text.startsWith(PROTOCOL_PREFIX)) return null;

  const json = text.slice(PROTOCOL_PREFIX.length);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new LedgerProtocolError("Mission Control payload has a malformed JSON body", {
      sample: json.slice(0, 120),
    });
  }
  const result = AnyEnvelope.safeParse(raw);
  if (!result.success) {
    throw new LedgerProtocolError("Mission Control payload failed schema validation", {
      issues: result.error.issues.slice(0, 5),
    });
  }
  return result.data;
}

/** sha256 hex digest — used to anchor off-chain artifacts on the ledger. */
export function sha256Hex(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
