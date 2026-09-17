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
  /** And the cash flow, the last to leave (§6.78). */
  if (area === "cash") redirect(`/plans/${planId}/cash-flow`);
  /** And the assumptions grid, which went up to Financials with the rest of the inputs (§6.79). */
  if (area === "assumptions") redirect(`/plans/${planId}/assumptions`);
  const { plan, mode, taxLabel } = await loadPlan(planId);

  /**
   * One pipeline (§6.67), and this screen takes only the CHECKS off it. `checked` is the forecast with the
   * monthly checks folded in, so twelve months that stop adding to their own year fail visibly here rather
   * than drifting quietly — and it is the same run the three statements are drawn from, which is the whole
   * reason the strip above them can be trusted.
   */
  const { checked } = runForecast(plan);

  return (
    <ForecastModule planId={planId} mode={mode} forecast={checked} gstLabel={taxLabel} />
  );
}
