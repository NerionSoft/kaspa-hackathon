"use server";

import { redirect } from "next/navigation";
import { PostMissionInput } from "@/marketplace/contracts";
import { getMarketplace } from "@/marketplace/service";

export type PostMissionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Server Action for the post-mission form. Validates the submitted fields with
 * the shared `PostMissionInput` contract, persists via the marketplace, then
 * redirects to the new mission's detail page (where recruitment runs).
 */
export async function postMissionAction(
  _prev: PostMissionState,
  formData: FormData,
): Promise<PostMissionState> {
  const highImpactRaw = String(formData.get("highImpactActions") ?? "").trim();

  const candidate = {
    clientId: String(formData.get("clientId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    domain: String(formData.get("domain") ?? ""),
    objective: String(formData.get("objective") ?? "").trim(),
    target: String(formData.get("target") ?? "").trim(),
    budgetKas: num(formData.get("budgetKas")),
    deadline: String(formData.get("deadline") ?? ""),
    policy: {
      perAgentBudgetCapKas: num(formData.get("perAgentBudgetCapKas")),
      humanApprovalThresholdKas: num(formData.get("humanApprovalThresholdKas")),
      highImpactActions: highImpactRaw
        ? highImpactRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    },
  };

  const parsed = PostMissionInput.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const mission = await getMarketplace().postMission(parsed.data);

  // redirect throws — must be outside any try/catch.
  redirect(`/marketplace/missions/${mission.id}`);
}
