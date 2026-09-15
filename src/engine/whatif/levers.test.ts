import { describe, expect, it } from "vitest";
import {
  NEUTRAL, applyDays, applyLevers, planLevers, runPlan, runWhatIf,
  type Levers, type WhatIfPlan,
} from "./levers";
import { assembleBase, assembleMonths, assembleOpening, type PlanSources } from "../forecast/assemble";
import { assembleGst, type GstPlanSources } from "../forecast/gst_assemble";
import { FORECAST_YEARS, buildForecast, type WorkingCapitalDays } from "../forecast/model";
import { buildMonthlyCashFlow } from "../forecast/monthly";
import { settingsFor } from "../plan/gst";
import { regimeFor } from "../plan/taxRegimes";
import { planRevenueByYear } from "../sales/product";
import { makePlan, type GeneratedPlan } from "../forecast/plans.fixture";

/* ------------------------------------------------------------------ *
 * Fixtures                                                            *
 * ------------------------------------------------------------------ */

/** One product, one fixed cost, one overhead, and the two synced lines. Enough to test every lever. */
function simplePlan(over: Partial<Record<string, unknown>> = {}): PlanSources {
  const products = [{
    id: "p1", name: "Job", sold_as: "one_off",
    average_price: 1000, units_sold: 120, start_selling_year: 1,
    yearly_growth: {}, monthly_distribution: null,
    cost_per_unit: 400, yearly_cost_increase: {},
  }];
  // The Forecast page passes ONE array as both, so the fixture does too.
  const sources = {
    products, costProducts: products,
    fixedCogs: [{ annual_cost: 24000, yearly_growth_rates: {}, monthly_distribution: null }],
    overheads: [{ id: "o1", name: "Rent", current_value: 36000, yearly_change: {}, start_year: 1, monthly_distribution: null }],
    salaries: [120000, 120000, 120000, 120000, 120000],
    marketing: [12000, 12000, 12000, 12000, 12000],
    onCostPct: 0,
    funding: [], assets: [], extraordinary: [],
    ...over,
  };
  return sources as unknown as PlanSources;
}

const DAYS: WorkingCapitalDays = { debtorDays: 30, inventoryDays: 10, creditorDays: 30 };

function planFor(sources: PlanSources, days: WorkingCapitalDays = DAYS): WhatIfPlan {
  return {
    sources,
    opening: assembleOpening(null, 200000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 0, dividendRate: 0,
  };
}

/** A generated plan (§6.40), wrapped the way the Forecast page wraps the real one. */
function whatIfPlanOf(g: GeneratedPlan): WhatIfPlan {
  return {
    sources: g.sources,
    opening: assembleOpening(null, g.openingCash, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, g.days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, g.timing])),
    taxRate: g.taxRate, dividendRate: g.dividendRate,
    openingTaxLosses: g.openingTaxLosses, openingRetainedEarnings: g.openingRetainedEarnings,
    components: g.place[0] ? regimeFor(g.place[0], g.place[1]).components.map((c) => settingsFor(c)) : [],
  };
}

/** Exactly what the Forecast page does, so "the What-If run is the forecast" is a claim and not a hope. */
function asThePageDoes(p: WhatIfPlan) {
  const components = p.components?.length ? p.components : [];
  const gst = assembleGst(p.sources as unknown as GstPlanSources, components.length ? components : [settingsFor({ label: "", rate: 0, reclaimable: true, frequency: "quarterly", lagMonths: 0 })]);
  const base = assembleBase(p.sources);
  for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];
  const f = buildForecast({
    base, opening: p.opening, workingCapital: p.workingCapital, cashTiming: p.cashTiming,
    taxRate: p.taxRate, dividendRate: p.dividendRate,
    openingTaxLosses: p.openingTaxLosses, openingRetainedEarnings: p.openingRetainedEarnings,
  });
  const monthly = buildMonthlyCashFlow({
    openingCash: f.cashFlow[1].openingCash,
    opening: {
      accountsReceivable: p.opening.accountsReceivable, inventory: p.opening.inventory,
      accountsPayable: p.opening.accountsPayable, prepaid: 0, accrued: 0,
    },
    closing: {
      accountsReceivable: f.workingCapital[1].accountsReceivable, inventory: f.workingCapital[1].inventory,
      accountsPayable: f.workingCapital[1].accountsPayable,
      prepaid: f.workingCapital[1].prepaid, accrued: f.workingCapital[1].accrued,
    },
    taxPaid: f.cashFlow[1].taxPaid, dividends: f.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(p.sources, components.length ? components : undefined),
  });
  return { f, monthly };
}

const levers = (over: Partial<Levers>): Levers => ({ ...NEUTRAL, ...over });
const r2 = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ *
 * The levers at rest                                                  *
 * ------------------------------------------------------------------ */

describe("with nothing moved, the What-If IS the forecast (§6.41)", () => {
  it("reproduces the page's own profit and loss and its twelve months", () => {
    for (const seed of [0, 7, 41, 199, 512]) {
      const p = whatIfPlanOf(makePlan(seed));
      const mine = runPlan(p, NEUTRAL);
      const theirs = asThePageDoes(p);
      expect(mine.forecast.pnl, `seed ${seed}`).toEqual(theirs.f.pnl);
      expect(mine.forecast.balanceSheet, `seed ${seed}`).toEqual(theirs.f.balanceSheet);
      expect(mine.monthly.months, `seed ${seed}`).toEqual(theirs.monthly.months);
    }
  });

  it("reads revenue from Sales, not from a second computation of it", () => {
    const p = planFor(simplePlan());
    expect(runPlan(p, NEUTRAL).outcome.revenue).toBe(planRevenueByYear(p.sources.products)[0].value);
  });

  it("puts the day sliders where the plan already has them", () => {
    expect(planLevers(DAYS)).toEqual({ ...NEUTRAL, debtorDays: 30, stockDays: 10, creditorDays: 30 });
  });

  it("leaves the caller's own plan untouched", () => {
    const sources = simplePlan();
    const before = JSON.stringify(sources);
    applyLevers(sources, levers({ price: 25, volume: -10, cogs: 40, overheads: 15 }));
    expect(JSON.stringify(sources)).toBe(before);
  });
});

/* ------------------------------------------------------------------ *
 * What each lever means                                               *
 * ------------------------------------------------------------------ */

describe("each lever changes the one thing it names", () => {
  const p = planFor(simplePlan());
  const base = runPlan(p, NEUTRAL).outcome;

  it("price lifts revenue and leaves every cost where it was", () => {
    const up = runPlan(p, levers({ price: 10 })).outcome;
    expect(r2(up.revenue)).toBe(r2(base.revenue * 1.1));
    expect(r2(up.overheads)).toBe(r2(base.overheads));
    // Revenue up, cost flat: the whole rise falls to the operating line.
    expect(r2(up.operatingProfit - base.operatingProfit)).toBe(r2(base.revenue * 0.1));
  });

  it("volume lifts revenue and the variable cost with it, and leaves fixed cost of sales alone", () => {
    const up = runPlan(p, levers({ volume: 10 })).outcome;
    expect(r2(up.revenue)).toBe(r2(base.revenue * 1.1));
    // 120 jobs at 1,000 less 400 each, plus 24,000 of fixed cost of sales.
    expect(r2(base.grossProfit)).toBe(r2(120 * 600 - 24000));
    expect(r2(up.grossProfit)).toBe(r2(132 * 600 - 24000));
  });

  it("cogs moves the variable cost and nothing else", () => {
    const down = runPlan(p, levers({ cogs: -25 })).outcome;
    expect(r2(down.revenue)).toBe(r2(base.revenue));
    expect(r2(down.grossProfit - base.grossProfit)).toBe(r2(120 * 400 * 0.25));
  });

  it("overheads includes the synced salary and marketing lines (§6.19)", () => {
    // 36,000 rent + 120,000 salaries + 12,000 marketing.
    expect(r2(base.overheads)).toBe(168000);
    expect(r2(runPlan(p, levers({ overheads: -5 })).outcome.overheads)).toBe(r2(168000 * 0.95));
  });

  it("the days move cash without touching a penny of profit", () => {
    const slow = runPlan(p, levers({ debtorDays: 90 })).outcome;
    expect(r2(slow.operatingProfit)).toBe(r2(base.operatingProfit));
    expect(r2(slow.netProfit)).toBe(r2(base.netProfit));
    expect(slow.lowestCash).toBeLessThan(base.lowestCash);
  });

  it("paying suppliers later frees cash; paying them sooner costs it", () => {
    const later = runPlan(p, levers({ creditorDays: 60 })).outcome;
    const sooner = runPlan(p, levers({ creditorDays: 0 })).outcome;
    expect(later.lowestCash).toBeGreaterThan(base.lowestCash);
    expect(sooner.lowestCash).toBeLessThan(base.lowestCash);
    expect(r2(later.operatingProfit)).toBe(r2(base.operatingProfit));
  });

  it("a later year typed outright still answers the lever (§6.26)", () => {
    const typed = simplePlan({
      products: [{
        id: "p1", name: "Job", sold_as: "one_off",
        average_price: 1000, units_sold: 120, start_selling_year: 1,
        yearly_growth: { "2": { unitsValue: 200, priceValue: 1500 } }, monthly_distribution: null,
        cost_per_unit: 400, yearly_cost_increase: {},
      }],
    });
    // The fixture shares one array; re-point the cost side at the same rows.
    (typed as unknown as { costProducts: unknown }).costProducts = typed.products;
    const q = planFor(typed);
    const y2 = (l: Levers) => runPlan(q, l).forecast.pnl[2].revenue;
    expect(r2(y2(NEUTRAL))).toBe(300000);
    expect(r2(y2(levers({ volume: 10 })))).toBe(r2(1500 * 220));
    expect(r2(y2(levers({ price: 10 })))).toBe(r2(1650 * 200));
  });
});

/* ------------------------------------------------------------------ *
 * The headline number                                                 *
 * ------------------------------------------------------------------ */

describe("lowest cash is a month that exists (§6.41)", () => {
  it("is the tightest of the twelve, and names the month it falls in", () => {
    for (const seed of [3, 88, 404, 1001]) {
      const p = whatIfPlanOf(makePlan(seed));
      const run = runPlan(p, levers({ price: 7, volume: -4, creditorDays: 45 }));
      const closes = run.monthly.months.map((m) => m.closingCash);
      const lowest = Math.min(...closes);
      expect(run.outcome.lowestCash, `seed ${seed}`).toBe(lowest);
      expect(run.monthly.months[run.outcome.lowestMonth - 1].closingCash, `seed ${seed}`).toBe(lowest);
    }
  });
});

/* ------------------------------------------------------------------ *
 * What each lever is worth                                            *
 * ------------------------------------------------------------------ */

describe("the contributions account for the whole change", () => {
  const p = planFor(simplePlan());
  const set = levers({ price: 6, volume: 8, cogs: -4, overheads: -3, debtorDays: 20, creditorDays: 50 });

  it("the seven and the interaction add to the total, to the cent", () => {
    const w = runWhatIf(p, set);
    for (const key of ["revenue", "operatingProfit", "netProfit", "lowestCash", "closingCash"] as const) {
      const parts = w.contributions.reduce((a, c) => a + c.effect[key], 0) + w.interaction[key];
      expect(r2(parts), key).toBe(r2(w.total[key]));
    }
  });

  it("only the levers that moved are credited with anything", () => {
    const w = runWhatIf(p, levers({ price: 6 }));
    expect(w.contributions.filter((c) => c.moved).map((c) => c.lever)).toEqual(["price"]);
    for (const c of w.contributions.filter((c) => !c.moved)) {
      expect(Object.values(c.effect).every((v) => v === 0), c.lever).toBe(true);
    }
  });

  it("price and volume together are worth more than the two apart", () => {
    const w = runWhatIf(p, levers({ price: 10, volume: 10 }));
    const apart = w.contributions.reduce((a, c) => a + c.effect.operatingProfit, 0);
    expect(w.total.operatingProfit).toBeGreaterThan(apart);
    expect(r2(w.interaction.operatingProfit)).toBe(r2(w.total.operatingProfit - apart));
  });

  it("one lever moved gives the same answer as running the whole scenario", () => {
    const one = levers({ overheads: -12 });
    expect(runWhatIf(p, one).adjusted.outcome).toEqual(runPlan(p, one).outcome);
  });

  it("nothing moved is nothing changed", () => {
    const w = runWhatIf(p, NEUTRAL);
    expect(Object.values(w.total).every((v) => v === 0)).toBe(true);
    expect(Object.values(w.interaction).every((v) => v === 0)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Every scenario is still a plan                                      *
 * ------------------------------------------------------------------ */

describe("a scenario that does not reconcile is not a scenario (§6.21.1, §6.41)", () => {
  const CASES = 300;
  const failures: string[] = [];

  for (let seed = 0; seed < CASES; seed++) {
    const g = makePlan(seed);
    const p = whatIfPlanOf(g);
    // Deterministic, and deliberately hostile: prices cut, volume up, terms stretched both ways.
    const swing = ((seed % 7) - 3) * 5;
    const set = levers({
      price: swing, volume: -swing, cogs: swing / 2, overheads: -swing / 2,
      debtorDays: Math.max(0, g.days.debtorDays + swing),
      stockDays: Math.max(0, g.days.inventoryDays - swing),
      creditorDays: Math.max(0, g.days.creditorDays + swing * 2),
    });

    let run: ReturnType<typeof runPlan>;
    try { run = runPlan(p, set); } catch (e) { failures.push(`#${seed}: threw ${(e as Error).message}`); continue; }

    for (const i of run.invariants) {
      if (!i.passed) failures.push(`#${seed}: ${i.label} Y${i.year} out by ${r2(i.difference)}`);
    }
    for (const y of FORECAST_YEARS) {
      const check = run.forecast.balanceSheet[y].balanceCheck;
      if (Math.abs(check) > 0.5) failures.push(`#${seed}: balance sheet Y${y} out by ${r2(check)}`);
    }
    // The levered plan must still be read the same way the Sales screen would read it.
    const levered = applyLevers(p.sources, set);
    const fromSales = planRevenueByYear(levered.products)[0].value;
    if (Math.abs(run.outcome.revenue - fromSales) > 0.5) {
      failures.push(`#${seed}: revenue ${run.outcome.revenue} against Sales' ${fromSales}`);
    }
    if (!run.outcome.reconciled) failures.push(`#${seed}: reported as not reconciled`);
  }

  it(`holds across ${CASES} generated plans with every lever moved`, () => {
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * The tightest month                                                  *
 * ------------------------------------------------------------------ */

describe("the cash parts are all measured in the same month (§6.41)", () => {
  const p = planFor(simplePlan());
  const set = levers({ price: 6, volume: 8, debtorDays: 15, creditorDays: 60 });

  it("is the month the scenario is tightest in, and its balance is the scenario's lowest", () => {
    const w = runWhatIf(p, set);
    expect(w.tightest.month).toBe(w.adjusted.outcome.lowestMonth);
    expect(w.tightest.adjusted).toBe(w.adjusted.outcome.lowestCash);
    expect(w.tightest.base).toBe(w.base.monthly.months[w.tightest.month - 1].closingCash);
  });

  it("the parts and the interaction add to the change in that month, to the cent", () => {
    const w = runWhatIf(p, set);
    const parts = w.tightest.contributions.reduce((a, c) => a + c.effect, 0) + w.tightest.interaction;
    expect(r2(parts)).toBe(r2(w.tightest.change));
    expect(r2(w.tightest.change)).toBe(r2(w.tightest.adjusted - w.tightest.base));
  });

  it("holds the month still, so the interaction stays small beside the change itself", () => {
    // Measured against the moving minimum this was out by multiples of the answer on a real plan.
    const w = runWhatIf(p, set);
    expect(Math.abs(w.tightest.interaction)).toBeLessThan(Math.abs(w.tightest.change));
  });

  it("credits nothing to a lever that has not moved", () => {
    const w = runWhatIf(p, levers({ overheads: -5 }));
    expect(w.tightest.contributions.filter((c) => c.effect !== 0).map((c) => c.lever)).toEqual(["overheads"]);
  });
});


/* ------------------------------------------------------------------ *
 * How far the days reach                                              *
 * ------------------------------------------------------------------ */

describe("the days levers reach Year 1, or all five (§6.43)", () => {
  const p = planFor(simplePlan());
  const faster = levers({ debtorDays: 10, creditorDays: 60 });

  it("touches only Year 1 by default, and leaves the other four exactly as the plan has them", () => {
    const out = applyDays(p.workingCapital, faster);
    expect(out[1]).toEqual({ debtorDays: 10, inventoryDays: 10, creditorDays: 60 });
    for (const y of [2, 3, 4, 5]) expect(out[y], `year ${y}`).toEqual(DAYS);
  });

  it("writes every year when asked to", () => {
    const out = applyDays(p.workingCapital, faster, "all");
    for (const y of FORECAST_YEARS) {
      expect(out[y], `year ${y}`).toEqual({ debtorDays: 10, inventoryDays: 10, creditorDays: 60 });
    }
  });

  it("changes nothing at all when the levers sit where the plan does", () => {
    expect(applyDays(p.workingCapital, NEUTRAL)).toBe(p.workingCapital);
  });

  /**
   * The reason the save dialog shows five years rather than one. Collecting faster releases cash once; if the
   * terms revert the following year it is absorbed again, and the plan ends exactly where it started. A
   * client choosing "Year 1 only" is choosing a one-year effect, and should see that before choosing it.
   */
  it("a Year-1-only change unwinds; carried forward, it holds", () => {
    const planned = runPlan(p, planLevers(p.workingCapital[1]));
    const once = runPlan(p, faster, "year1");
    const kept = runPlan(p, faster, "all");
    const closing = (r: typeof planned, y: number) => r.forecast.cashFlow[y].closingCash;

    expect(closing(once, 1)).toBeGreaterThan(closing(planned, 1));
    expect(r2(closing(once, 5))).toBe(r2(closing(planned, 5)));       // gone by Year 5
    expect(closing(kept, 5)).toBeGreaterThan(closing(planned, 5));    // still there
  });

  it("every year still reconciles when the days are written across all five", () => {
    const run = runPlan(p, faster, "all");
    expect(run.invariants.filter((i) => !i.passed)).toEqual([]);
    for (const y of FORECAST_YEARS) expect(Math.abs(run.forecast.balanceSheet[y].balanceCheck)).toBeLessThan(0.5);
  });
});
