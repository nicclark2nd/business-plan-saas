"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { loadPlan } from "@/lib/planLoad";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { FORECAST_YEARS, type WorkingCapitalDays } from "@/engine/forecast/model";
import { saveAssumptions } from "../forecast/actions";

type Result = { ok: true } | { ok: false; error: string };

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
  area: string;
  title: string;
  detail: string;
  year: number;
  quarter: number;
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

  // One lookup, not one per goal: several levers commonly land in the same area.
  const { data: existing, error: readErr } = await supabase.from("plan_goals")
    .select("id, area").eq("plan_id", planId).is("parent_id", null);
  if (readErr) return { ok: false, error: readErr.message };
  const parents = new Map<string, string>((existing ?? []).map((g) => [g.area as string, g.id as string]));

  const rows: Record<string, unknown>[] = [];
  for (const g of goals) {
    if (!isArea(g.area)) return { ok: false, error: `Unknown area: ${g.area}` };
    if (!g.title.trim()) continue;
    let parentId = parents.get(g.area);
    if (!parentId) {
      const { data, error } = await supabase.from("plan_goals")
        .insert({ plan_id: planId, area: g.area, title: "", source: "whatif" }).select("id").single();
      if (error) return { ok: false, error: `Couldn't create the ${g.area} annual goal: ${error.message}` };
      parentId = data.id as string;
      parents.set(g.area, parentId);
    }
    rows.push({
      plan_id: planId, parent_id: parentId, area: g.area,
      title: g.title.trim(), detail: g.detail.trim() || null,
      year: Math.min(5, Math.max(1, Math.trunc(g.year) || 1)),
      quarter: Math.min(4, Math.max(1, Math.trunc(g.quarter) || 1)),
      owner_person_id: g.ownerPersonId || null,
      status: "not_started", source: "whatif",
    });
  }
  if (!rows.length) return { ok: false, error: "Nothing to create." };

  const { error } = await supabase.from("plan_goals").insert(rows);
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}
