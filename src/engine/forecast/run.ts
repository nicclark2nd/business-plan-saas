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
import { facilitiesFrom } from "../funding/sources";
import { sweepOverdraft, type OverdraftRun } from "../funding/overdraft";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

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
  /** What the facility did, or null when the plan has none (§6.72). */
  overdraft: OverdraftRun | null;
};

/** Enough passes for the tax feedback to settle; more than this means something is oscillating. */
const MAX_PASSES = 6;
const CENTS = 0.5;

/** Two sweeps are the same answer when every year agrees to within the tolerance the invariants use. */
function settled(a: OverdraftRun, b: OverdraftRun): boolean {
  for (const y of FORECAST_YEARS) {
    const x = a.byYear[y], z = b.byYear[y];
    if (Math.abs(x.interest - z.interest) > CENTS) return false;
    if (Math.abs(x.drawn - z.drawn) > CENTS) return false;
    if (Math.abs(x.repaid - z.repaid) > CENTS) return false;
    if (Math.abs(x.closingDrawn - z.closingDrawn) > CENTS) return false;
  }
  return true;
}

export function runForecast(input: PlanInput): PlanRun {
  const { sources, opening, workingCapital, cashTiming } = input;
  const components = input.components?.length ? input.components : [NOT_REGISTERED];
  const openingGstPayable = n(input.openingGstPayable);

  /**
   * GST is assembled ONCE and fed to the year and the months from the same place (§6.38), so the liability
   * on the balance sheet and the BAS payment on the cash flow can never be two different readings.
   */
  const gst = assembleGst(sources as unknown as GstPlanSources, components, openingGstPayable);
  const facilities = facilitiesFrom(sources.funding);

  /**
   * ONE PASS OF THE PLAN, given what the facility is currently believed to do (§6.72).
   *
   * The facility is not in `assembleBase` and never will be: a limit is not money arriving, and
   * `loanMonths` returns an empty schedule for one. Everything it does is added here, in both places at
   * once — the year, and that year's twelve months — so the months cannot stop adding to their own year.
   */
  const pass = (od: OverdraftRun | null) => {
    const base = assembleBase(sources);
    for (const y of FORECAST_YEARS) {
      base[y].gst = gst.byYear[y];
      if (!od) continue;
      const b = od.byYear[y];
      base[y].interest = r2(base[y].interest + b.interest);      // costs the P&L, so it costs the tax too
      base[y].debtProceeds = r2(base[y].debtProceeds + b.drawn);
      base[y].debtRepaid = r2(base[y].debtRepaid + b.repaid);
      // Repayable on demand, so a drawn balance is current debt whatever year it is sitting in.
      base[y].debtCurrent = r2(base[y].debtCurrent + b.closingDrawn);
    }

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
      const shapes = assembleMonths(sources, components, openingGstPayable, y);
      if (od) {
        for (let i = 0; i < 12; i++) {
          const m = od.months[(y - 1) * 12 + i];
          shapes.interest[i] = r2(shapes.interest[i] + m.interest + m.fee);
          shapes.debtProceeds[i] = r2(shapes.debtProceeds[i] + m.drawn);
          shapes.debtRepaid[i] = r2(shapes.debtRepaid[i] + m.repaid);
        }
      }
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
        shapes,
      });
    }
    return { forecast, monthlyByYear };
  };

  /**
   * THE FEEDBACK LOOP.
   *
   * The sweep has to be fed the cash movement BEFORE the facility acts, so whatever the last pass injected
   * is taken straight back out again, month by month. What genuinely changes between passes is the TAX:
   * the facility's interest lowers taxable profit, which lowers the tax paid, which leaves more cash, which
   * means a smaller draw and less interest. That settles in two or three passes.
   *
   * If it has not settled by `MAX_PASSES` the plan is not reported as fine. It carries a failed invariant
   * and the reconciliation strip says so, which is the same way every other engine disagreement surfaces.
   */
  const preFacility = (run: ReturnType<typeof pass>, od: OverdraftRun | null) =>
    FORECAST_YEARS.flatMap((y) => run.monthlyByYear[y].months.map((m, i) => {
      if (!od) return m.netMovement;
      const o = od.months[(y - 1) * 12 + i];
      return r2(m.netMovement + o.interest + o.fee - o.drawn + o.repaid);
    }));

  let od: OverdraftRun | null = null;
  let run = pass(null);
  let converged = facilities.length === 0;
  if (facilities.length) {
    for (let k = 0; k < MAX_PASSES; k++) {
      const next = sweepOverdraft({
        openingCash: run.forecast.cashFlow[1].openingCash,
        netMovement: preFacility(run, od),
        facilities,
      });
      if (od && settled(od, next)) { converged = true; break; }
      od = next;
      run = pass(od);
    }
  }
  const { forecast, monthlyByYear } = run;
  const monthly = monthlyByYear[1];

  const invariants = [
    ...forecast.invariants,
    ...FORECAST_YEARS.flatMap((y) => monthlyInvariants(monthlyByYear[y], forecast.cashFlow[y], y)),
    ...(converged ? [] : [{
      key: "overdraft-settled",
      label: `The overdraft did not settle in ${MAX_PASSES} passes — the facility's cost and the tax on it are chasing each other`,
      year: 1 as const, difference: 0, passed: false,
    }]),
  ];
  const checked: Forecast = { ...forecast, invariants, reconciled: invariants.every((i) => i.passed) };

  return { forecast, monthly, monthlyByYear, checked, gst, overdraft: od };
}
