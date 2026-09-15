import { describe, expect, it } from "vitest";
import { planQuarters, quarterOf, planYearEnding } from "./calendar";

describe("the plan's own quarters (§6.44)", () => {
  it("starts Q1 at the top of the FINANCIAL year, not the calendar year", () => {
    // June year-end: the year runs July → June, so Q1 is July to September.
    expect(planQuarters(6, 2027).map((q) => q.months)).toEqual(["Jul–Sep", "Oct–Dec", "Jan–Mar", "Apr–Jun"]);
    // December year-end: the financial year IS the calendar year.
    expect(planQuarters(12, 2027).map((q) => q.months)).toEqual(["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"]);
    // March year-end, as the UK and India run it.
    expect(planQuarters(3, 2027).map((q) => q.months)).toEqual(["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"]);
  });

  it("names the year the financial year ends in", () => {
    expect(planQuarters(6, 2027).map((q) => q.label)).toEqual(["Q1 FY27", "Q2 FY27", "Q3 FY27", "Q4 FY27"]);
  });

  it("covers the twelve month slots exactly once, in order", () => {
    for (const fy of [1, 3, 6, 9, 12]) {
      const all = planQuarters(fy, 2027).flatMap((q) => q.monthIndexes);
      expect(all, `year ending month ${fy}`).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it("puts a date in the quarter the plan would put it in", () => {
    // June year-end: July is Q1, September Q1, October Q2, June Q4.
    expect(quarterOf(6, new Date(2026, 6, 15))).toBe(1);    // July
    expect(quarterOf(6, new Date(2026, 8, 30))).toBe(1);    // September
    expect(quarterOf(6, new Date(2026, 9, 1))).toBe(2);     // October
    expect(quarterOf(6, new Date(2027, 5, 30))).toBe(4);    // June
    // The same date is a different quarter on a different year end — which is the whole point.
    expect(quarterOf(12, new Date(2026, 6, 15))).toBe(3);   // July, on a calendar year
  });

  it("agrees with the plan year the rest of the calendar computes", () => {
    // Year 1 of a plan whose first projected year ends 2027.
    expect(planQuarters(6, planYearEnding(2027, 1))[0].label).toBe("Q1 FY27");
    expect(planQuarters(6, planYearEnding(2027, 3))[0].label).toBe("Q1 FY29");
  });
});
