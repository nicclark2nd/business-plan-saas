import { loadTargetChecks } from "@/lib/targetChecks";
import { TargetsProvider } from "@/components/module/TargetStrip";
import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { SUGGESTED_STRESS, impliedCostOfCapital, readGrowth, readStress } from "@/engine/capability/judgements";
import { worstYear, type HistoricRow } from "@/engine/capability/actual";
import { createClient } from "@/lib/supabase/server";
import { AssumptionsModule } from "./AssumptionsModule";
import { planMonths } from "@/engine/plan/calendar";

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
  const { plan, mode, impliedFromHistory, assumptionsSet, settings, fyEndMonth, firstYear } = await loadPlan(planId);
  /* The business's own worst year, for the bad-year suggestion (§6.162). */
  const supabase = await createClient();
  const { data: periods } = await supabase.from("plan_historic_periods").select("period_number, revenue, cogs, accounts_receivable").eq("plan_id", planId);
  const worst = worstYear(((periods ?? []) as unknown as HistoricRow[]).map((r) => ({ ...r, revenue: Number(r.revenue), cogs: Number(r.cogs), accounts_receivable: Number(r.accounts_receivable) })), firstYear, SUGGESTED_STRESS);
  const { workingCapital, cashTiming } = plan;
  const run = runForecast(plan);
  const checked = run.checked;
  const monthlyCash = run.monthly?.months?.map((m) => m.closingCash) ?? [];
  const low = monthlyCash.length ? Math.min(...monthlyCash) : null;

  const targets = await loadTargetChecks(planId, "assumptions");
  return (
    <TargetsProvider checks={targets}>
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
        lowestMonth={low}
        /* Which month that is, by name, so the warning says "June" rather than "month 12" (§6.155). */
        lowestMonthName={low === null ? null : planMonths(fyEndMonth)[monthlyCash.indexOf(low)] ?? null}
        /* One month of Year 1 overheads: the usual rule of thumb for a floor, offered, never stored unasked. */
        worst={periods && periods.length > 1 ? worst : null}
        suggestedFloor={checked.pnl[1].overheads > 0 ? Math.round(checked.pnl[1].overheads / 12) : null}
      />
    </TargetsProvider>
  );
}
