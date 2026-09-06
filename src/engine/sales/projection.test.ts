import { describe, expect, it } from "vitest";
import { exactHundred, yearlyProjection, revenueByYear, evenDistribution, moderateDistribution, rampUpDistribution, distributionTotal, distributionValid, monthlySales } from "./projection";

describe("sales projection (APeX Annual Projections parity, DesignOne)", () => {
  it("House Slab: 16,800 × 36, price 0/1/1/1/1 %, units 0/10/10/10/10 %", () => {
    const g = { "1": { price: 0, units: 0 }, "2": { price: 1, units: 10 }, "3": { price: 1, units: 10 }, "4": { price: 1, units: 10 }, "5": { price: 1, units: 10 } };
    const p = yearlyProjection(16800, 36, g, 1);
    expect(p.map((y) => Math.round(y.sales))).toEqual([604800, 671933, 746517, 829450, 921484]);
    expect(p[1].price).toBeCloseTo(16968, 2);
    expect(p[1].units).toBe(39.6);
  });
  it("Carports: 6,800 × 18, then +3 % price / +10 % units", () => {
    const g = { "1": { price: 0, units: 0 }, "2": { price: 3, units: 10 }, "3": { price: 3, units: 10 }, "4": { price: 3, units: 10 }, "5": { price: 3, units: 10 } };
    expect(yearlyProjection(6800, 18, g, 1).map((y) => Math.round(y.sales))).toEqual([122400, 138679, 157124, 178036, 201669]);
  });
  it("blank growth means flat — no silent 5/10 % default", () => {
    expect(yearlyProjection(1000, 10, {}, 1).map((y) => y.sales)).toEqual([10000, 10000, 10000, 10000, 10000]);
    expect(yearlyProjection(1000, 10, null, 1).every((y) => y.sales === 10000)).toBe(true);
  });
  it("negative growth shrinks the line", () => {
    const p = yearlyProjection(1000, 100, { "1": { price: -10, units: -20 } }, 1);
    expect(p[0].sales).toBe(72000);
  });
  it("a line starting in Year 3 sells its base in Year 3 and compounds from Year 4; nothing before", () => {
    const p = yearlyProjection(500, 10, { "3": { price: 50, units: 50 }, "4": { price: 10, units: 10 } }, 4);   // start 4 = Year 3
    expect(p.map((y) => y.sales)).toEqual([0, 0, 5000, 6050, 6050]);   // Year 3's own growth is ignored; Year 4 = 550 × 11
  });
  it("totals across products give the forecast's revenue line", () => {
    const t = revenueByYear([
      { average_price: 16800, units_sold: 36, yearly_growth: { "2": { price: 1, units: 10 } }, start_selling_year: 1 },
      { average_price: 25000, units_sold: 12, yearly_growth: {}, start_selling_year: 1 },
    ]);
    expect(t[0].value).toBe(904800);
    expect(Math.round(t[1].value)).toBe(971933);
  });
});

describe("monthly distribution", () => {
  it("presets each sum to exactly 100", () => {
    for (const d of [evenDistribution(), moderateDistribution(), rampUpDistribution()]) { expect(distributionTotal(d)).toBe(100); expect(distributionValid(d)).toBe(true); }
  });
  it("even is 8.3333 × 11 and 8.3337 in December (APeX)", () => {
    const d = evenDistribution(); expect(d["1"]).toBe(8.3333); expect(d["12"]).toBe(8.3337);
  });
  it("ramp-up puts December well above January", () => {
    const d = rampUpDistribution(); expect(d["12"]).toBeGreaterThan(d["1"] * 10);
  });
  it("splits Year-1 sales by month", () => {
    const m = monthlySales(120000, evenDistribution()); expect(m.reduce((a, b) => a + b, 0)).toBeCloseTo(120000, 0);
  });
});

describe("a split that is a hair short of 100", () => {
  it("is scaled to exactly 100 so no revenue leaks", () => {
    const typed = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 8.333]));   // 99.996 %
    expect(distributionTotal(typed)).toBe(99.996);
    expect(distributionTotal(exactHundred(typed))).toBe(100);
  });
  it("leaves an exact split alone", () => {
    const even = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), 8.3333]));
    const d = { ...even, "12": 8.3337 };
    expect(exactHundred(d)).toBe(d);
  });
});
