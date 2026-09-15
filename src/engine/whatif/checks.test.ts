import { describe, expect, it } from "vitest";
import { listed, listedMonths, realityChecks } from "./checks";
import { NEUTRAL, runWhatIf, type Levers, type WhatIfPlan } from "./levers";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS, type WorkingCapitalDays } from "../forecast/model";
import { PRODUCT_NOUNS } from "../plan/vocabulary";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const JOBS = PRODUCT_NOUNS.find((x) => x.many === "Services")!;
const money = (v: number) => `$${Math.round(v).toLocaleString("en-AU")}`;
const levers = (over: Partial<Levers>): Levers => ({ ...NEUTRAL, ...over });
const DAYS: WorkingCapitalDays = { debtorDays: 30, inventoryDays: 10, creditorDays: 30 };

/** 240 jobs at 1,000, costing 400 each. `overheads` and `openingCash` are what the tests vary. */
function plan({ overheads = 60000, openingCash = 200000, days = DAYS }: {
  overheads?: number; openingCash?: number; days?: WorkingCapitalDays;
} = {}): WhatIfPlan {
  const products = [{
    id: "p1", name: "Job", sold_as: "one_off",
    average_price: 1000, units_sold: 240, start_selling_year: 1,
    yearly_growth: {}, monthly_distribution: null, cost_per_unit: 400, yearly_cost_increase: {},
  }];
  const sources = {
    products, costProducts: products, fixedCogs: [],
    overheads: [{ id: "o1", name: "Rent", current_value: overheads, yearly_change: {}, start_year: 1, monthly_distribution: null }],
    salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0], onCostPct: 0,
    funding: [], assets: [], extraordinary: [],
  } as unknown as PlanSources;
  return {
    sources,
    opening: assembleOpening(null, openingCash, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 0, dividendRate: 0,
  };
}

const keysOf = (p: WhatIfPlan, l: Levers) =>
  realityChecks(runWhatIf(p, l), l, MONTHS, JOBS, money).map((c) => c.key);

describe("a list a person would say out loud", () => {
  it("joins with 'and', never a trailing comma", () => {
    expect(listed([])).toBe("");
    expect(listed(["March"])).toBe("March");
    expect(listed(["March", "June"])).toBe("March and June");
    expect(listed(["March", "June", "October"])).toBe("March, June and October");
  });
});

describe("months that run together are said as a run", () => {
  const name = (m: number) => MONTHS[m - 1];
  it("names two apart, and a run of three or more as a span", () => {
    expect(listedMonths([3], name)).toBe("Sep");
    expect(listedMonths([3, 5], name)).toBe("Sep and Nov");
    expect(listedMonths([3, 4, 5], name)).toBe("Sep through to Nov");
    expect(listedMonths([3, 4, 6], name)).toBe("Sep, Oct and Dec");
  });
});

describe("the checks say what the run actually found (§6.41)", () => {
  it("says nothing at all when nothing has moved", () => {
    expect(keysOf(plan(), NEUTRAL)).toEqual([]);
  });

  it("names the months that close below zero, and says they are new", () => {
    // A thin 14,000 of profit, and now customers paying at 120 days instead of 30.
    const p = plan({ overheads: 130000, openingCash: 20000 });
    const l = levers({ debtorDays: 120 });
    const checks = realityChecks(runWhatIf(p, l), l, MONTHS, JOBS, money);
    const negative = checks.find((c) => c.key === "negative");
    expect(negative?.level).toBe("bad");
    expect(negative?.text).toContain("did not before these changes");
    // The plan's own financial year, not January to December (§6.21).
    expect(negative?.text).toContain("Nov");
  });

  it("leads with what breaks, then what improves, then what to watch", () => {
    // Loss-making, one month already below zero: a price rise fixes the profit and 120 days breaks the cash.
    const p = plan({ overheads: 150000, openingCash: 20000 });
    const l = levers({ price: 9, debtorDays: 120 });
    const checks = realityChecks(runWhatIf(p, l), l, MONTHS, JOBS, money);
    expect(checks.map((c) => c.level)).toEqual(["bad", "good", "warn"]);
  });

  it("counts the extra work in the plan's own word for it, and asks rather than asserts", () => {
    const l = levers({ volume: 20 });
    const c = realityChecks(runWhatIf(plan(), l), l, MONTHS, JOBS, money).find((x) => x.key === "volume");
    expect(c?.text).toContain("48 more services");
    expect(c?.text).toContain("about 4 a month");
    expect(c?.text).toMatch(/\?$/);
  });

  it("warns about a price rise only once it is above the threshold it names", () => {
    expect(keysOf(plan(), levers({ price: 5 }))).not.toContain("price");
    expect(keysOf(plan(), levers({ price: 5.5 }))).toContain("price");
  });

  it("warns about faster payment only when it is faster than the plan already assumes", () => {
    // The plan already assumes 30 days, so moving to 29 is quick; a plan on 20 is not made quicker by 25.
    expect(keysOf(plan(), levers({ debtorDays: 29 }))).toContain("debtor-days");
    expect(keysOf(plan({ days: { debtorDays: 20, inventoryDays: 10, creditorDays: 30 } }), levers({ debtorDays: 25 }))).not.toContain("debtor-days");
  });

  it("calls out a loss turning into a profit, and a profit turning into a loss", () => {
    // 240 jobs at 1,000, cost 400, overheads 60,000 — a 84,000 operating profit.
    expect(keysOf(plan(), levers({ price: -40 }))).toContain("into-loss");
    const lossMaking = plan({ overheads: 200000 });
    expect(keysOf(lossMaking, levers({ price: 40 }))).toContain("into-profit");
  });
});
