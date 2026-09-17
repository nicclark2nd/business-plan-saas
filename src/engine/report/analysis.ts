/**
 * The two readings the plan makes that no screen makes (§6.83).
 *
 * A lender reading a business plan asks two questions the statements do not answer on their face: how much
 * of every hundred dollars of revenue survives as cash, and how do the ordinary ratios move over five
 * years. APeX's sample puts both in the executive summary, and it is right to.
 *
 * Both are arithmetic on the forecast. Neither introduces an assumption, and the tests hold them to that.
 */
import type { BalanceSheetYear, PnlYear } from "../forecast/model";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const over = (top: number, bottom: number) => (bottom === 0 ? null : r2((top / bottom) * 100));

export type MarginalCash = {
  year: number;
  /** Always 100. The whole table is read against it, so it is stated rather than implied. */
  revenue: number;
  costOfGoods: number;
  receivables: number;
  inventory: number;
  payables: number;
  overheads: number;
  /** What is left of the hundred once the trading and the working capital have taken their share. */
  netVariableCashFlow: number;
};

/**
 * Every 100 units of revenue, and where they go.
 *
 * Cost of goods and overheads are what the year SPENDS. Receivables and inventory are what the year does
 * not collect — revenue counted as profit and left sitting in somebody else's hands — and payables are the
 * same thing in reverse, which is why it is the one line that gives back. A falling net figure on rising
 * revenue is growth being funded out of the bank, which is the single most useful thing this table says.
 */
export function marginalCash(pnl: Record<number, PnlYear>, bs: Record<number, BalanceSheetYear>, years: readonly number[]): MarginalCash[] {
  return years.map((year) => {
    const revenue = n(pnl[year]?.revenue);
    const pc = (v: number) => (revenue === 0 ? 0 : r2((v / revenue) * 100));
    const costOfGoods = pc(n(pnl[year]?.cogs));
    const receivables = pc(n(bs[year]?.accountsReceivable));
    const inventory = pc(n(bs[year]?.inventory));
    const payables = pc(n(bs[year]?.accountsPayable));
    const overheads = pc(n(pnl[year]?.overheads));
    return {
      year, revenue: revenue === 0 ? 0 : 100,
      costOfGoods, receivables, inventory, payables, overheads,
      netVariableCashFlow: revenue === 0 ? 0 : r2(100 - costOfGoods - receivables - inventory + payables - overheads),
    };
  });
}

export type RatioRow = { group: "Profitability" | "Growth" | "Efficiency & liquidity"; label: string; values: (number | null)[]; unit: "%" | "x" | "days" };

/**
 * The ordinary ratios, in the three groups every lender reads them in.
 *
 * A ratio nobody can divide is NULL, not zero — the first year has no growth because there is no year
 * before it, and that is a different statement from "it did not grow". The renderer prints a dash.
 */
export function ratios(pnl: Record<number, PnlYear>, bs: Record<number, BalanceSheetYear>, years: readonly number[]): RatioRow[] {
  const each = (f: (y: number, i: number) => number | null) => years.map((y, i) => f(y, i));
  const growth = (pick: (y: number) => number) => each((y, i) => {
    if (i === 0) return null;
    const was = pick(years[i - 1]);
    return was === 0 ? null : r2(((pick(y) - was) / Math.abs(was)) * 100);
  });
  return [
    { group: "Profitability", label: "Gross profit margin", unit: "%", values: each((y) => over(n(pnl[y]?.grossProfit), n(pnl[y]?.revenue))) },
    { group: "Profitability", label: "Operating margin", unit: "%", values: each((y) => over(n(pnl[y]?.operatingProfit), n(pnl[y]?.revenue))) },
    { group: "Profitability", label: "Net profit margin", unit: "%", values: each((y) => over(n(pnl[y]?.netProfit), n(pnl[y]?.revenue))) },
    /* Equity can be negative, and a "return" on negative equity is not a return. */
    { group: "Profitability", label: "Return on equity", unit: "%", values: each((y) => (n(bs[y]?.equity) <= 0 ? null : over(n(pnl[y]?.netProfit), n(bs[y].equity)))) },
    { group: "Growth", label: "Revenue growth", unit: "%", values: growth((y) => n(pnl[y]?.revenue)) },
    { group: "Growth", label: "Gross profit growth", unit: "%", values: growth((y) => n(pnl[y]?.grossProfit)) },
    { group: "Growth", label: "Net profit growth", unit: "%", values: growth((y) => n(pnl[y]?.netProfit)) },
    { group: "Efficiency & liquidity", label: "Current ratio", unit: "x", values: each((y) => (n(bs[y]?.currentLiabilities) <= 0 ? null : r2(n(bs[y].currentAssets) / n(bs[y].currentLiabilities)))) },
    { group: "Efficiency & liquidity", label: "Quick ratio", unit: "x", values: each((y) => (n(bs[y]?.currentLiabilities) <= 0 ? null : r2((n(bs[y].currentAssets) - n(bs[y].inventory)) / n(bs[y].currentLiabilities)))) },
    { group: "Efficiency & liquidity", label: "Gearing", unit: "%", values: each((y) => {
      const debt = n(bs[y]?.debtCurrent) + n(bs[y]?.debtNonCurrent);
      const base = debt + n(bs[y]?.equity);
      return base <= 0 ? null : over(debt, base);
    }) },
    /* Interest cover is meaningless with no interest to cover, and misleading as a huge number. */
    { group: "Efficiency & liquidity", label: "Interest cover", unit: "x", values: each((y) => (n(pnl[y]?.interest) <= 0 ? null : r2(n(pnl[y].operatingProfit) / n(pnl[y].interest)))) },
    { group: "Efficiency & liquidity", label: "Debtor days", unit: "days", values: each((y) => (n(pnl[y]?.revenue) <= 0 ? null : Math.round((n(bs[y]?.accountsReceivable) / n(pnl[y].revenue)) * 365))) },
  ];
}
