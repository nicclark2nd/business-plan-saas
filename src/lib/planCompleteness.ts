import { cache } from "react";
import { getCompleteness } from "@/lib/plan";
import { loadPlan } from "@/lib/planLoad";
import { runForecast } from "@/engine/forecast/run";

/**
 * Completeness, including the one section that needs the forecast run (§6.99).
 *
 * WHY THIS FILE EXISTS. `getCompleteness` lives in `plan.ts`, and `planLoad.ts` imports `plan.ts` for the
 * session — so `plan.ts` cannot import `planLoad.ts` back. This sits above both, loads the plan, runs the
 * forecast, and hands the verdict down.
 *
 * `cache` makes it free on the second call in a request, and `loadPlan` is cached too, so the dashboard —
 * which already loads the plan and runs the forecast for its own tiles — pays nothing at all for this.
 *
 * IT FAILS SOFT. A forecast that throws must not take the sidebar down on every page of the app: the
 * verdict becomes `false`, Review forecast reads as not done, and every other section is unaffected. A step
 * wrongly shown as outstanding is a nuisance; a blank application is not (§6.94, the same rule as the logo).
 */
export const getPlanCompleteness = cache(async (planId: string) => {
  let reconciled = false;
  try {
    const { plan } = await loadPlan(planId);
    reconciled = runForecast(plan).forecast.reconciled;
  } catch (e) {
    console.error("completeness forecast", e);
  }
  return getCompleteness(planId, reconciled);
});
