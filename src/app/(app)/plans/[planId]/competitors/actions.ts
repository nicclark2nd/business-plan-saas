"use server";

import { redirect } from "next/navigation";

export async function continueFromCompetitors(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/swot` : `/plans/${planId}/dashboard`);
}
