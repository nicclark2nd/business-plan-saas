/**
 * One pipeline, run once (§6.67).
 *
 * Five places assembled a forecast — Review forecast, Break-Even, Fixed Assets, the What-If planner and the
 * monthly test — and each of them wrote the same twenty-five lines by hand: assemble GST, assemble the
 * years, push GST onto each year, build the forecast, then rebuild Year 1 month by month off the balances
 * the forecast just computed. Character for character identical, with two silent exceptions that prove the
 * point: only What-If threaded `openingGstPayable` through, and until §6.66.1 three of them opened the
 * monthly view at `prepaid: 0, accrued: 0` while handing it real opening receivables in the same object.
 *
 * That is the §6.52.1 fault at a larger scale: **a copy of the loader is a copy of every future mistake.**
 * The overdraft sweep has to go in exactly here, and going in five times is how it drifts.
 *
 * `checked` versus `forecast` is deliberate and not yet decided. Review forecast appends the monthly
 * invariants to the strip and recomputes `reconciled`; Break-Even and Fixed Assets do not. Both are
 * returned so the extraction changes no screen, and so the choice can be made on purpose later rather than
 * smuggled inside a refactor.
 */
import { assembleBase, assembleMonths, type PlanSources } from "./assemble";
import { assembleGst, type GstPlanSources, type GstAssembly } from "./gst_assemble";
import {
  FORECAST_YEARS, buildForecast,
  type CashTiming, type Forecast, type OpeningBalance, type WorkingCapitalDays,
} from "./model";
import { buildMonthlyCashFlow, monthlyInvariants, type MonthlyCashFlow } from "./monthly";
import { NOT_REGISTERED, type GstSettings } from "../plan/gst";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Everything the engine needs to draw a plan, and nothing that belongs to a screen. */
export type PlanInput = {
  sources: PlanSources;
  opening: OpeningBalance;
  workingCapital: Record<number, WorkingCapitalDays>;
  cashTiming: Record<number, CashTiming>;
  taxRate: number;
  dividendRate: number;
  openingTaxLosses?: number;
  openingRetainedEarnings?: number;
  openingGstPayable?: number;
  /** The plan's tax components (§6.39). Absent or empty means not registered. */
  components?: GstSettings[];
};

export type PlanRun = {
  /** The annual model exactly as `buildForecast` returned it. */
  forecast: Forecast;
  /** Year 1, month by month, off the annual figures — never a second reading of the plan. */
  monthly: MonthlyCashFlow;
  /** The same forecast with the monthly checks folded into the strip and `reconciled` recomputed. */
  checked: Forecast;
  gst: GstAssembly;
};

export function runForecast(input: PlanInput): PlanRun {
  const { sources, opening, workingCapital, cashTiming } = input;
  const components = input.components?.length ? input.components : [NOT_REGISTERED];
  const openingGstPayable = n(input.openingGstPayable);

  /**
   * GST is assembled ONCE and fed to the year and the months from the same place (§6.38), so the liability
   * on the balance sheet and the BAS payment on the cash flow can never be two different readings.
   */
  const gst = assembleGst(sources as unknown as GstPlanSources, components, openingGstPayable);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];

  const forecast = buildForecast({
    base, opening, workingCapital, cashTiming,
    taxRate: input.taxRate, dividendRate: input.dividendRate,
    openingTaxLosses: input.openingTaxLosses, openingRetainedEarnings: input.openingRetainedEarnings,
    openingGstPayable,
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
    shapes: assembleMonths(sources, components, openingGstPayable),
  });

  const invariants = [...forecast.invariants, ...monthlyInvariants(monthly, forecast.cashFlow[1])];
  const checked: Forecast = { ...forecast, invariants, reconciled: invariants.every((i) => i.passed) };

  return { forecast, monthly, checked, gst };
}
