import { describe, expect, it } from "vitest";
import { breakEvenYear, breakEvenByYear, safetyOf, serviceBreakEven, cashCrossover, type ProfitYear } from "./point";
import { clientMonthsByYear } from "../sales/product";
import type { CostProduct } from "../cogs/direct";

/** A year that clears its costs: 1,000,000 revenue, 600,000 variable, 300,000 of fixed base. */
const trading: ProfitYear = {
  revenue: 1_000_000, variableCogs: 600_000,
  fixedCogs: 50_000, overheads: 200_000, depreciation: 30_000, interest: 20_000,
};

describe("break-even, by year", () => {
  it("is fixed costs over the contribution rate, and needs no unit to say it", () => {
    const b = breakEvenYear(1, trading);
    expect(b.fixedCosts).toBe(300_000);                 // 50k + 200k + 30k + 20k
    expect(b.contribution).toBe(400_000);               // 1m - 600k
    expect(b.contributionRate).toBe(40);
    expect(b.breakEvenRevenue).toBe(750_000);           // 300k / 0.40
    expect(b.headroom).toBe(250_000);
    expect(b.marginOfSafety).toBe(25);
    expect(b.totalCosts).toBe(900_000);
  });

  /**
   * The defining property, and the reason this is worth a test rather than a comment: sell exactly the
   * break-even revenue, and profit is nil. If the formula ever drifts, this fails before a client sees it.
   */
  it("leaves exactly nil profit at the break-even revenue", () => {
    for (const rate of [0.15, 0.4, 0.62, 0.9]) {
      for (const fixed of [1, 12_345.67, 900_000]) {
        const revenue = 2_000_000;
        const b = breakEvenYear(1, {
          revenue, variableCogs: revenue * (1 - rate),
          fixedCogs: fixed, overheads: 0, depreciation: 0, interest: 0,
        });
        const at = b.breakEvenRevenue!;
        const profit = at - at * (1 - rate) - fixed;    // contribution on that revenue, less the fixed base
        // Within a cent: the break-even revenue is money and is rounded to cents like every other figure
        // in the plan, so the profit at it lands within half a cent of nil rather than exactly on it.
        expect(Math.abs(profit)).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("has no break-even when every sale loses money, and says so with a null rather than a nought", () => {
    const upsideDown = breakEvenYear(1, { ...trading, variableCogs: 1_100_000 });
    expect(upsideDown.contribution).toBe(-100_000);
    expect(upsideDown.breakEvenRevenue).toBeNull();     // APeX printed 0 here, which reads as "already there"
    expect(upsideDown.marginOfSafety).toBeNull();
    expect(safetyOf(upsideDown.marginOfSafety)).toBe("none");

    const exactlyFlat = breakEvenYear(1, { ...trading, variableCogs: 1_000_000 });
    expect(exactlyFlat.breakEvenRevenue).toBeNull();    // contribution of nil never covers a fixed base
  });

  it("survives a year with no revenue at all — a line that starts in Year 3", () => {
    const b = breakEvenYear(1, { revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 40_000, depreciation: 0, interest: 0 });
    expect(b.contributionRate).toBeNull();
    expect(b.breakEvenRevenue).toBeNull();
    expect(b.marginOfSafety).toBeNull();
    expect(b.fixedCosts).toBe(40_000);
  });

  it("bands the margin of safety on the conventional thresholds", () => {
    expect(safetyOf(25)).toBe("comfortable");
    expect(safetyOf(24.9)).toBe("tight");
    expect(safetyOf(10)).toBe("tight");
    expect(safetyOf(9.9)).toBe("exposed");
    expect(safetyOf(-40)).toBe("exposed");             // below break-even is exposed, not unbanded
  });

  it("reads five years off the profit and loss it is given", () => {
    const pnl = { 1: trading, 2: trading, 3: trading, 4: trading, 5: trading } as Record<number, ProfitYear>;
    const years = breakEvenByYear(pnl);
    expect(years.map((y) => y.year)).toEqual([1, 2, 3, 4, 5]);
    expect(years.every((y) => y.breakEvenRevenue === 750_000)).toBe(true);
  });
});

/* A one-off line sells jobs; an ongoing line sells client-years. The two are never added together. */
const carports: CostProduct = {
  id: "a", name: "Carports", sold_as: "one_off", average_price: 6800, units_sold: 20, cost_per_unit: 3200,
  start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
} as unknown as CostProduct;

const coaching: CostProduct = {
  id: "b", name: "Coaching", sold_as: "recurring", average_price: 24000, opening_clients: 10,
  client_life_months: 120, life_mode: "fixed", cost_per_unit: 8400,
  start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
} as unknown as CostProduct;

const laterYears: CostProduct = { ...carports, id: "c", name: "Mining", start_selling_year: 4 } as CostProduct;

describe("break-even, by service", () => {
  it("measures each line in what it is actually sold in", () => {
    const [top, next] = serviceBreakEven([carports, coaching], 300_000);
    /**
     * Ten clients on the books at the start, each working through the rest of a ten-year life, come to
     * 114.5 client-MONTHS across Year 1 — the model already attrits them. Twelve of those is one
     * client-year, which is the unit this line is priced and costed in, so that is the unit it breaks even
     * in. Derived from the same function the Sales screen uses rather than typed here, because a figure
     * typed twice is a figure that can disagree.
     */
    expect(top.name).toBe("Coaching");
    expect(top.unit).toBe("client");
    expect(top.planned).toBe(Math.round((clientMonthsByYear(coaching)[0] / 12) * 100) / 100);
    expect(top.planned).toBeCloseTo(9.54, 2);
    expect(top.price).toBeCloseTo(24_000, 0);          // 24,000 a client-year, as entered
    expect(top.cost).toBeCloseTo(8_400, 0);
    expect(top.contribution).toBeCloseTo(15_600, 0);

    expect(next.name).toBe("Carports");
    expect(next.unit).toBe("job");
    expect(next.planned).toBe(20);
    expect(next.contribution).toBe(3600);              // 6,800 - 3,200
    expect(next.contributionRate).toBeCloseTo(52.94, 2);
  });

  it("says how many of one line alone would carry the whole fixed base", () => {
    const [coach, carport] = serviceBreakEven([carports, coaching], 300_000);
    expect(coach.aloneToBreakEven).toBe(Math.ceil(300_000 / coach.contribution));
    expect(coach.aloneToBreakEven).toBe(20);                           // 20 clients on that line alone
    expect(carport.aloneToBreakEven).toBe(Math.ceil(300_000 / 3600));  // 84 jobs
    // Whole units only, and rounded UP: 19.2 clients does not cover it, and is not an answer anyone can act on.
    expect(Number.isInteger(coach.aloneToBreakEven)).toBe(true);
  });

  it("leaves out a line that sells nothing this year, and a line that cannot contribute", () => {
    expect(serviceBreakEven([laterYears], 300_000)).toEqual([]);       // starts in Year 4
    const [loss] = serviceBreakEven([{ ...carports, cost_per_unit: 9000 } as CostProduct], 300_000);
    expect(loss.contribution).toBe(-2200);
    expect(loss.aloneToBreakEven).toBeNull();                          // no volume of it ever gets there
  });

  it("finds the later year's line when asked for that year", () => {
    const [mining] = serviceBreakEven([laterYears], 300_000, 4);
    expect(mining.name).toBe("Mining");
    expect(mining.planned).toBe(20);
  });
});

describe("the cash crossover", () => {
  const months = (net: number[], interest = 0) => net.map((n) => ({ netOperating: n, interestPaid: interest }));

  it("is the month cumulative operating cash, after interest, first reaches nil", () => {
    const c = cashCrossover(months([-30, -20, -10, 25, 40, 40, 40, 40, 40, 40, 40, 40], 5));
    // Cumulative of (net - 5): -35, -60, -75, -55, -20, 15, ...
    expect(c.cumulative.slice(0, 6)).toEqual([-35, -60, -75, -55, -20, 15]);
    expect(c.month).toBe(6);
    expect(c.lowest).toEqual({ month: 3, value: -75 });
    expect(c.fallsBack).toBe(false);
  });

  it("reports a crossing that does not hold", () => {
    const c = cashCrossover(months([10, -5, -20, 5, 5, 5, 5, 5, 5, 5, 5, 5]));
    expect(c.month).toBe(1);
    expect(c.fallsBack).toBe(true);                    // cumulative dips to -15 in month 3
  });

  it("says nothing rather than something when the year never gets there", () => {
    const c = cashCrossover(months([-10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10]));
    expect(c.month).toBeNull();
    expect(c.lowest).toEqual({ month: 12, value: -120 });
  });

  it("ignores money the owner puts in — only operating cash counts", () => {
    // netOperating is operating cash ALONE: a loan drawn or equity raised never reaches this function.
    const c = cashCrossover(months([-100, -100, 300]));
    expect(c.cumulative).toEqual([-100, -200, 100]);
    expect(c.month).toBe(3);
  });
});
