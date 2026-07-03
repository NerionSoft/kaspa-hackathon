"use client";

import Link from "next/link";
import type { Domain, MissionRequestStatus } from "@/marketplace/contracts";
import { DomainBadge } from "./DomainBadge";

const STATUS_LABEL: Record<MissionRequestStatus, string> = {
  open: "Open",
  recruiting: "Recruiting",
  assigned: "Assigned",
  running: "Running",
  completed: "Completed",
  aborted: "Aborted",
};

export interface MissionCardProps {
  id: string;
  title: string;
  domain: Domain;
  status: MissionRequestStatus;
  budgetKas: number;
  deadline: string;
  clientName: string;
  clientOrg: string;
  clientInitials: string;
}

/** A posted mission (demand side). Links to its detail route. */
export function MissionCard(props: MissionCardProps) {
  const { id, title, domain, status, budgetKas, deadline, clientName, clientOrg, clientInitials } =
    props;

  return (
    <Link href={`/marketplace/missions/${id}`} className="mkt-mcard">
      <div className="top">
        <div className="client">
          <span className="avatar">{clientInitials}</span>
          <span className="who">
            <span className="nm">{clientName}</span>
            <span className="org">{clientOrg}</span>
          </span>
        </div>
        <span className={`mkt-status s-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <h3>{title}</h3>

      <div className="row">
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <DomainBadge domain={domain} />
          <span className="mkt-budget num">{budgetKas} KAS</span>
        </span>
        <span className="deadline">
          due <b>{deadline}</b>
        </span>
      </div>
    </Link>
  );
}

export default MissionCard;
