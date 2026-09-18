"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseMonth } from "../people/model";
import type { Profile, Financial, Printing, Licence } from "./model";
import { serializeComponents } from "@/engine/plan/gst";
import { checkLogo, logoObjectPath, LOGO_BUCKET } from "@/engine/plan/logo";
import { checkEmail, checkWebsite } from "@/engine/plan/contact";

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

  /* Refused with a sentence rather than stored and printed wrong on a cover (§6.96). */
  const email = checkEmail(p.contact_email);
  if (!email.ok) return { ok: false, error: email.error };
  const website = checkWebsite(p.website);
  if (!website.ok) return { ok: false, error: website.error };

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
      tagline: p.tagline?.trim() || null,
      /* Stored as typed, tidied only for printing — what the client wrote is theirs (§6.96). */
      contact_email: email.value,
      website: website.value,
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
 * How the plan prints (§6.93). Both choices save the moment they are made — neither is typed, so there is
 * no field to leave.
 *
 * `page_size` stores null for "follow the country", and that is deliberate rather than lazy: a stored 'a4'
 * could not be told apart from a client who chose A4, and a plan later moved to the United States would go
 * on printing 210mm paper because of a default nobody remembered making.
 */
export async function savePrinting(planId: string, p: Partial<Printing>): Promise<Result> {
  const supabase = await createClient();
  const size = p.page_size === "a4" || p.page_size === "letter" ? p.page_size : null;
  const { error } = await supabase.from("plan_settings").upsert({
    plan_id: planId,
    print_key_people_salaries: p.print_key_people_salaries !== false,
    page_size: size,
  }, { onConflict: "plan_id" });
  if (error) { console.error("printing", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true };
}

/**
 * The plan's logo (§6.94).
 *
 * Uploaded through a server action rather than straight from the browser, so the file is checked ONCE, by
 * code the client cannot skip: a picker's `accept` attribute is a hint a drag-and-drop ignores, and the
 * bucket's own mime list (0042) returns an error a client cannot read.
 *
 * `upsert: true` and one object per plan (`<planId>/logo.<ext>`) so changing a logo replaces it rather than
 * leaving the old one behind. The ONE case that needs care is a change of format: png → jpg writes a new
 * object and the old `logo.png` would sit there forever, still readable by anyone with the old signed URL,
 * so the previous object is removed when the extension changes.
 */
export async function uploadLogo(planId: string, form: FormData): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const file = form.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "No file arrived — try choosing it again." };
  const check = checkLogo({ type: file.type, size: file.size, name: file.name });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const path = logoObjectPath(planId, check.ext);
  const { error: upload } = await supabase.storage.from(LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upload) {
    console.error("logo upload", upload);
    return { ok: false, error: `That logo could not be saved: ${upload.message}` };
  }

  const { data: was } = await supabase.from("plan_settings").select("logo_path").eq("plan_id", planId).maybeSingle();
  const previous = was?.logo_path as string | null | undefined;
  if (previous && previous !== path) await supabase.storage.from(LOGO_BUCKET).remove([previous]);

  const { error } = await supabase.from("plan_settings").upsert({ plan_id: planId, logo_path: path }, { onConflict: "plan_id" });
  if (error) { console.error("logo path", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, path };
}

/** Taking the logo off the plan removes the FILE too — a client who deletes it means it, and a row pointing
 *  at nothing while the object stays readable is not deletion, it is hiding. */
export async function removeLogo(planId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: was } = await supabase.from("plan_settings").select("logo_path").eq("plan_id", planId).maybeSingle();
  const previous = was?.logo_path as string | null | undefined;
  if (previous) await supabase.storage.from(LOGO_BUCKET).remove([previous]);
  const { error } = await supabase.from("plan_settings").update({ logo_path: null }).eq("plan_id", planId);
  if (error) { console.error("logo remove", error); return { ok: false, error: error.message }; }
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
