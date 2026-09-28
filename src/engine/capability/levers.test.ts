import { describe, it, expect } from "vitest";
import { capabilityViews, type HistoricRow } from "./actual";
import { buildView } from "./views";
import { growLevers, growStory, growWith, leverTable, moveLine, withMoves } from "./levers";
import type { CapabilityInput } from "./model";

/* SEQ's two actual years (as actual.test.ts). */
const rows: HistoricRow[] = [
  { period_number: 1, revenue: 1_997_000, cogs: 1_229_527, overheads: 808_000, depreciation_amortisation: 11_835, operating_profit: -52_362,
    interest_paid: 18_638, net_profit_before_tax: -71_000, tax_paid: 0, net_profit: -71_000, cash: 21_315, accounts_receivable: 253_938,
    inventory_wip: 6_000, accounts_payable: 20_000, bank_loans_current: 98_849, bank_loans_non_current: 89_974, fixed_assets: 129_294,
    current_assets: 287_496, current_liabilities: 253_756, equity: 73_325 },
  { period_number: 2, revenue: 1_890_000, cogs: 1_096_200, overheads: 680_000, depreciation_amortisation: 11_565, operating_profit: 102_235,
    interest_paid: 14_000, net_profit_before_tax: 88_235, tax_paid: 13_235, net_profit: 75_000, cash: 150_000, accounts_receivable: 155_342,
    inventory_wip: 4_000, accounts_payable: 18_000, bank_loans_current: 85_000, bank_loans_non_current: 87_000, fixed_assets: 130_800,
    current_assets: 318_493, current_liabilities: 217_418, equity: 144_325 },
];
const money = (v: number) => Math.round(v).toLocaleString("en-AU");
const plan = {
  pnl: {}, cashFlow: {}, balanceSheet: {}, days: {}, monthlyCash: [], monthlyProfit: [], debtService: {}, capex: {},
  growth: { cashBuffer: 78_048, costOfCapital: 12 }, stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
  sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null },
  transfer: [], recurringShare: null, largestProductShare: null, leadershipPay: null, collateral: null, undrawn: 0,
} as unknown as Omit<CapabilityInput, "money">;

describe("what fixes it (§6.173)", () => {
  const views = capabilityViews(plan, rows, 2027);
  const a = views.actual!;
  const base = buildView(a, money, a.last);
  const raw = growLevers(base.growIn);
  const levers = withMoves(raw, a, a.last, false, money, base.grow);

  it("finds the three levers the accounts point to, most money first", () => {
    expect(levers.map((l) => l.key)).toEqual(["overheads", "margin", "debtors"]);
    expect(levers[1].label).toBe("Lift gross margin back to 42%");
    expect(levers[2].label).toBe("Get customers to pay in 30 days");
    expect(levers[2].profit).toBe(0);
    expect(levers[0].moves).toContain("Operating margin");
  });

  it("re-scores the year with every lever pulled", () => {
    const after = growWith(a, a.last, levers, false, money);
    expect(after.score!).toBeGreaterThan(base.scores.grow.value!);
    const rows = leverTable(levers, a, a.last, false, money, { metrics: base.grow, score: base.scores.grow.value });
    expect(rows.find((r) => r.label === "Operating margin")!.after).not.toBe("-2.6%");
  });

  it("says what would move a dial, and how far", () => {
    const line = moveLine("operatingMargin", levers, a, a.last, false, money, base.grow)!;
    expect(line).toMatch(/^Bring overheads down to [\d,]+ \(\+[\d,]+ a year\) and lift gross margin back to 42% \(\+[\d,]+ a year\)\. That would take this to /);
    expect(moveLine("revenueGrowth", levers, a, a.last, false, money, base.grow)).toBeNull();   // already good
  });

  it("tells how the dials connect", () => {
    const s = growStory(base.growIn, a.growNames, a.last, levers)!;
    expect(s).toContain("Sales went up 107,000 (5.7%) in 2026. But gross margin dropped from 42% to 38.4% and overheads went up 128,000");
    expect(s).toContain("each extra dollar of sales cost more than it brought in");
    expect(s).toContain("The year ended with 21,315 in the bank.");
  });
});
