"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

/**
 * WHAT THE BUSINESS DEPENDS ON, AND HOW MUCH OF IT IS USED (§6.129.3).
 *
 * Named by the client — a concreter's pumps and crews, a café's seats, a distributor's warehouse — because a
 * fixed list fits one industry and misleads the rest. Six at most, checked here where the message can say
 * why: a seventh measure is not more information, it is the first six diluted.
 *
 * `pct_used` is nullable: a thing named and not yet measured is not a thing sitting idle (§6.89). It may run
 * above 100, because "the crew is at 110% on overtime" is a real answer and the most important one.
 */
/* Not exported: a "use server" file may export only async functions, and this broke the page when it did. */
const MAX_CAPACITY_MEASURES = 6;

export async function upsertCapacityMeasure(planId: string, m: { id?: string; name: string; pct_used: number | null }):
  Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const name = (m.name ?? "").trim();
  if (!name) return { ok: false, error: "Say what it is — premises, a machine, a crew, a system." };
  const pct = m.pct_used === null || m.pct_used === undefined ? null : Math.max(0, Math.round(m.pct_used * 100) / 100);
  const supabase = await createClient();
  if (!m.id) {
    const { count } = await supabase.from("plan_capacity_measures").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    if ((count ?? 0) >= MAX_CAPACITY_MEASURES) return { ok: false, error: `Six is the most — pick the ${MAX_CAPACITY_MEASURES} the business would hit first.` };
  }
  const q = m.id
    ? supabase.from("plan_capacity_measures").update({ name, pct_used: pct }).eq("id", m.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_capacity_measures").insert({ plan_id: planId, name, pct_used: pct, sort_order: Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save that measure");
  await touch(planId);
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteCapacityMeasure(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_capacity_measures").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove that measure");
  await touch(planId);
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}
