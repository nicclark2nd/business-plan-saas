"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DepreciationMethod } from "@/engine/assets/depreciation";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";
import { adjustments, adjustedNote, type Watched } from "@/lib/adjusted";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const money = (v: unknown) => Math.max(0, Number(v) || 0);
const yr = (v: unknown) => Math.min(5, Math.max(1, Math.trunc(Number(v)) || 1));
const mo = (v: unknown) => Math.min(12, Math.max(1, Math.trunc(Number(v)) || 1));

/**
 * WHAT AN ASSET'S SAVE GIVES BACK (§6.123).
 *
 * The clamp worth naming here is `residual_value`, capped at the purchase price — "it can never be worth
 * more than it cost" is right, and it was silent. A client entering a 40,000 residual on a 30,000 machine
 * had 30,000 stored, a depreciation schedule built on it, and a screen that went on saying 40,000.
 */
export type AssetSaved = { stored: Record<string, unknown>; note?: string };

const CLAMPED: readonly Watched<string>[] = [
  { key: "purchase_price", label: "What it cost" },
  { key: "residual_value", label: "Worth at the end" },
  { key: "useful_life_months", label: "Written off over (months)" },
  { key: "start_year", label: "Bought in" },
  { key: "start_month", label: "Month" },
];

/**
 * An asset bought with the business's own cash. A financed asset never comes through here — its figures
 * belong to the Funding row that bought it, exactly as a synced Overheads line belongs to its own module.
 */
export async function upsertAsset(planId: string, a: {
  id?: string; name: string; category?: string | null; purchase_price: number; residual_value?: number;
  useful_life_months?: number; method?: DepreciationMethod; start_year?: number; start_month?: number; notes?: string | null;
  gst_applies?: boolean; already_owned?: boolean;
}): Promise<Result<{ id: string }> & { saved?: AssetSaved }> {
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
    // Already owned: no cash ever leaves for it, so the tax on a purchase is not a question that applies.
    already_owned: a.already_owned === true,
    gst_applies: a.already_owned === true ? true : a.gst_applies !== false,
  };
  /* The whole row back, not its id (§6.123): the clamps above are why the two can differ. */
  const q = a.id && !a.id.startsWith("tmp-")
    ? supabase.from("plan_fixed_assets").update(row).eq("id", a.id).eq("plan_id", planId).eq("source", "entered").select("*").single()
    : supabase.from("plan_fixed_assets").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("*").single();
  const { data, error } = await q;
  if (error) return failed(error, "save the asset");

  const stored: Record<string, unknown> = {
    ...(data as Record<string, unknown>),
    purchase_price: Number(data.purchase_price), residual_value: Number(data.residual_value),
  };
  const note = adjustedNote(adjustments(a, stored, CLAMPED), name);

  touch(planId);
  return { ok: true, data: { id: data.id }, saved: { stored, note } };
}

/** Only a cash-bought asset can be deleted here; a financed one goes when its loan does. */
export async function deleteAsset(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_fixed_assets").delete().eq("id", id).eq("plan_id", planId).eq("source", "entered");
  if (error) return failed(error, "remove the asset");
  touch(planId); return { ok: true };
}

/** What a financed asset is called, and how it is written off, are real choices — what it cost is not. */
export async function saveFinancedShape(planId: string, id: string, m: { name?: string; method: DepreciationMethod; useful_life_months: number }): Promise<Result> {
  const supabase = await createClient();
  const name = (m.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the asset a name." };
  const { error } = await supabase.from("plan_fixed_assets")
    .update({ name, method: m.method, useful_life_months: Math.max(1, Math.trunc(Number(m.useful_life_months) || 60)) })
    .eq("id", id).eq("plan_id", planId).eq("source", "finance");
  if (error) return failed(error, "save how the asset is financed");
  touch(planId); return { ok: true };
}

export async function continueFromAssets(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "assets") : `/plans/${planId}/dashboard`);
}
