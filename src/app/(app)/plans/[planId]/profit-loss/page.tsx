import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { pnlMonths, serviceProfit } from "@/engine/pnl/lines";
import { sourceOf, type AnyProduct } from "@/engine/sales/product";
import type { CostProduct } from "@/engine/cogs/direct";
import { planMonthNames } from "@/engine/plan/calendar";
import { ProfitLossModule } from "./ProfitLossModule";

/**
 * Profit & Loss (§6.76). Assembled on the server and handed down finished, like every other statement.
 *
 * It runs the SAME pipeline Review forecast and Break-Even run, from the same loader (§6.67) — a profit and
 * loss that disagreed with the cash flow one menu item away would be worse than no profit and loss at all.
 * The month series come back from that run rather than being derived again here, because reading the plan
 * a second time is how two readings of one plan start (§6.41).
 */
export default async function ProfitLossPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const { plan, mode, fyEndMonth, noun } = await loadPlan(planId);
  const { sources } = plan;

  const { forecast, shapesByYear } = runForecast(plan);
  const products = sources.costProducts as unknown as (CostProduct & { id?: string; name?: string | null })[];
  const services = serviceProfit(products, (c) => sourceOf(c as unknown as AnyProduct, sources.products as unknown as AnyProduct[]));

  const areas = ["year", "months", "service"] as const;
  return (
    <ProfitLossModule
      planId={planId} mode={mode} noun={noun}
      pnl={forecast.pnl}
      months={pnlMonths(shapesByYear[1])}
      services={services}
      monthNames={planMonthNames(fyEndMonth)}
      yearLabels={FORECAST_YEARS.map((y) => `Year ${y}`)}
      reconciled={forecast.reconciled}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "year"}
    />
  );
}
