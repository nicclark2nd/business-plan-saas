"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distributionValid, exactHundred, type Growth, type MonthlyDistribution } from "@/engine/sales/projection";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const LIFECYCLES = ["development", "introduction", "growth", "maturity", "saturation", "decline"];

export async function upsertProduct(planId: string, p: {
  id?: string; name: string; description?: string | null; notes?: string | null; lifecycle?: string | null;
  average_price: number; units_sold: number; start_selling_year: number; yearly_growth?: Growth | null; monthly_distribution?: MonthlyDistribution | null;
  sold_as?: string | null; opening_clients?: number | null; client_life_months?: number | null; life_mode?: string | null;
  monthly_new_clients?: Record<string, number> | null; clients_from_product_id?: string | null;
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
  const growth: Growth = {};
  for (const y of ["1", "2", "3", "4", "5"]) {
    const g = p.yearly_growth?.[y]; if (!g) continue;
    const price = Number(g.price), units = Number(g.units);
    growth[y] = { price: Number.isFinite(price) ? Math.max(-100, Math.min(1000, price)) : 0, units: Number.isFinite(units) ? Math.max(-100, Math.min(1000, units)) : 0 };
  }
  const row = {
    plan_id: planId, name, description: p.description?.trim() || null, notes: p.notes?.trim() || null,
    lifecycle: LIFECYCLES.includes(p.lifecycle ?? "") ? p.lifecycle : null,
    average_price: Math.max(0, Number(p.average_price) || 0), units_sold: Math.max(0, Number(p.units_sold) || 0),
    start_selling_year: Math.min(6, Math.max(1, Math.trunc(Number(p.start_selling_year)) || 1)),   // 1 = now, 2–6 = plan Year 1–5
    yearly_growth: growth, monthly_distribution: recurring ? null : (p.monthly_distribution ? exactHundred(p.monthly_distribution) : null),
    sold_as: recurring ? "recurring" : "one_off",
    opening_clients: recurring ? Math.max(0, Number(p.opening_clients) || 0) : 0,
    client_life_months: Math.min(600, Math.max(1, Math.trunc(Number(p.client_life_months)) || 12)),
    life_mode: p.life_mode === "fixed" ? "fixed" : "average",
    monthly_new_clients: recurring && !source ? clients : null,
    clients_from_product_id: source,
  };
  const q = p.id
    ? supabase.from("plan_products").update(row).eq("id", p.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_products").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("product", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteProduct(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_products").delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function continueFromSales(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/cogs` : `/plans/${planId}/dashboard`);
}
