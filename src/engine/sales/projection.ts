/**
 * Sales projection — ported from APeX `salesGrowthUtils` / `salesProductUtils`, with one deliberate change:
 * NO default growth. APeX silently assumed +5 % price / +10 % units when a year was blank; here a blank year is 0.
 * Growth may be negative. Year 1 = current × (1 + g1); each later year compounds on the one before.
 * Units compound unrounded but are shown and multiplied at two decimals (APeX parity).
 */
export const YEARS = [1, 2, 3, 4, 5] as const;
export type Year = (typeof YEARS)[number];
export type Growth = Partial<Record<string, { price?: number | null; units?: number | null }>>;
export type MonthlyDistribution = Record<string, number>;   // {"1": 8.3333, … "12": 8.3337} — percentages summing to 100

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Base price and units belong to the year the line starts selling. "Now" (start 1) means this year's actuals, and
 * Year 1 = base × (1 + g₁). A line starting in Year N sells base × units in Year N — no growth applied to its own
 * first year — and compounds from Year N+1. Earlier years are 0 and nothing compounds through them.
 */
export function yearlyProjection(basePrice: number, baseUnits: number, growth: Growth | null | undefined, startYear = 1) {
  let price = num(basePrice), units = num(baseUnits);
  const start = Math.min(6, Math.max(1, Math.trunc(num(startYear)) || 1));   // 1 = now; 2–6 = Year 1–5
  const firstYear = start - 1;                                                 // plan year whose column holds the base
  return YEARS.map((year) => {
    if (year < firstYear) return { year, price: 0, units: 0, sales: 0 };
    if (year > firstYear) {
      const g = growth?.[String(year)] ?? {};
      price = price * (1 + num(g.price) / 100);
      units = units * (1 + num(g.units) / 100);      // carried unrounded (APeX), shown and multiplied at 2 dp
    }
    const shownUnits = r2(units);
    return { year, price, units: shownUnits, sales: price * shownUnits };
  });
}

export type ProductLike = { average_price: number | null; units_sold: number | null; yearly_growth: Growth | null; start_selling_year: number | null; monthly_distribution?: MonthlyDistribution | null };

/** Total revenue by plan year across products — `annualBaseByYear[year].revenue` for the forecast engine. */
export function revenueByYear(products: ProductLike[]) {
  const totals = YEARS.map(() => 0);
  for (const p of products) yearlyProjection(p.average_price ?? 0, p.units_sold ?? 0, p.yearly_growth, p.start_selling_year ?? 1).forEach((y, i) => { totals[i] += y.sales; });
  return YEARS.map((year, i) => ({ year, value: Math.round(totals[i] * 100) / 100 }));
}
/** This year's sales — only lines already selling ("Now"); a line starting in a plan year has nothing to reconcile against Historic. */
export const currentSales = (products: ProductLike[]) => products.reduce((t, p) => t + ((p.start_selling_year ?? 1) <= 1 ? num(p.average_price) * num(p.units_sold) : 0), 0);

// ---------- monthly distribution (Year 1 → the twelve months of cash flow) ----------
const fix4 = (v: number) => parseFloat(v.toFixed(4));
/**
 * A share is a WEIGHT, not a promise about arithmetic. 100 / 12 = 8.333333... recurring, so no number of
 * decimal places makes twelve equal months sum to exactly 100 — forcing the remainder into December only
 * produced an odd month (8.3337) that had to be explained. The twelve are stored as they are, and the MONEY
 * is reconciled instead: `monthlySales` divides by the actual total, so twelve equal shares always give
 * twelve equal months that add to the year exactly.
 */
const fromFactors = (factors: number[]): MonthlyDistribution => {
  const total = factors.reduce((a, b) => a + b, 0);
  const d: MonthlyDistribution = {};
  for (let m = 1; m <= 12; m++) d[String(m)] = fix4((factors[m - 1] / total) * 100);
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
/**
 * Kept for splits typed by hand: it squares a within-tolerance total to exactly 100 so the stored figures read
 * as a full year. It is no longer what protects the money — `monthlySales` normalises by the actual total —
 * so it never has to invent an odd month, and equal shares stay equal.
 */
export function exactHundred(d: MonthlyDistribution): MonthlyDistribution {
  const total = distributionTotal(d);
  if (!total || Math.abs(total - 100) < 1e-9) return d;
  const equal = Object.values(d).every((v) => Math.abs(num(v) - num(d["1"])) < 1e-9);
  if (equal) return d;                                   // twelve equal shares are already the answer
  const out: MonthlyDistribution = {};
  let sum = 0;
  for (let m = 1; m <= 11; m++) { const v = fix4((num(d[String(m)]) * 100) / total); out[String(m)] = v; sum += v; }
  out["12"] = fix4(100 - sum);
  return out;
}
export const distributionValid = (d: MonthlyDistribution) => Object.values(d).every((v) => Number.isFinite(v) && v >= 0 && v <= 100) && Math.abs(distributionTotal(d) - 100) <= 0.01;

/**
 * Year-1 sales split by month. Shares are treated as weights and divided by their own total, so a split of
 * twelve 8.3333s gives twelve exactly equal months; the last cent of any rounding is put in December so the
 * twelve always add to the year to the cent. Nothing can leak here, whatever was typed.
 */
export function monthlySales(year1Sales: number, d: MonthlyDistribution | null | undefined) {
  const dist = d ?? evenDistribution();
  const total = distributionTotal(dist);
  if (!total) return Array(12).fill(0);
  const out: number[] = []; let running = 0;
  for (let m = 1; m <= 11; m++) {
    const v = Math.round(year1Sales * (num(dist[String(m)]) / total) * 100) / 100;
    out.push(v); running += v;
  }
  out.push(Math.round((year1Sales - running) * 100) / 100);
  return out;
}
