"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { MAX_KPIS, PLAN_MEASURES, type GoalHorizon, type GoalStatus } from "./model";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

const isArea = (a: unknown): a is GoalArea => GOAL_AREAS.some((x) => x.key === a);
const HORIZONS: GoalHorizon[] = ["ninety", "year1", "year3", "year5"];
const isHorizon = (h: unknown): h is GoalHorizon => HORIZONS.includes(h as GoalHorizon);

/* ------------------------------------------------------------------ *
 * The top of the screen                                               *
 * ------------------------------------------------------------------ */

/**
 * The big goal, the North Star, and the day the current 90 days ends (§6.125).
 *
 * All five live on `plan_settings`, which already holds one row per plan — so this is an UPDATE on a row
 * the plan is guaranteed to have rather than an upsert that could race with Settings saving beside it.
 *
 * Fields are patched individually rather than written as a set, because the screen saves each box on blur
 * and a whole-object write would blank the four the client was not touching.
 */
export type HeaderField = "big_goal" | "north_star_metric" | "north_star_value" | "north_star_why" | "ninety_day_ends_on";
const HEADER_FIELDS: HeaderField[] = ["big_goal", "north_star_metric", "north_star_value", "north_star_why", "ninety_day_ends_on"];

export async function saveHeaderField(planId: string, field: string, value: string): Promise<Result> {
  if (!HEADER_FIELDS.includes(field as HeaderField)) return { ok: false, error: "Unknown field." };
  const supabase = await createClient();

  /*
   * A DATE COLUMN CANNOT BE HANDED AN EMPTY STRING, and the client clearing the picker is the ordinary
   * case rather than an error — so empty becomes null here instead of reaching Postgres as ''.
   */
  const text = value.trim();
  const v = field === "ninety_day_ends_on" ? (text || null) : text;

  const { error } = await supabase.from("plan_settings").update({ [field]: v }).eq("plan_id", planId);
  if (error) return failed(error, "save that");
  touch(planId); return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Goals                                                               *
 * ------------------------------------------------------------------ */

export type GoalInput = {
  id?: string;
  horizon: GoalHorizon;
  /** Optional tag. Null is a real answer, not a missing one. */
  area: string | null;
  title: string;
  detail?: string | null;
  /** Only the 90-day rung carries these three; the long horizons pass null. */
  ownerPersonId?: string | null;
  status?: GoalStatus;
  milestoneDate?: string | null;
  swotItemId?: string | null;
  sortOrder?: number;
};

/**
 * One goal, at one rung (§6.125).
 *
 * WHAT IS NOT HERE ANY MORE. Every write used to begin by finding or CREATING the annual goal for the
 * area, because the old schema made a quarterly goal an orphan without one — which is why SEQ's plan
 * carries several empty annual rows nobody ever typed into. A goal now stands on its own and a rung is a
 * column, so there is no scaffolding row to conjure and nothing to clean up after.
 *
 * The stored row comes back in full (§6.121) so the screen can compare what it sent against what Postgres
 * kept and say so in the footer if they differ.
 */
export async function saveGoal(planId: string, input: GoalInput): Promise<Result<Record<string, unknown>>> {
  if (!isHorizon(input.horizon)) return { ok: false, error: "Unknown horizon." };
  if (input.area !== null && !isArea(input.area)) return { ok: false, error: "Unknown area." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the goal a name first." };

  const supabase = await createClient();
  const row = {
    plan_id: planId,
    horizon: input.horizon,
    area: input.area,
    title,
    detail: (input.detail ?? "").trim() || null,
    owner_person_id: input.ownerPersonId || null,
    status: input.status ?? "not_started",
    milestone_date: input.milestoneDate || null,
    swot_item_id: input.swotItemId || null,
    ...(input.sortOrder === undefined ? {} : { sort_order: Math.trunc(input.sortOrder) }),
  };

  const q = input.id
    ? supabase.from("plan_goals").update(row).eq("id", input.id).eq("plan_id", planId).select("*").single()
    : supabase.from("plan_goals").insert({ ...row, source: "manual" }).select("*").single();
  const { data, error } = await q;
  if (error) return failed(error, "save the goal");
  touch(planId); return { ok: true, data: data as Record<string, unknown> };
}

/** Status is the one field a review meeting changes, so it saves without opening anything. */
export async function setGoalStatus(planId: string, id: string, status: GoalStatus): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_goals").update({ status }).eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "change the status");
  touch(planId); return { ok: true };
}

export async function deleteGoal(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_goals").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove the goal");
  touch(planId); return { ok: true };
}

/* ------------------------------------------------------------------ *
 * KPIs                                                                *
 * ------------------------------------------------------------------ */

/**
 * A measure, named once (§6.125).
 *
 * The product this shape came from repeats each KPI's name down every horizon column. Three copies of one
 * name drift apart the first time somebody edits one of them (§6.41), so the name is stated here and only
 * the TARGET varies by rung.
 *
 * The cap is enforced on the server as well as in the screen, because a cap that only exists in the
 * browser is a suggestion.
 */
export async function saveKpi(
  planId: string,
  input: { id?: string; name: string; unit: string | null; sortOrder?: number; sourceKey?: string | null },
): Promise<Result<{ id: string }>> {
  /*
   * A PLAN-HELD MEASURE IS NAMED BY THE APP, NOT BY THE REQUEST (§6.125.1). Its name and unit are read
   * from the one list, so a browser cannot relabel "Debtor days" into something the figure beside it does
   * not mean. An unrecognised key is refused rather than stored as a client measure with a name attached.
   */
  const held = input.sourceKey ? PLAN_MEASURES.find((m) => m.key === input.sourceKey) : null;
  if (input.sourceKey && !held) return { ok: false, error: "Unknown measure." };

  const name = held ? held.name : input.name.trim();
  if (!name) return { ok: false, error: "Give the measure a name first." };
  const supabase = await createClient();

  if (!input.id) {
    const { count, error: countErr } = await supabase.from("plan_kpis")
      .select("id", { count: "exact", head: true }).eq("plan_id", planId);
    if (countErr) return failed(countErr, "count your measures");
    if ((count ?? 0) >= MAX_KPIS) return { ok: false, error: `Three measures is the limit. Remove one first.` };
  }

  const row = {
    plan_id: planId, name,
    unit: held ? (held.unit || null) : ((input.unit ?? "").trim() || null),
    source_key: held ? held.key : null,
    ...(input.sortOrder === undefined ? {} : { sort_order: Math.trunc(input.sortOrder) }),
  };

  const q = input.id
    ? supabase.from("plan_kpis").update(row).eq("id", input.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_kpis").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save the measure");
  touch(planId); return { ok: true, data: { id: data.id as string } };
}

/** Its targets go with it — the foreign key cascades, which is the honest reading. */
export async function deleteKpi(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_kpis").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove the measure");
  touch(planId); return { ok: true };
}

/**
 * The number wanted for one measure at one rung.
 *
 * BLANK IS NOT NOUGHT. Clearing the box deletes the row rather than storing 0, because "no target set yet"
 * and "a target of zero" are different claims and the column a lender reads has to be able to show the
 * difference (§6.89).
 *
 * The stored value comes back so the screen can reconcile: `numeric(16,3)` rounds a fourth decimal place
 * away silently, and a client who typed one is entitled to be told (§6.123).
 */
export async function saveKpiTarget(
  planId: string, kpiId: string, horizon: string, value: string,
): Promise<Result<{ target: number | null }>> {
  if (!isHorizon(horizon)) return { ok: false, error: "Unknown horizon." };
  const supabase = await createClient();

  /*
   * A MEASURE THE PLAN ANSWERS HAS NO TARGET TO SAVE (§6.125.1). The screen shows no box for one, so
   * reaching here means something other than the screen asked — and the answer is the same either way:
   * the figure is read from the plan, and a stored number beside it would be the second answer this whole
   * section exists to prevent.
   */
  const { data: kpi } = await supabase.from("plan_kpis").select("source_key").eq("id", kpiId).eq("plan_id", planId).maybeSingle();
  if (kpi?.source_key) return { ok: false, error: "That measure comes from your plan — change it where it is set." };

  const text = value.trim();

  if (!text) {
    const { error } = await supabase.from("plan_kpi_targets").delete()
      .eq("plan_id", planId).eq("kpi_id", kpiId).eq("horizon", horizon);
    if (error) return failed(error, "clear the target");
    touch(planId); return { ok: true, data: { target: null } };
  }

  const n = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(n)) return { ok: false, error: "That target is not a number." };

  const { data, error } = await supabase.from("plan_kpi_targets")
    .upsert({ plan_id: planId, kpi_id: kpiId, horizon, target: n }, { onConflict: "kpi_id,horizon" })
    .select("target").single();
  if (error) return failed(error, "save the target");
  touch(planId); return { ok: true, data: { target: data.target === null ? null : Number(data.target) } };
}

export async function continueFromGoals(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "goals") : `/plans/${planId}/dashboard`);
}

/* ------------------------------------------------------------------ *
 * The end of the ninety days                                          *
 * ------------------------------------------------------------------ */

export type ReviewChoice = "done" | "carry" | "drop";

/**
 * CLOSE THE NINETY DAYS (§6.137, open item 23).
 *
 * Each live 90-day goal is done, carried forward, or dropped. Done and dropped goals are stamped with the
 * period they closed under and leave the live list — kept, never deleted. Carried goals stay live as they
 * are. Then the next end date is set.
 *
 * The period being closed is read from the plan, not taken from the browser: a stale tab must not close a
 * period somebody else already closed. The goals are updated before the date moves, so a failure part-way
 * leaves the review still due rather than a new period with last quarter's goals silently in it.
 */
export async function closeNinetyDays(planId: string, decisions: { id: string; choice: ReviewChoice }[], nextEnd: string):
  Promise<Result<{ closedOn: string }>> {
  const supabase = await createClient();
  const { data: s, error: readError } = await supabase.from("plan_settings").select("ninety_day_ends_on").eq("plan_id", planId).maybeSingle();
  if (readError) return failed(readError, "read the current 90 days");
  const ended = s?.ninety_day_ends_on as string | null | undefined;
  if (!ended) return { ok: false, error: "This plan has no 90-day end date to close." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextEnd) || nextEnd <= ended) {
    return { ok: false, error: "The next 90 days have to end after the ones being closed." };
  }

  for (const choice of ["done", "drop"] as const) {
    const ids = decisions.filter((d) => d.choice === choice).map((d) => d.id);
    if (!ids.length) continue;
    const patch = choice === "done"
      ? { status: "done", outcome: "done", closed_period_end: ended }
      : { outcome: "dropped", closed_period_end: ended };
    const { error } = await supabase.from("plan_goals").update(patch)
      .eq("plan_id", planId).eq("horizon", "ninety").is("closed_period_end", null).in("id", ids);
    if (error) return failed(error, "close the 90 days");
  }

  const { error } = await supabase.from("plan_settings").update({ ninety_day_ends_on: nextEnd }).eq("plan_id", planId);
  if (error) return failed(error, "set the next 90 days");
  touch(planId);
  return { ok: true, data: { closedOn: ended } };
}

