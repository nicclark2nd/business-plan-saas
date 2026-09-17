import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { breakEvenByYear, cashCrossover, serviceBreakEven } from "@/engine/breakeven/point";
import { sourceOf, type AnyProduct } from "@/engine/sales/product";
import type { CostProduct } from "@/engine/cogs/direct";
import { planMonthNames, planYearEnding } from "@/engine/plan/calendar";
import { BreakEvenModule } from "./BreakEvenModule";

/**
 * Break-even (§6.49). Assembled on the server and handed down finished, like the forecast it reads
 * (§6.32.3) — there are no sliders here, so nothing needs the engine on the client.
 *
 * It runs the SAME pipeline the Review forecast page runs, from the same loader, because break-even that
 * disagreed with the profit and loss one menu item away would be worse than no break-even at all.
 */
export default async function BreakEvenPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const { plan, mode, fyEndMonth, firstYear, noun } = await loadPlan(planId);
  const { sources } = plan;

  const { forecast, monthly } = runForecast(plan);   // §6.67

  const years = breakEvenByYear(forecast.pnl);
  const products = sources.costProducts as unknown as (CostProduct & { id?: string; name?: string | null })[];
  const services = serviceBreakEven(products, years[0].fixedCosts, 1,
    (c) => sourceOf(c as unknown as AnyProduct, sources.products as unknown as AnyProduct[]));
  const crossover = cashCrossover(monthly.months);

  const areas = ["year", "months", "service"] as const;
  return (
    <BreakEvenModule
      planId={planId} mode={mode} noun={noun}
      years={years} services={services} crossover={crossover}
      months={monthly.months.map((m) => ({ month: m.month, netOperating: m.netOperating, interestPaid: m.interestPaid }))}
      monthNames={planMonthNames(fyEndMonth)}
      yearLabels={FORECAST_YEARS.map((y) => `Year ${y}`)}
      yearEnding={planYearEnding(firstYear, 1)}
      reconciled={forecast.reconciled}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "year"}
    />
  );
}
