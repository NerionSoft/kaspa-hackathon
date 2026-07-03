import type { AgentTeam } from "@/marketplace/contracts";
import { modelById, roleByKey } from "@/marketplace/catalog";
import "./detail.css";

/**
 * Static profile of a registered team: orchestrator model, price, and the
 * catalog roles it staffs with the preferred model + cost tier per role.
 */

function modelLabel(id: string): string {
  return modelById(id)?.label ?? id;
}

export function TeamMeta({ team }: { team: AgentTeam }) {
  return (
    <>
      <div className="det-card">
        <h2>Team profile</h2>
        <div className="det-kv">
          <div className="row">
            <span className="k">Orchestrator</span>
            <span className="v mono">{modelLabel(team.orchestratorModel)}</span>
          </div>
          <div className="row">
            <span className="k">Domains</span>
            <span className="v">{team.domains.join(" · ")}</span>
          </div>
          <div className="row">
            <span className="k">Price / mission</span>
            <span className="v mono teal det-kas">{team.priceKasPerMission.toFixed(1)} KAS</span>
          </div>
          <div className="row">
            <span className="k">Roles staffed</span>
            <span className="v mono">{team.roles.length}</span>
          </div>
        </div>
      </div>

      <div className="det-card">
        <h2>Staffed roles · model per role</h2>
        <div className="det-tablescroll">
          <table className="det-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Model</th>
                <th>Tier</th>
                <th style={{ textAlign: "right" }}>Typical budget</th>
              </tr>
            </thead>
            <tbody>
              {team.roles.map((key) => {
                const role = roleByKey(key);
                const modelId = team.workerModels[key];
                const model = modelId ? modelById(modelId) : undefined;
                const tier = model?.tier ?? role?.suggestedTier ?? "$$";
                return (
                  <tr key={key}>
                    <td>
                      <div className="rname">{role?.name ?? key}</div>
                      {role?.description ? (
                        <div className="rdesc">{role.description}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className="det-model">
                        {modelId ? modelLabel(modelId) : "—"}
                      </span>
                    </td>
                    <td>
                      <span className="det-tier">{tier}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="det-kas">
                        {(role?.typicalBudgetKas ?? 0).toFixed(1)} KAS
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
