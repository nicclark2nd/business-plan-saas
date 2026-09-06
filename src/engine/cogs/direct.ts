/**
 * COGS — the direct cost of what you sell (§6.18).
 *
 * A cost follows the way the line is sold, exactly as its revenue does:
 *   one-off job     — a cost for every unit sold. `cost_per_unit` is what one job costs.
 *   ongoing client  — a cost for every month a client is on the books. `cost_per_unit` is what one client
 *                     costs in a YEAR (mirroring `average_price`), so the two are directly comparable and the
 *                     margin per client reads straight off them.
 * Cost increases compound from the line's start year, the same rule the price follows, so a line starting in
 * Year 3 carries its Year 3 cost and rises from Year 4. A line with no direct cost — a royalty, a licence fee —
 * is simply left at zero, which the per-unit model can state honestly rather than fudge.
 *
 * Fixed COGS (a production wage, a yard) does not vary with volume: an annual amount, its own yearly increases
 * and its own split across the twelve months.
 */
import { YEARS, yearlyProjection, normalizeDistribution, monthlySales, type MonthlyDistribution } from "../sales/projection";
import { recurring, baseYear, unitsByMonth, productYears, productYear1Clients, clientMonthsByYear, type AnyProduct } from "../sales/product";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type CostProduct = AnyProduct & { cost_per_unit?: number | null; yearly_cost_increase?: Record<string, number> | null };

/** What one unit (or one client-year) costs in each plan year. The base belongs to the start year. */
export function unitCostByYear(p: CostProduct): number[] {
  const first = baseYear(p);
  let cost = num(p.cost_per_unit);
  return YEARS.map((year) => {
    if (year > first) cost = cost * (1 + num(p.yearly_cost_increase?.[String(year)]) / 100);
    return year < first ? 0 : cost;
  });
}

export type ProductCostYear = {
  year: number; volume: number; unitCost: number; cost: number;
  revenue: number; grossProfit: number; margin: number | null;
};

/** Cost, revenue, gross profit and margin for one product in each plan year. */
export function productCostYears(p: CostProduct, source?: AnyProduct | null): ProductCostYear[] {
  const first = baseYear(p);
  const costs = unitCostByYear(p);
  const rev = productYears(p, source);
  // A one-off line's volume is units sold; an ongoing line's is client-months, and its cost is quoted per year.
  const volumes = recurring(p)
    ? clientMonthsByYear(p, source)
    : yearlyProjection(num(p.average_price), num(p.units_sold), p.yearly_growth, num(p.start_selling_year) || 1).map((y) => y.units);
  return YEARS.map((year, i) => {
    const volume = year < first ? 0 : r2(volumes[i]);
    const cost = r2(volume * (recurring(p) ? costs[i] / 12 : costs[i]));
    const revenue = rev[i].revenue;
    return { year, volume, unitCost: r2(costs[i]), cost, revenue, grossProfit: r2(revenue - cost), margin: revenue ? r2(((revenue - cost) / revenue) * 100) : null };
  });
}

/** Year 1 by month — a one-off line costs when it sells, an ongoing line costs while the client is on the books. */
export function productCostMonths(p: CostProduct, source?: AnyProduct | null): number[] {
  const c = unitCostByYear(p)[0];
  if (recurring(p)) return productYear1Clients(p, source).map((active) => r2(active * (c / 12)));
  return unitsByMonth(p).map((u) => r2(u * c));
}

/** Today's cost, before any increase — what the toolbar reconciles against Historic. */
export const currentCost = (p: CostProduct) => {
  if (baseYear(p) > 0) return 0;                                  // not selling yet, nothing to reconcile
  return recurring(p)
    ? r2(num(p.opening_clients) * num(p.cost_per_unit))
    : r2(num(p.cost_per_unit) * num(p.units_sold));
};

// ---------- fixed COGS ----------
export type FixedCost = { annual_cost: number | null; yearly_growth_rates?: Record<string, number> | null; monthly_distribution?: MonthlyDistribution | null };

export function fixedCostByYear(f: FixedCost): number[] {
  let v = num(f.annual_cost);
  return YEARS.map((year) => { v = v * (1 + num(f.yearly_growth_rates?.[String(year)]) / 100); return r2(v); });
}
export const fixedCostMonths = (f: FixedCost) => monthlySales(fixedCostByYear(f)[0], normalizeDistribution(f.monthly_distribution));

// ---------- the plan ----------
export type CogsYear = { year: number; variable: number; fixed: number; total: number; revenue: number; grossProfit: number; margin: number | null };

export function planCogsByYear(products: CostProduct[], fixed: FixedCost[], sourceFor: (p: CostProduct) => AnyProduct | null = () => null): CogsYear[] {
  const variable = YEARS.map(() => 0), revenue = YEARS.map(() => 0), fixedTotals = YEARS.map(() => 0);
  for (const p of products) productCostYears(p, sourceFor(p)).forEach((y, i) => { variable[i] += y.cost; revenue[i] += y.revenue; });
  for (const f of fixed) fixedCostByYear(f).forEach((v, i) => { fixedTotals[i] += v; });
  return YEARS.map((year, i) => {
    const total = r2(variable[i] + fixedTotals[i]);
    const rev = r2(revenue[i]);
    return { year, variable: r2(variable[i]), fixed: r2(fixedTotals[i]), total, revenue: rev, grossProfit: r2(rev - total), margin: rev ? r2(((rev - total) / rev) * 100) : null };
  });
}

/** Year 1 by month across the plan — what the twelve-month cash flow consumes. */
export function planCogsMonths(products: CostProduct[], fixed: FixedCost[], sourceFor: (p: CostProduct) => AnyProduct | null = () => null) {
  const totals = Array(12).fill(0);
  for (const p of products) productCostMonths(p, sourceFor(p)).forEach((v, i) => { totals[i] += v; });
  for (const f of fixed) fixedCostMonths(f).forEach((v, i) => { totals[i] += v; });
  return totals.map(r2);
}
