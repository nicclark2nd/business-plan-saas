import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { AssumptionsModule } from "./AssumptionsModule";

/**
 * Assumptions (§6.79). The days themselves come straight off the plan; the forecast is run only so each
 * day can show what it is WORTH — 46 debtor days against this revenue is 275,022 sitting in debtors, and
 * that figure is the reason anybody changes the number above it.
 *
 * Same pipeline, same loader as every statement (§6.67), so the worth shown here and the balance shown on
 * the balance sheet are one reading rather than two.
 */
export default async function AssumptionsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { plan, mode, impliedFromHistory, assumptionsSet } = await loadPlan(planId);
  const { workingCapital, cashTiming } = plan;
  const { checked } = runForecast(plan);

  return (
    <AssumptionsModule
      planId={planId} mode={mode}
      revenue={FORECAST_YEARS.map((y) => checked.pnl[y].revenue)}
      cogs={FORECAST_YEARS.map((y) => checked.pnl[y].cogs)}
      workingCapital={workingCapital} cashTiming={cashTiming}
      impliedFromHistory={impliedFromHistory}
      assumptionsSet={assumptionsSet}
    />
  );
}
