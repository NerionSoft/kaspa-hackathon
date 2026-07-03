<div align="center">

# ⛓️ Kaspa Mission Control

### The **on-chain governance layer** for autonomous AI agent teams.

*Agents coordinate only through immutable commitments published on Kaspa.*
**If it's not on the ledger, it didn't happen.**

<br/>

![Kaspa](https://img.shields.io/badge/Kaspa-testnet--10-49EACB?logo=kashflow&logoColor=black)
![Covenants](https://img.shields.io/badge/Covenants-P2SH_escrow-49EACB)
![Mastra](https://img.shields.io/badge/Mastra-agents-7C3AED)
![Venice.ai](https://img.shields.io/badge/Venice.ai-LLM-000000)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)

![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.60-2EAD33?logo=playwright&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-≥22.13-339933?logo=node.js&logoColor=white)

</div>

---

## 📑 Table of Contents

- [The pitch](#-the-pitch)
- [Why Kaspa](#-why-kaspa)
- [Quick start](#-quick-start)
- [Going fully on-chain](#-going-fully-on-chain-testnet-10)
- [Architecture](#-architecture)
- [Mission lifecycle](#-mission-lifecycle)
- [Governance rules](#-governance-rules-hardcoded)
- [Scripts](#-scripts)
- [Stack](#-stack)

---

## 🎯 The pitch

A team of autonomous AI agents goes off the rails fast: runaway budgets, high-risk actions
fired without oversight, and no reliable record of "who did what."

**Kaspa Mission Control** adds a **programmable governance layer** on top of the agent
framework. Agents coordinate their actions only by publishing **immutable commitments** to the
Kaspa ledger. Three invariants are **hardcoded** (never in prompts):

- 🔒 **Budget envelope** — no agent ever exceeds its on-chain budget.
- ✋ **Human-in-the-loop** — any budget increase or high-impact action suspends the workflow
  and requires human approval.
- 📜 **On-ledger coordination** — a transition doesn't "count" until its commitment is
  confirmed on Kaspa. **The Mission Ledger IS the audit trail.**

> **Demo:** an offensive-security audit — agents auditing an authorized target, every decision
> anchored on-chain, every unit of budget locked in a **covenant escrow**.

---

## 💎 Why Kaspa

Kaspa isn't just a place to drop hashes — its speed (sub-second blocks) and **covenants** make
it a real-time governance engine:

| Need | What Kaspa delivers |
|---|---|
| Tamper-proof traceability | Commitments confirmed in < 1s, replayable straight from the chain |
| Conditional budget | **Covenant P2SH escrow**: funds only release at settlement |
| Distributed coordination | Canonical on-ledger ordering, single source of truth |

> ✅ **Full covenant flow proven on testnet-10**: budget **locked** in a P2SH escrow, agent
> commitments confirmed, escrow **released** by an arbiter-signed spend — all as real Kaspa
> transactions, with clickable txids.

---

## 🚀 Quick start

By default everything runs **offline** on a simulated, deterministic ledger (`LEDGER=mock`) —
no key, no network connection required.

```bash
# Prerequisites: Node ≥ 22.13, pnpm 11

# 1. Install
pnpm install

# 2. Configure (defaults are fine for mock mode)
cp .env.example .env

# 3. Launch the UI
pnpm dev          # → http://localhost:3000
```

```bash
# See the governance engine in action (full workflow + R1 budget gate)
pnpm run-mission
```

---

## 🔗 Going fully on-chain (testnet-10)

```bash
# 1. Generate a throwaway test key
pnpm keygen

# 2. In .env:
#    LEDGER="kaspa"
#    KASPA_PRIVATE_KEY="…"   (or KASPA_MNEMONIC)

# 3. Fund the printed kaspatest: address via the faucet
#    → https://faucet-tn10.kaspanet.io

# 4. Write a real mission to the chain (lock escrow → commitments → release)
pnpm hello:mission
```

The script prints an explorer link for every transaction: genesis, covenant-escrow lock,
agent commitments, then escrow release at settlement.

> ⚠️ **Testnet only.** The app refuses mainnet by design. Never use a real key.

---

## 🏗️ Architecture

The heart of the project: a clean boundary between the **agent framework (swappable)** and the
**Kaspa governance layer (universal)**. Agents hold *zero* governance logic.

```mermaid
flowchart TD
    UI["🖥️ Next.js 16 · React 19<br/>Cockpit & Marketplace"]

    subgraph MASTRA["🤖 Agent framework — swappable"]
        WF["Mission Workflow<br/>· R1 / R2 / R3 hardcoded ·<br/>suspend / resume (HITL)"]
        AG["Agents · planner · recon<br/>(LLM via Venice.ai)"]
        TOOLS["Ledger Tools<br/>(read-only)"]
    end

    subgraph LEDGER["📜 Mission Ledger SDK — framework-agnostic"]
        BASE["BaseLedger<br/>chaining · budget · status"]
        MOCK["MockLedger<br/>offline · deterministic"]
        KASPA["KaspaLedger<br/>WASM SDK"]
        ESCROW["Covenant Escrow<br/>arbiter-signed P2SH"]
        IDX[("LedgerIndex<br/>reconstructible SQLite")]
    end

    CHAIN{{"⛓️ Kaspa testnet-10<br/>commitments + escrow"}}

    UI --> WF
    WF -->|orchestrates| AG
    AG -->|reads| TOOLS
    TOOLS --> BASE
    WF -->|writes via| BASE
    BASE --> MOCK
    BASE --> KASPA
    KASPA --> ESCROW
    BASE --> IDX
    KASPA --> CHAIN
    ESCROW --> CHAIN

    classDef kaspa fill:#49EACB,stroke:#0d9488,color:#000;
    class CHAIN,ESCROW,KASPA kaspa;
```

**The principle:** `src/mission-ledger/` knows nothing about Mastra; `src/mastra/tools/` is a
thin adapter exposing the ledger read-only. You can swap Mastra out without touching the
governance layer — *that's the universality argument.*

---

## 🔄 Mission lifecycle

```mermaid
sequenceDiagram
    participant H as 👤 Operator
    participant W as Workflow
    participant K as Kaspa
    participant A as Agents

    H->>W: Create a mission (budget)
    W->>K: Genesis + LOCK covenant escrow 🔒
    W->>A: Plan → recon
    A-->>W: Reserve budget
    alt Exceeds threshold (R1) / high-impact action (R2)
        W->>K: REQUEST_BUDGET (commitment)
        W--xH: ⏸️ SUSPEND — approval required
        H->>W: ✅ Approve
    end
    W->>K: Commitments confirmed (R3)
    A-->>W: Work complete
    W->>K: SETTLE + RELEASE escrow 🔓
    Note over K: Every decision is<br/>on-chain and verifiable
```

---

## 🛡️ Governance rules (hardcoded)

They live in **code** (`src/mastra/governance.ts`), never in prompts. Whatever the LLM emits,
the workflow enforces them.

| Rule | Invariant | Mechanism |
|---|---|---|
| **R1** | Budget envelope | Reservation > budget / cap / threshold → `REQUEST_BUDGET` + `suspend()` |
| **R2** | High-impact action | Listed action → `ApprovalRequest` + `suspend()` |
| **R3** | On-ledger ordering | `publishAndConfirm` waits for confirmation before proceeding |

---

## 📜 Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev UI (Next.js + Turbopack) |
| `pnpm run-mission` | End-to-end workflow: happy path **and** the R1 budget gate (suspend → approve → resume) |
| `pnpm hello:mission` | Real on-chain proof: mission + covenant escrow + commitments on testnet-10 |
| `pnpm ledger:demo` | Mission Ledger demo (mock): full chain + simulated escrow + settlement |
| `pnpm keygen` | Generate a throwaway testnet key/address |
| `pnpm test` · `pnpm test:e2e` | Unit tests (Vitest) · e2e (Playwright) |

---

## 🧱 Stack

**Frontend** — Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · Framer Motion · Recharts
**Agents** — Mastra (agents + durable workflows) · Venice.ai (LLM) · Zod 4
**On-chain** — Kaspa testnet-10 via WASM SDK · covenants / P2SH escrow · reconstructible SQLite (libsql) index
**Quality** — TypeScript 5 · Vitest · Playwright · ESLint · Prettier · Pino

---

<div align="center">

*Built for the Kaspa hackathon — "Build Programmable Agent Interactions with Kaspa."*

**⛓️ If it's not on the ledger, it didn't happen.**

</div>
