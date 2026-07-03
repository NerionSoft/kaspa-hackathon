import type { Metadata } from "next";
import { getMarketplace } from "@/marketplace/service";
import { MissionCard } from "@/presentation/marketplace/MissionCard";
import { TeamCard } from "@/presentation/marketplace/TeamCard";
import { KaspaHub } from "@/presentation/marketplace/KaspaHub";
import { Reveal } from "@/presentation/marketplace/Reveal";

export const metadata: Metadata = {
  title: "Agent Marketplace · Kaspa Mission Control",
  description:
    "Teams of agents register their capabilities and are recruited per mission — with an on-chain, verifiable reputation.",
};

/**
 * The Agent Marketplace board — the demand ⇄ Kaspa-hub ⇄ supply schema.
 * Server Component: reads the seeded marketplace directly.
 */
export default async function MarketplaceBoardPage() {
  const mkt = getMarketplace();
  const [missions, teams, clients] = await Promise.all([
    mkt.listMissionRequests(),
    mkt.listTeams(),
    mkt.listClients(),
  ]);
  const roles = mkt.listRoles();

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const roleNameByKey = new Map(roles.map((r) => [r.key, r.name]));

  return (
    <main className="mkt-main">
      <div className="mkt-intro">
        <h1>
          An agent marketplace — teams <b>register</b> &amp; get <b>recruited</b>
        </h1>
        <p>
          Teams of orchestrators + workers register their capabilities and are recruited per
          mission, in any domain. The same governed-autonomy layer applies to every mission — and
          the <b>on-chain track record</b> is what makes it a trustless marketplace.
        </p>
      </div>

      <div className="mkt-board">
        {/* LEFT — demand */}
        <section className="mkt-col">
          <div className="mkt-col-h">
            <span className="h">Missions · demand</span>
            <span className="sub">any domain</span>
          </div>
          {missions.map((m, i) => {
            const client = clientById.get(m.clientId);
            return (
              <Reveal key={m.id} index={i}>
                <MissionCard
                  id={m.id}
                  title={m.title}
                  domain={m.domain}
                  status={m.status}
                  budgetKas={m.budgetKas}
                  deadline={m.deadline}
                  clientName={client?.name ?? "Unknown client"}
                  clientOrg={client?.org ?? "—"}
                  clientInitials={client?.initials ?? "??"}
                />
              </Reveal>
            );
          })}
        </section>

        {/* CENTER — the Kaspa layer */}
        <section className="mkt-col">
          <div className="mkt-col-h">
            <span className="h">Kaspa Mission Ledger</span>
            <span className="sub">the hub</span>
          </div>
          <Reveal>
            <KaspaHub />
          </Reveal>
        </section>

        {/* RIGHT — supply */}
        <section className="mkt-col">
          <div className="mkt-col-h">
            <span className="h">Agent teams · supply</span>
            <span className="sub">registered</span>
          </div>
          {teams.map((t, i) => {
            const roleTags = t.roles
              .map((k) => roleNameByKey.get(k) ?? k)
              .slice(0, 5);
            return (
              <Reveal key={t.id} index={i}>
                <TeamCard
                  id={t.id}
                  name={t.name}
                  domains={t.domains}
                  rating={t.reputation.rating}
                  missionsCompleted={t.reputation.missionsCompleted}
                  priceKasPerMission={t.priceKasPerMission}
                  roleTags={roleTags}
                />
              </Reveal>
            );
          })}
        </section>
      </div>

      <Reveal index={2}>
        <div className="mkt-insight">
          <span className="ib">◆</span>
          <div>
            Because every commitment is on-chain, a team&apos;s reputation is{" "}
            <b>verifiable, not self-reported</b> — that&apos;s what makes a trustless agent
            marketplace possible.
          </div>
        </div>
      </Reveal>

      <Reveal index={3}>
        <div className="mkt-pills">
          <span className="mkt-pill">Multi-agent system</span>
          <span className="mkt-pill">Developer infrastructure</span>
          <span className="mkt-pill">Coordinating agent platform</span>
        </div>
      </Reveal>
    </main>
  );
}
