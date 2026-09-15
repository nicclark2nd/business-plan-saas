import { loadPlan } from "@/lib/planLoad";
import { ForecastModule } from "./ForecastModule";
import { assembleBase, assembleMonths } from "@/engine/forecast/assemble";
import { buildForecast, FORECAST_YEARS } from "@/engine/forecast/model";
import { buildMonthlyCashFlow, monthlyInvariants } from "@/engine/forecast/monthly";
import { assembleGst, type GstPlanSources } from "@/engine/forecast/gst_assemble";

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
  const { plan, mode, components, taxLabel, fyEndMonth, firstYear, impliedFromHistory, assumptionsSet } =
    await loadPlan(planId);
  const { sources, opening, workingCapital, cashTiming } = plan;

  /**
   * GST (§6.38). Assembled once and fed into the year and the months from the same place, so the liability
   * on the balance sheet and the BAS payment on the cash flow can never be two different readings.
   */
  const gstParts = assembleGst(sources as unknown as GstPlanSources, components);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gstParts.byYear[y];

  const forecast = buildForecast({
    base, opening, workingCapital, cashTiming,
    taxRate: plan.taxRate, dividendRate: plan.dividendRate,
    openingTaxLosses: plan.openingTaxLosses, openingRetainedEarnings: plan.openingRetainedEarnings,
  });

  /**
   * Year 1 month by month (§6.36), off the same annual figures rather than a second reading of the plan:
   * the opening balances the forecast opened on, the closing balances it computed, and the month series each
   * module already publishes. The invariants it returns are appended to the strip, so a module whose twelve
   * months stop adding to its own year fails visibly here rather than drifting quietly.
   */
  const monthly = buildMonthlyCashFlow({
    openingCash: forecast.cashFlow[1].openingCash,
    opening: {
      accountsReceivable: opening.accountsReceivable, inventory: opening.inventory,
      accountsPayable: opening.accountsPayable, prepaid: 0, accrued: 0,
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
  const checked = {
    ...forecast,
    invariants: [...forecast.invariants, ...monthlyInvariants(monthly, forecast.cashFlow[1])],
  };
  checked.reconciled = checked.invariants.every((i) => i.passed);

  const areas = ["pnl", "cash", "balance", "assumptions"] as const;
  return (
    <ForecastModule
      planId={planId} mode={mode} forecast={checked} monthly={monthly}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "pnl"}
      workingCapital={workingCapital} cashTiming={cashTiming}
      impliedFromHistory={impliedFromHistory}
      assumptionsSet={assumptionsSet}
      fyEndMonth={fyEndMonth} firstYear={firstYear}
      gst={{ registered: components.length > 0 }} gstLabel={taxLabel}
      gstSchedules={gstParts.schedules} gstComponents={components.map((c) => ({ label: c.label, rate: c.rate, frequency: c.frequency, reclaimable: c.reclaimable }))}
    />
  );
}
