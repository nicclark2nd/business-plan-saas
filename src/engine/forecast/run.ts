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
  /** All five years, month by month. Year 1 is the same object as `monthly`. */
  monthlyByYear: Record<number, MonthlyCashFlow>;
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

  /**
   * Every year, month by month (§6.71). Year 1 used to be the only one that existed, because
   * `assembleMonths` was sliced to it — so an overdraft could only ever have been swept through the first
   * twelve months of a five-year plan.
   *
   * Each year opens on the LAST year's closing balances, never on the plan's opening ones, which is the
   * whole reason these have to be built in order rather than independently.
   */
  const monthlyByYear: Record<number, MonthlyCashFlow> = {};
  for (const y of FORECAST_YEARS) {
    const prior = y === 1 ? null : forecast.workingCapital[y - 1];
    monthlyByYear[y] = buildMonthlyCashFlow({
      openingCash: forecast.cashFlow[y].openingCash,
      opening: prior
        ? { accountsReceivable: prior.accountsReceivable, inventory: prior.inventory, accountsPayable: prior.accountsPayable, prepaid: prior.prepaid, accrued: prior.accrued }
        : { accountsReceivable: opening.accountsReceivable, inventory: opening.inventory, accountsPayable: opening.accountsPayable, prepaid: opening.prepaid, accrued: opening.accrued },
      closing: {
        accountsReceivable: forecast.workingCapital[y].accountsReceivable,
        inventory: forecast.workingCapital[y].inventory,
        accountsPayable: forecast.workingCapital[y].accountsPayable,
        prepaid: forecast.workingCapital[y].prepaid,
        accrued: forecast.workingCapital[y].accrued,
      },
      taxPaid: forecast.cashFlow[y].taxPaid,
      dividends: forecast.cashFlow[y].dividendsPaid,
      shapes: assembleMonths(sources, components, openingGstPayable, y),
    });
  }
  const monthly = monthlyByYear[1];

  const invariants = [
    ...forecast.invariants,
    ...FORECAST_YEARS.flatMap((y) => monthlyInvariants(monthlyByYear[y], forecast.cashFlow[y], y)),
  ];
  const checked: Forecast = { ...forecast, invariants, reconciled: invariants.every((i) => i.passed) };

  return { forecast, monthly, monthlyByYear, checked, gst };
}
