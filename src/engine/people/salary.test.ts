import { describe, expect, it } from "vitest";
import { salarySchedule, scheduleChangeFromFirstYear, salaryForYear, totalSalariesByYear, planYearStart, startYearFromDate, tenureLabel } from "./salary";

describe("salary schedule (APeX parity)", () => {
  // The APeX Key People dialog held 55,000 with adjustments -50, 2, 2, 2, 2 from Year 1. That -50 was a year
  // sitting in front of the plan; §6.48 folded it into the figure, so the same person is 27,500 rising 2 %.
  const adj = { "2": 2, "3": 2, "4": 2, "5": 2 };
  it("compounds year on year from the year AFTER the start year", () => {
    expect(salarySchedule(27500, adj, 1).map((y) => Math.round(y.value))).toEqual([27500, 28050, 28611, 29183, 29767]);
  });
  it("reports Year 5 against the first year", () => {
    const c = scheduleChangeFromFirstYear(27500, adj, 1);
    expect(Math.round(c.delta)).toBe(2267);
    expect(c.percent).toBeCloseTo(8.24, 1);
  });
  it("ignores an adjustment on the person's own first year: 0026 removed those keys", () => {
    expect(salaryForYear(90000, { "1": 99 }, 1, 1)).toBe(90000);
    expect(salaryForYear(90000, { "3": 99 }, 3, 3)).toBe(90000);
  });
  it("is zero before the start year, and for a start after the plan", () => {
    expect(salaryForYear(90000, {}, 3, 2)).toBe(0);
    expect(salaryForYear(90000, {}, 3, 3)).toBe(90000);
    expect(salaryForYear(90000, {}, 6, 5)).toBe(0);
  });
  it("a salary IS the person's first-year figure, and adjustments compound from the year after", () => {
    // 120,000 joining in Year 1, rising 3 % a year: Year 1 is what was typed (\u00a76.48).
    expect(salarySchedule(120000, { "2": 3, "3": 3, "4": 3, "5": 3 }, 1).map((y) => y.value))
      .toEqual([120000, 123600, 127308, 131127.24, 135061.06]);
    // And for someone joining later, their own first year is the figure, not a year to grow through.
    expect(salarySchedule(90000, { "4": 5 }, 3).map((y) => y.value)).toEqual([0, 0, 90000, 94500, 94500]);
  });

  it("treats blank adjustments as flat", () => {
    expect(salarySchedule(100000, null, 1).every((y) => y.value === 100000)).toBe(true);
  });
  it("totals across people and leaves contractors out", () => {
    const t = totalSalariesByYear([
      { annual_salary: 100000, salary_adjustments: null, startYear: 1 },
      { annual_salary: 50000, salary_adjustments: { "3": 10 }, startYear: 2 },
      { annual_salary: 80000, salary_adjustments: null, startYear: 1, role: "contractor" },
    ]);
    expect(t.map((y) => y.value)).toEqual([100000, 150000, 155000, 155000, 155000]);
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
