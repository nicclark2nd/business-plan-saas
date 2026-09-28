import { describe, it, expect } from "vitest";
import { actualYear, type HistoricRow } from "./actual";
import { cashBridge, issuesFrom, profitBridge } from "./assessment";

/* SEQ's two actual years, in the shape Historic holds them. */
const rows: HistoricRow[] = [
  { period_number: 1, revenue: 1_997_000, cogs: 1_229_527, overheads: 819_835, depreciation_amortisation: 0, operating_profit: -52_362,
    interest_paid: 18_638, net_profit_before_tax: -71_000, tax_paid: 0, net_profit: -71_000, cash: 21_315, accounts_receivable: 253_938,
    inventory_wip: 6_000, accounts_payable: 20_000, bank_loans_current: 98_849, bank_loans_non_current: 89_974, fixed_assets: 129_294 },
  { period_number: 2, revenue: 1_890_000, cogs: 1_096_200, overheads: 691_565, depreciation_amortisation: 0, operating_profit: 102_235,
    interest_paid: 14_000, net_profit_before_tax: 88_235, tax_paid: 13_235, net_profit: 75_000, cash: 152_147, accounts_receivable: 155_342,
    inventory_wip: 5_409, accounts_payable: 17_910, bank_loans_current: 85_000, bank_loans_non_current: 87_000, fixed_assets: 130_800 },
];
const money = (v: number) => Math.round(v).toLocaleString("en-AU");
const last = actualYear(rows, 1, 2027)!, prev = actualYear(rows, 2, 2027)!;

describe("the Planner's assessment (§6.164)", () => {
  it("explains the whole change in operating profit, and nothing else", () => {
    const b = profitBridge(prev, last);
    const steps = b.filter((s) => s.kind === "step").reduce((a, s) => a + s.value, 0);
    expect(Math.round(b[0].value + steps)).toBe(-52_362);
    expect(b.find((s) => s.label === "Overheads")!.value).toBe(-128_270);
  });
  it("lands the cash bridge on the bank balance the accounts show", () => {
    const b = cashBridge(prev, last);
    const steps = b.filter((s) => s.kind === "step").reduce((a, s) => a + s.value, 0);
    expect(Math.round(b[0].value + steps)).toBe(21_315);
  });
  it("puts the loans first, then the rest by the money at stake", () => {
    const keys = issuesFrom(prev, last, money).map((i) => i.key);
    expect(keys[0]).toBe("loans");
    expect(keys).toEqual(expect.arrayContaining(["overheads", "debtors", "margin", "cash"]));
  });
  it("proposes a direction with a number for each", () => {
    const margin = issuesFrom(prev, last, money).find((i) => i.key === "margin")!;
    expect(margin.target).toEqual({ kind: "grossMargin", value: 42 });
    expect(margin.direction).toContain("back to 42%");
  });
});
