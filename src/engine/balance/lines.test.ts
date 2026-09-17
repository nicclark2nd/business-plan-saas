import { describe, expect, it } from "vitest";
import { cashCycleDays, strengthByYear, workingCapitalMonths } from "./lines";
import { runForecast, type PlanInput } from "../forecast/run";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS } from "../forecast/model";
import { makePlan } from "../forecast/plans.fixture";

/** The same generated plans the forecast's own suites run on, put through the one pipeline (§6.67). */
const planFor = (seed: number): PlanInput => {
  const p = makePlan(seed);
  return {
    sources: p.sources as unknown as PlanSources,
    opening: assembleOpening(null, 40_000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.timing])),
    taxRate: 25, dividendRate: 0,
    openingTaxLosses: 0, openingRetainedEarnings: 0,
    components: [],
  };
};

describe("the strength ratios", () => {
  /**
   * The point of these is that they can never be a second opinion. Every one is division on two figures
   * already printed on the statement, so if a ratio and the table it sits under ever disagreed, the ratio
   * is the thing that was invented. Run across generated plans in every year.
   */
  it("is arithmetic on the statement and nothing else, across 30 plans", () => {
    const broken: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const { forecast } = runForecast(planFor(seed));
      const bs = forecast.balanceSheet;
      for (const s of strengthByYear(bs, FORECAST_YEARS)) {
        const b = bs[s.year];
        const near = (what: string, got: number, want: number) => {
          if (Math.abs(got - want) > 0.02) broken.push(`seed ${seed} Y${s.year} ${what}: ${got} vs ${want}`);
        };
        near("total debt", s.totalDebt, b.debtCurrent + b.debtNonCurrent);
        near("net debt", s.netDebt, b.debtCurrent + b.debtNonCurrent - b.cash);
        near("net working capital", s.netWorkingCapital, b.currentAssets - b.currentLiabilities);
        near("net assets", s.netAssets, b.totalAssets - b.totalLiabilities);
        /* The ratios are rounded to two places for reading, so they are checked at that resolution
           rather than multiplied back out — on liabilities in the millions, half a hundredth of a ratio is
           thousands of dollars of nothing. */
        const at2 = (what: string, got: number | null, top: number, bottom: number) => {
          if (got === null) return;
          if (Math.abs(got - top / bottom) > 0.005) broken.push(`seed ${seed} Y${s.year} ${what}: ${got} vs ${top / bottom}`);
        };
        at2("current ratio", s.currentRatio, b.currentAssets, b.currentLiabilities);
        at2("quick ratio", s.quickRatio, b.currentAssets - b.inventory, b.currentLiabilities);
      }
    }
    expect(broken).toEqual([]);
  });

  /**
   * Net assets and equity are the same quantity reached two ways, and the balance sheet balancing is what
   * makes them the same. Taking net assets off the two TOTALS rather than off equity is deliberate: if the
   * statement ever stopped balancing, this tile would show it rather than quietly agreeing with itself.
   */
  it("meets equity, because the statement balances", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { forecast } = runForecast(planFor(seed));
      for (const s of strengthByYear(forecast.balanceSheet, FORECAST_YEARS)) {
        expect(Math.abs(s.netAssets - s.equity)).toBeLessThan(0.02);
      }
    }
  });

  it("refuses to divide by nothing rather than returning zero", () => {
    const empty = {
      1: { currentAssets: 5000, currentLiabilities: 0, inventory: 0, cash: 5000, debtCurrent: 0, debtNonCurrent: 0,
           equity: 0, totalAssets: 5000, totalLiabilities: 0 },
    } as never;
    const [s] = strengthByYear(empty, [1]);
    expect(s.currentRatio).toBeNull();
    expect(s.quickRatio).toBeNull();
    expect(s.gearing).toBeNull();
  });

  it("reads gearing as debt against debt plus equity", () => {
    const b = {
      1: { currentAssets: 0, currentLiabilities: 0, inventory: 0, cash: 0, debtCurrent: 100, debtNonCurrent: 300,
           equity: 100, totalAssets: 500, totalLiabilities: 400 },
    } as never;
    expect(strengthByYear(b, [1])[0].gearing).toBe(80);
  });
});

describe("working capital month by month", () => {
  /**
   * The year's closing balances are the annual model's, not this reading's. The twelfth month has to land
   * on them exactly or the two screens are telling a client two different things about the same date.
   */
  it("ends the year where the balance sheet says it ends, across 20 plans", () => {
    const broken: string[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const { forecast, monthly } = runForecast(planFor(seed));
      const last = workingCapitalMonths(monthly.months)[11];
      const b = forecast.balanceSheet[1];
      const near = (what: string, got: number, want: number) => {
        if (Math.abs(got - want) > 0.02) broken.push(`seed ${seed} ${what}: ${got} vs ${want}`);
      };
      near("debtors", last.debtors, b.accountsReceivable);
      near("stock", last.stock, b.inventory);
      near("creditors", last.creditors, b.accountsPayable);
    }
    expect(broken).toEqual([]);
  });

  it("ties up debtors and stock and releases creditors", () => {
    const [m] = workingCapitalMonths([{ month: 1, accountsReceivable: 1000, inventory: 250, accountsPayable: 400 } as never]);
    expect(m.tiedUp).toBe(850);
  });
});

describe("the cash cycle", () => {
  it("is the days in less the days out", () => {
    expect(cashCycleDays({ debtorDays: 46, inventoryDays: 2, creditorDays: 6 })).toBe(42);
  });
  it("can be negative, which is the supplier funding the business", () => {
    expect(cashCycleDays({ debtorDays: 5, inventoryDays: 0, creditorDays: 45 })).toBe(-40);
  });
});
