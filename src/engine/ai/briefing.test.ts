import { describe, it, expect } from "vitest";
import { type HistoricRow } from "@/engine/capability/actual";
import type { CapabilityInput } from "@/engine/capability/model";
import { readTab, readViews } from "@/engine/capability/read";
import { briefingMessages, briefingSheet, unknownFigures } from "./briefing";
import { requestBody } from "@/lib/ai/provider";

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

const ctx = { facts: plan, history: rows, firstYear: 2027, money, adviser: true, months: [], agreedTargets: {}, facilities: [] };
const RV = readViews(ctx);

describe("the Planner's briefing (§6.179)", () => {
  const R = readTab(ctx, RV, "grow", true);
  const sheet = briefingSheet(R, "grow", money, "SEQ Concreting");

  it("hands the model the page: the score, the verdict, the story, the fixes and the measures", () => {
    expect(sheet).toContain("TOPIC: Capability to grow — SEQ Concreting");
    expect(sheet).toContain("WHAT THIS COVERS: the business's past accounts, 2025 → 2026. Nothing from the plan.");
    expect(sheet).toContain(`SCORE: ${R.s.value} out of 100`);
    expect(sheet).toContain(R.fixes.story!);
    expect(sheet).toContain("1. Bring overheads down to");
    expect(sheet).toContain("Lift gross margin back to 42%");
    expect(sheet).toContain("- Operating margin:");
  });

  it("names no projected year on the Actual view (§6.169)", () => {
    expect(sheet).not.toMatch(/\b202[7-9]\b|\b203\d\b/);
    expect(sheet).not.toMatch(/the plan asks/i);
  });

  it("tells the model the Actual view is the accounts only, and the Plan view is the plan", () => {
    const a = briefingMessages(sheet, { adviser: true, onActual: true });
    expect(a[0].content).toContain("past accounts ONLY");
    expect(a[0].content).toContain("from a business adviser (the Planner)");
    const p = briefingMessages(sheet, { adviser: false, onActual: false });
    expect(p[0].content).not.toContain("past accounts ONLY");
    expect(p[0].content).not.toContain("adviser");
    expect(a[1].content).toContain(sheet);
  });

  it("asks for a page, not a passage, and stays zero-retention", () => {
    const body = requestBody(briefingMessages(sheet, { adviser: true, onActual: true }), "m", 1000);
    expect(body.max_tokens).toBe(1000);
    expect(body.provider).toEqual({ zdr: true });
    expect(requestBody([], "m").max_tokens).toBe(700);
  });

  it("reads the Plan view from the plan", () => {
    const P = readTab(ctx, RV, "grow", false);
    expect(P.onActual).toBe(false);
    expect(briefingSheet(P, "grow", money, null)).toContain("WHAT THIS COVERS: the business plan,");
  });
});

describe("figures that are not on the page", () => {
  const sheet = "SCORE: 47 out of 100\nSales went up 107,000 (5.7%) in 2026. Margin 38.4%. Cover 1.25×. 42 days.";
  it("lets through every figure the sheet holds, however it is written", () => {
    expect(unknownFigures("Sales rose $107,000, or 5.7%, in 2026. Your score is 47. Customers pay in 42 days; cover is 1.25×.", sheet)).toEqual([]);
  });
  it("lets through step numbers and small counts", () => {
    expect(unknownFigures("1. Do this.\n2. Then this. Two of 6 measures.", sheet)).toEqual([]);
  });
  it("flags roundings, sums and years the page does not name", () => {
    expect(unknownFigures("About $110k more sales, a 38% margin, and by 2028 it should be fixed.", sheet)).toEqual(["$110k", "38%", "2028"]);
  });
});
