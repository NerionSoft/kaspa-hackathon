import Link from "next/link";
import { Domain } from "@/marketplace/contracts";
import { getMarketplace } from "@/marketplace/service";
import { PostMissionForm } from "@/presentation/marketplace/detail/PostMissionForm";
import "@/presentation/marketplace/detail/detail.css";

export default async function PostMissionPage() {
  const clients = await getMarketplace().listClients();

  return (
    <div className="det-page">
      <Link href="/marketplace" className="det-back">
        ◀ Marketplace
      </Link>

      <header className="det-head">
        <span className="det-label">Demand · post a mission</span>
        <h1>Post a mission</h1>
        <p className="det-sub">
          Describe the objective, set a budget and the governance rules. On
          submit the mission is registered and the orchestrator recruits a
          best-fit team — any domain, one governed layer.
        </p>
      </header>

      <div className="det-card">
        <PostMissionForm clients={clients} domains={Domain.options} />
      </div>
    </div>
  );
}
