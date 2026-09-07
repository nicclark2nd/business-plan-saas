"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DepreciationMethod } from "@/engine/assets/depreciation";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const money = (v: unknown) => Math.max(0, Number(v) || 0);
const yr = (v: unknown) => Math.min(5, Math.max(1, Math.trunc(Number(v)) || 1));
const mo = (v: unknown) => Math.min(12, Math.max(1, Math.trunc(Number(v)) || 1));

/**
 * An asset bought with the business's own cash. A financed asset never comes through here — its figures
 * belong to the Funding row that bought it, exactly as a synced Overheads line belongs to its own module.
 */
export async function upsertAsset(planId: string, a: {
  id?: string; name: string; category?: string | null; purchase_price: number; residual_value?: number;
  useful_life_months?: number; method?: DepreciationMethod; start_year?: number; start_month?: number; notes?: string | null;
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const name = (a.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the asset a name." };

  const price = money(a.purchase_price);
  const residual = Math.min(money(a.residual_value), price);      // it can never be worth more than it cost
  const row = {
    plan_id: planId, source: "entered" as const, funding_debt_id: null, name,
    category: (a.category ?? "").trim() || null,
    purchase_price: price, residual_value: residual,
    useful_life_months: Math.max(1, Math.trunc(Number(a.useful_life_months) || 60)),
    method: a.method ?? "straight_line",
    start_year: yr(a.start_year), start_month: mo(a.start_month),
    notes: (a.notes ?? "").trim() || null,
  };
  const q = a.id && !a.id.startsWith("tmp-")
    ? supabase.from("plan_fixed_assets").update(row).eq("id", a.id).eq("plan_id", planId).eq("source", "entered").select("id").single()
    : supabase.from("plan_fixed_assets").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("asset", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

/** Only a cash-bought asset can be deleted here; a financed one goes when its loan does. */
export async function deleteAsset(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_fixed_assets").delete().eq("id", id).eq("plan_id", planId).eq("source", "entered");
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

/** How a financed asset is written off is a real choice, even though what it cost is not. */
export async function saveFinancedShape(planId: string, id: string, m: { method: DepreciationMethod; useful_life_months: number }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_fixed_assets")
    .update({ method: m.method, useful_life_months: Math.max(1, Math.trunc(Number(m.useful_life_months) || 60)) })
    .eq("id", id).eq("plan_id", planId).eq("source", "finance");
  if (error) { console.error("financed asset", error); return { ok: false, error: error.message }; }
  touch(planId); return { ok: true };
}

export async function continueFromAssets(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/forecast` : `/plans/${planId}/dashboard`);
}
