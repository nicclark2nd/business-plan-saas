"use server";

import { redirect } from "next/navigation";
import { nextHref } from "@/lib/nav";

/** The assessment writes nothing yet (§6.164); continuing only moves the Planner along the path. */
export async function continueFromAssessment(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "assessment") : `/plans/${planId}/dashboard`);
}
