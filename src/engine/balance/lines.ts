/**
 * What the balance sheet looks like from two other angles (§6.77).
 *
 * The statement itself already exists year by year. These are the two readings a client — and every lender
 * reading after them — asks for and the five-year table cannot answer: **where the money actually is**
 * while the year runs, and **whether what is owned covers what is owed**.
 *
 * Neither invents a figure. Both are arithmetic on balances the forecast already computed, which is the
 * only reason they are allowed to exist at all.
 */
import type { BalanceSheetYear } from "../forecast/model";
import type { MonthCash } from "../forecast/monthly";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** A ratio nobody can divide is not zero and it is not one. It is nothing, and it prints as a dash. */
const ratio = (top: number, bottom: number) => (bottom <= 0 ? null : r2(top / bottom));

export type WorkingCapitalMonth = {
  month: number;
  debtors: number;
  stock: number;
  creditors: number;
  /** Debtors plus stock less creditors — the cash the business has lent to its own trading. */
  tiedUp: number;
};

/**
 * Year 1's working capital, month by month.
 *
 * These four are the ONLY balance-sheet items the monthly engine genuinely carries. Fixed assets, tax, GST
 * and equity are annual — building twelve columns of those so a monthly balance sheet could be made to
 * balance would mean asserting figures nobody entered, which is the fault §6.49 exists to name. So the
 * statement stays annual and the part that actually moves within a year gets its own reading.
 */
export function workingCapitalMonths(months: MonthCash[]): WorkingCapitalMonth[] {
  return months.map((m) => {
    const debtors = r2(n(m.accountsReceivable));
    const stock = r2(n(m.inventory));
    const creditors = r2(n(m.accountsPayable));
    return { month: m.month, debtors, stock, creditors, tiedUp: r2(debtors + stock - creditors) };
  });
}

export type Strength = {
  year: number;
  currentAssets: number;
  currentLiabilities: number;
  /** Current assets over current liabilities. Null when there are no current liabilities to cover. */
  currentRatio: number | null;
  /** The same test with stock taken out, because stock is the asset that does not sell on demand. */
  quickRatio: number | null;
  netWorkingCapital: number;
  /** Borrowings, both halves. An overdraft drawn at year end is in the current half already. */
  totalDebt: number;
  cash: number;
  /** Debt less the cash sitting against it. Negative means the business holds more cash than it owes. */
  netDebt: number;
  equity: number;
  /** Assets less liabilities, taken from the two totals rather than from equity, so a gap would show. */
  netAssets: number;
  /** Debt as a share of debt plus equity, 0–100. Null when neither side has anything in it. */
  gearing: number | null;
};

/**
 * The four questions a lender answers on the back of an envelope before reading anything else: can it pay
 * what falls due, how much of it is borrowed, what is owed net of the bank, and what is left if it stopped.
 *
 * Every one is division on two figures already printed on the statement. Nothing here is a new assumption
 * and nothing here can disagree with the table above it.
 */
export function strengthByYear(bs: Record<number, BalanceSheetYear>, years: readonly number[]): Strength[] {
  return years.map((year) => {
    const b = bs[year];
    const currentAssets = r2(n(b?.currentAssets));
    const currentLiabilities = r2(n(b?.currentLiabilities));
    const stock = r2(n(b?.inventory));
    const totalDebt = r2(n(b?.debtCurrent) + n(b?.debtNonCurrent));
    const cash = r2(n(b?.cash));
    const equity = r2(n(b?.equity));
    const fundingBase = totalDebt + equity;
    return {
      year,
      currentAssets,
      currentLiabilities,
      currentRatio: ratio(currentAssets, currentLiabilities),
      quickRatio: ratio(r2(currentAssets - stock), currentLiabilities),
      netWorkingCapital: r2(currentAssets - currentLiabilities),
      totalDebt,
      cash,
      netDebt: r2(totalDebt - cash),
      equity,
      netAssets: r2(n(b?.totalAssets) - n(b?.totalLiabilities)),
      gearing: fundingBase <= 0 ? null : r2((totalDebt / fundingBase) * 100),
    };
  });
}

/**
 * The cash cycle in days, from the days the forecast itself used.
 *
 * Deliberately NOT implied back out of the balances: the days are an input the client typed on Assumptions,
 * the balances were built from them, and reading them back from the balances would be a second answer to a
 * question already settled — which is how two readings of one plan start (§6.41).
 */
export const cashCycleDays = (d: { debtorDays: number; inventoryDays: number; creditorDays: number }) =>
  Math.round(n(d.debtorDays) + n(d.inventoryDays) - n(d.creditorDays));
