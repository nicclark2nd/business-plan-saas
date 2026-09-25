import { describe, expect, it } from "vitest";
import { assembleOpening } from "./assemble";
import { FORECAST_YEARS } from "./model";
import { runForecast } from "./run";
import { settingsFor } from "../plan/gst";
import { regimeFor } from "../plan/taxRegimes";
import { makePlan } from "./plans.fixture";
import { lossMonths, monthlyProfit, monthlyProfitGap } from "./monthlyProfit";

/**
 * THE CHART AND THE PROFIT AND LOSS MUST BE THE SAME PLAN (§6.124).
 *
 * A dashboard card that adds up to something other than the statement behind it is worse than no card:
 * two numbers disagreeing on one screen is the fault this project keeps paying for (§6.92.1). So this runs
 * across GENERATED plans rather than one hand-built one — the shapes that break are the ones nobody would
 * think to type — and asserts the twelve months add to that year's own profit before tax.
 */
const run = (seed: number) => {
  const p = makePlan(seed);
  const components = p.place[0] ? regimeFor(p.place[0], p.place[1]).components.map((c) => settingsFor(c)) : [];
  return runForecast({
    sources: p.sources,
    opening: assembleOpening(null, p.openingCash, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.timing])),
    taxRate: p.taxRate, dividendRate: p.dividendRate,
    openingTaxLosses: p.openingTaxLosses, openingRetainedEarnings: p.openingRetainedEarnings,
    components,
  });
};

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

describe("profit before tax, month by month", () => {
  it("gives twelve months for every year", () => {
    const r = run(1);
    for (const y of FORECAST_YEARS) expect(monthlyProfit(r.shapesByYear[y])).toHaveLength(12);
  });

  /*
   * THE WHOLE POINT. The only line that may be missing is a disposal's gain against book value, which has
   * no monthly form — so the gap is asserted to be either nothing, or exactly that.
   */
  it("adds up to the year's own profit before tax, or names what it cannot place", () => {
    for (const seed of SEEDS) {
      const r = run(seed);
      for (const y of FORECAST_YEARS) {
        const gap = monthlyProfitGap(r.shapesByYear[y], r.forecast.pnl[y].profitBeforeTax);
        const disposal = r.forecast.pnl[y].disposalGainLoss;
        expect(Math.abs(gap - disposal), `seed ${seed} year ${y}: gap ${gap} is not the disposal ${disposal}`)
          .toBeLessThan(1);
      }
    }
  });

  it("reports no gap at all on a plan that sells nothing", () => {
    for (const seed of SEEDS) {
      const r = run(seed);
      for (const y of FORECAST_YEARS) {
        if (r.forecast.pnl[y].disposalGainLoss !== 0) continue;
        expect(Math.abs(monthlyProfitGap(r.shapesByYear[y], r.forecast.pnl[y].profitBeforeTax)), `seed ${seed} year ${y}`)
          .toBeLessThan(1);
      }
    }
  });

  it("names the months that lost money, and nothing else", () => {
    expect(lossMonths([10, -5, 0, -1])).toEqual([2, 4]);
    expect(lossMonths([1, 2, 3])).toEqual([]);
  });
});
