/**
 * What the profit and loss looks like from two other angles (§6.76).
 *
 * The statement itself already exists year by year. These are the two readings a client asks for and the
 * five-year table cannot answer: **when** inside a year the profit actually happens, and **which line**
 * earns it.
 */
import type { MonthlyShapes } from "../forecast/monthly";
import { productYears, recurring, type AnyProduct } from "../sales/product";
import { productCostYears, type CostProduct } from "../cogs/direct";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type PnlMonth = {
  month: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  overheads: number;
  depreciation: number;
  operatingProfit: number;
};

/**
 * One year's profit and loss, month by month — and it stops at OPERATING PROFIT on purpose.
 *
 * Everything below that line is annual by nature or by choice: tax is charged on a year, loss relief is
 * given against a year, a dividend is declared once. Spreading them across twelve months would mean
 * inventing twelve figures from one, and the plan would be asserting something nobody entered. Operating
 * profit is the deepest line that is genuinely monthly, so it is where this stops.
 */
export function pnlMonths(shapes: MonthlyShapes): PnlMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const revenue = r2(n(shapes.revenue[i]));
    const cogs = r2(n(shapes.cogs[i]));
    const overheads = r2(n(shapes.overheads[i]));
    const depreciation = r2(n(shapes.depreciation[i]));
    const grossProfit = r2(revenue - cogs);
    return { month: i + 1, revenue, cogs, grossProfit, overheads, depreciation, operatingProfit: r2(grossProfit - overheads - depreciation) };
  });
}

export type ServiceProfit = {
  id?: string;
  name: string;
  /** True for an ongoing line, whose "one" is a client for a year rather than a job. */
  ongoing: boolean;
  revenue: number;
  cogs: number;
  grossProfit: number;
  /** Gross profit as a share of the line's own revenue, or null when it sold nothing. */
  margin: number | null;
  /** This line's share of the plan's whole gross profit, 0–100. Null when the plan makes none. */
  shareOfGross: number | null;
};

/**
 * Each line's contribution, and it STOPS AT GROSS PROFIT.
 *
 * Below that sit overheads, and overheads cannot be split across lines without inventing a basis nobody
 * agreed to — the same refusal §6.49 makes about break-even, and for the same reason: a number the client
 * did not choose, presented as if they had. So there is no "net profit per service" here and there will not
 * be one. What a line earns above the cost of delivering it is the honest end of this table.
 */
export function serviceProfit(
  products: CostProduct[],
  sourceFor: (p: CostProduct) => AnyProduct | null = () => null,
  year = 1,
): ServiceProfit[] {
  const y = Math.min(5, Math.max(1, Math.trunc(year) || 1));
  const rows = products.map((p) => {
    const source = sourceFor(p);
    const cost = productCostYears(p, source)[y - 1];
    const rev = productYears(p as unknown as AnyProduct, source)[y - 1];
    const revenue = r2(n(rev?.revenue));
    const cogs = r2(n(cost?.cost));
    const grossProfit = r2(revenue - cogs);
    return {
      id: (p as { id?: string }).id,
      name: (p as { name?: string | null }).name?.trim() || "Untitled",
      ongoing: recurring(p as unknown as AnyProduct),
      revenue, cogs, grossProfit,
      margin: revenue ? r2((grossProfit / revenue) * 100) : null,
      shareOfGross: null as number | null,
    };
  });
  /**
   * The share is taken against the POSITIVE gross profit in the plan, not the net of it. A line losing
   * money does not earn a negative share of the total; it earns none, and the lines that do earn still add
   * to a hundred between them.
   */
  const earned = rows.reduce((a, r) => a + Math.max(0, r.grossProfit), 0);
  for (const r of rows) r.shareOfGross = earned > 0 ? r2((Math.max(0, r.grossProfit) / earned) * 100) : null;
  return rows.sort((a, b) => b.grossProfit - a.grossProfit);
}
