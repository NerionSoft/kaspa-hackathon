"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Client, Domain } from "@/marketplace/contracts";
import {
  postMissionAction,
  type PostMissionState,
} from "@/app/marketplace/post/actions";
import "./detail.css";

/**
 * Demand-side form: a client posts a mission with an objective, a budget and a
 * governance policy. Submits to the `postMissionAction` Server Action, which
 * validates with `PostMissionInput` and redirects to the new mission.
 */

const initialState: PostMissionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="det-btn" type="submit" disabled={pending}>
      {pending ? "Posting…" : "Post mission ▸"}
    </button>
  );
}

export function PostMissionForm({
  clients,
  domains,
}: {
  clients: Client[];
  domains: Domain[];
}) {
  const [state, formAction] = useActionState(postMissionAction, initialState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="det-form">
      {state.error ? <div className="det-err">{state.error}</div> : null}

      <div className="det-fieldrow">
        <div className="det-field">
          <label htmlFor="clientId">Client</label>
          <select id="clientId" name="clientId" defaultValue={clients[0]?.id ?? ""} required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.org}
              </option>
            ))}
          </select>
          {fe.clientId ? <span className="det-fielderr">{fe.clientId}</span> : null}
        </div>

        <div className="det-field">
          <label htmlFor="domain">Domain</label>
          <select id="domain" name="domain" defaultValue={domains[0] ?? ""} required>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {fe.domain ? <span className="det-fielderr">{fe.domain}</span> : null}
        </div>
      </div>

      <div className="det-field full">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="External attack-surface audit — staging"
        />
        {fe.title ? <span className="det-fielderr">{fe.title}</span> : null}
      </div>

      <div className="det-field full">
        <label htmlFor="objective">Objective</label>
        <textarea
          id="objective"
          name="objective"
          required
          placeholder="Map, scan, validate and report the attack surface. Active exploitation gated."
        />
        {fe.objective ? <span className="det-fielderr">{fe.objective}</span> : null}
      </div>

      <div className="det-fieldrow">
        <div className="det-field">
          <label htmlFor="target">Target</label>
          <input
            id="target"
            name="target"
            type="text"
            required
            placeholder="app.internal.staging"
          />
          {fe.target ? <span className="det-fielderr">{fe.target}</span> : null}
        </div>

        <div className="det-field kas">
          <label htmlFor="budgetKas">Budget (KAS)</label>
          <input
            id="budgetKas"
            name="budgetKas"
            type="number"
            min={1}
            step={0.1}
            defaultValue={12}
            required
          />
          {fe.budgetKas ? <span className="det-fielderr">{fe.budgetKas}</span> : null}
        </div>
      </div>

      <div className="det-fieldrow">
        <div className="det-field">
          <label htmlFor="deadline">Deadline</label>
          <input id="deadline" name="deadline" type="date" required />
          {fe.deadline ? <span className="det-fielderr">{fe.deadline}</span> : null}
        </div>
      </div>

      <div className="det-section-title">Governance policy</div>

      <div className="det-fieldrow">
        <div className="det-field kas">
          <label htmlFor="perAgentBudgetCapKas">Per-agent budget cap (KAS)</label>
          <input
            id="perAgentBudgetCapKas"
            name="perAgentBudgetCapKas"
            type="number"
            min={0}
            step={0.1}
            defaultValue={4}
            required
          />
          {fe["policy.perAgentBudgetCapKas"] ? (
            <span className="det-fielderr">{fe["policy.perAgentBudgetCapKas"]}</span>
          ) : null}
        </div>

        <div className="det-field kas">
          <label htmlFor="humanApprovalThresholdKas">Human-approval threshold (KAS)</label>
          <input
            id="humanApprovalThresholdKas"
            name="humanApprovalThresholdKas"
            type="number"
            min={0}
            step={0.1}
            defaultValue={3}
            required
          />
          {fe["policy.humanApprovalThresholdKas"] ? (
            <span className="det-fielderr">
              {fe["policy.humanApprovalThresholdKas"]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="det-field full">
        <label htmlFor="highImpactActions">High-impact actions (gated)</label>
        <input
          id="highImpactActions"
          name="highImpactActions"
          type="text"
          placeholder="active_exploit, prod_change"
        />
        <span className="hint">
          Comma-separated. These require an on-chain human approval before an
          agent may attempt them.
        </span>
      </div>

      <div className="det-form-foot">
        <SubmitButton />
        <span className="hint">
          Posting registers the mission on the ledger; the orchestrator recruits a
          team next.
        </span>
      </div>
    </form>
  );
}
