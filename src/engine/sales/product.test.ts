import { describe, it, expect } from "vitest";
import { productYears, productYear1Months, planRevenueByYear, bookNow } from "./product";

const oneOff = { average_price: 16800, units_sold: 36, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null, sold_as: "one_off" };
const coach = {
  average_price: 24000, units_sold: 10, start_selling_year: 1, yearly_growth: {}, sold_as: "recurring",
  opening_clients: 0, client_life_months: 12, life_mode: "average",
  monthly_new_clients: { "1": 0, "2": 1, "3": 0, "4": 3, "5": 1, "6": 1, "7": 2, "8": 0, "9": 0, "10": 1, "11": 0, "12": 1 },
};

describe("product dispatch", () => {
  it("leaves one-off lines exactly as they were", () => {
    expect(productYears(oneOff).map((y) => y.revenue)).toEqual([604800, 604800, 604800, 604800, 604800]);
    expect(productYear1Months(oneOff).reduce((a, b) => a + b, 0)).toBeCloseTo(604800, 0);
  });

  it("an ongoing line bills its active clients, not price x units", () => {
    const y = productYears(coach);
    expect(y[0].revenue).toBeLessThan(240000);
    expect(y[0].newClients).toBe(10);
    expect(productYear1Months(coach).reduce((a, b) => a + b, 0)).toBeCloseTo(y[0].revenue, 0);
  });

  it("a set programme reproduces the client-months a planner would count by hand", () => {
    const y = productYears({ ...coach, life_mode: "fixed" });
    expect(y[0].revenue).toBe(138000);          // 69 client-months x $2,000
    expect(y[0].runRate).toBe(240000);
  });

  it("a fee rise lifts everyone from the year it applies", () => {
    const flat = productYears({ ...coach, life_mode: "fixed" })[1].revenue;
    const risen = productYears({ ...coach, life_mode: "fixed", yearly_growth: { "2": { price: 10, units: 0 } } })[1].revenue;
    expect(risen).toBeCloseTo(flat * 1.1, 0);
  });

  it("an established book bills from month one and is worth its run rate today", () => {
    const firm = { ...coach, units_sold: 3, opening_clients: 12, client_life_months: 60,
      monthly_new_clients: { "1": 0, "2": 1, "3": 0, "4": 0, "5": 0, "6": 1, "7": 0, "8": 0, "9": 0, "10": 1, "11": 0, "12": 0 } };
    expect(bookNow(firm)).toBe(288000);
    expect(productYear1Months(firm)[0]).toBe(24000);
    expect(productYears(firm)[0].revenue).toBeGreaterThan(288000);
  });

  it("a plan mixing both kinds adds up", () => {
    const total = planRevenueByYear([oneOff, coach]);
    expect(total[0].value).toBeCloseTo(604800 + productYears(coach)[0].revenue, 0);
  });
});
