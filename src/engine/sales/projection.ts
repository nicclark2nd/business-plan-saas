/**
 * Sales projection — ported from APeX `salesGrowthUtils` / `salesProductUtils`, with one deliberate change:
 * NO default growth. APeX silently assumed +5 % price / +10 % units when a year was blank; here a blank year is 0.
 * Growth may be negative. Year 1 = current × (1 + g1); each later year compounds on the one before.
 * Units compound unrounded but are shown and multiplied at two decimals (APeX parity); sales before the start-selling year are 0.
 */
export const YEARS = [1, 2, 3, 4, 5] as const;
export type Year = (typeof YEARS)[number];
export type Growth = Partial<Record<string, { price?: number | null; units?: number | null }>>;
export type MonthlyDistribution = Record<string, number>;   // {"1": 8.3333, … "12": 8.3337} — percentages summing to 100

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function yearlyProjection(basePrice: number, baseUnits: number, growth: Growth | null | undefined, startYear = 1) {
  let price = num(basePrice), units = num(baseUnits);
  const start = Math.min(5, Math.max(1, Math.trunc(num(startYear)) || 1));
  return YEARS.map((year) => {
    const g = growth?.[String(year)] ?? {};
    price = price * (1 + num(g.price) / 100);
    units = units * (1 + num(g.units) / 100);        // carried unrounded (APeX), shown and multiplied at 2 dp
    const shownUnits = r2(units);
    const sales = year >= start ? price * shownUnits : 0;
    return { year, price, units: shownUnits, sales };
  });
}

export type ProductLike = { average_price: number | null; units_sold: number | null; yearly_growth: Growth | null; start_selling_year: number | null; monthly_distribution?: MonthlyDistribution | null };

/** Total revenue by plan year across products — `annualBaseByYear[year].revenue` for the forecast engine. */
export function revenueByYear(products: ProductLike[]) {
  const totals = YEARS.map(() => 0);
  for (const p of products) yearlyProjection(p.average_price ?? 0, p.units_sold ?? 0, p.yearly_growth, p.start_selling_year ?? 1).forEach((y, i) => { totals[i] += y.sales; });
  return YEARS.map((year, i) => ({ year, value: Math.round(totals[i] * 100) / 100 }));
}
export const currentSales = (products: ProductLike[]) => products.reduce((t, p) => t + num(p.average_price) * num(p.units_sold), 0);

// ---------- monthly distribution (Year 1 → the twelve months of cash flow) ----------
const fix4 = (v: number) => parseFloat(v.toFixed(4));
const fromFactors = (factors: number[]): MonthlyDistribution => {
  const total = factors.reduce((a, b) => a + b, 0);
  const d: MonthlyDistribution = {}; let running = 0;
  for (let m = 1; m <= 11; m++) { d[String(m)] = fix4((factors[m - 1] / total) * 100); running += d[String(m)]; }
  d["12"] = fix4(100 - running);
  return d;
};
export const evenDistribution = (): MonthlyDistribution => fromFactors(Array(12).fill(1));
/** APeX "Moderate Growth": gentle linear ramp, 0.8 → 1.0 over the year. */
export const moderateDistribution = (): MonthlyDistribution => fromFactors(Array.from({ length: 12 }, (_, i) => 0.8 + 0.2 * ((i + 1) / 12)));
/** APeX "Exponential Growth": a launching product, small early months. */
export const rampUpDistribution = (): MonthlyDistribution => fromFactors(Array.from({ length: 12 }, (_, i) => 0.5 * Math.exp(0.3 * (i + 1))));

export function normalizeDistribution(raw: unknown): MonthlyDistribution {
  if (!raw || typeof raw !== "object") return evenDistribution();
  const src = raw as Record<string, unknown>; const even = evenDistribution(); const d: MonthlyDistribution = {};
  const has1 = "1" in src, hasOld = "month1Percent" in src;
  if (!has1 && !hasOld) return even;
  for (let m = 1; m <= 12; m++) { const v = Number(has1 ? src[String(m)] : src[`month${m}Percent`]); d[String(m)] = Number.isFinite(v) ? v : even[String(m)]; }
  return d;
}
export const distributionTotal = (d: MonthlyDistribution) => fix4(Object.values(d).reduce((a, b) => a + num(b), 0));
export const distributionValid = (d: MonthlyDistribution) => Object.values(d).every((v) => Number.isFinite(v) && v >= 0 && v <= 100) && Math.abs(distributionTotal(d) - 100) <= 0.01;

/** Year-1 sales split by month for one product. */
export function monthlySales(year1Sales: number, d: MonthlyDistribution | null | undefined) {
  const dist = d ?? evenDistribution();
  return Array.from({ length: 12 }, (_, i) => Math.round(year1Sales * (num(dist[String(i + 1)]) / 100) * 100) / 100);
}
