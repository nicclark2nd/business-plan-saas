import { describe, it, expect } from "vitest";
import { planMonths, planMonthNames, monthAt, fyStartMonth, planYearLabel } from "./calendar";

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
