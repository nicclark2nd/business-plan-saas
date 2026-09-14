import { describe, expect, it } from "vitest";
import { rbfByYear, rbfCap, rbfCost, rbfSplitMonths, type FundingSource, type RevenueLinked } from "./sources";
import { assembleBase, assembleOpening } from "../forecast/assemble";
import { buildForecast, FORECAST_YEARS } from "../forecast/model";
import { planRevenueMonths, type AnyProduct } from "../sales/product";
import type { PlanSources } from "../forecast/assemble";

const rbf: RevenueLinked = {
  amount_received: 100000, repayment_percent: 8, cap_multiple: 1.4,
  min_monthly_payment: 0, start_year: 1, start_month: 1,
};
const source: FundingSource = { id: "r1", kind: "revenue_linked", name: "Clearco", amount: 100000, start_year: 1, start_month: 1, rbf };

const products = [
  { id: "a", name: "Job", sold_as: "one_off", average_price: 1000, units_sold: 600, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null },
] as unknown as AnyProduct[];
const revenueMonths = planRevenueMonths(products);
const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

describe("revenue-linked finance is debt, and is treated as debt (§6.37)", () => {
  const months = rbfSplitMonths(rbf, revenueMonths);

  it("repays exactly the principal and exactly the cap, and no more", () => {
    expect(sum(months.map((m) => m.payment))).toBeCloseTo(rbfCap(rbf), 1);
    expect(sum(months.map((m) => m.principal))).toBeCloseTo(100000, 1);
    expect(sum(months.map((m) => m.cost))).toBeCloseTo(rbfCost(rbf), 1);
  });

  it("retires the liability to nil — not to a few cents that sit there forever", () => {
    expect(months[59].balance).toBe(0);
    const last = months.findLastIndex((m) => m.payment > 0);
    expect(months[last].balance).toBe(0);
  });

  it("never lets the balance go negative or the principal exceed what is left", () => {
    for (const m of months) {
      expect(m.balance).toBeGreaterThanOrEqual(0);
      expect(m.principal).toBeGreaterThanOrEqual(0);
      expect(m.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("owes the full amount the month it arrives", () => {
    expect(rbfByYear(rbf, revenueMonths)[0].closing).toBeLessThan(100000);
    expect(months[0].balance).toBeGreaterThan(0);
  });

  it("does not repay before the money lands", () => {
    const later = { ...rbf, start_year: 3, start_month: 4 };
    const m = rbfSplitMonths(later, revenueMonths);
    expect(sum(m.slice(0, 27).map((x) => x.payment))).toBe(0);
    expect(m[26].balance).toBe(0);
    expect(m[27].balance).toBeGreaterThan(0);
  });
});

/**
 * The fault itself: the money came in, was never repaid, never appeared as a liability, and the balance
 * sheet was over by the full amount in every one of the five years.
 */
describe("the forecast a revenue-linked source produces", () => {
  const plan = {
    products, costProducts: products, fixedCogs: [], overheads: [],
    salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0], onCostPct: 0,
    funding: [source], assets: [], extraordinary: [],
  } as unknown as PlanSources;

  const forecast = buildForecast({
    base: assembleBase(plan),
    opening: assembleOpening(null, 0, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 25, dividendRate: 0,
  });

  it("balances in every year", () => {
    for (const y of FORECAST_YEARS) expect(forecast.balanceSheet[y].balanceCheck, `Y${y}`).toBe(0);
    expect(forecast.reconciled).toBe(true);
  });

  it("shows the money as owed until it is repaid", () => {
    const owed = FORECAST_YEARS.map((y) => forecast.balanceSheet[y].debtCurrent + forecast.balanceSheet[y].debtNonCurrent);
    expect(owed[0]).toBeGreaterThan(0);
    expect(owed[0]).toBeLessThan(100000);          // a year of repayments has already come off it
    expect(owed[4]).toBe(0);                        // and it is gone by the end of the plan
  });

  it("charges the cost of the money to the profit and loss", () => {
    const charged = FORECAST_YEARS.reduce((a, y) => a + forecast.pnl[y].interest, 0);
    expect(charged).toBeCloseTo(rbfCost(rbf), 0);
  });

  it("takes the repayments out of cash as financing, never as an operating cost", () => {
    const repaid = FORECAST_YEARS.reduce((a, y) => a + forecast.cashFlow[y].debtRepaid, 0);
    expect(repaid).toBeCloseTo(100000, 0);
    expect(forecast.cashFlow[1].debtProceeds).toBe(100000);
  });
});
