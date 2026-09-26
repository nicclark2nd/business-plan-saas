import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { impliedCostOfCapital, readGrowth, readStress } from "@/engine/capability/judgements";
import { AssumptionsModule } from "./AssumptionsModule";

/**
 * Assumptions (§6.79). The days themselves come straight off the plan; the forecast is run only so each
 * day can show what it is WORTH — 46 debtor days against this revenue is 275,022 sitting in debtors, and
 * that figure is the reason anybody changes the number above it.
 *
 * Same pipeline, same loader as every statement (§6.67), so the worth shown here and the balance shown on
 * the balance sheet are one reading rather than two.
 *
 * THE CASH FLOOR, THE COST OF CAPITAL AND THE DOWNSIDE (§6.129) come off the same settings row through the
 * same reader the capability dials use, so the box a client fills and the dial it feeds cannot disagree
 * about what is stored and what is blank.
 */
/*
 * `?area=` (§6.129). The pencil on a greyed Financial Capabilities dial links straight to the tab that holds
 * the box it needs — a link that landed on this screen's first tab would leave the client hunting for a field
 * they were just told about, which is worse than no link.
 */
export default async function AssumptionsPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const { plan, mode, impliedFromHistory, assumptionsSet, settings } = await loadPlan(planId);
  const { workingCapital, cashTiming } = plan;
  const run = runForecast(plan);
  const checked = run.checked;
  const monthlyCash = run.monthly?.months?.map((m) => m.closingCash) ?? [];

  return (
    <AssumptionsModule
      planId={planId} mode={mode}
      initialArea={area === "cash" || area === "downside" ? area : "days"}
      revenue={FORECAST_YEARS.map((y) => checked.pnl[y].revenue)}
      cogs={FORECAST_YEARS.map((y) => checked.pnl[y].cogs)}
      workingCapital={workingCapital} cashTiming={cashTiming}
      impliedFromHistory={impliedFromHistory}
      assumptionsSet={assumptionsSet}
      growth={readGrowth(settings)}
      stress={readStress(settings)}
      /* The plan's own dearest borrowing, offered as a starting point and never stored in the client's place. */
      impliedCost={impliedCostOfCapital(plan.sources.funding)}
      /* The lowest month the forecast actually reaches, so a floor is typed against a figure, not into the dark. */
      lowestMonth={monthlyCash.length ? Math.min(...monthlyCash) : null}
    />
  );
}
