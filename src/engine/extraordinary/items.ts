/**
 * One-off income and costs — what the P&L calls extraordinary items (§6.23).
 *
 * Money in or out that has nothing to do with trading: an insurance settlement, the proceeds of selling a
 * machine, a one-off office fit-out, a feasibility study, the legal cost of restructuring the shares. They
 * are not revenue and they are not overheads; putting them in either would distort the margins a lender
 * reads, which is exactly why the P&L keeps them on their own line below operating profit.
 *
 * Two rules this engine exists to enforce, both learned from APeX's version:
 *
 *   Nothing is silently dropped. Every item lands in a plan year 1–5, so there is no date a client can
 *   choose that the forecast then ignores. APeX let you date an item in the current year and then left
 *   15,000 of entered income out of both the P&L and the cash flow while still totalling it on screen.
 *
 *   Selling an asset is not operating income. Proceeds that name a fixed asset are investing activity and
 *   are returned separately, so the cash flow can put them in the right section instead of inflating the
 *   cash the business appears to generate from trading.
 */
import { YEARS } from "../sales/projection";
import { bookValueAtDisposal, withDisposals, type FixedAsset } from "../assets/depreciation";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type ExtraordinaryCategory = "income" | "expense";

export type ExtraordinaryItem = {
  id?: string;
  description: string;
  category: ExtraordinaryCategory;
  amount: number | null;
  year: number | null;          // plan year 1–5
  month: number | null;         // 1–12, a slot in the plan year (not a calendar month)
  source_asset_id?: string | null;
  notes?: string | null;
};

const yearOf = (i: ExtraordinaryItem) => Math.min(5, Math.max(1, Math.trunc(num(i.year)) || 1));
const monthOf = (i: ExtraordinaryItem) => Math.min(12, Math.max(1, Math.trunc(num(i.month)) || 1));
const amountOf = (i: ExtraordinaryItem) => Math.max(0, num(i.amount));

/** Proceeds from selling something the business owned — investing, not operating. */
export const isDisposal = (i: ExtraordinaryItem) => i.category === "income" && !!i.source_asset_id;

/** What the item does to profit: income adds, expense takes away. */
export const signed = (i: ExtraordinaryItem) => (i.category === "income" ? amountOf(i) : -amountOf(i));

export type ExtraordinaryYear = {
  year: number;
  income: number;
  expense: number;
  net: number;                  // the single line the P&L shows below operating profit
  disposalProceeds: number;     // of the income, the part that belongs in investing activities
  operatingIncome: number;      // the rest — genuinely operating receipts
};

export function extraordinaryByYear(items: ExtraordinaryItem[]): ExtraordinaryYear[] {
  return YEARS.map((year) => {
    const inYear = items.filter((i) => yearOf(i) === year);
    const income = r2(inYear.filter((i) => i.category === "income").reduce((a, i) => a + amountOf(i), 0));
    const expense = r2(inYear.filter((i) => i.category === "expense").reduce((a, i) => a + amountOf(i), 0));
    const disposalProceeds = r2(inYear.filter(isDisposal).reduce((a, i) => a + amountOf(i), 0));
    return {
      year, income, expense,
      net: r2(income - expense),
      disposalProceeds,
      operatingIncome: r2(income - disposalProceeds),
    };
  });
}

/** One plan year, month by month — these are lumpy by nature, so the month is the whole point. */
export function extraordinaryMonths(items: ExtraordinaryItem[], year = 1): number[] {
  const out = Array(12).fill(0);
  for (const i of items) {
    if (yearOf(i) !== year) continue;
    out[monthOf(i) - 1] = r2(out[monthOf(i) - 1] + signed(i));
  }
  return out;
}

/** Cash in and cash out separately, the way a cash flow statement wants them. */
export function extraordinaryCashMonths(items: ExtraordinaryItem[], year = 1) {
  const receipts = Array(12).fill(0), payments = Array(12).fill(0), disposals = Array(12).fill(0);
  for (const i of items) {
    if (yearOf(i) !== year) continue;
    const m = monthOf(i) - 1;
    if (i.category === "expense") payments[m] = r2(payments[m] + amountOf(i));
    else if (isDisposal(i)) disposals[m] = r2(disposals[m] + amountOf(i));
    else receipts[m] = r2(receipts[m] + amountOf(i));
  }
  return { receipts, payments, disposals };
}

/** Every item in the plan, added up — the pair of figures the screen shows at the top. */
export function extraordinaryTotals(items: ExtraordinaryItem[]) {
  const years = extraordinaryByYear(items);
  return {
    income: r2(years.reduce((a, y) => a + y.income, 0)),
    expense: r2(years.reduce((a, y) => a + y.expense, 0)),
    net: r2(years.reduce((a, y) => a + y.net, 0)),
    disposalProceeds: r2(years.reduce((a, y) => a + y.disposalProceeds, 0)),
  };
}

/**
 * The month each asset leaves the business, 0-based across the five plan years (§6.56).
 *
 * The disposal fact is owned here — it is an extraordinary item that names an asset — and it is published
 * as a plain map so the assets engine can stop depreciating a machine that has been sold without this
 * module and that one each keeping their own idea of when it went. Where an asset is sold more than once
 * (a client can enter that; nothing stops them) the earliest sale is the one that counts: it can only
 * leave the business once.
 */
export function soldMonthByAsset(items: ExtraordinaryItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    if (!isDisposal(i) || !i.source_asset_id) continue;
    const m = (yearOf(i) - 1) * 12 + (monthOf(i) - 1);
    const seen = out[i.source_asset_id];
    out[i.source_asset_id] = seen === undefined ? m : Math.min(seen, m);
  }
  return out;
}

/**
 * What the sold assets were worth on the books, year by year (§6.56).
 *
 * Selling a machine for 50,000 does not put 50,000 into profit. The machine was carrying a book value, and
 * only the part of the proceeds ABOVE it is a gain — the rest is the business converting an asset it
 * already owned into cash. This is the figure that turns proceeds into that gain, and it is computed from
 * the asset's own depreciation series so the P&L, the balance sheet and this screen cannot disagree.
 */
export function disposalBookValueByYear(items: ExtraordinaryItem[], assets: FixedAsset[]): number[] {
  const withSale = withDisposals(assets, soldMonthByAsset(items));
  return YEARS.map((year) => {
    let total = 0;
    for (const i of items) {
      if (!isDisposal(i) || yearOf(i) !== year) continue;
      const asset = withSale.find((a) => a.id && a.id === i.source_asset_id);
      if (asset) total += bookValueAtDisposal(asset);
    }
    return r2(total);
  });
}
