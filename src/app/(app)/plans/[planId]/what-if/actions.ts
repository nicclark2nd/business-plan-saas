"use server";

import { loadPlan } from "@/lib/planLoad";
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
