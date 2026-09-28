import { describe, it, expect } from "vitest";
import { growSummary } from "./summary";
import type { CapabilityInput, Metric } from "./model";

const money = (v: number) => Math.round(v).toLocaleString("en-AU");
const pnl = (op: number) => ({ operatingProfit: op, depreciation: 0, revenue: 1 });
const card = (key: string, value: number) => ({ key, value } as unknown as Metric);
const base = { growth: { cashBuffer: 78_048, costOfCapital: 12 }, stress: { salesPct: null, marginPts: null, debtorDaysAdded: null }, sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null }, transfer: [] };

describe("three lines for the person in the room (§6.160)", () => {
  it("reads SEQ's grow tab the way Nic described it", () => {
    const s = growSummary({
      adviser: true, money,
      actual: {
        growIn: { ...base, pnl: { 1: pnl(102_235), 2: pnl(-52_362) } } as unknown as CapabilityInput,
        posIn: { ...base, pnl: { 1: pnl(-52_362) } } as unknown as CapabilityInput,
        year: 2026, grow: [card("revenueGrowth", 5.7)], borrow: [],
      },
      plan: {
        input: { ...base, pnl: { 1: pnl(-87_248), 3: pnl(72_198) }, monthlyCash: [105, 85, 68, 50, 33, 135, 118, 100, 80, 60, 40, -25].map((k) => k * 1000) } as unknown as CapabilityInput,
        firstYear: 2027, grow: [card("revenueGrowth", 9.3)], borrow: [], monthNames: [],
      },
    });
    expect(s.happened).toBe("In 2026 sales grew 5.7% and profit fell into a 52,362 loss.");
    expect(s.asks).toBe("The plan asks for 9.3% growth in 2027 and a bigger loss, with the bank below your floor for 6 of 12 months.");
    expect(s.talk).toBe("Talk to the owner about how 2027 gets funded before talking about growth.");
  });

  /* §6.172 — ZZ: no accounts, so the Grow tab measures 2027 → 2028 and the line has to say 2028. */
  it("names the growth year a plan with no accounts is measured on", () => {
    const s = growSummary({
      adviser: false, money, actual: null,
      plan: {
        input: { ...base, growth: { cashBuffer: null, costOfCapital: 12 }, pnl: { 1: pnl(500_000), 2: pnl(556_800) }, monthlyCash: [10_000] } as unknown as CapabilityInput,
        firstYear: 2027, grow: [card("revenueGrowth", 0)], borrow: [], monthNames: [],
      },
    });
    expect(s.asks).toBe("The plan asks for 0% growth in 2028 and 556,800 of operating profit.");
  });
});
