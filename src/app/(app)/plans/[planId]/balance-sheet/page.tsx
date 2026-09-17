import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { cashCycleDays, strengthByYear, workingCapitalMonths } from "@/engine/balance/lines";
import { planMonthNames } from "@/engine/plan/calendar";
import { BalanceSheetModule } from "./BalanceSheetModule";

/**
 * Balance Sheet (§6.77). Assembled on the server and handed down finished, like every other statement.
 *
 * It runs the SAME pipeline Review forecast, Profit & Loss and Break-Even run, from the same loader (§6.67).
 * A balance sheet that disagreed with the cash flow one menu item away would be worse than no balance sheet
 * at all — and the reconciliation strip above says whether it does, before a figure is read.
 */
export default async function BalanceSheetPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const { plan, mode, components, taxLabel, fyEndMonth } = await loadPlan(planId);

  const { checked, monthly } = runForecast(plan);

  const areas = ["years", "working", "strength"] as const;
  return (
    <BalanceSheetModule
      planId={planId} mode={mode}
      bs={checked.balanceSheet}
      strength={strengthByYear(checked.balanceSheet, FORECAST_YEARS)}
      wcMonths={workingCapitalMonths(monthly.months)}
      cycleDays={cashCycleDays(plan.workingCapital[1])}
      days={plan.workingCapital[1]}
      monthNames={planMonthNames(fyEndMonth)}
      yearLabels={FORECAST_YEARS.map((y) => `Year ${y}`)}
      reconciled={checked.reconciled}
      balances={!checked.invariants.some((i) => i.key === "balance-sheet-equation" && !i.passed)}
      gst={{ registered: components.length > 0 }} gstLabel={taxLabel}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "years"}
    />
  );
}
