import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { bridgeLines } from "@/engine/cash/bridge";
import { planMonths, planYearLabel } from "@/engine/plan/calendar";
import { CashFlowModule } from "./CashFlowModule";

/**
 * Cash Flow (§6.78). Assembled on the server and handed down finished, like every other statement.
 *
 * Third and last of the three to leave Review forecast, on the same pipeline and the same loader (§6.67).
 * The bridge comes from `forecast.bridge` rather than being derived here — it is the reading the engine has
 * been computing all along, and a second derivation of it would be a second answer (§6.41).
 */
export default async function CashFlowPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const { plan, mode, components, taxLabel, fyEndMonth, firstYear } = await loadPlan(planId);

  const { checked, monthly, gst, overdraft } = runForecast(plan);

  const areas = ["years", "months", "bridge"] as const;
  return (
    <CashFlowModule
      planId={planId} mode={mode}
      cf={checked.cashFlow}
      monthly={monthly}
      overdraft={overdraft}
      bridge={Object.fromEntries(FORECAST_YEARS.map((y) => [y, bridgeLines(checked.bridge[y])]))}
      bridgeTotals={Object.fromEntries(FORECAST_YEARS.map((y) => [y, checked.bridge[y].operatingCashFlow]))}
      netProfit={Object.fromEntries(FORECAST_YEARS.map((y) => [y, checked.pnl[y].netProfit]))}
      months={planMonths(fyEndMonth)}
      yearLabel={planYearLabel(firstYear, fyEndMonth)}
      yearLabels={FORECAST_YEARS.map((y) => `Year ${y}`)}
      reconciled={checked.reconciled}
      gst={{ registered: components.length > 0 }} gstLabel={taxLabel}
      gstSchedules={gst.schedules}
      gstComponents={components.map((c) => ({ label: c.label, rate: c.rate, frequency: c.frequency, reclaimable: c.reclaimable }))}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "years"}
    />
  );
}
