/**
 * Key-person salary schedule — ported from APeX `ownerSalaryProjectionUtils.ts`, with one change (SaaS §6.11):
 * the year a person's salary starts is DERIVED from their Started date against the plan's first financial year,
 * not typed separately. A person's salary applies from that year; each year's adjustment % compounds on the
 * previous year. Years before the start year are 0 (the person is not yet employed in the plan).
 */
export type SalaryYear = 1 | 2 | 3 | 4 | 5;
export const SALARY_YEARS: SalaryYear[] = [1, 2, 3, 4, 5];

/** {"1": -50, "2": 2, ...} — percentage change applied in that year */
export type SalaryAdjustments = Partial<Record<string, number>>;

export const normalizeStartYear = (v: unknown): SalaryYear => {
  const n = Math.trunc(Number(v));
  return n >= 1 && n <= 5 ? (n as SalaryYear) : 1;
};

/** First day of plan Year 1. A plan labelled FY2026 with a June year-end runs Jul 2025 → Jun 2026. */
export function planYearStart(planYear: number, fyEndMonth: number): Date {
  const m = Math.min(12, Math.max(1, Math.trunc(fyEndMonth) || 6));
  return m === 12 ? new Date(Date.UTC(planYear, 0, 1)) : new Date(Date.UTC(planYear - 1, m, 1));
}

const toDate = (d: Date | string | null | undefined): Date | null => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x.getTime()) ? null : x;
};
const monthsBetween = (a: Date, b: Date) => (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());

/**
 * Plan year in which a person starts: 1 for anyone already employed (or with no date), 2–5 for a future start
 * inside the plan window, 6 for a start after Year 5 (no salary in this plan).
 */
export function startYearFromDate(startedOn: Date | string | null | undefined, fyStart: Date): number {
  const s = toDate(startedOn);
  if (!s) return 1;
  const months = monthsBetween(fyStart, s);
  if (months < 0) return 1;
  return Math.min(6, Math.floor(months / 12) + 1);
}

/** "6 yrs" / "< 1 yr" for someone employed; "Joins Y4" / "After Y5" for a planned hire. */
export function tenureLabel(startedOn: Date | string | null | undefined, fyStart: Date, today = new Date()): string {
  const s = toDate(startedOn);
  if (!s) return "";
  if (s > today) { const y = startYearFromDate(s, fyStart); return y > 5 ? "After Y5" : `Joins Y${y}`; }
  const years = Math.floor(monthsBetween(s, today) / 12);
  return years < 1 ? "< 1 yr" : `${years} yr${years === 1 ? "" : "s"}`;
}

export function salaryForYear(baseSalary: number, adjustments: SalaryAdjustments | null | undefined, startYear: unknown, year: number): number {
  const target = normalizeStartYear(year);
  const start = Math.trunc(Number(startYear)) || 1;
  if (start > 5 || target < start) return 0;
  let salary = Number(baseSalary) || 0;
  for (let y = Math.max(1, start); y <= target; y++) salary *= 1 + (Number(adjustments?.[String(y)]) || 0) / 100;
  return Number(salary.toFixed(2));
}

export function salarySchedule(baseSalary: number, adjustments: SalaryAdjustments | null | undefined, startYear: unknown) {
  return SALARY_YEARS.map((year) => ({ year, value: salaryForYear(baseSalary, adjustments, startYear, year) }));
}

/** APeX "Total Increase From Base": Year 5 salary minus the base salary, and that as a % of base. */
export function scheduleChangeFromBase(baseSalary: number, adjustments: SalaryAdjustments | null | undefined, startYear: unknown) {
  const base = Number(baseSalary) || 0;
  const year5 = salaryForYear(base, adjustments, startYear, 5);
  const delta = Number((year5 - base).toFixed(2));
  return { delta, percent: base ? Number(((delta / base) * 100).toFixed(2)) : 0 };
}

export type SalaryPerson = { annual_salary: number | null; salary_adjustments: SalaryAdjustments | null; startYear: number; role?: string | null };

/** Total key-people salaries by year — the locked "from People" line in Overheads. Contractors are excluded. */
export function totalSalariesByYear(people: SalaryPerson[]) {
  const paid = people.filter((p) => p.role !== "contractor");
  return SALARY_YEARS.map((year) => ({
    year,
    value: Number(paid.reduce((t, p) => t + salaryForYear(p.annual_salary ?? 0, p.salary_adjustments, p.startYear, year), 0).toFixed(2)),
  }));
}
