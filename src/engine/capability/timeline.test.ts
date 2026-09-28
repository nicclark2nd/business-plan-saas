import { describe, it, expect } from "vitest";
import { actualYear, capabilityViews, type HistoricRow } from "./actual";
import { buildView } from "./views";
import { capabilityTimeline, readiness, type TimelineYear } from "./timeline";
import type { CapabilityInput } from "./model";

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
const loss = actualYear(rows, 1, 2027)!, good = actualYear(rows, 2, 2027)!;
const years = { 1: loss, 2: good, 3: good, 4: good, 5: good };
const pick = <K extends "pnl" | "balanceSheet" | "cashFlow" | "days" | "capex" | "debtService">(k: K) =>
  Object.fromEntries(Object.entries(years).map(([y, a]) => [y, a[k]]));
const plan = {
  pnl: pick("pnl"), cashFlow: pick("cashFlow"), balanceSheet: pick("balanceSheet"), days: pick("days"),
  monthlyCash: [], monthlyProfit: [], debtService: pick("debtService"), capex: pick("capex"),
  growth: { cashBuffer: null, costOfCapital: 12 }, stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
  sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null },
  transfer: [], recurringShare: null, largestProductShare: null, leadershipPay: null, collateral: null, undrawn: 0,
} as unknown as Omit<CapabilityInput, "money">;

describe("when the business becomes ready (§6.166)", () => {
  it("scores every plan year, and Year 1 is the Plan view's own score", () => {
    for (const hist of [[], rows]) {
      const views = capabilityViews(plan, hist, 2027);
      const line = capabilityTimeline(plan, views, {}, 2027, money);
      expect(line.map((y) => y.year)).toEqual([2027, 2028, 2029, 2030, 2031]);
      const page = buildView(views.plan, money, null).scores;
      expect(line[0].scores.grow).toBe(page.grow.value);
      expect(line[0].scores.borrow).toBe(page.borrow.value);
    }
  });

  it("reads the loss year worse than the profitable years that follow", () => {
    const views = capabilityViews(plan, [], 2027);
    const line = capabilityTimeline(plan, views, {}, 2027, money);
    expect(line[0].scores.borrow!).toBeLessThan(line[2].scores.borrow!);
  });

  it("names the year it arrives, and a slip", () => {
    const L = (v: (number | null)[]): TimelineYear[] => v.map((x, i) => ({ k: i + 1, year: 2027 + i, scores: { grow: x, borrow: x, sell: x } }));
    expect(readiness(L([40, 60, 75, 80, 90]), "borrow")).toEqual({ from: 2029, first: 2029, slips: [] });
    expect(readiness(L([75, 60, 80, 85, 90]), "borrow")).toEqual({ from: 2029, first: 2027, slips: [2028] });
    expect(readiness(L([40, 75, 60, 55, 50]), "borrow")).toEqual({ from: null, first: 2028, slips: [2029, 2030, 2031] });
    expect(readiness(L([40, 50, null, 60, 70]), "borrow")).toEqual({ from: null, first: null, slips: [] });
    expect(readiness(L([71, 72, 73, 74, 75]), "borrow").from).toBe(2027);
  });
});
