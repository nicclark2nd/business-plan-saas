import { describe, it, expect } from "vitest";
import {
  extraordinaryByYear, extraordinaryMonths, extraordinaryCashMonths, extraordinaryTotals,
  isDisposal, signed, type ExtraordinaryItem,
} from "./items";

/** Nic's own plan, with APeX's current-year items pulled into the forecast where they belong. */
const items: ExtraordinaryItem[] = [
  { description: "Insurance settlement — vehicle write-off", category: "income", amount: 12000, year: 1, month: 2 },
  { description: "Disposal — old concrete mixer", category: "income", amount: 3000, year: 1, month: 4, source_asset_id: "asset-mixer" },
  { description: "Sydney office setup", category: "expense", amount: 15000, year: 2, month: 9 },
  { description: "Disposal — old finishing equipment", category: "income", amount: 1500, year: 2, month: 10, source_asset_id: "asset-finisher" },
  { description: "Canada market entry feasibility study", category: "expense", amount: 8000, year: 2, month: 12 },
  { description: "Share restructure — legal and admin", category: "expense", amount: 5000, year: 3, month: 3 },
  { description: "Canada office setup", category: "expense", amount: 25000, year: 3, month: 9 },
];

describe("one-off income and costs", () => {
  it("puts every item in a plan year — nothing is dropped", () => {
    const years = extraordinaryByYear(items);
    const counted = years.reduce((a, y) => a + y.income + y.expense, 0);
    const entered = items.reduce((a, i) => a + (i.amount ?? 0), 0);
    expect(counted).toBe(entered);                      // 69,500 in, 69,500 accounted for
    expect(entered).toBe(69500);
  });

  it("nets income against expense for the line below operating profit", () => {
    const years = extraordinaryByYear(items);
    expect(years[0].net).toBe(15000);                   // 12,000 + 3,000, both in Year 1
    expect(years[1].net).toBe(-21500);                  // 1,500 - 15,000 - 8,000
    expect(years[2].net).toBe(-30000);                  // - 5,000 - 25,000
    expect(years[3].net).toBe(0);
  });

  it("keeps disposal proceeds out of operating income", () => {
    const years = extraordinaryByYear(items);
    expect(years[0].income).toBe(15000);
    expect(years[0].disposalProceeds).toBe(3000);       // the mixer — investing activity
    expect(years[0].operatingIncome).toBe(12000);       // the insurance settlement — genuinely operating
    expect(isDisposal(items[1])).toBe(true);
    expect(isDisposal(items[0])).toBe(false);
  });

  it("an expense takes away from profit and income adds to it", () => {
    expect(signed(items[0])).toBe(12000);
    expect(signed(items[2])).toBe(-15000);
  });

  it("lands each item in its own month — these are lumpy, and the month is the point", () => {
    const m = extraordinaryMonths(items, 1);
    expect(m[1]).toBe(12000);                           // month 2
    expect(m[3]).toBe(3000);                            // month 4
    expect(m[0]).toBe(0);
    expect(m.reduce((a, b) => a + b, 0)).toBe(15000);   // the twelve add to the year
  });

  it("two items in the same month add up rather than overwrite", () => {
    const same: ExtraordinaryItem[] = [
      { description: "A", category: "income", amount: 1000, year: 1, month: 5 },
      { description: "B", category: "expense", amount: 400, year: 1, month: 5 },
    ];
    expect(extraordinaryMonths(same, 1)[4]).toBe(600);
  });

  it("splits the cash three ways, so the cash flow can put each in its right section", () => {
    const { receipts, payments, disposals } = extraordinaryCashMonths(items, 2);
    expect(disposals[9]).toBe(1500);                    // month 10, investing
    expect(payments[8]).toBe(15000);                    // month 9, operating
    expect(payments[11]).toBe(8000);
    expect(receipts.reduce((a, b) => a + b, 0)).toBe(0); // no non-disposal income in Year 2
  });

  it("totals the way the screen shows them", () => {
    const t = extraordinaryTotals(items);
    expect(t.income).toBe(16500);
    expect(t.expense).toBe(53000);
    expect(t.net).toBe(-36500);
    expect(t.disposalProceeds).toBe(4500);
  });

  it("a year with nothing in it is zero, not undefined", () => {
    const years = extraordinaryByYear([]);
    expect(years).toHaveLength(5);
    expect(years.every((y) => y.net === 0 && y.income === 0 && y.expense === 0)).toBe(true);
    expect(extraordinaryMonths([], 1).every((v) => v === 0)).toBe(true);
  });
});
