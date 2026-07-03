"use client";

import type { Domain } from "@/marketplace/contracts";

const DOMAIN_LABEL: Record<Domain, string> = {
  security: "Security",
  data: "Data",
  research: "Research",
  devops: "DevOps",
  finance: "Finance",
};

/** Domain pill. Uses a neutral/violet palette — teal is reserved for Kaspa. */
export function DomainBadge({ domain }: { domain: Domain }) {
  return <span className={`mkt-badge dom-${domain}`}>{DOMAIN_LABEL[domain]}</span>;
}

export default DomainBadge;
