import { describe, it, expect } from "vitest";
import { planMonths, planMonthNames, monthAt, fyStartMonth, planYearLabel, firstProjectedYear, currentFinancialYear, planYearEnding } from "./calendar";

describe("the plan's own calendar", () => {
  it("starts Year 1 the month after the financial year ends", () => {
    expect(fyStartMonth(6)).toBe(7);                       // June year-end → July
    expect(fyStartMonth(12)).toBe(1);                      // December year-end → January
    expect(fyStartMonth(1)).toBe(2);                       // January year-end → February
  });

  it("labels the twelve slots in the plan's order, not the calendar's", () => {
    expect(planMonths(6)).toEqual(["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
    expect(planMonths(1)).toEqual(["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"]);
    expect(planMonths(12)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  });

  it("knows which calendar month each slot really is", () => {
    expect(monthAt(6, 0)).toBe(7);                         // slot 1 of a June-year plan is July
    expect(monthAt(6, 6)).toBe(1);                         // slot 7 is January
    expect(monthAt(6, 11)).toBe(6);                        // slot 12 is June
  });

  it("gives full names for the dialogs that have room", () => {
    expect(planMonthNames(6)[0]).toBe("July");
    expect(planMonthNames(6)[11]).toBe("June");
  });

  it("says the plan year the way the settings screen does", () => {
    expect(planYearLabel(2026, 6)).toBe("July 2025 → June 2026");
    expect(planYearLabel(2026, 12)).toBe("January 2026 → December 2026");
  });

  it("falls back to a June year rather than breaking on a missing setting", () => {
    expect(planMonths(null)[0]).toBe("Jul");
    expect(planMonths(undefined)[0]).toBe("Jul");
  });
});

describe("the plan's financial calendar (§6.33.1)", () => {
  it("uses the stated first projected year, never the plan year", () => {
    expect(firstProjectedYear(2027, 6)).toBe(2027);
    expect(planYearLabel(firstProjectedYear(2027, 6), 6)).toBe("July 2026 → June 2027");
  });

  it("names each plan year by the year it ends in", () => {
    const first = firstProjectedYear(2027, 6);
    expect([1, 2, 3, 4, 5].map((y) => planYearEnding(first, y))).toEqual([2027, 2028, 2029, 2030, 2031]);
    expect(planYearLabel(planYearEnding(first, 5), 6)).toBe("July 2030 → June 2031");
  });

  it("falls back to the financial year today is in, and only when nothing is stated", () => {
    // Financial year ends in June: September 2026 is already in the year ending June 2027.
    expect(currentFinancialYear(6, new Date(Date.UTC(2026, 8, 14)))).toBe(2027);
    expect(currentFinancialYear(6, new Date(Date.UTC(2026, 2, 14)))).toBe(2026);
    // A December year end: the financial year is the calendar year.
    expect(currentFinancialYear(12, new Date(Date.UTC(2026, 8, 14)))).toBe(2026);
    for (const bad of [null, undefined, 0, "", "abc"]) {
      expect(firstProjectedYear(bad as number | null, 6)).toBe(currentFinancialYear(6));
    }
  });

  it("refuses a year that cannot be one", () => {
    expect(firstProjectedYear(12, 6)).toBe(currentFinancialYear(6));
    expect(firstProjectedYear(99999, 6)).toBe(currentFinancialYear(6));
  });
});
