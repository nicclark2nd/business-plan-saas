import { describe, it, expect } from "vitest";
import { unitCostByYear, productCostYears, productCostMonths, fixedCostByYear, fixedCostMonths, planCogsByYear, planCogsMonths, currentCost } from "./direct";

// APeX, DesignOne Concreting: Carports sell for $6,800, 18 units, costing $3,200 each, cost rising 1 % a year.
const carports = {
  id: "C", average_price: 6800, units_sold: 18, start_selling_year: 1, sold_as: "one_off",
  yearly_growth: { "1": { price: 0, units: 0 }, "2": { price: 3, units: 10 }, "3": { price: 3, units: 10 }, "4": { price: 3, units: 10 }, "5": { price: 3, units: 10 } },
  monthly_distribution: null, cost_per_unit: 3200,
  yearly_cost_increase: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1 },
};
// A coach: $2,000 a month a client, ten won through the year, each staying twelve months as a set programme.
// A contractor delivers the sessions at $700 a month, so the cost is quoted per client per YEAR: 8,400.
const coach = {
  id: "K", average_price: 24000, units_sold: 10, start_selling_year: 1, sold_as: "recurring",
  yearly_growth: {}, opening_clients: 0, client_life_months: 12, life_mode: "fixed",
  monthly_new_clients: { "1": 0, "2": 1, "3": 0, "4": 3, "5": 1, "6": 1, "7": 2, "8": 0, "9": 0, "10": 1, "11": 0, "12": 1 },
  cost_per_unit: 8400, yearly_cost_increase: {},
};

describe("direct costs", () => {
  /**
   * §6.33 is a deliberate break from APeX here. APeX applies a Year 1 rise to a line that is already
   * selling, because its base sits in a notional year before Year 1. This plan has no such year: Year 1 IS
   * the year the business is in, so the entered cost is Year 1's cost and the first rise lands in Year 2.
   * The Year 5 figure is one compounding step lower than APeX's for the same reason.
   */
  it("charges the entered cost in Year 1, and compounds from Year 2", () => {
    const y = productCostYears(carports);
    expect(currentCost(carports)).toBe(57600);        // 3,200 x 18
    expect(y[0].cost).toBe(57600);                    // Year 1 IS now: no rise yet (APeX said 58,176)
    expect(unitCostByYear(carports)[0]).toBe(3200);   // the cost as entered
    expect(unitCostByYear(carports)[1]).toBe(3232);   // the first 1 % rise lands in Year 2
    expect(y[0].cost).toBe(currentCost(carports));    // and "current" and Year 1 are the same year
  });

  it("gross profit and margin fall out of price less cost", () => {
    const y = productCostYears(carports)[0];
    expect(y.revenue).toBe(122400);
    expect(y.grossProfit).toBe(122400 - y.cost);
    expect(y.margin).toBeCloseTo(52.9, 0);            // APeX 52.9 %
  });

  it("an ongoing line costs per client per month, not per client won", () => {
    const y = productCostYears(coach);
    expect(y[0].volume).toBe(69);                     // 69 client-months in Year 1
    expect(y[0].cost).toBe(69 * 700);                 // $700 a month each
    expect(y[0].revenue).toBe(138000);
    expect(y[0].margin).toBeCloseTo(65, 0);
  });

  it("a line with no direct cost says so rather than fudging it", () => {
    const royalty = { ...coach, cost_per_unit: 0 };
    const y = productCostYears(royalty)[0];
    expect(y.cost).toBe(0);
    expect(y.margin).toBe(100);
  });

  it("cost rises compound from the year the line starts, never before", () => {
    const later = { ...carports, start_selling_year: 3 };          // starts in Year 3 (§6.33: the value IS the year)
    const c = unitCostByYear(later);
    expect(c[0]).toBe(0); expect(c[1]).toBe(0);
    expect(c[2]).toBe(3200);                                       // its own first year, no rise yet
    expect(c[3]).toBe(3232);
    expect(productCostYears(later)[0].cost).toBe(0);
  });

  it("a one-off line costs when it sells; an ongoing line costs while clients are on the books", () => {
    const cm = productCostMonths(carports);
    expect(cm.reduce((a, b) => a + b, 0)).toBeCloseTo(productCostYears(carports)[0].cost, 0);
    const km = productCostMonths(coach);
    expect(km[0]).toBe(0);                                          // no clients in January
    expect(km[11]).toBeGreaterThan(km[1]);                          // and ten by December
    expect(km.reduce((a, b) => a + b, 0)).toBeCloseTo(productCostYears(coach)[0].cost, 0);
  });

  it("a fixed cost IS its Year 1 figure, and rises from Year 2", () => {
    const wage = { annual_cost: 30300, yearly_growth_rates: { "2": 1, "3": 1, "4": 1, "5": 1 }, monthly_distribution: null };
    expect(fixedCostByYear(wage)).toEqual([30300, 30603, 30909.03, 31218.12, 31530.3]);   // APeX Base Salary
    expect(fixedCostByYear(wage)[0]).toBe(30300);                   // what was typed is what Year 1 shows
    expect(fixedCostMonths(wage).reduce((a, b) => a + b, 0)).toBeCloseTo(30300, 0);
  });

  it("still reads a Year 1 rate on a row migration 0026 has not folded yet (\u00a76.29)", () => {
    const legacy = { annual_cost: 30000, yearly_growth_rates: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1 }, monthly_distribution: null };
    const folded = { annual_cost: 30300, yearly_growth_rates: { "2": 1, "3": 1, "4": 1, "5": 1 }, monthly_distribution: null };
    expect(fixedCostByYear(legacy)).toEqual(fixedCostByYear(folded));   // the fold changes no figure anywhere
  });

  it("the plan totals variable and fixed, and states the margin", () => {
    const wage = { annual_cost: 30000, yearly_growth_rates: {}, monthly_distribution: null };
    const y = planCogsByYear([carports, coach], [wage])[0];
    expect(y.variable).toBe(productCostYears(carports)[0].cost + productCostYears(coach)[0].cost);
    expect(y.fixed).toBe(30000);
    expect(y.total).toBe(y.variable + y.fixed);
    expect(y.grossProfit).toBe(r(y.revenue - y.total));
    expect(planCogsMonths([carports, coach], [wage]).reduce((a, b) => a + b, 0)).toBeCloseTo(y.total, 0);
  });

  it("today's cost is only what is already selling", () => {
    expect(currentCost(carports)).toBe(57600);
    expect(currentCost({ ...carports, start_selling_year: 4 })).toBe(0);
    expect(currentCost({ ...coach, opening_clients: 12 })).toBe(12 * 8400);
  });
});
const r = (v: number) => Math.round(v * 100) / 100;
