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
import { gstSchedule, taxOn, type GstSchedule, type GstSettings } from "../plan/gst";
import { planRevenueMonths, productMonths, sourceOf, type AnyProduct } from "../sales/product";
import { planCogsMonths, planCogsByYear, productCostMonths, fixedCostMonths, fixedCostByYear, type CostProduct, type FixedCost } from "../cogs/direct";
import { overheadMonths, overheadByYear, overheadsMonths, planOverheadLines, type Overhead } from "../overheads/expenses";
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

  // Cost of sales: a product's own cost follows the product's flag, a fixed line follows its own.
  const cogsProducts = p.costProducts.filter(taxed);
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
  /** The full twelve-month schedule of each year, for the screens that show months. */
  schedules: Record<number, GstSchedule>;
  /** What the forecast model consumes. */
  byYear: Record<number, GstOnYear>;
  /** Cost of sales, overheads and capex month by month in Year 1, so the cash flow can show them. */
  year1: { sales: number[]; cogs: number[]; overheads: number[]; capex: number[] };
};

export function assembleGst(p: GstPlanSources, g: GstSettings, openingPayable = 0): GstAssembly {
  const t = taxableSeries(p);
  const cogsShape = shapeOf(t.cogsY1);
  const ohShape = shapeOf(t.ohY1);
  const capexShape = shapeOf(t.capexY1);

  const schedules: Record<number, GstSchedule> = {};
  const byYear: Record<number, GstOnYear> = {};
  let carried = Math.max(0, n(openingPayable));

  for (const year of FORECAST_YEARS) {
    const i = year - 1;
    const sales = t.salesMonths.slice(i * 12, i * 12 + 12);
    const cogs = year === 1 ? t.cogsY1 : onShape(t.cogsYears[i], cogsShape);
    const oh = year === 1 ? t.ohY1 : onShape(t.ohYears[i], ohShape);
    const capex = year === 1 ? t.capexY1 : onShape(t.capexYears[i], capexShape);
    const purchases = Array.from({ length: 12 }, (_, m) => n(cogs[m]) + n(oh[m]) + n(capex[m]));

    const schedule = gstSchedule(sales, purchases, g, carried);
    schedules[year] = schedule;
    byYear[year] = {
      onSales: taxOn(sum(sales), g),
      onCogs: taxOn(sum(cogs), g),
      onOverheads: taxOn(sum(oh), g),
      onCapex: taxOn(sum(capex), g),
      remitted: schedule.remitted,
      payableClosing: schedule.closingPayable,
    };
    carried = schedule.closingPayable;
  }

  return {
    schedules, byYear,
    year1: { sales: t.salesMonths.slice(0, 12), cogs: t.cogsY1, overheads: t.ohY1, capex: t.capexY1 },
  };
}
