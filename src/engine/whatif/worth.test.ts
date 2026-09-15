import { describe, expect, it } from "vitest";
import { revenueWorth } from "./worth";
import { type WhatIfPlan } from "./levers";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS, type WorkingCapitalDays } from "../forecast/model";
import { makePlan } from "../forecast/plans.fixture";
import { regimeFor } from "../plan/taxRegimes";
import { settingsFor } from "../plan/gst";

const DAYS: WorkingCapitalDays = { debtorDays: 30, inventoryDays: 10, creditorDays: 30 };

function planOf(products: Record<string, unknown>[], fixedCogs: Record<string, unknown>[] = [], days = DAYS): WhatIfPlan {
  const sources = {
    products, costProducts: products, fixedCogs,
    overheads: [{ id: "o1", name: "Rent", current_value: 60000, yearly_change: {}, start_year: 1, monthly_distribution: null }],
    salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0], onCostPct: 0,
    funding: [], assets: [], extraordinary: [],
  } as unknown as PlanSources;
  return {
    sources,
    opening: assembleOpening(null, 200000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 0, dividendRate: 0,
  };
}

/** 240 jobs at 1,000, costing 400 each: a 60% contribution margin. */
const oneOff = (over: Record<string, unknown> = {}) => [{
  id: "p1", name: "Job", sold_as: "one_off",
  average_price: 1000, units_sold: 240, start_selling_year: 1,
  yearly_growth: {}, monthly_distribution: null, cost_per_unit: 400, yearly_cost_increase: {}, ...over,
}];

const near = (v: number | null, want: number) => expect(v).toBeCloseTo(want, 6);

describe("what a dollar of revenue is worth, by where it comes from (§6.41.2)", () => {
  it("price costs nothing to deliver, so all of it reaches the operating line", () => {
    const w = revenueWorth(planOf(oneOff()));
    near(w.price.margin, 1);
    expect(w.price.revenue).toBeCloseTo(2400, 6);        // 1% of 240,000
    expect(w.price.operatingProfit).toBeCloseTo(2400, 6);
  });

  it("volume keeps only the contribution on the extra work", () => {
    const w = revenueWorth(planOf(oneOff()));
    near(w.volume.margin, 0.6);                           // 1,000 less 400
    expect(w.multiple).toBe(1.67);                        // 1 ÷ 0.6
  });

  it("is the CONTRIBUTION margin, not the gross margin the P&L reports", () => {
    // 60,000 of fixed cost of sales drags the reported margin down and does not scale with volume, so the
    // two genuinely differ — which is exactly why this is measured rather than read off the statement.
    const w = revenueWorth(planOf(oneOff(), [{ annual_cost: 60000, yearly_growth_rates: {}, monthly_distribution: null }]));
    near(w.volume.margin, 0.6);
    const grossMargin = (240000 - 240 * 400 - 60000) / 240000;   // 0.35
    expect(Math.abs((w.volume.margin ?? 0) - grossMargin)).toBeGreaterThan(0.2);
  });

  it("says plainly when the extra work loses money", () => {
    const w = revenueWorth(planOf(oneOff({ cost_per_unit: 1200 })));
    expect(w.volume.margin).toBeLessThan(0);
    // Nothing to compare against: a multiple would read as though selling more were merely less good.
    expect(w.multiple).toBeNull();
  });

  it("an ongoing book does not scale with the clients won, and the comparison survives it", () => {
    // 100 clients already on the books; 12 more won in the year. A price rise lifts all 112; volume lifts 12.
    const w = revenueWorth(planOf([{
      id: "r1", name: "Care plan", sold_as: "recurring",
      average_price: 1200, units_sold: 12, opening_clients: 100, client_life_months: 36, life_mode: "average",
      start_selling_year: 1, yearly_growth: {}, monthly_distribution: null, monthly_new_clients: null,
      cost_per_unit: 300, yearly_cost_increase: {},
    }]));
    expect(w.price.revenue).toBeGreaterThan(w.volume.revenue);
    // Measured per pound of revenue either way, so the two are still comparable.
    near(w.price.margin, 1);
    expect(w.volume.margin).toBeGreaterThan(0);
    expect(w.multiple).not.toBeNull();
  });

  it("does not depend on where the day sliders sit — it is a fact about the plan", () => {
    const a = revenueWorth(planOf(oneOff()));
    const b = revenueWorth(planOf(oneOff(), [], { debtorDays: 90, inventoryDays: 45, creditorDays: 5 }));
    near(a.volume.margin, b.volume.margin!);
    expect(a.multiple).toBe(b.multiple);
  });

  it("price is worth at least as much as volume on every plan that sells anything", () => {
    const failures: string[] = [];
    for (let seed = 0; seed < 200; seed++) {
      const g = makePlan(seed);
      const plan: WhatIfPlan = {
        sources: g.sources,
        opening: assembleOpening(null, g.openingCash, 0),
        workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, g.days])),
        cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, g.timing])),
        taxRate: g.taxRate, dividendRate: g.dividendRate,
        openingTaxLosses: g.openingTaxLosses, openingRetainedEarnings: g.openingRetainedEarnings,
        components: g.place[0] ? regimeFor(g.place[0], g.place[1]).components.map((c) => settingsFor(c)) : [],
      };
      const w = revenueWorth(plan);
      if (w.price.margin == null) continue;               // nothing selling in Year 1
      if (Math.abs(w.price.margin - 1) > 1e-6) failures.push(`#${seed}: price keeps ${w.price.margin}`);
      if (w.volume.margin != null && w.volume.margin > w.price.margin + 1e-6) {
        failures.push(`#${seed}: volume keeps more than price (${w.volume.margin})`);
      }
      if (w.multiple != null && w.multiple < 1) failures.push(`#${seed}: multiple below 1 (${w.multiple})`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});
