/**
 * One entry point for a product's numbers, whichever way it is sold (§6.16, §6.17).
 *   one-off   — price x units, grown year on year, split across the twelve months by percentage.
 *   recurring — an opening book plus clients won month by month, each staying a while; revenue follows
 *               ACTIVE clients, so Year 1 is nothing like price x units.
 * Price rises apply to everyone from the year they take effect (indexed fees), which is how a retainer
 * or a membership is normally repriced.
 */
import { YEARS, yearlyProjection, firstPlanYear, monthlySales, normalizeDistribution, type Growth, type MonthlyDistribution } from "./projection";
import { recurringProjection, type LifeMode } from "./recurring";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type AnyProduct = {
  id?: string;
  average_price: number | null; units_sold: number | null; start_selling_year: number | null;
  clients_from_product_id?: string | null;
  yearly_growth: Growth | null; monthly_distribution?: MonthlyDistribution | null;
  sold_as?: string | null; opening_clients?: number | null; client_life_months?: number | null;
  life_mode?: string | null; monthly_new_clients?: Record<string, number> | null;
};
export const recurring = (p: AnyProduct) => p.sold_as === "recurring";
/** Ongoing lines quote a monthly fee; the column stores what a client is worth in a year. */
export const monthlyFee = (p: AnyProduct) => num(p.average_price) / 12;

/** The plan year whose column holds the base: 0 = selling now, 1–5 = the year it starts. */
const firstYearOf = (p: AnyProduct) => firstPlanYear(p.start_selling_year);

/** The line this one takes its clients from, if any. */
export const sourceOf = (p: AnyProduct, all: AnyProduct[]) =>
  p.clients_from_product_id ? all.find((x) => x.id === p.clients_from_product_id) ?? null : null;
export const isLinked = (p: AnyProduct) => recurring(p) && !!p.clients_from_product_id;

/** Cumulative price factor for each plan year — Year 1 = 1 + g1, and so on. */
const priceFactors = (g: Growth | null | undefined) => {
  let f = 1;
  return YEARS.map((y) => { f = f * (1 + num(g?.[String(y)]?.price) / 100); return f; });
};
// NOTE: a typed price figure (priceValue) is not yet honoured for ongoing lines, whose revenue is a monthly
// fee times client-months rather than price x units. Sales §6.26 covers one-off lines; ongoing lines keep
// percentages until the fee model is revisited.
/**
 * Units — jobs, or clients won — in each plan year: the base count grown by the units change.
 *
 * This mirrors `yearlyProjection` exactly and must keep doing so. An earlier version read the base year as
 * `first || 1`, which for a line selling from Year 1 (first = 0, and 0 is falsy) skipped the Year 1 growth
 * that `yearlyProjection` applies. The annual columns then said 33 units while the twelve months said 30 —
 * so COGS costed a different number of jobs than Sales billed, and a linked line inherited the wrong count.
 */
const newByYear = (p: AnyProduct) => {
  const firstYear = firstPlanYear(p.start_selling_year);
  let n = num(p.units_sold);
  return YEARS.map((year) => {
    if (year < firstYear) return 0;
    if (year > firstYear) {
      const g = p.yearly_growth?.[String(year)];
      n = g?.unitsValue != null ? num(g.unitsValue) : n * (1 + num(g?.units) / 100);
    }
    return r2(n);
  });
};

/**
 * Units — jobs, or clients won — in each of the twelve months of Year 1. What a linked line inherits.
 *
 * A monthly split is WEIGHTS, not percentages that must add to 100 (§6.17), and this divided by 100 while
 * `monthlySales` — which the same product's revenue goes through — divides by the weights' actual total. So
 * on any line whose split did not happen to add to exactly 100, revenue by month added to its year and units
 * by month did not, and cost of sales quietly disagreed with itself: 1,207 out on the live plan, found by the
 * twelve-months check the moment it went on screen (§6.36). One rule for splitting a year, used by both.
 */
export function unitsByMonth(p: AnyProduct): number[] {
  if (firstYearOf(p) > 1) return Array(12).fill(0);
  const y1 = newByYear(p)[0];
  if (recurring(p)) {
    // Clients won each month are counts the client typed, not shares of a year, so they are taken as given.
    const monthly = Array.from({ length: 12 }, (_, i) => num(p.monthly_new_clients?.[String(i + 1)]));
    return monthly.some((v) => v > 0) ? monthly : Array(12).fill(y1 / 12);
  }
  return monthlySales(y1, normalizeDistribution(p.monthly_distribution));
}
/** Units won in each plan year. */
export const unitsByYear = (p: AnyProduct) => newByYear(p);

export type ProductYear = { year: number; revenue: number; clients?: number; newClients?: number; runRate?: number };

/** Revenue in each plan year, plus the client counts behind it for an ongoing line. */
export function productYears(p: AnyProduct, source?: AnyProduct | null): ProductYear[] {
  if (!recurring(p)) return yearlyProjection(num(p.average_price), num(p.units_sold), p.yearly_growth, num(p.start_selling_year) || 1)
    .map((y) => ({ year: y.year, revenue: r2(y.sales) }));
  const { months, years } = recurringBase(p, source);
  const factors = priceFactors(p.yearly_growth);
  return years.map((y, i) => ({
    year: y.year,
    revenue: r2(months.slice(i * 12, i * 12 + 12).reduce((a, m) => a + m.active, 0) * monthlyFee(p) * factors[i]),
    clients: y.activeAtEnd, newClients: y.newClients, runRate: r2(y.activeAtEnd * monthlyFee(p) * 12 * factors[i]),
  }));
}

/** Year 1 by month — the twelve the cash flow uses. */
export function productYear1Months(p: AnyProduct, source?: AnyProduct | null): number[] {
  if (!recurring(p)) {
    const y1 = yearlyProjection(num(p.average_price), num(p.units_sold), p.yearly_growth, num(p.start_selling_year) || 1)[0].sales;
    return monthlySales(y1, normalizeDistribution(p.monthly_distribution));
  }
  const { months } = recurringBase(p, source);
  const f = priceFactors(p.yearly_growth)[0];
  return months.slice(0, 12).map((m) => r2(m.active * monthlyFee(p) * f));
}

/** Active clients at the end of each month of Year 1 — shown beside the acquisition boxes. */
export function productYear1Clients(p: AnyProduct, source?: AnyProduct | null): number[] {
  return recurring(p) ? recurringBase(p, source).months.slice(0, 12).map((m) => m.active) : [];
}
/** Clients arriving in each month of Year 1 — entered by hand, or inherited from the line they come from. */
export function newClientsYear1(p: AnyProduct, source?: AnyProduct | null): number[] {
  return source ? unitsByMonth(source) : unitsByMonth(p);
}

function recurringBase(p: AnyProduct, source?: AnyProduct | null) {
  const first = firstYearOf(p);
  // A linked line takes both its timing and its numbers from the line that feeds it.
  const byYear = source ? unitsByYear(source) : newByYear(p);
  const y1 = source ? unitsByMonth(source) : first > 1 ? Array(12).fill(0) : unitsByMonth(p);
  return recurringProjection({
    monthlyPrice: 1,                       // priced outside, so the year's fee rise can be applied
    openingClients: !source && first > 1 ? 0 : num(p.opening_clients),
    newByMonth: y1, newByYear: byYear,
    averageLifeMonths: num(p.client_life_months) || 12,
    lifeMode: (p.life_mode === "fixed" ? "fixed" : "average") as LifeMode,
  });
}

/** Client-months in each plan year — what an ongoing line's revenue AND its cost to serve are both proportional to. */
export function clientMonthsByYear(p: AnyProduct, source?: AnyProduct | null): number[] {
  if (!recurring(p)) return YEARS.map(() => 0);
  const { months } = recurringBase(p, source);
  return YEARS.map((_, i) => r2(months.slice(i * 12, i * 12 + 12).reduce((a, m) => a + m.active, 0)));
}
/** The plan year whose column holds the base price, cost and units. Exported for the COGS engine. */
export const baseYear = (p: AnyProduct) => firstYearOf(p);

/** Total revenue by plan year across every product — what the forecast's top line consumes. */
export function planRevenueByYear(products: AnyProduct[]) {
  const totals = YEARS.map(() => 0);
  for (const p of products) productYears(p, sourceOf(p, products)).forEach((y, i) => { totals[i] += y.revenue; });
  return YEARS.map((year, i) => ({ year, value: r2(totals[i]) }));
}
/**
 * All sixty months, for the things that follow revenue past Year 1 — revenue-linked finance is the first, and
 * it repays out of sales for as long as the cap takes (§6.37).
 *
 * Each year's twelve are settled against that year's own total from `productYears`, December taking the
 * remainder, so the sixty months and the five years can never say different things.
 */
export function productMonths(p: AnyProduct, source?: AnyProduct | null): number[] {
  const years = productYears(p, source);
  const out: number[] = [];
  if (recurring(p)) {
    const { months } = recurringBase(p, source);
    const factors = priceFactors(p.yearly_growth);
    for (let y = 0; y < 5; y++) {
      const raw = months.slice(y * 12, y * 12 + 12).map((m) => num(m.active) * monthlyFee(p) * factors[y]);
      out.push(...settleTo(raw, years[y].revenue));
    }
    return out;
  }
  const d = normalizeDistribution(p.monthly_distribution);
  for (let y = 0; y < 5; y++) out.push(...monthlySales(years[y].revenue, d));
  return out;
}

/** Twelve raw figures rounded to a stated total, the last month taking the remainder (§6.17). */
function settleTo(raw: number[], total: number): number[] {
  const out = raw.map(r2);
  const first11 = out.slice(0, 11).reduce((a, b) => a + b, 0);
  out[11] = r2(num(total) - first11);
  return out;
}

/** Sixty months of revenue across the plan. */
export function planRevenueMonths(products: AnyProduct[]): number[] {
  const totals = Array(60).fill(0);
  for (const p of products) productMonths(p, sourceOf(p, products)).forEach((v, i) => { totals[i] += v; });
  return totals.map(r2);
}

/** Year 1 by month across every product. */
export function planYear1Months(products: AnyProduct[]) {
  const totals = Array(12).fill(0);
  for (const p of products) productYear1Months(p, sourceOf(p, products)).forEach((v, i) => { totals[i] += v; });
  return totals.map(r2);
}
/** What an ongoing book is worth a year today. */
export const bookNow = (p: AnyProduct) => r2(num(p.opening_clients) * monthlyFee(p) * 12);
