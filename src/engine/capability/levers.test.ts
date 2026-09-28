import { describe, it, expect } from "vitest";
import { capabilityViews, type HistoricRow } from "./actual";
import { buildView } from "./views";
import { borrowLevers, borrowStory, growLevers, growStory, growWith, leverTable, moveLine, profitForPrice, sellLevers, sellStory, viewWith, withMoves } from "./levers";
import { annualRepayment } from "./model";
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

describe("what fixes it — Borrow (§6.176)", () => {
  const views = capabilityViews(plan, rows, 2027);
  const a = views.actual!;
  const base = buildView(a, money, a.last);
  const last = a.last;
  const debt = last.balanceSheet.debtCurrent + last.balanceSheet.debtNonCurrent;
  const loans = [{ name: "the loans", balance: debt, ratePct: 10, years: debt / last.balanceSheet.debtCurrent }];
  const levers = withMoves(borrowLevers(base.posIn, growLevers(base.growIn), loans, {}, false), a, last, false, money, base.borrow, "borrow");

  it("puts spreading the loans first, then the profit and payment levers, and no overdraft on the accounts", () => {
    expect(levers[0].key).toBe("loans");
    expect(levers[0].label).toBe(`Spread the ${money(debt)} owed over 5 years`);
    expect(levers.map((l) => l.key)).toEqual(["loans", "overheads", "margin", "debtors"]);
  });

  it("never cuts payments below what the spread loans would cost", () => {
    const service = base.posIn.debtService[1]!;
    const five = annualRepayment(debt, 10, 5)!;
    expect(service - levers[0].saves!).toBeCloseTo(five, 0);
  });

  it("re-scores the borrowing with every lever pulled, and says how to move loan cover", () => {
    const after = viewWith(a, last, levers, false, money, "borrow");
    expect(after.metrics.find((m) => m.key === "dscr")!.value!).toBeGreaterThan(1.25);
    const line = moveLine("dscr", levers, a, last, false, money, base.borrow, "borrow")!;
    expect(line).toMatch(/^Spread the [\d,]+ owed over 5 years \([\d,]+ a year less in loan payments\)/);
    expect(line).toMatch(/That would take this to [\d.]+×/);
  });

  it("tells the story of the loans in plain words", () => {
    const s = borrowStory(base.posIn, a.positionNames, last)!;
    expect(s).toContain("In 2026 the business used up");
    expect(s).toContain("so none of them were covered by trading");
    expect(s).toContain("The year ended with 21,315 in the bank.");
  });

  it("sizes an overdraft to the worst month on the plan", () => {
    const pos = { ...base.posIn, monthlyCash: [10_000, -25_019, 5_000] };
    const od = borrowLevers(pos, [], [], {}, true).find((l) => l.key === "overdraft")!;
    expect(od.label).toBe("Arrange an overdraft of 30,000");
  });
});

describe("what fixes it — Sell (§6.177)", () => {
  const priced = { ...plan, sale: { askingPrice: 1_000_000, addBacks: 85_000, multipleLow: 2, multipleHigh: 3.5, exitYear: null } } as typeof plan;
  const views = capabilityViews(priced, rows, 2027);
  const a = views.actual!;
  const base = buildView(a, money, a.last);
  const levers = withMoves(sellLevers(base.posIn, growLevers(base.growIn), 1), a, a.last, false, money, base.sell, "sell");

  it("leads with the profit levers and ends with the price the fixed-up profit supports", () => {
    expect(levers[0].profit).toBeGreaterThan(0);
    const price = levers[levers.length - 1];
    expect(price.key).toBe("price");
    const gain = levers.reduce((t, l) => t + l.profit, 0);
    const earnings = -52_362 + 11_835 + 85_000 + gain;
    expect(price.price).toEqual({ from: 1_000_000, to: Math.floor((earnings * 3.5) / 10_000) * 10_000 });
  });

  it("says what profit the asking price needs", () => {
    expect(profitForPrice(base.posIn)).toEqual({ price: 1_000_000, needed: 285_714.29, high: 3.5 });
  });

  it("re-scores the sale with every fix, and tells the story in plain words", () => {
    const after = viewWith(a, a.last, levers, false, money, "sell");
    expect(after.score!).toBeGreaterThan(base.scores.sell.value!);
    const s = sellStory(base.posIn, 1, "2026", true)!;
    expect(s).toContain("With 85,000 of owner add-backs, a buyer would have seen");
    expect(s).toContain("Similar businesses sold for 2–3.5 times profit");
  });
});
