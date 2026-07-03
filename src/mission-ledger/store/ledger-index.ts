import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { Commitment, Mission } from "@/domain/entities";
import type { OnchainStatus } from "@/domain/enums";

/**
 * Local, reconstructible index of the on-chain Mission Ledger (§2, §8).
 *
 * The Kaspa chain is the source of truth; this SQLite/libsql store is a durable,
 * queryable PROJECTION that the dashboard and SSE feed read. It can always be
 * rebuilt from the chain. Commitments are append-only at the code level — only
 * their on-chain status (pending→confirmed) may be updated; there is no delete.
 */
export class LedgerIndex {
  private readonly url: string;
  private client?: Client;
  private ready?: Promise<void>;

  constructor(url: string) {
    this.url = url;
  }

  private async ensureDir(): Promise<void> {
    const m = /^file:(.*)$/.exec(this.url);
    if (!m) return;
    const file = m[1].replace(/^\/\//, "");
    const dir = path.dirname(file);
    if (dir && dir !== ".") await mkdir(dir, { recursive: true });
  }

  async init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      await this.ensureDir();
      this.client = createClient({ url: this.url });
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS missions (
          id             TEXT PRIMARY KEY,
          title          TEXT NOT NULL,
          objective      TEXT NOT NULL,
          rules          TEXT NOT NULL,
          target         TEXT NOT NULL,
          budget_kas     REAL NOT NULL,
          status         TEXT NOT NULL,
          created_by     TEXT NOT NULL,
          create_txid    TEXT NOT NULL,
          budget_address TEXT NOT NULL,
          escrow_mode    TEXT NOT NULL DEFAULT 'simple',
          covenant_id    TEXT,
          created_at     TEXT NOT NULL
        )`);
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS commitments (
          id           TEXT PRIMARY KEY,
          mission_id   TEXT NOT NULL,
          seq          INTEGER NOT NULL,
          prev         TEXT,
          type         TEXT NOT NULL,
          actor        TEXT NOT NULL,
          budget_delta REAL NOT NULL,
          proof_hash   TEXT,
          rationale    TEXT NOT NULL,
          payload      TEXT NOT NULL,
          txid         TEXT,
          block_time   TEXT,
          onchain      TEXT NOT NULL,
          UNIQUE (mission_id, seq)
        )`);
      await this.client.execute(
        `CREATE INDEX IF NOT EXISTS idx_commitments_mission ON commitments (mission_id, seq)`,
      );
    })();
    return this.ready;
  }

  private db(): Client {
    if (!this.client) throw new Error("LedgerIndex.init() must be awaited before use");
    return this.client;
  }

  // --- Missions -------------------------------------------------------------

  async upsertMission(m: Mission): Promise<void> {
    await this.init();
    await this.db().execute({
      sql: `INSERT INTO missions
              (id, title, objective, rules, target, budget_kas, status, created_by,
               create_txid, budget_address, escrow_mode, covenant_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              status = excluded.status, budget_kas = excluded.budget_kas`,
      args: [
        m.id, m.title, m.objective, m.rules, m.target, m.budgetKas, m.status,
        m.createdBy, m.createTxid, m.budgetAddress, m.escrowMode, m.covenantId, m.createdAt,
      ],
    });
  }

  async getMission(id: string): Promise<Mission | null> {
    await this.init();
    const rs = await this.db().execute({ sql: `SELECT * FROM missions WHERE id = ?`, args: [id] });
    const row = rs.rows[0];
    return row ? rowToMission(row) : null;
  }

  async listMissions(): Promise<Mission[]> {
    await this.init();
    const rs = await this.db().execute(`SELECT * FROM missions ORDER BY created_at DESC`);
    return rs.rows.map(rowToMission);
  }

  // --- Commitments (append-only) -------------------------------------------

  async appendCommitment(c: Commitment): Promise<void> {
    await this.init();
    await this.db().execute({
      sql: `INSERT INTO commitments
              (id, mission_id, seq, prev, type, actor, budget_delta, proof_hash,
               rationale, payload, txid, block_time, onchain)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`,
      args: [
        c.id, c.missionId, c.seq, c.prev, c.type, c.actor, c.budgetDelta, c.proofHash,
        c.rationale, JSON.stringify(c.payload), c.txid, c.blockTime, c.onchain,
      ],
    });
  }

  /** The only mutation allowed on a commitment: reflect chain confirmation. */
  async updateCommitmentOnchain(
    id: string,
    patch: { onchain: OnchainStatus; txid?: string | null; blockTime?: string | null },
  ): Promise<void> {
    await this.init();
    await this.db().execute({
      sql: `UPDATE commitments
              SET onchain = ?,
                  txid = COALESCE(?, txid),
                  block_time = COALESCE(?, block_time)
            WHERE id = ?`,
      args: [patch.onchain, patch.txid ?? null, patch.blockTime ?? null, id],
    });
  }

  async getCommitments(missionId: string): Promise<Commitment[]> {
    await this.init();
    const rs = await this.db().execute({
      sql: `SELECT * FROM commitments WHERE mission_id = ? ORDER BY seq ASC`,
      args: [missionId],
    });
    return rs.rows.map(rowToCommitment);
  }

  /** Highest seq recorded for a mission, or null — used to rebuild the publish cursor. */
  async getMaxSeq(missionId: string): Promise<number | null> {
    await this.init();
    const rs = await this.db().execute({
      sql: `SELECT MAX(seq) AS maxSeq FROM commitments WHERE mission_id = ?`,
      args: [missionId],
    });
    const v = rs.rows[0]?.maxSeq;
    return v === null || v === undefined ? null : Number(v);
  }
}

// --- Row mappers (defensive: validate through the domain schema) ------------

type Row = Record<string, unknown>;

function rowToMission(r: Row): Mission {
  return Mission.parse({
    id: r.id,
    title: r.title,
    objective: r.objective,
    rules: r.rules,
    target: r.target,
    budgetKas: Number(r.budget_kas),
    spentKas: 0, // derived from commitments at read time, not stored
    status: r.status,
    createdBy: r.created_by,
    createTxid: r.create_txid,
    budgetAddress: r.budget_address,
    escrowMode: r.escrow_mode ?? "simple",
    covenantId: r.covenant_id ?? null,
    createdAt: r.created_at,
  });
}

function rowToCommitment(r: Row): Commitment {
  return Commitment.parse({
    id: r.id,
    missionId: r.mission_id,
    seq: Number(r.seq),
    prev: r.prev ?? null,
    type: r.type,
    actor: r.actor,
    budgetDelta: Number(r.budget_delta),
    proofHash: r.proof_hash ?? null,
    rationale: r.rationale,
    payload: JSON.parse(String(r.payload)),
    txid: r.txid ?? null,
    blockTime: r.block_time ?? null,
    onchain: r.onchain,
  });
}
