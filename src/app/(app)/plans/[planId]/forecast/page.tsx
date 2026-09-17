import { redirect } from "next/navigation";
import { loadPlan } from "@/lib/planLoad";
import { ForecastModule } from "./ForecastModule";
import { runForecast } from "@/engine/forecast/run";

/**
 * The forecast is assembled on the server and handed down finished (§6.32.3). Nothing on the client
 * recomputes any of it, so a figure can never differ between the statement showing it and the check
 * verifying it. The plan itself comes from `loadPlan` — the one loader this screen and the What-If planner
 * share, so the two can never read the same plan differently (§6.41).
 */
export default async function ForecastPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  /**
   * The profit and loss used to be this module's first tab and is its own module now (§6.76). A bookmark or
   * an old link saying `?area=pnl` is sent to where the thing it asked for actually went — falling back to
   * the cash flow would land somebody on a statement they did not ask for and look like it worked.
   */
  if (area === "pnl") redirect(`/plans/${planId}/profit-loss`);
  /** And the balance sheet, which left the same way in §6.77. Same reasoning: send the link where the thing went. */
  if (area === "balance") redirect(`/plans/${planId}/balance-sheet`);
  const { plan, mode, components, taxLabel, fyEndMonth, firstYear, impliedFromHistory, assumptionsSet } =
    await loadPlan(planId);
  const { workingCapital, cashTiming } = plan;

  /**
   * GST (§6.38). Assembled once and fed into the year and the months from the same place, so the liability
   * on the balance sheet and the BAS payment on the cash flow can never be two different readings.
   */
  /**
   * One pipeline (§6.67): GST assembled once, the five years built, then Year 1 month by month off the
   * balances the year just computed rather than a second reading of the plan. `checked` is the forecast
   * with the monthly checks folded into the strip, so twelve months that stop adding to their own year
   * fail visibly here instead of drifting quietly.
   */
  const { checked, monthly, gst, overdraft } = runForecast(plan);

  const areas = ["cash", "assumptions"] as const;
  return (
    <ForecastModule
      planId={planId} mode={mode} forecast={checked} monthly={monthly} overdraft={overdraft}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "cash"}
      workingCapital={workingCapital} cashTiming={cashTiming}
      impliedFromHistory={impliedFromHistory}
      assumptionsSet={assumptionsSet}
      fyEndMonth={fyEndMonth} firstYear={firstYear}
      gst={{ registered: components.length > 0 }} gstLabel={taxLabel}
      gstSchedules={gst.schedules} gstComponents={components.map((c) => ({ label: c.label, rate: c.rate, frequency: c.frequency, reclaimable: c.reclaimable }))}
    />
  );
}
