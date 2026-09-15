import { describe, expect, it } from "vitest";
import { AREA_LABEL, GOAL_AREAS, proposedGoals } from "./goals";
import { NEUTRAL, runWhatIf, type Levers, type WhatIfPlan } from "./levers";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS, type WorkingCapitalDays } from "../forecast/model";
import { PRODUCT_NOUNS } from "../plan/vocabulary";

const DAYS: WorkingCapitalDays = { debtorDays: 46, inventoryDays: 2, creditorDays: 6 };
const JOBS = PRODUCT_NOUNS.find((x) => x.many === "Services")!;
const money = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-AU")}`;
const levers = (over: Partial<Levers>): Levers => ({ ...NEUTRAL, ...over });

function plan(): WhatIfPlan {
  const products = [{
    id: "p1", name: "Job", sold_as: "one_off",
    average_price: 1000, units_sold: 240, start_selling_year: 1,
    yearly_growth: {}, monthly_distribution: null, cost_per_unit: 400, yearly_cost_increase: {},
  }];
  return {
    sources: {
      products, costProducts: products, fixedCogs: [],
      overheads: [{ id: "o1", name: "Rent", current_value: 120000, yearly_change: {}, start_year: 1, monthly_distribution: null }],
      salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0], onCostPct: 0,
      funding: [], assets: [], extraordinary: [],
    } as unknown as PlanSources,
    opening: assembleOpening(null, 150000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, DAYS])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 0, dividendRate: 0,
  };
}

const propose = (l: Levers) => proposedGoals(runWhatIf(plan(), l), l, JOBS, money);

describe("a scenario, turned into goals (§6.44)", () => {
  it("proposes nothing while every lever is at rest", () => {
    expect(propose(NEUTRAL)).toEqual([]);
  });

  it("proposes one goal per lever the client actually moved, and no others", () => {
    const g = propose(levers({ price: 5, creditorDays: 30 }));
    expect(g.map((x) => x.lever)).toEqual(["price", "creditorDays"]);
  });

  it("files each goal under an area the plan actually has", () => {
    const keys = GOAL_AREAS.map((a) => a.key);
    const g = propose(levers({ price: 5, volume: 10, cogs: -5, overheads: -5, debtorDays: 30, stockDays: 1, creditorDays: 30 }));
    expect(g).toHaveLength(7);
    for (const x of g) expect(keys, x.lever).toContain(x.area);
  });

  it("puts selling under Sales, buying and making under Operational, and terms under Financial", () => {
    const area = Object.fromEntries(
      propose(levers({ price: 5, volume: 10, cogs: -5, overheads: -5, debtorDays: 30, stockDays: 1, creditorDays: 30 }))
        .map((g) => [g.lever, g.area]));
    expect(area).toEqual({
      price: "sales", volume: "sales",
      cogs: "operational", stockDays: "operational",
      overheads: "financial", debtorDays: "financial", creditorDays: "financial",
    });
  });

  it("writes the title in the owner's units, not in percentages", () => {
    const g = propose(levers({ volume: 10 }));
    expect(g[0].title).toBe("Win 24 more services this year — about 2 a month");
  });

  it("names both figures a days goal is about", () => {
    const g = propose(levers({ debtorDays: 30 }))[0];
    expect(g.title).toContain("from 46 to 30");
    expect(g.title).toContain("16 days sooner");
  });

  /**
   * The point of the whole exit. A goal quoting a figure the screen did not show would be this project's
   * oldest fault — one fact with two computations — arriving in the client's goal list.
   */
  it("quotes the lever's own measured contribution, to the cent", () => {
    const l = levers({ price: 5 });
    const w = runWhatIf(plan(), l);
    const g = proposedGoals(w, l, JOBS, money)[0];
    const profit = w.contributions.find((c) => c.lever === "price")!.effect.operatingProfit;
    expect(g.detail).toContain(money(profit));
  });

  it("says what a cash-only lever is worth in cash, and claims no profit for it", () => {
    const g = propose(levers({ creditorDays: 45 }))[0];
    expect(g.detail).toContain("cash in the tightest month");
    expect(g.detail).not.toContain("operating profit");
  });

  it("reads the right way round when a lever is moved the unhelpful way", () => {
    expect(propose(levers({ price: -5 }))[0].title).toBe("Cut prices by 5% across the range");
    expect(propose(levers({ overheads: 5 }))[0].title).toContain("Add");
  });

  it("labels every area it can return", () => {
    for (const a of GOAL_AREAS) expect(AREA_LABEL[a.key]).toBe(a.label);
  });
});
