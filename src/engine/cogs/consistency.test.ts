import { describe, it, expect } from "vitest";
import { planCogsByYear, planCogsMonths, productCostYears, productCostMonths, type CostProduct } from "./direct";
import { unitsByMonth, unitsByYear } from "../sales/product";

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
