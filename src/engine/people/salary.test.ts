import { describe, expect, it } from "vitest";
import { salarySchedule, scheduleChangeFromBase, salaryForYear, totalSalariesByYear, planYearStart, startYearFromDate, tenureLabel } from "./salary";

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
  it("is zero before the start year, and for a start after the plan", () => {
    expect(salaryForYear(90000, {}, 3, 2)).toBe(0);
    expect(salaryForYear(90000, {}, 3, 3)).toBe(90000);
    expect(salaryForYear(90000, {}, 6, 5)).toBe(0);
  });
  it("treats blank adjustments as flat", () => {
    expect(salarySchedule(100000, null, 1).every((y) => y.value === 100000)).toBe(true);
  });
  it("totals across people and leaves contractors out", () => {
    const t = totalSalariesByYear([
      { annual_salary: 100000, salary_adjustments: null, startYear: 1 },
      { annual_salary: 50000, salary_adjustments: { "2": 10 }, startYear: 2 },
      { annual_salary: 80000, salary_adjustments: null, startYear: 1, role: "contractor" },
    ]);
    expect(t.map((y) => y.value)).toEqual([100000, 155000, 155000, 155000, 155000]);
  });
});

describe("start year derived from the Started date (SaaS §6.11)", () => {
  const fy = planYearStart(2026, 6);           // Jul 2025
  it("puts Year 1 at the start of the plan's first financial year", () => {
    expect(fy.toISOString().slice(0, 10)).toBe("2025-07-01");
    expect(planYearStart(2026, 12).toISOString().slice(0, 10)).toBe("2026-01-01");
  });
  it("existing people start in Year 1 whatever their date", () => {
    expect(startYearFromDate("2004-02-01", fy)).toBe(1);
    expect(startYearFromDate(null, fy)).toBe(1);
  });
  it("a planned hire lands in the plan year that contains their date", () => {
    expect(startYearFromDate("2026-07-01", fy)).toBe(2);
    expect(startYearFromDate("2029-07-01", fy)).toBe(5);
    expect(startYearFromDate("2028-08-15", fy)).toBe(4);
    expect(startYearFromDate("2031-01-01", fy)).toBe(6);   // after the plan window: no salary
  });
  it("tenure reads as years employed, or the year they join", () => {
    const today = new Date(Date.UTC(2026, 8, 5));
    expect(tenureLabel("2020-03-01", fy, today)).toBe("6 yrs");
    expect(tenureLabel("2026-05-01", fy, today)).toBe("< 1 yr");
    expect(tenureLabel("2028-08-15", fy, today)).toBe("Joins Y4");
    expect(tenureLabel("2031-01-01", fy, today)).toBe("After Y5");
  });
});
