"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setMode(mode: "guided" | "advanced", path: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ mode }).eq("id", user.id);
  revalidatePath(path);
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
  if (!businessName) return { error: "Give the business a name." };

  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .insert({ name: orgName || businessName, kind, country, currency, created_by: user.id })
    .select("id").single();
  if (orgErr) return { error: orgErr.message };

  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .insert({ organisation_id: org.id, business_name: businessName, created_by: user.id })
    .select("id").single();
  if (planErr) return { error: planErr.message };

  await supabase.from("plan_settings").update({ country, currency }).eq("plan_id", plan.id);
  await supabase.from("profiles").update({ default_organisation_id: org.id }).eq("id", user.id);
  redirect(`/plans/${plan.id}/dashboard`);
}
