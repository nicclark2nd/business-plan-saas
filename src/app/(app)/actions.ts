"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentFinancialYear } from "@/engine/plan/calendar";

/**
 * Remember the view preference. Deliberately does NOT revalidate: Guided vs Advanced changes which items
 * the sidebar lists and nothing else, so throwing away the route to redraw identical figures cost about two
 * seconds a click. The switch itself is client state (ModeProvider); this only makes it stick (§6.22).
 */
export async function setMode(mode: "guided" | "advanced"): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("profiles").update({ mode }).eq("id", user.id);
  return !error;
}

export type SetupState = { error?: string } | undefined;

/** Setup wizard: creates the organisation (if needed) and the first plan. Triggers add the creator as admin/owner. */
export async function completeSetup(_: SetupState, formData: FormData): Promise<SetupState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kind = String(formData.get("kind") ?? "owner");
  const orgName = String(formData.get("org_name") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "AUD").trim();
  // The plan's financial calendar, stated at creation rather than left for Settings to be asked for later
  // (§6.33.2). plan_year is the cover year and defaults to the year of creation; it is not the calendar.
  const fyEndMonth = Math.min(12, Math.max(1, Math.trunc(Number(formData.get("financial_year_end_month"))) || 6));
  const firstProjected = Math.trunc(Number(formData.get("first_projected_year")));
  const firstProjectedYear = Number.isFinite(firstProjected) && firstProjected >= 1900 && firstProjected <= 2200
    ? firstProjected : currentFinancialYear(fyEndMonth);
  if (!businessName) return { error: "Give the business a name." };

  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .insert({ name: orgName || businessName, kind, country, currency, created_by: user.id })
    .select("id").single();
  if (orgErr) { console.error("create the organisation", orgErr); return { error: "Couldn't create the organisation. Try again." }; }

  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .insert({ organisation_id: org.id, business_name: businessName, created_by: user.id })
    .select("id").single();
  if (planErr) { console.error("create the plan", planErr); return { error: "Couldn't create the plan. Try again." }; }

  await supabase.from("plan_settings").update({ country, currency, financial_year_end_month: fyEndMonth, first_projected_year: firstProjectedYear }).eq("plan_id", plan.id);
  await supabase.from("profiles").update({ default_organisation_id: org.id }).eq("id", user.id);
  redirect(`/plans/${plan.id}/dashboard`);
}
