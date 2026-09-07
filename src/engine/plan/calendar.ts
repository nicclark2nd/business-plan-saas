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

/** "July 2025 → June 2026" — the sentence the plan year is described by. */
export function planYearLabel(planYear: number, fyEndMonth: number | null | undefined) {
  const end = Math.min(12, Math.max(1, Math.trunc(Number(fyEndMonth)) || 6));
  const start = fyStartMonth(end);
  const startYear = end === 12 ? planYear : planYear - 1;
  return `${MONTH_LONG[start - 1]} ${startYear} → ${MONTH_LONG[end - 1]} ${planYear}`;
}
