"use server";

import { redirect } from "next/navigation";
import { nextHref } from "@/lib/nav";

export async function continueFromCompetitors(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "competitors") : `/plans/${planId}/dashboard`);
}
