import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketplace } from "@/marketplace/service";
import { RecruitmentView } from "@/presentation/marketplace/detail/RecruitmentView";
import "@/presentation/marketplace/detail/detail.css";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mkt = getMarketplace();
  const mission = await mkt.getMissionRequest(id);
  if (!mission) notFound();

  const clients = await mkt.listClients();
  const client = clients.find((c) => c.id === mission.clientId);

  const plan = await mkt.recruit(mission.id);
  const recruitedRep = await mkt.getReputation(plan.teamId);

  return (
    <div className="det-page">
      <Link href="/marketplace" className="det-back">
        ◀ Marketplace
      </Link>

      <header className="det-head">
        <span className="det-label">Mission · demand</span>
        <h1>{mission.title}</h1>
        <p className="det-sub">{mission.objective}</p>
        <div className="det-badges">
          <span className="det-badge">{mission.domain}</span>
          <span className="det-badge">{mission.status}</span>
          {client ? (
            <span className="det-tag">
              {client.name} · {client.org}
            </span>
          ) : null}
        </div>
      </header>

      <div className="det-grid">
        <div>
          <RecruitmentView
            plan={plan}
            teamRating={recruitedRep?.rating ?? 0}
          />
        </div>
        <div>
          <div className="det-card">
            <h2>Mission brief</h2>
            <div className="det-kv">
              <div className="row">
                <span className="k">Client</span>
                <span className="v">{client ? client.name : mission.clientId}</span>
              </div>
              <div className="row">
                <span className="k">Domain</span>
                <span className="v">{mission.domain}</span>
              </div>
              <div className="row">
                <span className="k">Target</span>
                <span className="v mono">{mission.target}</span>
              </div>
              <div className="row">
                <span className="k">Budget</span>
                <span className="v mono teal det-kas">
                  {mission.budgetKas.toFixed(1)} KAS
                </span>
              </div>
              <div className="row">
                <span className="k">Deadline</span>
                <span className="v mono">{fmtDate(mission.deadline)}</span>
              </div>
              <div className="row">
                <span className="k">Status</span>
                <span className="v">{mission.status}</span>
              </div>
            </div>
          </div>

          <div className="det-card">
            <h2>Governance policy</h2>
            <div className="det-kv">
              <div className="row">
                <span className="k">Per-agent cap</span>
                <span className="v mono det-kas">
                  {mission.policy.perAgentBudgetCapKas.toFixed(1)} KAS
                </span>
              </div>
              <div className="row">
                <span className="k">Approval threshold</span>
                <span className="v mono det-kas">
                  {mission.policy.humanApprovalThresholdKas.toFixed(1)} KAS
                </span>
              </div>
              <div className="row">
                <span className="k">High-impact</span>
                <span className="v mono">
                  {mission.policy.highImpactActions.length > 0
                    ? mission.policy.highImpactActions.join(", ")
                    : "none"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
