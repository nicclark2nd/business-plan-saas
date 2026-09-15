import { describe, expect, it } from "vitest";
import { applyChanges, plannedChanges } from "./apply";
import { NEUTRAL, planLevers, runPlan, type Levers, type WhatIfPlan } from "./levers";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS, type WorkingCapitalDays } from "../forecast/model";
import { planRevenueByYear } from "../sales/product";
import { makePlan } from "../forecast/plans.fixture";

const DAYS: WorkingCapitalDays = { debtorDays: 46, inventoryDays: 2, creditorDays: 6 };
const levers = (over: Partial<Levers>): Levers => ({ ...NEUTRAL, ...over });
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Two products with awkward figures — a price that will not divide and a typed Year 2 — plus two overheads. */
function sources(over: Partial<Record<string, unknown>> = {}): PlanSources {
  const products = [
    {
      id: "p1", name: "Driveways", sold_as: "one_off",
      average_price: 997, units_sold: 12, start_selling_year: 1,
      yearly_growth: { "2": { unitsValue: 14, priceValue: 1050 } }, monthly_distribution: null,
      cost_per_unit: 401.5, yearly_cost_increase: {},
    },
    {
      id: "p2", name: "Maintenance", sold_as: "recurring",
      average_price: 1200, units_sold: 24, opening_clients: 10, client_life_months: 24, life_mode: "average",
      start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
      monthly_new_clients: { "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2, "7": 2, "8": 2, "9": 2, "10": 2, "11": 2, "12": 2 },
      cost_per_unit: 300, yearly_cost_increase: {},
    },
  ];
  const s = {
    products, costProducts: products, fixedCogs: [],
    overheads: [
      { id: "o1", name: "Rent", source: "entered", current_value: 60000, yearly_change: {}, start_year: 1, monthly_distribution: null },
      { id: "o2", name: "Leadership Team salaries", source: "people", current_value: 0, on_cost: true, yearly_change: {}, start_year: 1, monthly_distribution: null },
    ],
    salaries: [140000, 140000, 140000, 140000, 140000],
    marketing: [20000, 20000, 20000, 20000, 20000],
    onCostPct: 10,
    funding: [], assets: [], extraordinary: [], ...over,
  };
  return s as unknown as PlanSources;
}

function planOf(s: PlanSources): WhatIfPlan {
  return {
    sources: s,
    opening: assembleOpening(null, 100000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, DAYS])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 0, dividendRate: 0,
  };
}

const AT = planLevers(DAYS);
const planned = (l: Levers, s = sources()) => plannedChanges(s, l, AT);
const find = (l: Levers, row: string, field: string, s = sources()) =>
  planned(l, s).changes.find((c) => c.row === row && c.field === field);

describe("what a scenario would actually change (§6.45)", () => {
  it("changes nothing while the levers are at rest", () => {
    expect(planned(NEUTRAL).changes).toEqual([]);
  });

  it("names the row, the field and both figures, in the client's own words", () => {
    const c = find(levers({ price: 7.5 }), "Driveways", "average_price")!;
    expect(c).toMatchObject({ table: "plan_products", row: "Driveways", label: "Price", from: 997 });
    // 1,071.775 is not a price a column can hold, so it is rounded to one that is — and THAT is what gets
    // written, which is why the recomputed forecast below can be trusted.
    expect(c.to).toBeCloseTo(1071.78, 1);
    expect(String(c.to).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it("rounds a price that divides cleanly to exactly what a calculator gives", () => {
    const clean = sources({ products: [{ id: "p1", name: "Slab", sold_as: "one_off", average_price: 1000, units_sold: 10, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null, cost_per_unit: 400, yearly_cost_increase: {} }] });
    expect(find(levers({ price: 7.5 }), "Slab", "average_price", clean)!.to).toBe(1075);
  });

  it("keeps a whole count whole, so nobody opens Sales to find 13.44 driveways", () => {
    expect(find(levers({ volume: 12 }), "Driveways", "units_sold")!.to).toBe(13);
    // Clients won each month are counts too: 2 a month at +50% is 3, not 3.0.
    expect(find(levers({ volume: 50 }), "Maintenance", "monthly_new_clients.1")!.to).toBe(3);
  });

  it("moves a later year the client typed outright, not just Year 1", () => {
    expect(find(levers({ volume: 50 }), "Driveways", "yearly_growth.2.unitsValue")!.to).toBe(21);
    expect(find(levers({ price: 10 }), "Driveways", "yearly_growth.2.priceValue")!.to).toBe(1155);
  });

  it("leaves a row alone when the figure does not actually move", () => {
    // A line with no price yet is not changed by a price rise, and listing it would be noise in a list the
    // client has to read line by line before agreeing to it.
    const withBlank = sources({
      products: [{ id: "p3", name: "Not priced yet", sold_as: "one_off", average_price: 0, units_sold: 0, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null, cost_per_unit: 0, yearly_cost_increase: {} }],
    });
    expect(planned(levers({ price: 7.5, volume: 10, cogs: -5 }), withBlank).changes).toEqual([]);
  });

  it("writes the overhead rows it owns and never a synced line", () => {
    const rows = planned(levers({ overheads: -10 })).changes.filter((c) => c.table === "plan_overheads");
    expect(rows.map((r) => r.row)).toEqual(["Rent"]);
  });

  /**
   * The column headed "This year" is what the business spends NOW. A plan to cut overheads a tenth is not a
   * claim about today's rent, so it goes in Year 1's change box — which the Overheads screen shows and the
   * engine honours.
   */
  it("cuts overheads in Year 1's change box, not in what the business spends today", () => {
    const c = planned(levers({ overheads: -10 })).changes.find((x) => x.table === "plan_overheads")!;
    expect(c.field).toBe("yearly_change.1");
    expect(c.unit).toBe("percent");
    expect(c.from).toBe(0);
    expect(c.to).toBe(-10);
    // `current_value` is left exactly alone.
    expect(planned(levers({ overheads: -10 })).changes.some((x) => x.field === "current_value")).toBe(false);
  });

  it("compounds with a change the client already typed, because that is what happens to the money", () => {
    const withChange = sources({
      overheads: [{ id: "o1", name: "Rent", source: "entered", current_value: 60000, yearly_change: { "1": 2 }, start_year: 1, monthly_distribution: null }],
    });
    // 2 % already, then a 10 % cut: 1.02 × 0.90 = 0.918, so −8.2 %, not −8 %.
    expect(find(levers({ overheads: -10 }), "Rent", "yearly_change.1", withChange)!.to).toBe(-8.2);
  });

  it("a line that starts later has no working box for its own first year, so its amount moves", () => {
    const later = sources({
      overheads: [{ id: "o1", name: "Second yard", source: "entered", current_value: 40000, yearly_change: {}, start_year: 3, monthly_distribution: null }],
    });
    const c = find(levers({ overheads: -10 }), "Second yard", "current_value", later)!;
    expect(c.unit).toBe("money");
    expect(c.to).toBe(36000);
  });

  /**
   * Recording the cut as a Year 1 percentage has to give the same five years as scaling the amount, or the
   * apply would quietly mean something different from the preview. Tested on a plan with no synced lines,
   * because salaries and marketing are the part the apply deliberately CANNOT reach — that gap is real, it
   * is what the dialog states, and it would drown this out.
   */
  it("recording the cut as a percentage gives the same years as scaling the amount", () => {
    const own = sources({
      overheads: [{ id: "o1", name: "Rent", source: "entered", current_value: 60000, yearly_change: { "1": 2, "2": 3 }, start_year: 1, monthly_distribution: null }],
      salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0],
    });
    const l = levers({ overheads: -10 });
    const previewed = runPlan(planOf(own), l).forecast;
    const written = runPlan(planOf(applyChanges(own, planned(l, own).changes)), NEUTRAL).forecast;
    for (const y of FORECAST_YEARS) {
      expect(r2(written.pnl[y].overheads), `year ${y}`).toBe(r2(previewed.pnl[y].overheads));
    }
  });

  it("sizes the overheads it cannot reach, and names them", () => {
    const { overheads } = planned(levers({ overheads: -10 }));
    expect(overheads.reached).toBe(60000);                       // Rent
    expect(overheads.untouched).toBe(174000);                    // 140,000 + 10% on-costs, plus 20,000 marketing
    expect(overheads.untouchedNames).toContain("Leadership Team salaries");
    expect(overheads.untouchedNames).toContain("Marketing spend");
  });

  it("notices the days without pretending they are a row", () => {
    expect(planned(levers({ overheads: -10 })).daysMoved).toBe(false);
    expect(planned(levers({ debtorDays: 30 })).daysMoved).toBe(true);
  });
});

describe("the plan as those rows would leave it (§6.45)", () => {
  it("does not touch the caller's own sources", () => {
    const s = sources();
    const before = JSON.stringify(s);
    applyChanges(s, planned(levers({ price: 7.5, volume: 12, cogs: -5, overheads: -10 }), s).changes);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("rebuilds every field the list names, nested ones included", () => {
    const s = sources();
    const out = applyChanges(s, planned(levers({ price: 10, volume: 50 }), s).changes);
    const p = out.products[0] as unknown as Record<string, Record<string, Record<string, number>>>;
    expect(p.average_price).toBe(1096.7);
    expect(p.yearly_growth["2"].priceValue).toBe(1155);
    expect(p.yearly_growth["2"].unitsValue).toBe(21);
    // Untouched keys survive the rebuild.
    expect((out.products[1] as unknown as { opening_clients: number }).opening_clients).toBe(10);
  });

  /**
   * The whole reason this module exists. The sliders draw the ideal figures; the plan stores what the
   * columns can hold. The confirmation has to quote the second, or the screen promises a number the client
   * will not have tomorrow.
   */
  it("gives a forecast that differs from the ideal one — which is the point", () => {
    const s = sources();
    const l = levers({ price: 7.5 });
    const ideal = runPlan(planOf(s), l).outcome.revenue;
    const real = runPlan(planOf(applyChanges(s, planned(l, s).changes)), NEUTRAL).outcome.revenue;
    expect(real).not.toBe(ideal);
    expect(Math.abs(real - ideal)).toBeLessThan(ideal * 0.001);   // close, but not the same
  });

  it("the applied plan reads the same from Sales as the forecast reads it", () => {
    const s = applyChanges(sources(), planned(levers({ price: 7.5, volume: 12 })).changes);
    expect(r2(runPlan(planOf(s), NEUTRAL).outcome.revenue)).toBe(r2(planRevenueByYear(s.products)[0].value));
  });

  it("holds across 200 generated plans: applying leaves a plan that still reconciles", () => {
    const failures: string[] = [];
    for (let seed = 0; seed < 200; seed++) {
      const g = makePlan(seed);
      const l = levers({ price: 6, volume: -4, cogs: 3, overheads: -7 });
      const after = applyChanges(g.sources, plannedChanges(g.sources, l, AT).changes);
      const run = runPlan({
        sources: after,
        opening: assembleOpening(null, g.openingCash, 0),
        workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, g.days])),
        cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, g.timing])),
        taxRate: g.taxRate, dividendRate: g.dividendRate,
        openingTaxLosses: g.openingTaxLosses, openingRetainedEarnings: g.openingRetainedEarnings,
      }, NEUTRAL);
      for (const i of run.invariants) if (!i.passed) failures.push(`#${seed}: ${i.label} Y${i.year} out by ${r2(i.difference)}`);
      for (const y of FORECAST_YEARS) {
        if (Math.abs(run.forecast.balanceSheet[y].balanceCheck) > 0.5) failures.push(`#${seed}: balance sheet Y${y}`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
