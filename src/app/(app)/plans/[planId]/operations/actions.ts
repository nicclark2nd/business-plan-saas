"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextHref } from "@/lib/nav";
import { CAPACITY_FIELDS, DEPENDENCY, TENURE, type Capacity } from "./model";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const TABLES = {
  premises: { table: "plan_outlets", required: "name", cols: ["name", "address", "tenure", "is_primary", "floor_area", "monthly_cost", "purpose"] },
  suppliers: { table: "plan_suppliers", required: "name", cols: ["name", "supplies", "terms", "dependency", "alternative"] },
  steps: { table: "plan_operations_steps", required: "title", cols: ["title", "detail", "owner", "duration"] },
} as const;
export type RowKind = keyof typeof TABLES;

const oneOf = (list: readonly { value: string }[], v: unknown, fallback: string | null) =>
  list.some((x) => x.value === String(v)) ? String(v) : fallback;

async function touch(planId: string) {
  const supabase = await createClient();
  await supabase.from("plans").update({ updated_at: new Date().toISOString() }).eq("id", planId);
}

export async function upsertRow(planId: string, kind: RowKind, row: Record<string, unknown> & { id?: string }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const spec = TABLES[kind];
  const clean: Record<string, unknown> = { plan_id: planId };
  for (const c of spec.cols) {
    if (!(c in row)) continue;
    const v = row[c];
    if (c === "monthly_cost") clean[c] = Math.max(0, Number(v) || 0);
    else if (c === "is_primary") clean[c] = v === true;
    else if (c === "tenure") clean[c] = oneOf(TENURE, v, null);
    else if (c === "dependency") clean[c] = oneOf(DEPENDENCY, v, null);
    else clean[c] = typeof v === "string" ? (v.trim() || null) : v;
  }
  if (!String(clean[spec.required] ?? "").trim()) return { ok: false, error: "Fill in the first column." };

  const q = row.id
    ? supabase.from(spec.table).update(clean).eq("id", row.id).eq("plan_id", planId).select("id").single()
    : supabase.from(spec.table).insert({ ...clean, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save that row");
  await touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteRow(planId: string, kind: RowKind, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES[kind].table).delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove that row");
  await touch(planId);
  return { ok: true };
}

/**
 * Exactly one primary place, and the DATABASE is not asked to enforce it.
 *
 * A client mid-edit with none set is an ordinary state, not a violation — a constraint would reject the
 * save and lose their typing. So the rule lives here: setting one clears the others, in that order, so a
 * failure leaves two marked rather than none. Two primaries reads as a mistake; none reads as data loss.
 */
export async function setPrimaryPremise(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const set = await supabase.from("plan_outlets").update({ is_primary: true }).eq("id", id).eq("plan_id", planId);
  if (set.error) return failed(set.error, "set the main place");
  const clear = await supabase.from("plan_outlets").update({ is_primary: false }).eq("plan_id", planId).neq("id", id);
  if (clear.error) return failed(clear.error, "clear the other places");
  await touch(planId);
  return { ok: true };
}

export async function saveCapacity(planId: string, capacity: Capacity): Promise<Result> {
  const supabase = await createClient();
  const row: Record<string, unknown> = { plan_id: planId };
  for (const f of CAPACITY_FIELDS) row[f.key] = capacity[f.key]?.trim() || null;
  const { error } = await supabase.from("plan_operations").upsert(row, { onConflict: "plan_id" });
  if (error) return failed(error, "save the capacity");
  await touch(planId);
  return { ok: true };
}

export async function continueFromOperations(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "operations") : `/plans/${planId}/dashboard`);
}
