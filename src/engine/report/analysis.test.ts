import { describe, expect, it } from "vitest";
import { marginalCash, ratios } from "./analysis";
import { numberSections, walk, type Draft } from "./blocks";
import { runForecast, type PlanInput } from "../forecast/run";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS } from "../forecast/model";
import { makePlan } from "../forecast/plans.fixture";

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

describe("marginal cash", () => {
  /**
   * The table's claim is that the six lines account for the hundred. If they did not add up, the report
   * would be showing a lender arithmetic that does not work — which is worse than showing nothing.
   */
  it("accounts for every hundred units, across 20 plans", () => {
    const broken: string[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const { forecast } = runForecast(planFor(seed));
      for (const m of marginalCash(forecast.pnl, forecast.balanceSheet, FORECAST_YEARS)) {
        const sum = m.revenue - m.costOfGoods - m.receivables - m.inventory + m.payables - m.overheads;
        if (Math.abs(sum - m.netVariableCashFlow) > 0.02) broken.push(`seed ${seed} Y${m.year}: ${sum} vs ${m.netVariableCashFlow}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("does not divide a year with no revenue", () => {
    const [m] = marginalCash({ 1: { revenue: 0, cogs: 500, overheads: 200 } } as never, { 1: {} } as never, [1]);
    expect(m.revenue).toBe(0);
    expect(m.netVariableCashFlow).toBe(0);
  });
});

describe("the ratios", () => {
  /** A ratio nobody can divide is nothing, and nothing is not zero. The first year cannot have grown. */
  it("leaves the first year's growth undefined rather than zero", () => {
    const { forecast } = runForecast(planFor(1));
    for (const r of ratios(forecast.pnl, forecast.balanceSheet, FORECAST_YEARS).filter((x) => x.group === "Growth")) {
      expect(r.values[0]).toBeNull();
    }
  });

  it("refuses a return on equity that is not there", () => {
    const rows = ratios({ 1: { netProfit: 100, revenue: 1000 } } as never, { 1: { equity: -50 } } as never, [1]);
    expect(rows.find((r) => r.label === "Return on equity")!.values[0]).toBeNull();
  });

  it("gives every ratio one value per year", () => {
    const { forecast } = runForecast(planFor(4));
    for (const r of ratios(forecast.pnl, forecast.balanceSheet, FORECAST_YEARS)) {
      expect(r.values).toHaveLength(FORECAST_YEARS.length);
    }
  });
});

describe("section numbering", () => {
  /**
   * The point of the whole structure. A section with nothing to say is gone before numbering runs, so the
   * numbers CLOSE OVER THE GAP — there is no missing 2.0 and no empty heading left to explain it. This is
   * the thing a merge template cannot do, and the reason the samples ship headings with nothing under them.
   */
  it("closes over a dropped section rather than leaving a hole", () => {
    const drafts: (Draft | null)[] = [
      { title: "First" }, null, { title: "Third" },
    ];
    expect(numberSections(drafts).map((s) => `${s.number} ${s.title}`)).toEqual(["1.0 First", "2.0 Third"]);
  });

  it("numbers children against their parent's position, not the draft's", () => {
    const drafts: (Draft | null)[] = [
      null,
      { title: "Money", children: [null, { title: "Revenue" }, { title: "Costs", children: [{ title: "Wages" }] }] },
    ];
    const [money] = numberSections(drafts);
    expect(money.number).toBe("1.0");
    expect(money.children.map((c) => c.number)).toEqual(["1.1", "1.2"]);
    expect(money.children[1].children[0].number).toBe("1.2.1");
  });

  it("walks every section in reading order", () => {
    const s = numberSections([{ title: "A", children: [{ title: "B" }] }, { title: "C" }]);
    expect(walk(s).map((x) => x.title)).toEqual(["A", "B", "C"]);
  });
});
