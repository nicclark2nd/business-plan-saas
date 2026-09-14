import { describe, it, expect } from "vitest";
import { planCogsByYear, planCogsMonths, productCostYears, productCostMonths, type CostProduct } from "./direct";
import { planRevenueByYear, planYear1Months, unitsByMonth, unitsByYear } from "../sales/product";

/** Year 1 by month must add up to Year 1. A screen that shows both cannot show two different answers. */
const oneOff: CostProduct = {
  id: "a", name: "Carport", sold_as: "one_off", average_price: 12000, units_sold: 30,
  cost_per_unit: 7000, start_selling_year: 1,
  yearly_growth: { "1": { price: 0, units: 10 }, "2": { price: 3, units: 10 } },
  monthly_distribution: null,
} as unknown as CostProduct;

const recurringLine: CostProduct = {
  id: "b", name: "Coaching", sold_as: "recurring", average_price: 24000, opening_clients: 4,
  client_life_months: 12, life_mode: "fixed", monthly_new_clients: { "2": 1, "4": 3, "7": 2 },
  cost_per_unit: 6000, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
} as unknown as CostProduct;

describe("year 1 reconciles to its own months", () => {
  it("a one-off line", () => {
    expect(unitsByMonth(oneOff).reduce((a, b) => a + b, 0)).toBeCloseTo(unitsByYear(oneOff)[0], 2);
    expect(productCostMonths(oneOff).reduce((a, b) => a + b, 0)).toBeCloseTo(productCostYears(oneOff)[0].cost, 2);
  });

  it("an ongoing line", () => {
    expect(productCostMonths(recurringLine).reduce((a, b) => a + b, 0)).toBeCloseTo(productCostYears(recurringLine)[0].cost, 2);
  });

  it("the whole plan", () => {
    const months = planCogsMonths([oneOff, recurringLine], []).reduce((a, b) => a + b, 0);
    expect(months).toBeCloseTo(planCogsByYear([oneOff, recurringLine], [])[0].total, 2);
  });
});

/**
 * §6.36 — a monthly split is weights, not percentages. A line whose split adds to 98 or 105 must still cost
 * the same by the month as it does by the year; it did not, and the twelve-months check on the forecast is
 * what found it on live data.
 */
describe("a split that does not add to 100", () => {
  const weights = (...v: number[]) => Object.fromEntries(v.map((x, i) => [String(i + 1), x]));
  const sum12 = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

  for (const [name, dist] of [
    ["shares adding to 98", weights(8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 10)],
    ["shares adding to 105", weights(9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 6)],
    ["plain weights out of 36", weights(1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0)],
  ] as const) {
    it(`costs the same by month as by year — ${name}`, () => {
      const p = {
        id: "p", name: "Slab", sold_as: "one_off", average_price: 16800, units_sold: 36,
        start_selling_year: 1, yearly_growth: {}, monthly_distribution: dist,
        cost_per_unit: 400, yearly_cost_increase: {},
      } as unknown as CostProduct;
      expect(sum12(planCogsMonths([p], []))).toBeCloseTo(planCogsByYear([p], [])[0].variable, 1);
      expect(sum12(planYear1Months([p]))).toBeCloseTo(planRevenueByYear([p])[0].value, 1);
      expect(sum12(unitsByMonth(p))).toBeCloseTo(unitsByYear(p)[0], 6);
    });
  }
});
