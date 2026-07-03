"use client";

import Link from "next/link";
import type { Domain } from "@/marketplace/contracts";
import { DomainBadge } from "./DomainBadge";

export interface TeamCardProps {
  id: string;
  name: string;
  domains: Domain[];
  rating: number;
  missionsCompleted: number;
  priceKasPerMission: number;
  roleTags: string[];
}

/** A registered agent team (supply side). Links to its detail route. */
export function TeamCard(props: TeamCardProps) {
  const { id, name, domains, rating, missionsCompleted, priceKasPerMission, roleTags } = props;

  return (
    <Link href={`/marketplace/teams/${id}`} className="mkt-tcard">
      <div className="tt">
        <b>{name}</b>
        <span className="rep">{"★"} {rating.toFixed(1)}</span>
      </div>

      <div className="doms">
        {domains.map((d) => (
          <DomainBadge key={d} domain={d} />
        ))}
      </div>

      <div className="tags">
        {roleTags.map((t) => (
          <span key={t} className="roletag">
            {t}
          </span>
        ))}
      </div>

      <div className="meta">
        <span className="oc num">{missionsCompleted} missions on-chain</span>
        <span className="price num">{priceKasPerMission} KAS/mission</span>
      </div>
    </Link>
  );
}

export default TeamCard;
