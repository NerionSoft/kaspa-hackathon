import type { RecruitmentPlan } from "@/marketplace/contracts";
import { modelById } from "@/marketplace/catalog";
import "./detail.css";

/**
 * The orchestrator's recruitment result made concrete: the chosen team, the
 * costed role/model/budget assignments, the roles it ruled out (with reasons)
 * and the allocation totals.
 */

function modelLabel(id: string): string {
  return modelById(id)?.label ?? id;
}

export function RecruitmentView({
  plan,
  teamRating,
}: {
  plan: RecruitmentPlan;
  teamRating: number;
}) {
  return (
    <div className="det-card">
      <h2>Recruitment · orchestrator plan</h2>

      <div className="det-chosen">
        <div>
          <div className="ck">Recruited team</div>
          <div className="cname">{plan.teamName}</div>
        </div>
        <div className="cright">
          <div className="crep-lbl">on-chain rating</div>
          <div className="crep">★ {teamRating.toFixed(1)}</div>
        </div>
      </div>

      <div className="det-tablescroll">
        <table className="det-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Model</th>
              <th>Tier</th>
              <th style={{ textAlign: "right" }}>Budget</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            {plan.assignments.map((a) => (
              <tr key={a.roleKey}>
                <td>
                  <span className="rname">{a.roleName}</span>
                </td>
                <td>
                  <span className="det-model">{modelLabel(a.model)}</span>
                </td>
                <td>
                  <span className="det-tier">{a.tier}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="det-kas">{a.budgetKas.toFixed(1)} KAS</span>
                </td>
                <td>
                  <span className="rdesc">{a.rationale}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="det-alloc">
        <div className="a">
          <span className="det-label">Allocated to roles</span>
          <span className="av teal">{plan.totalAllocatedKas.toFixed(1)} KAS</span>
        </div>
        <div className="a">
          <span className="det-label">Reserve</span>
          <span className="av reserve">{plan.reserveKas.toFixed(1)} KAS</span>
        </div>
        <div className="a">
          <span className="det-label">Roles staffed</span>
          <span className="av">{plan.assignments.length}</span>
        </div>
      </div>

      <p className="det-rationale">{plan.rationale}</p>

      {plan.rejectedRoles.length > 0 ? (
        <>
          <div className="det-label" style={{ margin: "16px 0 6px" }}>
            Ruled out for this mission
          </div>
          <div className="det-rejected">
            {plan.rejectedRoles.map((r) => (
              <div className="rj" key={r.key}>
                <span className="rjn">{r.name}</span>
                <span className="rjr">{r.reason}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
