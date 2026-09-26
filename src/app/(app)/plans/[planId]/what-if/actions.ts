"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { loadPlan } from "@/lib/planLoad";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { applyChanges, plannedChanges } from "@/engine/whatif/apply";
import { planLevers, type DayScope, type Levers, type StartYear } from "@/engine/whatif/levers";
import { FORECAST_YEARS, type WorkingCapitalDays } from "@/engine/forecast/model";
import { saveAssumptions } from "../assumptions/actions";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * The days sliders, written back into the plan (§6.43).
 *
 * This is the first thing What-If is allowed to change, and it is allowed because it is the one lever whose
 * effect the screen has shown honestly and completely: the sliders ARE the Year 1 working-capital
 * assumptions, re-run through the real forecast. Nothing is being approximated and nothing lands in another
 * module's records.
 *
 * Two rules it does not get to bend. It writes through `saveAssumptions`, the same server action the
 * Assumptions tab uses, so the grid has one writer and one set of coercions rather than two that drift. And
 * it takes the current schedule from `loadPlan` rather than reading `plan_settings` itself — because an
 * unset grid falls back to the days the business's own history implies, and rebuilding that fallback here
 * would write 30/0/30 over a plan that was quietly forecasting on 46/2/6 (§6.41.3).
 */
export async function saveDays(
  planId: string, days: WorkingCapitalDays, scope: "year1" | "all",
): Promise<Result> {
  const { plan } = await loadPlan(planId);
  const clean: WorkingCapitalDays = {
    debtorDays: Math.min(365, Math.max(0, Math.round(Number(days.debtorDays) || 0))),
    inventoryDays: Math.min(365, Math.max(0, Math.round(Number(days.inventoryDays) || 0))),
    creditorDays: Math.min(365, Math.max(0, Math.round(Number(days.creditorDays) || 0))),
  };
  const workingCapital = scope === "all"
    ? Object.fromEntries(FORECAST_YEARS.map((y) => [y, clean]))
    : { ...plan.workingCapital, 1: clean };
  return saveAssumptions(planId, { workingCapital, cashTiming: plan.cashTiming });
}


/* ------------------------------------------------------------------ *
 * Turn into goals                                                     *
 * ------------------------------------------------------------------ */

export type GoalToCreate = {
  /** The lever that proposed it — how a second "Turn into goals" finds the goal it made last time (§6.134). */
  lever: string;
  area: string;
  title: string;
  detail: string;
  /** When it is due, or null. The 90-day rung's own question (§6.139); the old quarter did nothing. */
  dueDate: string | null;
  ownerPersonId: string | null;
};

const isArea = (a: string): a is GoalArea => GOAL_AREAS.some((x) => x.key === a);

/**
 * A scenario, written into the plan as goals (§6.44).
 *
 * This is the second exit and the gentler of the two: it changes no figure anywhere. A goal is a note about
 * what somebody intends to do, so it can be wrong without the forecast being wrong — which is why it goes
 * in ahead of "Make this the plan".
 *
 * Each goal lands under its area's ANNUAL goal, and the annual goal is created empty if the area has none.
 * That is the same rule the Goals module follows for a hand-typed goal, and for the same reason: the
 * hierarchy is the report's, and a client who has not yet written the sentence at the top of a section
 * should not be blocked from recording what they will do this quarter.
 *
 * `source` is 'whatif', so the Goals screen can mark where each one came from and nobody has to remember.
 */
export async function createGoalsFromScenario(planId: string, goals: GoalToCreate[]): Promise<Result> {
  if (!goals.length) return { ok: false, error: "Nothing to create — move a lever first." };
  const supabase = await createClient();

  /*
   * NO PARENT TO FIND OR CONJURE ANY MORE (§6.125).
   *
   * This used to look up the annual goal for each area and INSERT an empty one where none existed, purely
   * so the goal it was writing had something to hang off. That scaffolding is why a plan ends up with
   * blank rows nobody typed. A goal now stands on its own at a rung, so the whole dance is one insert.
   *
   * Everything a scenario produces lands in the NEXT 90 DAYS, which is the only honest rung for it: a
   * lever the client just moved is something to do now, not a picture of the business in five years.
   */
  const wanted = goals.filter((g) => g.title.trim());
  for (const g of wanted) if (!isArea(g.area)) return { ok: false, error: `Unknown area: ${g.area}` };
  if (!wanted.length) return { ok: false, error: "Nothing to create." };

  /*
   * ONE OPEN GOAL PER LEVER (§6.134, open item 24). The goal this lever made last time, if it is still open,
   * is brought up to date rather than joined by a second one. Done goals are history and are left alone;
   * so is a goal's status, because "in progress" is the client's statement, not the scenario's.
   */
  const { data: open, error: readError } = await supabase.from("plan_goals")
    .select("id, source_key").eq("plan_id", planId).eq("source", "whatif").eq("horizon", "ninety")
    .neq("status", "done").is("closed_period_end", null).in("source_key", wanted.map((g) => g.lever));
  if (readError) return failed(readError, "check the goals already made");
  const existing = new Map((open ?? []).map((r) => [r.source_key as string, r.id as string]));

  const inserts: Record<string, unknown>[] = [];
  for (const g of wanted) {
    const due = g.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(g.dueDate) ? g.dueDate : null;
    const fields = {
      area: g.area, title: g.title.trim(), detail: g.detail.trim() || null,
      ...(g.ownerPersonId ? { owner_person_id: g.ownerPersonId } : {}),
      ...(due ? { milestone_date: due } : {}),
    };
    const id = existing.get(g.lever);
    if (id) {
      const { error } = await supabase.from("plan_goals").update(fields).eq("id", id).eq("plan_id", planId);
      if (error) return failed(error, "update the goals");
    } else {
      inserts.push({ plan_id: planId, horizon: "ninety", ...fields, owner_person_id: g.ownerPersonId || null,
        status: "not_started", source: "whatif", source_key: g.lever });
    }
  }
  if (inserts.length) {
    const { error } = await supabase.from("plan_goals").insert(inserts);
    if (error) return failed(error, "save the goals");
  }
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}


/* ------------------------------------------------------------------ *
 * Make this the plan                                                  *
 * ------------------------------------------------------------------ */

/**
 * The scenario, written into the plan (§6.45).
 *
 * The harder exit, and the one the screen is for. Until now the levers were a preview: they scaled COPIES of
 * the product and overhead rows in memory, re-ran the forecast from those, and threw them away — so a client
 * could model a price rise and then had to go into Sales and retype ten prices by hand. This writes them.
 *
 * Three rules it keeps.
 *
 * **It writes the BASE figures, not five years of them.** A product's price and units are the base the
 * yearly growth compounds from, so one number per product carries the change through all five years exactly
 * as the preview showed it.
 *
 * **It writes what the client was shown.** The rows come from `applyChanges`, the same rounded figures the
 * confirmation listed line by line — not from the levers a second time. One computation, one set of numbers.
 *
 * **It saves the before-state first.** Everything it is about to overwrite goes into `plan_versions` with
 * reason `whatif_apply`, so applying is reversible rather than a leap.
 */
export async function applyScenario(
  planId: string, levers: Levers, dayScope: DayScope, from: StartYear = 1,
): Promise<Result<{ changed: number }>> {
  const { plan } = await loadPlan(planId);
  const at = planLevers(plan.workingCapital[1]);
  const planned = plannedChanges(plan.sources, levers, at, from);
  if (!planned.changes.length && !planned.daysMoved) {
    return { ok: false, error: "Nothing to apply — move a lever first." };
  }

  const supabase = await createClient();
  const after = applyChanges(plan.sources, planned.changes);
  const touched = new Set(planned.changes.map((c) => `${c.table}:${c.id}`));

  /**
   * The undo record. It holds the rows exactly as they are now, so restoring is writing them back rather
   * than reversing arithmetic — which would not survive a client editing something in between.
   */
  const before = {
    products: plan.sources.products.filter((p) => touched.has(`plan_products:${String(p.id ?? "")}`)),
    overheads: plan.sources.overheads.filter((o) => touched.has(`plan_overheads:${String(o.id ?? "")}`)),
    workingCapital: plan.workingCapital,
  };
  const { error: versionErr } = await supabase.from("plan_versions").insert({
    plan_id: planId, reason: "whatif_apply",
    label: `What-If: ${planned.changes.length} record${planned.changes.length === 1 ? "" : "s"}`,
    snapshot: { levers, dayScope, from, changes: planned.changes, before },
  });
  if (versionErr) return failed(versionErr, "save a version first");

  // Products: the columns the levers can move, taken from the adjusted row so they match the list exactly.
  for (const p of after.products) {
    const id = String(p.id ?? "");
    if (!touched.has(`plan_products:${id}`)) continue;
    const row = p as unknown as Record<string, unknown>;
    const { error } = await supabase.from("plan_products").update({
      average_price: row.average_price,
      units_sold: row.units_sold,
      cost_per_unit: row.cost_per_unit,
      yearly_growth: row.yearly_growth ?? {},
      yearly_cost_increase: row.yearly_cost_increase ?? {},
      monthly_new_clients: row.monthly_new_clients ?? null,
    }).eq("id", id).eq("plan_id", planId);
    if (error) return failed(error, `update ${String(row.name ?? "a product")}`);
  }

  for (const o of after.overheads) {
    const id = String(o.id ?? "");
    if (!touched.has(`plan_overheads:${id}`)) continue;
    const { error } = await supabase.from("plan_overheads")
      .update({ current_value: o.current_value, yearly_change: o.yearly_change ?? {} }).eq("id", id).eq("plan_id", planId);
    if (error) return failed(error, `update ${o.name}`);
  }

  if (planned.daysMoved) {
    const days = {
      debtorDays: Math.round(Number(levers.debtorDays ?? at.debtorDays)),
      inventoryDays: Math.round(Number(levers.stockDays ?? at.stockDays)),
      creditorDays: Math.round(Number(levers.creditorDays ?? at.creditorDays)),
    };
    const r = await saveDays(planId, days, dayScope);
    if (!r.ok) return r;
  }

  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true, data: { changed: planned.changes.length } };
}

/**
 * Put it back (§6.45.1).
 *
 * A saved version is only a safety net if something can restore it. This takes the most recent
 * `whatif_apply` and writes its stored rows back as they were — restoring the figures rather than reversing
 * the arithmetic, which would not survive the client having edited something in between.
 */
export async function undoLastApply(planId: string): Promise<Result<{ label: string }>> {
  const supabase = await createClient();
  const { data: version, error } = await supabase.from("plan_versions")
    .select("id, label, snapshot, created_at").eq("plan_id", planId).eq("reason", "whatif_apply")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return failed(error, "undo the last change");
  if (!version) return { ok: false, error: "There is nothing to undo." };

  const snap = version.snapshot as {
    before?: {
      products?: Record<string, unknown>[];
      overheads?: Record<string, unknown>[];
      workingCapital?: Record<number, { debtorDays: number; inventoryDays: number; creditorDays: number }>;
    };
  };
  const before = snap.before ?? {};

  for (const p of before.products ?? []) {
    const { error: e } = await supabase.from("plan_products").update({
      average_price: p.average_price, units_sold: p.units_sold, cost_per_unit: p.cost_per_unit,
      yearly_growth: p.yearly_growth ?? {}, yearly_cost_increase: p.yearly_cost_increase ?? {},
      monthly_new_clients: p.monthly_new_clients ?? null,
    }).eq("id", String(p.id)).eq("plan_id", planId);
    if (e) return failed(e, `restore ${String(p.name ?? "a product")}`);
  }
  for (const o of before.overheads ?? []) {
    const { error: e } = await supabase.from("plan_overheads")
      .update({ current_value: o.current_value, yearly_change: o.yearly_change ?? {} }).eq("id", String(o.id)).eq("plan_id", planId);
    if (e) return failed(e, `restore ${String(o.name ?? "an overhead")}`);
  }
  if (before.workingCapital) {
    const { data: s } = await supabase.from("plan_settings").select("cash_flow_assumptions").eq("plan_id", planId).maybeSingle();
    const { error: e } = await supabase.from("plan_settings")
      .update({ working_capital_schedule: before.workingCapital }).eq("plan_id", planId);
    if (e) return failed(e, "finish undoing");
    void s;
  }

  // The version has done its job; leaving it would let a second undo restore figures already restored.
  await supabase.from("plan_versions").delete().eq("id", version.id).eq("plan_id", planId);
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true, data: { label: String(version.label ?? "the last change") } };
}

/** Whether there is an applied scenario waiting to be undone, for the screen to offer it. */
export async function lastApply(planId: string): Promise<{ label: string; at: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("plan_versions")
    .select("label, created_at").eq("plan_id", planId).eq("reason", "whatif_apply")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { label: String(data.label ?? "What-If change"), at: String(data.created_at) } : null;
}
