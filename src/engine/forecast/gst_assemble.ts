/**
 * The plan's GST, assembled (§6.38).
 *
 * Like `assemble.ts`, this computes no business figure of its own: it reads the same month series the
 * screens draw from, asks each line whether tax applies to it, and hands the result to `gstSchedule`.
 *
 * **One assumption is stated here and nowhere else.** The tax owed at a year end depends on when the returns
 * fall due inside that year, so every year needs a month-by-month shape, and only Year 1 has one for costs.
 * Years 2 to 5 take Year 1's own monthly proportions applied to their own totals — the same thing Sales
 * already does, where one monthly split serves all five years. It is exact in Year 1 by construction (Year
 * 1's proportions times Year 1's total give Year 1's months back), and for the later years it says the
 * business keeps the shape it has rather than inventing a new one. Revenue does not need the assumption:
 * `planRevenueMonths` produces all sixty months for real, so it is used for real.
 */
import { FORECAST_YEARS, type GstOnYear } from "./model";
import { gstScheduleFromTax, taxOn, type GstSchedule, type GstSettings } from "../plan/gst";
import { planRevenueMonths, sourceOf, type AnyProduct } from "../sales/product";
import { planCogsMonths, planCogsByYear, type CostProduct, type FixedCost } from "../cogs/direct";
import { overheadByYear, overheadsMonths, planOverheadLines, type Overhead } from "../overheads/expenses";
import { capexMonths, capexByYear, type FixedAsset } from "../assets/depreciation";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100 + 0;
const sum = (a: number[]) => r2(a.reduce((x, y) => x + n(y), 0));

/** Anything that can be taxed or not. A row with no flag is taxable, which is the ordinary case. */
export const applies = (row: { gst_applies?: boolean | null } | null | undefined) => row?.gst_applies !== false;
/** The same test, for the loosely-typed rows the overhead lines carry. */
const taxed = (row: unknown) => (row as { gst_applies?: boolean | null } | null)?.gst_applies !== false;

/**
 * Twelve proportions of a year, used to give a later year the shape of Year 1. A year with nothing in it
 * falls back to an even spread rather than dividing by nothing.
 */
export function shapeOf(months: number[]): number[] {
  const total = sum(months);
  if (!(Math.abs(total) > 0)) return Array.from({ length: 12 }, () => 1 / 12);
  return months.map((m) => n(m) / total);
}

/** A year's total, spread on a shape, December taking the remainder so the twelve add to it exactly. */
export function onShape(total: number, shape: number[]): number[] {
  const out = shape.map((f) => r2(n(total) * f));
  out[11] = r2(n(total) - out.slice(0, 11).reduce((a, b) => a + b, 0));
  return out;
}

export type GstPlanSources = {
  products: AnyProduct[];
  costProducts: CostProduct[];
  fixedCogs: FixedCost[];
  overheads: Overhead[];
  salaries: number[];
  marketing: number[];
  onCostPct: number;
  assets: FixedAsset[];
};

/** The taxable half of each driver — the lines the client has not marked exempt. */
function taxableSeries(p: GstPlanSources) {
  const taxedProducts = p.products.filter(taxed);
  const salesMonths = planRevenueMonths(taxedProducts.length === p.products.length
    ? p.products
    : taxedProducts);

  /**
   * Cost of sales. A product's flag governs what it CHARGES, not what it CLAIMS, and the two are genuinely
   * different: a GST-free sale is zero-rated, so an exporter charges nothing on the sale and still claims
   * every credit on what it cost to make. Filtering the cost side by the sales flag stripped those credits
   * and quietly understated an exporter's cash. Fixed cost lines keep their own flag, because those are
   * purchase decisions in their own right.
   *
   * Deliberately not modelled: input-taxed supplies — residential rent, most financial services — where
   * the sale is untaxed AND the credits are denied. That is a different election, and rarer than exporting.
   */
  const cogsProducts = p.costProducts;
  const cogsFixed = p.fixedCogs.filter(taxed);
  const cogsY1 = planCogsMonths(cogsProducts, cogsFixed, (c) => sourceOf(c, p.products));
  const cogsYears = FORECAST_YEARS.map((_, i) =>
    r2(planCogsByYear(cogsProducts, cogsFixed, (c) => sourceOf(c, p.products))[i].total));

  /**
   * Overheads: the People line carries wages, which are never taxed, and claiming credits on a payroll
   * would invent tens of thousands a year. It is excluded whatever its flag says — a synced line has no
   * row of its own to carry a flag on.
   */
  const ohLines = planOverheadLines(p.overheads, p.salaries, p.marketing)
    .filter(({ o }) => o.source !== "people" && !o.on_cost && taxed(o));
  const ohY1 = overheadsMonths(ohLines, 0);                    // on-costs are payroll; never taxed
  const ohYears = FORECAST_YEARS.map((_, i) =>
    r2(ohLines.reduce((a, { o, synced }) => a + n(overheadByYear(o, synced)[i]), 0)));

  const taxedAssets = p.assets.filter(taxed);
  const capexY1 = capexMonths(taxedAssets);
  const capexYears = FORECAST_YEARS.map((_, i) => r2(taxedAssets.reduce((a, x) => a + n(capexByYear(x)[i]), 0)));

  return { salesMonths, cogsY1, cogsYears, ohY1, ohYears, capexY1, capexYears };
}

export type GstAssembly = {
  /** The whole twelve-month schedule of each year, every component added together. */
  schedules: Record<number, GstSchedule>;
  /** The same, kept apart, so a screen can say what is GST and what is PST. */
  byComponent: Record<number, { label: string; schedule: GstSchedule }[]>;
  /** What the forecast model consumes. */
  byYear: Record<number, GstOnYear>;
  /**
   * Year 1's tax, month by month, ready for the cash flow. Computed here once and read there, rather than
   * the rate being applied a second time somewhere else (§6.39).
   */
  year1: { onSales: number[]; onCogs: number[]; onOverheads: number[]; onCapex: number[]; remitted: number[] };
};

const ZERO_SCHEDULE: GstSchedule = {
  months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, collected: 0, credits: 0, net: 0, remitted: 0, payable: 0 })),
  collected: 0, credits: 0, net: 0, remitted: 0, closingPayable: 0,
};

/** Two schedules added together — a province with both a GST and a PST files both, and holds both. */
function addSchedules(a: GstSchedule, b: GstSchedule): GstSchedule {
  return {
    months: a.months.map((m, i) => ({
      month: m.month,
      collected: r2(m.collected + b.months[i].collected),
      credits: r2(m.credits + b.months[i].credits),
      net: r2(m.net + b.months[i].net),
      remitted: r2(m.remitted + b.months[i].remitted),
      payable: r2(m.payable + b.months[i].payable),
    })),
    collected: r2(a.collected + b.collected), credits: r2(a.credits + b.credits),
    net: r2(a.net + b.net), remitted: r2(a.remitted + b.remitted),
    closingPayable: r2(a.closingPayable + b.closingPayable),
  };
}

/**
 * Assemble the plan's tax, however many taxes it has (§6.39).
 *
 * Each component runs its own schedule on its own filing cycle, carrying its own balance from year to year,
 * and the results are added. That is what lets British Columbia charge a reclaimable 5 % GST quarterly and a
 * non-reclaimable 7 % PST beside it without either one knowing the other exists.
 */
export function assembleGst(
  p: GstPlanSources, components: GstSettings[], openingPayable = 0,
): GstAssembly {
  const live = components.filter((c) => c.registered && c.rate > 0);
  const t = taxableSeries(p);
  const cogsShape = shapeOf(t.cogsY1);
  const ohShape = shapeOf(t.ohY1);
  const capexShape = shapeOf(t.capexY1);

  const schedules: Record<number, GstSchedule> = {};
  const byComponent: Record<number, { label: string; schedule: GstSchedule }[]> = {};
  const byYear: Record<number, GstOnYear> = {};
  const zero12 = () => Array.from({ length: 12 }, () => 0);
  const year1 = { onSales: zero12(), onCogs: zero12(), onOverheads: zero12(), onCapex: zero12(), remitted: zero12() };

  // One carried balance per component: each files on its own cycle, so each owes its own closing period.
  const carried = live.map(() => 0);
  if (live.length) carried[0] = Math.max(0, n(openingPayable));

  for (const year of FORECAST_YEARS) {
    const i = year - 1;
    const sales = t.salesMonths.slice(i * 12, i * 12 + 12);
    const cogs = year === 1 ? t.cogsY1 : onShape(t.cogsYears[i], cogsShape);
    const oh = year === 1 ? t.ohY1 : onShape(t.ohYears[i], ohShape);
    const capex = year === 1 ? t.capexY1 : onShape(t.capexYears[i], capexShape);
    let combined = ZERO_SCHEDULE;
    const parts: { label: string; schedule: GstSchedule }[] = [];
    const totals = { onSales: 0, onCogs: 0, onOverheads: 0, onCapex: 0, remitted: 0, payableClosing: 0 };

    live.forEach((c, ci) => {
      /**
       * The rate is applied once, per line, here — and the schedule is handed the results rather than the
       * bases. Rounding does not distribute: the tax on (cost + overheads + capex) is not always the tax on
       * each of them added up, and at Quebec's 9.975 % that seam put the balance sheet eleven cents out,
       * because the liability came from one calculation and the cash lines from the other (§6.39).
       */
      const taxed = (a: number[]) => a.map((v) => taxOn(v, c));
      const onSalesM = taxed(sales);
      const onCogsM = c.reclaimable ? taxed(cogs) : zero12();
      const onOhM = c.reclaimable ? taxed(oh) : zero12();
      const onCapexM = c.reclaimable ? taxed(capex) : zero12();
      const creditsM = Array.from({ length: 12 }, (_, m) => r2(onCogsM[m] + onOhM[m] + onCapexM[m]));

      const schedule = gstScheduleFromTax(onSalesM, creditsM, c, carried[ci]);
      carried[ci] = schedule.closingPayable;
      combined = addSchedules(combined, schedule);
      parts.push({ label: c.label, schedule });

      totals.onSales = r2(totals.onSales + sum(onSalesM));
      totals.onCogs = r2(totals.onCogs + sum(onCogsM));
      totals.onOverheads = r2(totals.onOverheads + sum(onOhM));
      totals.onCapex = r2(totals.onCapex + sum(onCapexM));
      totals.remitted = r2(totals.remitted + schedule.remitted);
      totals.payableClosing = r2(totals.payableClosing + schedule.closingPayable);

      if (year === 1) {
        for (let m = 0; m < 12; m++) {
          year1.onSales[m] = r2(year1.onSales[m] + onSalesM[m]);
          year1.onCogs[m] = r2(year1.onCogs[m] + onCogsM[m]);
          year1.onOverheads[m] = r2(year1.onOverheads[m] + onOhM[m]);
          year1.onCapex[m] = r2(year1.onCapex[m] + onCapexM[m]);
          year1.remitted[m] = r2(year1.remitted[m] + schedule.months[m].remitted);
        }
      }
    });

    schedules[year] = combined;
    byComponent[year] = parts;
    byYear[year] = { ...totals };
  }

  return { schedules, byComponent, byYear, year1 };
}
