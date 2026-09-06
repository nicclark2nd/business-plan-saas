"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseMonth } from "../people/model";
import type { Profile, Financial } from "./model";

type Result = { ok: true; data?: { date_established: string | null } } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

export async function saveProfile(planId: string, p: Partial<Profile> & { established_text?: string }): Promise<Result> {
  const supabase = await createClient();
  const established = p.established_text !== undefined ? parseMonth(p.established_text) : p.date_established;
  if (established === undefined) return { ok: false, error: "Date established should be a month and year, e.g. Jun 1975." };
  const name = (p.business_name ?? "").trim();
  if (!name) return { ok: false, error: "The business needs a name." };
  const [plans, settings] = await Promise.all([
    supabase.from("plans").update({ business_name: name }).eq("id", planId),
    supabase.from("plan_settings").upsert({
      plan_id: planId,
      date_established: established ?? null,
      industry: p.industry?.trim() || null,
      country: p.country?.trim() || null,
      legal_structure: p.legal_structure?.trim() || null,
      customer_type: p.customer_type?.trim() || null,
      product_type: p.product_type?.trim() || null,
      products_services_statement: p.products_services_statement?.trim() || null,
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
    currency: (f.currency || "AUD").toUpperCase().slice(0, 3),
  }, { onConflict: "plan_id" });
  if (error) { console.error("financial", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true };
}
