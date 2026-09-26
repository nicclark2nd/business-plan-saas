import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadPlan } from "@/lib/planLoad";
import { runForecast } from "@/engine/forecast/run";
import { monthlyProfit } from "@/engine/forecast/monthlyProfit";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { CapabilitiesModule } from "./CapabilitiesModule";
import type { PlanFacts } from "./CapabilitiesModule";

/**
 * FINANCIAL CAPABILITIES (§6.128) — a tool, not a step.
 *
 * It asks nothing of the client that the plan does not already hold, which is why it sits in Tools beside
 * the What-If planner rather than in the numbered path. Nothing on it is saved and nothing it shows moves
 * the plan.
 *
 * THE SAME FORECAST RUN AS EVERY OTHER SCREEN (§6.67). `loadPlan` then `runForecast`, exactly as the
 * dashboard and the statements do — so a cash conversion cycle here cannot disagree with the Assumptions
 * screen, and the lowest month cannot disagree with the dashboard's own chart.
 */
export default async function CapabilitiesPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();

  const [session, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_settings").select("currency").eq("plan_id", planId).maybeSingle(),
  ]);

  const currency = settings.data?.currency ?? "AUD";

  /*
   * THE FACTS CROSS THE WIRE; THE FORMATTER DOES NOT.
   *
   * `CapabilityInput` carries a `money` function, and a function cannot be serialised from a server
   * component to a client one. The module rebuilds it from the currency, which it needs anyway — so the
   * boundary carries data only, and nothing here has to pretend a function is data.
   */
  let input: PlanFacts = {
    pnl: {}, cashFlow: {}, balanceSheet: {}, days: {},
    monthlyCash: [], monthlyProfit: [], debtService: {}, capex: {}, cashBuffer: null,
  };

  try {
    const { plan } = await loadPlan(planId);
    const run = runForecast(plan);
    const f = run.checked ?? run.forecast;

    /*
     * DEBT SERVICE COMES OFF THE CASH FLOW, not out of the funding rows a second time.
     *
     * `debtRepaid` plus `interestPaid` is what the plan actually pays a lender in a year, already
     * including every loan's own schedule, fees and timing. Re-deriving it from the loan table would be a
     * second reading of the same fact, and the two would drift the first time a funding rule changed
     * (§6.41).
     */
    const debtService: Record<number, number> = {};
    const capex: Record<number, number> = {};
    for (const y of FORECAST_YEARS) {
      const cf = f.cashFlow?.[y];
      if (!cf) continue;
      debtService[y] = Math.round((Math.abs(cf.debtRepaid) + Math.abs(cf.interestPaid)) * 100) / 100;
      capex[y] = Math.abs(cf.capex);
    }

    input = {
      ...input,
      pnl: f.pnl ?? {},
      cashFlow: f.cashFlow ?? {},
      balanceSheet: f.balanceSheet ?? {},
      days: plan.workingCapital ?? {},
      monthlyCash: run.monthly?.months?.map((m) => m.closingCash) ?? [],
      monthlyProfit: run.shapesByYear?.[1] ? monthlyProfit(run.shapesByYear[1]) : [],
      debtService, capex,
    };
  } catch (e) {
    /*
     * A plan too empty to forecast is not a fault here. Every metric reports itself unanswerable with the
     * sentence that says what would answer it, which is a more useful screen than an error page.
     */
    console.error("capabilities", planId, e);
  }

  return (
    <CapabilitiesModule
      planId={planId}
      mode={(session?.profile?.mode ?? "guided") as "guided" | "advanced"}
      currency={currency}
      facts={input}
    />
  );
}
