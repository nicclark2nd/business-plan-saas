"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseMonth } from "../people/model";
import type { Profile, Financial, Licence } from "./model";
import { serializeComponents } from "@/engine/plan/gst";

type Result = { ok: true; data?: { date_established: string | null } } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

export async function saveProfile(planId: string, p: Partial<Profile> & { established_text?: string }): Promise<Result> {
  const supabase = await createClient();
  const established = p.established_text !== undefined ? parseMonth(p.established_text) : p.date_established;
  if (established === undefined) return { ok: false, error: "Date established should be a month and year, e.g. Jun 1975." };
  const name = (p.business_name ?? "").trim();
  if (!name) return { ok: false, error: "The business needs a name." };
  // The cover year. A plan revised and reissued next March should be able to say so (§6.33.2).
  const year = Math.trunc(Number(p.plan_year));
  if (p.plan_year !== undefined && (!Number.isFinite(year) || year < 1900 || year > 2200)) {
    return { ok: false, error: "The plan year should be a four-digit year, e.g. 2026." };
  }
  const planYear = p.plan_year === undefined ? null : year;

  /**
   * Moving country takes the old country's taxes with it (§6.39.1). A plan switched from British Columbia
   * to Australia would otherwise keep charging a 7 % PST that Australia has never heard of — a stale answer
   * to a question the client has just changed. Clearing both sends it back to the new country's own regime,
   * which is then editable like any other default. Enforced here rather than on the screen, so it holds
   * whichever screen changes the country.
   */
  const country = p.country?.trim() || null;
  const { data: was } = await supabase.from("plan_settings").select("country").eq("plan_id", planId).maybeSingle();
  const movedCountry = p.country !== undefined && (was?.country ?? null) !== country;

  const [plans, settings] = await Promise.all([
    supabase.from("plans").update({ business_name: name, ...(planYear ? { plan_year: planYear } : {}) }).eq("id", planId),
    supabase.from("plan_settings").upsert({
      plan_id: planId,
      ...(movedCountry ? { tax_region: null, tax_components: [] } : {}),
      date_established: established ?? null,
      industry: p.industry?.trim() || null,
      country,
      legal_structure: p.legal_structure?.trim() || null,
      customer_type: p.customer_type?.trim() || null,
      product_type: p.product_type?.trim() || null,
    }, { onConflict: "plan_id" }),
  ]);
  const error = plans.error ?? settings.error;
  if (error) { console.error("profile", error); return { ok: false, error: `Couldn't save the profile: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { date_established: established ?? null } };
}

export async function saveFinancial(planId: string, f: Partial<Financial>): Promise<Result> {
  const supabase = await createClient();
  const month = Math.min(12, Math.max(1, Math.trunc(Number(f.financial_year_end_month)) || 6));
  const { error } = await supabase.from("plan_settings").upsert({
    plan_id: planId,
    financial_year_end_month: month,
    first_projected_year: f.first_projected_year ? Math.trunc(Number(f.first_projected_year)) : null,
    tax_rate: Math.max(0, Math.min(100, Number(f.tax_rate) || 0)),
    dividend_rate: Math.max(0, Math.min(100, Number(f.dividend_rate) || 0)),
    // Losses are never negative; accumulated earnings genuinely can be, and a deficit is the case that matters.
    opening_tax_losses: Math.max(0, Number(f.opening_tax_losses) || 0),
    opening_retained_earnings: Number(f.opening_retained_earnings) || 0,
    gst_registered: !!f.gst_registered,
    gst_rate: Math.max(0, Math.min(100, Number(f.gst_rate) || 0)),
    gst_frequency: f.gst_frequency === "monthly" || f.gst_frequency === "annually" ? f.gst_frequency : "quarterly",
    tax_region: (f.tax_region ?? "").trim() || null,
    // Cleaned on the way out as well as in, so nothing unreadable can reach the engine (§6.39).
    tax_components: serializeComponents(Array.isArray(f.tax_components) ? f.tax_components : []),
    currency: (f.currency || "AUD").toUpperCase().slice(0, 3),
  }, { onConflict: "plan_id" });
  if (error) { console.error("financial", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true };
}

/**
 * A licence row saves like every other list line (§6.10): on leaving the field, never on a Save button.
 * `expires_on` is passed straight through as an ISO date or null — the screen owns the date picker, and a
 * registration with no expiry is a real answer, so an empty string must land as null rather than as today.
 */
export async function saveLicence(planId: string, l: Partial<Licence> & { id?: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const name = (l.name ?? "").trim();
  if (!name) return { ok: false, error: "A licence needs a name \u2014 what is it, and what does it let the business do?" };
  const expires = (l.expires_on ?? "").trim();
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { ok: false, error: "The expiry should be a date." };
  const row = {
    plan_id: planId, name,
    number: (l.number ?? "").trim() || null,
    issuer: (l.issuer ?? "").trim() || null,
    expires_on: expires || null,
    sort_order: Math.trunc(Number(l.sort_order)) || 0,
  };
  const { data, error } = l.id
    ? await supabase.from("plan_licences").update(row).eq("id", l.id).eq("plan_id", planId).select("id").maybeSingle()
    : await supabase.from("plan_licences").insert(row).select("id").maybeSingle();
  if (error) { console.error("licence", error); return { ok: false, error: `Couldn't save the licence: ${error.message}` }; }
  /**
   * An update that RLS refuses comes back as a success with no rows (§6.58 found the same thing on delete),
   * so a missing row here is a refusal and has to be reported rather than swallowed.
   */
  if (!data?.id) return { ok: false, error: "That licence could not be saved \u2014 reload the plan and try again." };
  touch(planId);
  return { ok: true, id: data.id };
}

export async function deleteLicence(planId: string, id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  await supabase.from("plan_licences").delete().eq("id", id).eq("plan_id", planId);
  touch(planId);
  return { ok: true };
}
