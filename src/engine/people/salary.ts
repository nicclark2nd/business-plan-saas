/**
 * Key-person salary schedule — ported from APeX `ownerSalaryProjectionUtils.ts`.
 * A person's salary applies from `startYear`; each year's adjustment % compounds on the previous year.
 * Years before the start year are 0 (the person is not yet employed in the plan).
 */
export type SalaryYear = 1 | 2 | 3 | 4 | 5;
export const SALARY_YEARS: SalaryYear[] = [1, 2, 3, 4, 5];

/** {"1": -50, "2": 2, ...} — percentage change applied in that year */
export type SalaryAdjustments = Partial<Record<string, number>>;

export const normalizeStartYear = (v: unknown): SalaryYear => {
  const n = Math.trunc(Number(v));
  return n >= 1 && n <= 5 ? (n as SalaryYear) : 1;
};

export function salaryForYear(baseSalary: number, adjustments: SalaryAdjustments | null | undefined, startYear: unknown, year: number): number {
  const target = normalizeStartYear(year);
  const start = normalizeStartYear(startYear);
  if (target < start) return 0;
  let salary = Number(baseSalary) || 0;
  for (let y = start; y <= target; y++) salary *= 1 + (Number(adjustments?.[String(y)]) || 0) / 100;
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

export function totalSalariesByYear(people: { annual_salary: number | null; salary_adjustments: SalaryAdjustments | null; salary_start_year: number | null }[]) {
  return SALARY_YEARS.map((year) => ({
    year,
    value: Number(people.reduce((t, p) => t + salaryForYear(p.annual_salary ?? 0, p.salary_adjustments, p.salary_start_year, year), 0).toFixed(2)),
  }));
}
