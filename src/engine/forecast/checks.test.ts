import { describe, expect, it } from "vitest";
import { checkGroups } from "./checks";
import { runForecast, type PlanInput } from "./run";
import { assembleOpening, type PlanSources } from "./assemble";
import { FORECAST_YEARS } from "./model";
import { makePlan } from "./plans.fixture";

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

describe("the checks, grouped for reading", () => {
  /**
   * The screen's whole claim is "here is every check". If a single invariant the engine ran fails to reach
   * a cell, the screen is showing a client a shorter list than the one the plan was actually judged on,
   * which is worse than showing no list at all.
   */
  it("places every invariant the engine ran, across 20 plans", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { checked } = runForecast(planFor(seed));
      const placed = checkGroups(checked.invariants)
        .flatMap((g) => g.rows)
        .flatMap((r) => r.cells)
        .filter((c) => c !== null).length;
      expect(placed).toBe(checked.invariants.length);
    }
  });

  /** A group passes only when every row in it does, and that has to match the forecast's own verdict. */
  it("agrees with the forecast about whether the plan reconciles", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { checked } = runForecast(planFor(seed));
      const groups = checkGroups(checked.invariants);
      expect(groups.every((g) => g.passed)).toBe(checked.reconciled);
    }
  });

  it("keeps the engine's row order rather than sorting it", () => {
    const rows = checkGroups([
      { key: "k", label: "Zebra", row: "Zebra", year: 1, difference: 0, passed: true, group: "statements" },
      { key: "k", label: "Apple", row: "Apple", year: 1, difference: 0, passed: true, group: "statements" },
    ])[0].rows.map((r) => r.row);
    expect(rows).toEqual(["Zebra", "Apple"]);
  });

  /**
   * "Not tested" and "tested and fine" are different answers. A year with no invariant for a row gets a
   * null cell, and the screen renders it as nothing rather than as a tick it cannot justify.
   */
  it("leaves a year untested rather than passing it", () => {
    const [group] = checkGroups([
      { key: "k", label: "Only year two", row: "Only year two", year: 2, difference: 0, passed: true, group: "statements" },
    ]);
    expect(group.rows[0].cells.map((c) => c !== null)).toEqual([false, true, false, false, false]);
  });

  it("reports the worst miss on a failing row", () => {
    const [group] = checkGroups([
      { key: "k", label: "A", row: "A", year: 1, difference: -12, passed: false, group: "statements" },
      { key: "k", label: "A", row: "A", year: 2, difference: 40, passed: false, group: "statements" },
      { key: "k", label: "A", row: "A", year: 3, difference: 0, passed: true, group: "statements" },
    ]);
    expect(group.rows[0].worst).toBe(40);
    expect(group.passed).toBe(false);
  });
});
