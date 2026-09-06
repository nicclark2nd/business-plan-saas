"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distributionValid, type MonthlyDistribution } from "@/engine/sales/projection";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const pctMap = (raw: Record<string, number> | null | undefined) => {
  const out: Record<string, number> = {};
  for (const y of ["1", "2", "3", "4", "5"]) {
    const v = Number(raw?.[y]);
    if (Number.isFinite(v) && v !== 0) out[y] = Math.max(-100, Math.min(1000, v));
  }
  return out;
};

/** A product's direct cost. Per job for a one-off line; per client per year for an ongoing one (§6.18). */
export async function saveProductCost(planId: string, p: {
  id: string; cost_per_unit: number; yearly_cost_increase?: Record<string, number> | null;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_products")
    .update({ cost_per_unit: Math.max(0, Number(p.cost_per_unit) || 0), yearly_cost_increase: pctMap(p.yearly_cost_increase) })
    .eq("id", p.id).eq("plan_id", planId);
  if (error) { console.error("product cost", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true };
}

export async function upsertFixedCogs(planId: string, f: {
  id?: string; item_name: string; annual_cost: number;
  yearly_growth_rates?: Record<string, number> | null; monthly_distribution?: MonthlyDistribution | null;
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const name = (f.item_name ?? "").trim();
  if (!name) return { ok: false, error: "Give the cost a name." };
  if (f.monthly_distribution && !distributionValid(f.monthly_distribution)) return { ok: false, error: "The monthly split must add up to 100%." };
  const row = {
    plan_id: planId, item_name: name,
    annual_cost: Math.max(0, Number(f.annual_cost) || 0),
    yearly_growth_rates: pctMap(f.yearly_growth_rates),
    monthly_distribution: f.monthly_distribution ?? null,
  };
  const q = f.id
    ? supabase.from("plan_fixed_cogs").update(row).eq("id", f.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_fixed_cogs").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("fixed cogs", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteFixedCogs(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_fixed_cogs").delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function continueFromCogs(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/overheads` : `/plans/${planId}/dashboard`);
}
