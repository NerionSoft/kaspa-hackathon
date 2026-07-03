import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketplace } from "@/marketplace/service";
import { ReputationCard } from "@/presentation/marketplace/detail/ReputationCard";
import { TeamMeta } from "@/presentation/marketplace/detail/TeamMeta";
import "@/presentation/marketplace/detail/detail.css";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await getMarketplace().getTeam(id);
  if (!team) notFound();

  return (
    <div className="det-page">
      <Link href="/marketplace" className="det-back">
        ◀ Marketplace
      </Link>

      <header className="det-head">
        <span className="det-label">Agent team · supply</span>
        <h1>{team.name}</h1>
        <p className="det-sub">{team.description}</p>
        <div className="det-badges">
          {team.domains.map((d) => (
            <span key={d} className="det-badge">
              {d}
            </span>
          ))}
          {team.tags.map((t) => (
            <span key={t} className="det-tag">
              {t}
            </span>
          ))}
        </div>
      </header>

      <div className="det-grid">
        <div>
          <TeamMeta team={team} />
        </div>
        <div>
          <ReputationCard
            reputation={team.reputation}
            registeredTxid={team.registeredTxid}
          />
        </div>
      </div>
    </div>
  );
}
