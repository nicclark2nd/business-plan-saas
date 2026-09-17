"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distributionValid, exactHundred, type Growth, type MonthlyDistribution } from "@/engine/sales/projection";
import { nextHref } from "@/lib/nav";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const LIFECYCLES = ["development", "introduction", "growth", "maturity", "decline"];

export async function upsertProduct(planId: string, p: {
  id?: string; name: string; description?: string | null; notes?: string | null; lifecycle?: string | null;
  average_price: number; units_sold: number; start_selling_year: number; yearly_growth?: Growth | null; monthly_distribution?: MonthlyDistribution | null;
  sold_as?: string | null; opening_clients?: number | null; client_life_months?: number | null; life_mode?: string | null;
  monthly_new_clients?: Record<string, number> | null; clients_from_product_id?: string | null; gst_applies?: boolean;
  pricing_rationale?: string | null;
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const name = (p.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the product a name." };
  const recurring = p.sold_as === "recurring";
  if (!recurring && p.monthly_distribution && !distributionValid(p.monthly_distribution)) return { ok: false, error: "The monthly split must add up to 100%." };
  // A line may inherit its clients from another line, one level deep so nothing can loop (§6.17).
  let source: string | null = null;
  if (recurring && p.clients_from_product_id && p.clients_from_product_id !== p.id) {
    const { data: src } = await supabase.from("plan_products").select("id, clients_from_product_id").eq("id", p.clients_from_product_id).eq("plan_id", planId).maybeSingle();
    if (!src) return { ok: false, error: "That line is no longer in this plan." };
    if (src.clients_from_product_id) return { ok: false, error: "That line already takes its clients from somewhere else — pick one that wins its own." };
    source = src.id;
  }
  const clients: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) { const v = Number(p.monthly_new_clients?.[String(m)]); clients[String(m)] = Number.isFinite(v) ? Math.max(0, v) : 0; }
  /**
   * A year holds either a % change or the figure itself (§6.26). A typed figure wins and clears its
   * percentage, so the two can never disagree about what the year is — and a figure of 0 is a real answer
   * (a year the line sells nothing), which is why this checks for null rather than falsiness.
   */
  const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-100, Math.min(1000, n)) : 0; };
  const figure = (v: unknown) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : null; };
  const growth: Growth = {};
  for (const y of ["1", "2", "3", "4", "5"]) {
    const g = p.yearly_growth?.[y]; if (!g) continue;
    const priceValue = figure(g.priceValue), unitsValue = figure(g.unitsValue);
    growth[y] = {
      price: priceValue === null ? pct(g.price) : null, priceValue,
      units: unitsValue === null ? pct(g.units) : null, unitsValue,
    };
  }
  const row = {
    plan_id: planId, name, description: p.description?.trim() || null, notes: p.notes?.trim() || null,
    // Why this price (§6.62) — the SBA asks for it in words and the plan only ever collected the number.
    pricing_rationale: p.pricing_rationale?.trim() || null,
    lifecycle: LIFECYCLES.includes(p.lifecycle ?? "") ? p.lifecycle : null,
    average_price: Math.max(0, Number(p.average_price) || 0), units_sold: Math.max(0, Number(p.units_sold) || 0),
    start_selling_year: Math.min(5, Math.max(1, Math.trunc(Number(p.start_selling_year)) || 1)),   // a plan year, 1-5 (§6.33)
    yearly_growth: growth, monthly_distribution: recurring ? null : (p.monthly_distribution ? exactHundred(p.monthly_distribution) : null),
    sold_as: recurring ? "recurring" : "one_off",
    opening_clients: recurring ? Math.max(0, Number(p.opening_clients) || 0) : 0,
    client_life_months: Math.min(600, Math.max(1, Math.trunc(Number(p.client_life_months)) || 12)),
    life_mode: p.life_mode === "fixed" ? "fixed" : "average",
    monthly_new_clients: recurring && !source ? clients : null,
    clients_from_product_id: source,
    gst_applies: p.gst_applies !== false,
  };
  const q = p.id
    ? supabase.from("plan_products").update(row).eq("id", p.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_products").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("product", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

/**
 * A line another line takes its clients from cannot be deleted (§6.24.1).
 *
 * The foreign key is `on delete set null`, so the database would quietly detach the dependent line and let
 * it carry on winning clients by itself — its income would change and nothing would say so. The screen
 * refuses first, and this refuses again, because the screen is not the gate.
 */
export async function deleteProduct(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();

  const { data: fed } = await supabase
    .from("plan_products").select("name").eq("plan_id", planId).eq("clients_from_product_id", id);
  if (fed && fed.length) {
    const names = fed.map((f) => f.name).filter(Boolean).join(", ");
    return { ok: false, error: `${names} ${fed.length === 1 ? "takes its clients" : "take their clients"} from this line. Change ${fed.length === 1 ? "it" : "them"} first, or ${fed.length === 1 ? "its" : "their"} income would change without anyone saying so.` };
  }

  const { error } = await supabase.from("plan_products").delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function continueFromSales(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "sales") : `/plans/${planId}/dashboard`);
}

/**
 * The statement that opens the report's products and services section (§6.34).
 *
 * It lived in Plan settings, which is where the app's configuration lives — currency, financial year, tax
 * rates, the vocabulary — and a two-or-three sentence narrative is not configuration. It belongs with the
 * lines it summarises, because the report section it opens is built from them.
 *
 * The column stays on `plan_settings`; only the screen that owns it has moved. No migration.
 */
export async function saveProductsStatement(planId: string, statement: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_settings")
    .update({ products_services_statement: statement.trim() || null })
    .eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}
