import { loadPlan } from "@/lib/planLoad";
import { assembleBase, assembleMonths } from "@/engine/forecast/assemble";
import { buildForecast, FORECAST_YEARS } from "@/engine/forecast/model";
import { buildMonthlyCashFlow } from "@/engine/forecast/monthly";
import { assembleGst, type GstPlanSources } from "@/engine/forecast/gst_assemble";
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
  const { plan, mode, components, fyEndMonth, firstYear, noun } = await loadPlan(planId);
  const { sources, opening, workingCapital, cashTiming } = plan;

  const gstParts = assembleGst(sources as unknown as GstPlanSources, components);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gstParts.byYear[y];

  const forecast = buildForecast({
    base, opening, workingCapital, cashTiming,
    taxRate: plan.taxRate, dividendRate: plan.dividendRate,
    openingTaxLosses: plan.openingTaxLosses, openingRetainedEarnings: plan.openingRetainedEarnings,
  });

  const monthly = buildMonthlyCashFlow({
    openingCash: forecast.cashFlow[1].openingCash,
    opening: {
      accountsReceivable: opening.accountsReceivable, inventory: opening.inventory,
      accountsPayable: opening.accountsPayable, prepaid: opening.prepaid, accrued: opening.accrued,
    },
    closing: {
      accountsReceivable: forecast.workingCapital[1].accountsReceivable,
      inventory: forecast.workingCapital[1].inventory,
      accountsPayable: forecast.workingCapital[1].accountsPayable,
      prepaid: forecast.workingCapital[1].prepaid,
      accrued: forecast.workingCapital[1].accrued,
    },
    taxPaid: forecast.cashFlow[1].taxPaid,
    dividends: forecast.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(sources, components),
  });

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
