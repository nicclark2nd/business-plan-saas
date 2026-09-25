import type { MonthlyShapes } from "./monthly";

/**
 * PROFIT BEFORE TAX, MONTH BY MONTH (§6.124).
 *
 * The dashboard showed cash through Year 1 and nothing beside it, and cash alone does not tell an owner
 * whether the business works. A plan can be liquid and losing money — SEQ Concreting is exactly that, a
 * year that never drops below zero in the bank and still loses 136,681 — and those two facts sitting one
 * above the other is the most useful thing a dashboard can say.
 *
 * NOT A SECOND FORECAST. `runForecast` already returns `shapesByYear`, and the comment on it says why:
 * "a profit and loss that read the plan a second time to draw its own months is exactly the fault this
 * pipeline exists to prevent". This is arithmetic on those shapes and nothing else.
 *
 * WHAT IT IS AND IS NOT.
 *
 * Before tax, deliberately. Tax and dividends are annual figures that the monthly model PLACES rather than
 * recomputes — there is no honest way to say what October's tax was — so a monthly "net profit" would be
 * invented. The dashboard tile above this chart says "after tax" and this one says "before tax", and the
 * caption carries the difference so two numbers on one screen never look like a contradiction.
 *
 * ONE LINE OF THE ANNUAL P&L CANNOT BE MONTHLY, AND IT IS LEFT OUT RATHER THAN GUESSED.
 *
 * A disposal's profit is proceeds less BOOK VALUE, and the monthly shapes carry the proceeds without the
 * book value. Spreading the gain evenly would be a number nobody could check; putting it all in month
 * twelve would be a spike that never happened. So the series excludes it, `monthlyProfitReconciles` says
 * whether that matters for a given plan, and the screen says so when it does.
 */

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function monthlyProfit(s: MonthlyShapes): number[] {
  return s.revenue.map((_, i) => r2(
    n(s.revenue[i])
    - n(s.cogs[i])
    - n(s.overheads[i])
    - n(s.depreciation[i])
    + n(s.grantIncome[i])
    + n(s.extraordinaryReceipts[i])
    - n(s.extraordinaryPayments[i])
    - n(s.interest[i]),
  ));
}

/**
 * What the twelve months do NOT account for, against the year's own figure.
 *
 * Zero on almost every plan. Non-zero exactly when an asset was sold at a gain or a loss, which is the one
 * line above that has no monthly form. Returned rather than hidden so a screen can say "one-off items sit
 * outside this" instead of quietly drawing a chart that adds up to something else.
 */
export const monthlyProfitGap = (s: MonthlyShapes, profitBeforeTax: number): number =>
  r2(profitBeforeTax - monthlyProfit(s).reduce((a, b) => a + b, 0));

/** The months that lost money — what the caption names, the way the cash card names its lowest month. */
export const lossMonths = (months: number[]): number[] =>
  months.flatMap((v, i) => (v < 0 ? [i + 1] : []));
