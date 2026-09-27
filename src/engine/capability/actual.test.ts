import { describe, it, expect } from "vitest";
import { actualYear, capabilityViews, compareWith, inAccounts, nameYears, yearEndCash, type HistoricRow } from "./actual";
import type { CapabilityInput, Metric } from "./model";
import { growMetrics } from "./grow";

/* Two actual years in SEQ's shape: sales up 5.7%, profit gone from 102k to a 52k loss, debtors up. */
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
  growth: { cashBuffer: null, costOfCapital: 12 }, stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
  sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: 3 },
  transfer: [], recurringShare: null, largestProductShare: null, leadershipPay: null, collateral: null, undrawn: 0,
} as unknown as Omit<CapabilityInput, "money">;

describe("the actual view, read from the accounts (§6.158)", () => {
  it("turns a Historic period into the forecast's shapes, with cash from operations worked the indirect way", () => {
    const a = actualYear(rows, 1, 2027)!;
    expect(a.year).toBe(2026);
    expect(a.pnl.operatingProfit).toBe(-52_362);
    /* −71,000 + 11,835 + 18,638 − 98,596 (debtors) − 2,000 (stock) + 2,000 (creditors) = −139,123, before interest */
    expect(a.cashFlow.netOperating).toBe(-139_123);
    expect(a.debtService).toBe(18_638 + 85_000);           // interest + what 2025 said fell due
    expect(a.capex).toBe(Math.max(0, 129_294 - 130_800 + 11_835));
    expect(a.days.debtorDays).toBe(46);
  });
  it("puts the last two actual years in the growth slots, and names them", () => {
    const v = capabilityViews(plan, rows, 2027);
    expect(v.hasHistory).toBe(true);
    expect(v.actual!.span).toBe("2025 → 2026");
    expect(v.actual!.grow.pnl[1]!.revenue).toBe(1_890_000);
    expect(v.actual!.grow.pnl[2]!.revenue).toBe(1_997_000);
    expect(v.actual!.growNames).toEqual({ 1: "2025", 2: "2026" });
    expect(v.actual!.position.pnl[1]!.revenue).toBe(1_997_000);
    expect(v.plan.span).toBe("2026 → 2027 onward");
    expect(v.plan.growNames[1]).toBe("2026 actual");
  });
  it("measures growth on the accounts with the same functions as the plan", () => {
    const v = capabilityViews(plan, rows, 2027);
    const g = growMetrics({ ...v.actual!.grow, money }).map((m) => inAccounts(nameYears(m, v.actual!.growNames)));
    const rev = g.find((m) => m.key === "revenueGrowth")!;
    expect(rev.value).toBe(5.7);
    expect(rev.note).toBe("2026 revenue is 5.7% above 2025 in the accounts.");
    const margin = g.find((m) => m.key === "operatingMargin")!;
    expect(margin.note).toContain("The business loses money in 2026");
  });
  it("has no actual view for a business with no accounts, and names the plan's own years", () => {
    const v = capabilityViews(plan, [], 2027);
    expect(v.hasHistory).toBe(false);
    expect(v.actual).toBeNull();
    expect(v.plan.span).toBe("2027 → 2028 onward");
    expect(v.plan.growNames[2]).toBe("2028");
  });
  it("names 'Years 2, 3 and 4' by year", () => {
    const m = { note: "Spending falls in Years 2, 3 and 4, and Year 1 is fine." } as Metric;
    expect(nameYears({ ...m, name: "", bench: "", formula: "", reveals: "", confidence: "" } as Metric, { 1: "2027", 2: "2028", 3: "2029", 4: "2030" }).note)
      .toBe("Spending falls in 2028, 2029 and 2030, and 2027 is fine.");
  });
  it("shows the year-end cash against a month of overheads, and says what it cannot see", () => {
    const c = yearEndCash(actualYear(rows, 1, 2027)!, 78_048, money);
    expect(c.value).toBe(21_315);
    expect(c.sub).toBe("About 0.3 months of overheads");
    expect(c.note).toContain("below your floor");
    expect(c.note).toContain("only show the last day of the year");
  });
});

describe("the other view's reading on each card (§6.159)", () => {
  const card = (key: string, value: number | null, display: string) =>
    ({ key, value, display, bands: [{ to: 0, s: "bad" }, { to: 5, s: "watch" }, { to: 30, s: "good" }] }) as unknown as Metric;
  it("flags a plan whose growth is half as much again as the business has managed", () => {
    const c = compareWith(card("revenueGrowth", 9.3, "9.3%"), card("revenueGrowth", 5.7, "5.7%"), "Track record, 2025 → 2026", true)!;
    expect(c.display).toBe("5.7%");
    expect(c.ahead).toBe(true);
  });
  it("flags a plan in a better band than the accounts, and says nothing when it is not", () => {
    expect(compareWith(card("m", 10, "10%"), card("m", -2, "-2%"), "x", true)!.ahead).toBe(true);
    expect(compareWith(card("m", -4, "-4%"), card("m", -2, "-2%"), "x", true)!.ahead).toBe(false);
  });
  it("reads the same way round from the accounts", () => {
    expect(compareWith(card("m", -2, "-2%"), card("m", 10, "10%"), "The plan", false)!.ahead).toBe(true);
  });
  it("has nothing to say when either side has no figure", () => {
    expect(compareWith(card("m", 3, "3%"), undefined, "x", true)).toBeNull();
    expect(compareWith(card("m", null, "—"), card("m", 3, "3%"), "x", true)).toBeNull();
  });
});
