/**
 * Grants — money that is not repaid, and is not equity either (§6.50).
 *
 * The plan collected a recognition type and a recognition period from the first migration, and nothing ever
 * read them. A grant was filed into the equity bucket, so it arrived as cash, became contributed equity on
 * the balance sheet, and never touched the profit and loss at all.
 *
 * That is wrong three ways, and quietly: a grant is not money the owner subscribed for shares with; an
 * immediate grant is INCOME and belongs in the P&L (a grant-funded business was showing a loss it did not
 * have, and paying tax on the wrong figure); and a deferred grant is a LIABILITY until it is earned. None
 * of it failed a check, because cash went up and equity went up by the same amount and the balance sheet
 * balanced perfectly around the mistake. A field nobody reads is the §6.35 fault; a field nobody reads that
 * also moves the tax bill is worse.
 *
 * Two recognitions, and the difference is only ever timing:
 *   immediate — earned when it arrives. Income in that month, no liability.
 *   deferred  — earned evenly across the period the client entered, starting the month it arrives. The part
 *               not yet earned sits as deferred income, split on the balance sheet between what will be
 *               earned inside twelve months and what will not.
 *
 * The cash is the same either way and arrives on the month the grant does. What changes is when it becomes
 * profit — which is the whole reason the field was collected.
 */
import { YEARS } from "../sales/projection";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type Recognition = "immediate" | "deferred";

export type Grant = {
  id?: string;
  name?: string;
  amount: number | null;
  start_year?: number | null;           // 1–5
  start_month?: number | null;          // 1–12 within that year
  recognition_type?: Recognition | null;
  recognition_period_months?: number | null;
};

/**
 * The plan runs sixty months; this runs seventy-two. The extra year is not shown anywhere — it exists so
 * that at the end of Year 5 the question "how much of this is earned within twelve months?" still has an
 * answer, instead of the whole remaining balance being called non-current because the arrays ran out.
 */
const HORIZON = 72;

const startMonthIndex = (g: Grant) =>
  (Math.min(5, Math.max(1, Math.trunc(num(g.start_year)) || 1)) - 1) * 12
  + (Math.min(12, Math.max(1, Math.trunc(num(g.start_month)) || 1)) - 1);

/** One grant: cash in, and income earned, month by month. */
export function grantMonths(g: Grant): { received: number[]; earned: number[] } {
  const received = Array(HORIZON).fill(0) as number[];
  const earned = Array(HORIZON).fill(0) as number[];
  const amount = num(g.amount);
  const from = startMonthIndex(g);
  if (amount <= 0 || from >= HORIZON) return { received, earned };

  received[from] = r2(amount);
  const deferred = g.recognition_type === "deferred";
  const period = deferred ? Math.max(1, Math.trunc(num(g.recognition_period_months)) || 12) : 1;
  const each = amount / period;
  for (let i = 0; i < period; i++) {
    const m = from + i;
    if (m >= HORIZON) break;                 // earned beyond the horizon: still a liability at Year 5, correctly
    earned[m] = r2(earned[m] + each);
  }
  return { received, earned };
}

export type GrantYear = {
  year: number;
  /** Cash in. Operating cash: a grant is income in nature, not money raised from an owner or a lender. */
  received: number;
  /** Earned this year, and so in the profit and loss this year. */
  income: number;
  /** Received and not yet earned at year end — the liability, split by when it will be earned. */
  deferredCurrent: number;
  deferredNonCurrent: number;
  deferredClosing: number;
};

export function grantsByYear(grants: Grant[]): GrantYear[] {
  const received = Array(HORIZON).fill(0) as number[];
  const earned = Array(HORIZON).fill(0) as number[];
  for (const g of grants) {
    const m = grantMonths(g);
    for (let i = 0; i < HORIZON; i++) { received[i] += m.received[i]; earned[i] += m.earned[i]; }
  }
  return YEARS.map((year) => {
    const end = year * 12;
    const sum = (a: number[], from: number, to: number) => a.slice(from, to).reduce((x, y) => x + y, 0);
    const closing = sum(received, 0, end) - sum(earned, 0, end);
    // Of what is still owed to the future, the part the next twelve months will earn is current.
    const current = Math.min(Math.max(0, closing), sum(earned, end, end + 12));
    return {
      year,
      received: r2(sum(received, end - 12, end)),
      income: r2(sum(earned, end - 12, end)),
      deferredClosing: r2(Math.max(0, closing)),
      deferredCurrent: r2(current),
      deferredNonCurrent: r2(Math.max(0, closing) - current),
    };
  });
}

/** One year month by month — cash in, and income earned — for that year's twelve-month statements. */
export function grantsMonths(grants: Grant[], year = 1): { received: number[]; earned: number[] } {
  const y = Math.min(5, Math.max(1, Math.trunc(year) || 1));
  const from = (y - 1) * 12;
  const received = Array(12).fill(0) as number[];
  const earned = Array(12).fill(0) as number[];
  for (const g of grants) {
    const m = grantMonths(g);
    for (let i = 0; i < 12; i++) { received[i] = r2(received[i] + num(m.received[from + i])); earned[i] = r2(earned[i] + num(m.earned[from + i])); }
  }
  return { received, earned };
}
