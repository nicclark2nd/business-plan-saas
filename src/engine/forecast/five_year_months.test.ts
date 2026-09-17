import { describe, expect, it } from "vitest";
import { assembleOpening } from "./assemble";
import { FORECAST_YEARS } from "./model";
import { runForecast } from "./run";
import { settingsFor } from "../plan/gst";
import { regimeFor } from "../plan/taxRegimes";
import { makePlan } from "./plans.fixture";

/**
 * Every year, month by month (§6.71).
 *
 * Until now `assembleMonths` was sliced to Year 1, so a five-year plan had twelve months of detail and
 * forty-eight months of nothing. The overdraft sweep needs monthly cash in every year, and the honest test
 * of whether the shapes are right is the one the app already runs: **each year's twelve months must add to
 * that year's own annual cash flow.**
 *
 * Run across generated plans rather than one hand-built one, because the shapes that break are the ones
 * nobody would think to type — a line that starts in Year 3, an asset bought in Year 4, a loan drawn in
 * Year 2, a tax component that files quarterly.
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

describe("five years, month by month", () => {
  it("has twelve months for every year, not just the first", () => {
    const r = run(1);
    for (const y of FORECAST_YEARS) expect(r.monthlyByYear[y].months).toHaveLength(12);
    expect(r.monthlyByYear[1]).toBe(r.monthly);
  });

  it("each year's twelve months add to that year, across 40 generated plans", () => {
    const broken: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const r = run(seed);
      for (const i of r.checked.invariants) {
        if (!i.passed) broken.push(`seed ${seed} · ${i.label} off by ${i.difference}`);
      }
    }
    expect(broken.slice(0, 10)).toEqual([]);
  });

  /**
   * An all-zero year would satisfy every invariant vacuously — twelve nothings add to a year of nothing
   * only if the year is also nothing. This is the check that the later years carry real figures.
   */
  it("carries real figures in the later years, not empty arrays", () => {
    const r = run(3);
    for (const y of FORECAST_YEARS) {
      const m = r.monthlyByYear[y];
      const moved = m.months.some((x) => x.receiptsFromCustomers !== 0 || x.paidToSuppliersAndEmployees !== 0);
      expect(moved, `year ${y} has no cash movement in any month`).toBe(true);
    }
    // And the years are not copies of each other: Year 5 sells more than Year 1 on a growing plan.
    const y1 = r.monthlyByYear[1].total.receiptsFromCustomers;
    const y5 = r.monthlyByYear[5].total.receiptsFromCustomers;
    expect(y5).not.toBe(y1);
  });

  /**
   * Each year opens on the ANNUAL model's opening cash, while the year before it closes on the monthly
   * path's own accumulation. Those meet to within the rounding the monthly series carries: every month is
   * placed against an annual total and December absorbs the remainder, so a few cents can sit in the seam.
   *
   * Half a dollar is the tolerance the app's own invariants use for "these agree" (`monthlyInvariants`),
   * and this test uses the same number rather than inventing a stricter one it would then have to explain.
   */
  it("opens each year within a rounding cent of where the last one closed", () => {
    const r = run(7);
    for (const y of FORECAST_YEARS) {
      if (y === 1) continue;
      const gap = Math.abs(r.monthlyByYear[y].months[0].openingCash - r.monthlyByYear[y - 1].months[11].closingCash);
      expect(gap, `year ${y} opens ${gap} away from where year ${y - 1} closed`).toBeLessThanOrEqual(0.5);
    }
  });
});
