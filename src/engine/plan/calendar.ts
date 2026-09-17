/**
 * The plan's own calendar (§6.21).
 *
 * A plan's Year 1 does not start in January. It starts the month after the financial year ends: a June
 * year-end means Year 1 runs July → June, a January year-end means February → January. Every monthly grid
 * in the app — sales, costs, overheads, salaries, assets, the cash row — is twelve slots in *that* order,
 * so slot 1 is July for one client and February for another.
 *
 * Six modules each carried their own hardcoded ["Jan" … "Dec"], which meant every one of them labelled
 * slot 1 "Jan" no matter what the client's year was: on a June year-end plan the column headed JAN was
 * really July, and every column was six months out. One definition, used everywhere.
 */
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A financial year ending in month `m` (1–12) starts the month after. June (6) → July (7). */
export const fyStartMonth = (fyEndMonth: number | null | undefined) => {
  const end = Math.min(12, Math.max(1, Math.trunc(Number(fyEndMonth)) || 6));
  return (end % 12) + 1;
};

/** The calendar month (1–12) sitting in slot `index` (0–11) of a plan year. */
export const monthAt = (fyEndMonth: number | null | undefined, index: number) =>
  ((fyStartMonth(fyEndMonth) - 1 + Math.trunc(index)) % 12) + 1;

/** The twelve short labels in plan order — "Jul", "Aug", … "Jun" for a June year-end. */
export const planMonths = (fyEndMonth: number | null | undefined) =>
  Array.from({ length: 12 }, (_, i) => MONTH_SHORT[monthAt(fyEndMonth, i) - 1]);

/** The twelve full names in plan order, for dialogs with room for them. */
export const planMonthNames = (fyEndMonth: number | null | undefined) =>
  Array.from({ length: 12 }, (_, i) => MONTH_LONG[monthAt(fyEndMonth, i) - 1]);

/**
 * The plan's four quarters, in its own year (§6.44).
 *
 * Q1 is the first three months of the FINANCIAL year, not of the calendar: a June year-end means Q1 is
 * July to September. Goals carry a quarter, and a client who sets one for "Q1" and finds it on the
 * dashboard against January to March has been told something false about their own business — the same
 * fault the months had before §6.21, one level up.
 *
 * `FY` is named for the year the financial year ENDS in, which is how every market this app serves refers
 * to it and how `planYearLabel` already describes a plan year.
 */
export type PlanQuarter = { quarter: 1 | 2 | 3 | 4; label: string; months: string; monthIndexes: number[] };

export function planQuarters(fyEndMonth: number | null | undefined, yearEnding: number): PlanQuarter[] {
  const short = planMonths(fyEndMonth);
  return ([1, 2, 3, 4] as const).map((q) => {
    const first = (q - 1) * 3;
    const monthIndexes = [first, first + 1, first + 2];
    return {
      quarter: q,
      label: `Q${q} FY${String(yearEnding).slice(-2)}`,
      months: `${short[first]}–${short[first + 2]}`,
      monthIndexes,
    };
  });
}

/**
 * Which quarter of the plan's year a date falls in, or null if it falls outside it. Used for the
 * dashboard's "this quarter" panel, which must ask the plan's calendar rather than the wall calendar.
 */
export function quarterOf(fyEndMonth: number | null | undefined, date: Date): 1 | 2 | 3 | 4 {
  const slot = (date.getMonth() + 1 - fyStartMonth(fyEndMonth) + 12) % 12;
  return (Math.floor(slot / 3) + 1) as 1 | 2 | 3 | 4;
}

/** "July 2025 → June 2026" — the sentence the plan year is described by. */
export function planYearLabel(planYear: number, fyEndMonth: number | null | undefined) {
  const end = Math.min(12, Math.max(1, Math.trunc(Number(fyEndMonth)) || 6));
  const start = fyStartMonth(end);
  const startYear = end === 12 ? planYear : planYear - 1;
  return `${MONTH_LONG[start - 1]} ${startYear} → ${MONTH_LONG[end - 1]} ${planYear}`;
}

/**
 * The year Year 1 ends in (§6.33.1).
 *
 * Two fields in Settings define the plan's financial calendar and nothing else does: **Financial year ends
 * in** and **First projected year**. `plans.plan_year` is not one of them — it is the year the plan was
 * produced, for the front cover of the report — and it had quietly become the calendar in four places,
 * which is how Year 1 came to read as the twelve months the Historic step already covers.
 *
 * Nothing is inferred from history or from today's date at read time: a plan's calendar is something the
 * client states, and a stated answer can be checked. The fallback exists only so a plan saved before this
 * field was required does not crash, and Settings asks for it.
 */
export const firstProjectedYear = (stored: number | null | undefined, fyEndMonth: number | null | undefined) => {
  const n = Math.trunc(Number(stored));
  if (Number.isFinite(n) && n >= 1900 && n <= 2200) return n;
  return currentFinancialYear(fyEndMonth);
};

/** The financial year today falls in, named by the calendar year it ENDS in — the same convention as above. */
export function currentFinancialYear(fyEndMonth: number | null | undefined, today = new Date()) {
  const end = Math.min(12, Math.max(1, Math.trunc(Number(fyEndMonth)) || 6));
  const year = today.getUTCFullYear(), month = today.getUTCMonth() + 1;
  return month > end ? year + 1 : year;
}

/** Year 1 of the plan runs to `firstProjectedYear`; Year N runs to that plus N-1. */
export const planYearEnding = (first: number, planYear: number) => first + Math.max(1, Math.trunc(planYear)) - 1;

/**
 * The date a year ENDS, short, for a column heading (§6.83).
 *
 * `planYearLabel` gives the span — "July 2026 → June 2027" — which is right in a toolbar and far too long
 * above a column of figures. A balance sheet column is a DATE, not a span, and a profit and loss column is
 * the year that ends on it, so one label serves both.
 */
export function planYearEndLabel(planYear: number, fyEndMonth: number | null | undefined) {
  const end = Math.min(12, Math.max(1, Math.trunc(Number(fyEndMonth)) || 6));
  return `${MONTH_LONG[end - 1].slice(0, 3)} ${planYear}`;
}

/** A month-precision date as a person writes it: "June 1998", not "1998-06". */
export function monthYearLabel(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${MONTH_LONG[month - 1]} ${m[1]}`;
}
