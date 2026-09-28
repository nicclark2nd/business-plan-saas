"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPlan, readNewPlan } from "@/lib/createPlan";
import { loadMyFirm } from "@/lib/myFirm";
import { myBillingOrg, planLimitMessage } from "@/lib/billing";

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

/**
 * Setup (§6.182): a business owner's first plan, or a consultant's firm and first client.
 *
 * A CONSULTANT HAS ONE FIRM. This used to create a new organisation for every business set up, so a coach with
 * twenty clients had twenty firms and no list of clients. Now a consultant who already has a firm adds the
 * business to it, and lands on My Clients rather than inside the plan. An owner's plan is still its own
 * organisation — a business planning for itself has nobody else in it.
 */
export async function completeSetup(_: SetupState, formData: FormData): Promise<SetupState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kind = String(formData.get("kind") ?? "owner");
  const orgName = String(formData.get("org_name") ?? "").trim();
  const read = readNewPlan(formData);
  if ("error" in read) return { error: read.error };

  /*
   * ONE ORGANISATION EACH (§6.182, §6.185): a consultant's clients go into their firm, and an owner's second
   * business goes into their own organisation — so one subscription covers all of them, and "Set up another
   * business" cannot become a way round the plan allowance.
   */
  const existing = kind === "owner" ? null : await loadMyFirm();
  const ownOrg = kind === "owner" ? await myBillingOrg() : null;
  let orgId = existing?.id ?? (ownOrg?.kind === "owner" ? ownOrg.id : null);
  if (!orgId) {
    if (kind !== "owner" && !orgName) return { error: "Give your practice or firm a name." };
    const { data: org, error: orgErr } = await supabase
      .from("organisations")
      .insert({ name: orgName || read.businessName, kind, country: read.country, currency: read.currency, created_by: user.id })
      .select("id").single();
    if (orgErr || !org) { console.error("create the organisation", orgErr); return { error: "Couldn't create the organisation. Try again." }; }
    orgId = org.id as string;
  }

  const made = await createPlan(orgId, user.id, {
    ...read,
    /* NOT ASKED TWICE (§6.151): an owner gave the cover's email when they signed in; a consultant's is not the client's. */
    ownerEmail: kind === "owner" ? user.email ?? null : null,
    pageSize: existing?.defaultPageSize ?? null,
  });
  if ("error" in made) return { error: made.error === "limit" ? planLimitMessage(kind === "owner" ? "owner" : "firm") : made.error };
  await supabase.from("profiles").update({ default_organisation_id: orgId }).eq("id", user.id);
  redirect(kind === "owner" ? `/plans/${made.id}/dashboard` : `/firm/clients?client=${made.id}`);
}
