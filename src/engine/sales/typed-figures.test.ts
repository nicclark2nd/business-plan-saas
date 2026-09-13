import { describe, it, expect } from "vitest";
import { yearlyProjection, impliedPct, hasValue, type Growth } from "./projection";
import { unitsByYear, unitsByMonth, type AnyProduct } from "./product";

/**
 * Nic's Retaining Walls: 19,000 x 12 today, price +2 % a year, and twelve / fourteen / sixteen / eighteen /
 * twenty walls — the quantities he actually plans, typed as themselves rather than solved for.
 */
const walls = (growth: Growth) => ({
  id: "w", name: "Retaining Walls", sold_as: "one_off", average_price: 19000, units_sold: 12,
  start_selling_year: 1, yearly_growth: growth, monthly_distribution: null,
}) as unknown as AnyProduct;

const typed: Growth = {
  "1": { price: 0, unitsValue: 12 },
  "2": { price: 2, unitsValue: 14 },
  "3": { price: 2, unitsValue: 16 },
  "4": { price: 2, unitsValue: 18 },
  "5": { price: 2, unitsValue: 20 },
};

describe("figures typed as themselves", () => {
  it("uses the exact quantity, not a percentage that lands near it", () => {
    const y = yearlyProjection(19000, 12, typed, 1);
    expect(y.map((x) => x.units)).toEqual([12, 14, 16, 18, 20]);
  });

  it("the old way carried a quantity nobody typed", () => {
    // 16.7 % of 12 is 14.004, and 14.004 is what compounds onward.
    const byPct = yearlyProjection(19000, 12, { "2": { units: 16.7 } }, 1);
    expect(byPct[1].units).toBe(14);          // shown as 14 …
    const onward = yearlyProjection(19000, 12, { "2": { units: 16.7 }, "3": { units: 0 } }, 1);
    expect(onward[2].units).toBe(14);         // … and the drift is carried, not the clean 14
    expect(yearlyProjection(19000, 12, typed, 1)[2].units).toBe(16);
  });

  it("a typed figure and a percentage can sit on the same line, year by year", () => {
    const y = yearlyProjection(19000, 12, typed, 1);
    expect(y[0].price).toBeCloseTo(19000, 2);        // price still grown by %
    expect(y[1].price).toBeCloseTo(19380, 2);
    expect(y[4].price).toBeCloseTo(20566.21, 1);
    expect(y[4].units).toBe(20);                     // units typed outright
    expect(y[1].sales).toBeCloseTo(271320, 0);       // matches the screen
  });

  it("a typed price overrides the percentage for that year and carries on from there", () => {
    const g: Growth = { "2": { price: 50, priceValue: 20000 }, "3": { price: 10 } };
    const y = yearlyProjection(19000, 12, g, 1);
    expect(y[1].price).toBe(20000);                  // typed wins over the 50 %
    expect(y[2].price).toBeCloseTo(22000, 2);        // and the next year grows off it
  });

  it("units by year and by month agree with the projection — the §6.21.1 invariant", () => {
    const p = walls(typed);
    expect(unitsByYear(p)).toEqual([12, 14, 16, 18, 20]);
    expect(unitsByMonth(p).reduce((a, b) => a + b, 0)).toBeCloseTo(12, 2);
    expect(yearlyProjection(19000, 12, typed, 1).map((x) => x.units)).toEqual(unitsByYear(p));
  });

  it("says what percentage a typed figure implies, for showing back", () => {
    expect(impliedPct(12, 14)).toBe(16.67);
    expect(impliedPct(19000, 19380)).toBe(2);
    expect(impliedPct(0, 5)).toBeNull();
    expect(hasValue(typed["2"], "units")).toBe(true);
    expect(hasValue(typed["2"], "price")).toBe(false);
  });

  it("zero is a figure like any other — a year a line sells nothing", () => {
    const y = yearlyProjection(19000, 12, { "3": { unitsValue: 0 } }, 1);
    expect(y[2].units).toBe(0);
    expect(y[2].sales).toBe(0);
    expect(y[3].units).toBe(0);     // and nothing grows back out of nothing
  });
});
