"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distributionValid, exactHundred, type MonthlyDistribution } from "@/engine/sales/projection";
import { nextHref } from "@/lib/nav";
import { normalizeCategory } from "@/engine/overheads/categories";
import { failed } from "@/lib/actionFailed";

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

/** A typed overhead. Synced lines never come through here — their figures belong to the module that owns them. */
export async function upsertOverhead(planId: string, o: {
  id?: string; name: string; current_value: number; start_year?: number | null; on_cost?: boolean | null; gst_applies?: boolean; category?: string | null;
  yearly_change?: Record<string, number> | null; monthly_distribution?: MonthlyDistribution | null;
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const name = (o.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the expense a name." };
  if (o.monthly_distribution && !distributionValid(o.monthly_distribution)) return { ok: false, error: "The monthly split must add up to 100%." };
  const row = {
    plan_id: planId, name, source: "entered" as const,
    // Anything that is not one of the eight is stored as null, not as itself — the DB check would reject it
    // anyway (0041), and a silent null reads as "uncategorised" rather than failing the client's save.
    category: normalizeCategory(o.category),
    current_value: Math.max(0, Number(o.current_value) || 0),
    start_year: Math.min(5, Math.max(1, Math.trunc(Number(o.start_year)) || 1)),
    on_cost: !!o.on_cost,
    // A wage line is never taxed, whatever the box says — the engine ignores it either way (§6.38).
    gst_applies: !o.on_cost && o.gst_applies !== false,
    yearly_change: pctMap(o.yearly_change),
    monthly_distribution: o.monthly_distribution ? exactHundred(o.monthly_distribution) : null,
  };
  const q = o.id
    ? supabase.from("plan_overheads").update(row).eq("id", o.id).eq("plan_id", planId).eq("source", "entered").select("id").single()
    : supabase.from("plan_overheads").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save the overhead");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

/** Only a typed line can be deleted; the two synced lines exist as long as their source does. */
export async function deleteOverhead(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_overheads").delete().eq("id", id).eq("plan_id", planId).eq("source", "entered");
  if (error) return failed(error, "remove the overhead");
  touch(planId); return { ok: true };
}

/** A synced line owns only its monthly shape here — its yearly figures come from its own module. */
export async function saveSyncedShape(planId: string, source: "people" | "marketing", d: MonthlyDistribution | null): Promise<Result> {
  const supabase = await createClient();
  if (d && !distributionValid(d)) return { ok: false, error: "The monthly split must add up to 100%." };
  const dist = d ? exactHundred(d) : null;
  const { data: existing } = await supabase.from("plan_overheads").select("id").eq("plan_id", planId).eq("source", source).maybeSingle();
  const { error } = existing
    ? await supabase.from("plan_overheads").update({ monthly_distribution: dist }).eq("id", existing.id).eq("plan_id", planId)
    : await supabase.from("plan_overheads").insert({
        plan_id: planId, source, name: source === "people" ? "Leadership Team salaries" : "Marketing spend",
        current_value: 0, yearly_change: {}, monthly_distribution: dist, sort_order: source === "people" ? -2 : -1,
      });
  if (error) return failed(error, "save how the overhead is synced");
  touch(planId); return { ok: true };
}

export async function saveOnCostPct(planId: string, pct: number): Promise<Result> {
  const supabase = await createClient();
  const value = Math.min(100, Math.max(0, Number(pct) || 0));
  const { error } = await supabase.from("plan_settings").update({ on_cost_pct: value }).eq("plan_id", planId);
  if (error) return failed(error, "save the on-cost percentage");
  touch(planId); return { ok: true };
}

export async function continueFromOverheads(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "overheads") : `/plans/${planId}/dashboard`);
}
