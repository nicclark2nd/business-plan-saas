import { describe, expect, it } from "vitest";
import { salarySchedule, scheduleChangeFromBase, salaryForYear, totalSalariesByYear } from "./salary";

describe("salary schedule (APeX parity)", () => {
  // Figures from the APeX Key People dialog: 55,000 base, adjustments -50, 2, 2, 2, 2, start Year 1
  const adj = { "1": -50, "2": 2, "3": 2, "4": 2, "5": 2 };
  it("compounds year on year from the start year", () => {
    expect(salarySchedule(55000, adj, 1).map((y) => Math.round(y.value))).toEqual([27500, 28050, 28611, 29183, 29767]);
  });
  it("reports total change from base as APeX does", () => {
    const c = scheduleChangeFromBase(55000, adj, 1);
    expect(Math.round(c.delta)).toBe(-25233);   // APeX dialog: -A$25,233 (-45.88%)
    expect(c.percent).toBeCloseTo(-45.88, 1);
  });
  it("is zero before the start year", () => {
    expect(salaryForYear(90000, {}, 3, 2)).toBe(0);
    expect(salaryForYear(90000, {}, 3, 3)).toBe(90000);
  });
  it("treats blank adjustments as flat", () => {
    expect(salarySchedule(100000, null, 1).every((y) => y.value === 100000)).toBe(true);
  });
  it("totals across people", () => {
    const t = totalSalariesByYear([
      { annual_salary: 100000, salary_adjustments: null, salary_start_year: 1 },
      { annual_salary: 50000, salary_adjustments: { "2": 10 }, salary_start_year: 2 },
    ]);
    expect(t.map((y) => y.value)).toEqual([100000, 155000, 155000, 155000, 155000]);
  });
});
