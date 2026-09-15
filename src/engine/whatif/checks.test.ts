import { describe, expect, it } from "vitest";
import { listed, listedMonths, realityChecks } from "./checks";
import { NEUTRAL, runWhatIf, type Levers, type WhatIfPlan } from "./levers";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS, type WorkingCapitalDays } from "../forecast/model";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
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

const keysOf = (p: WhatIfPlan, l: Levers, history?: WorkingCapitalDays | null) =>
  realityChecks(runWhatIf(p, l), l, MONTHS, money, history).map((c) => c.key);
const textOf = (p: WhatIfPlan, l: Levers, key: string, history?: WorkingCapitalDays | null) =>
  realityChecks(runWhatIf(p, l), l, MONTHS, money, history).find((c) => c.key === key)?.text ?? "";

/** What a concreter's own accounts implied: slow to collect, almost no stock, pays suppliers in a week. */
const HISTORY: WorkingCapitalDays = { debtorDays: 46, inventoryDays: 2, creditorDays: 6 };

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
    const checks = realityChecks(runWhatIf(p, l), l, MONTHS, money);
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
    const checks = realityChecks(runWhatIf(p, l), l, MONTHS, money);
    expect(checks.map((c) => c.level)).toEqual(["bad", "good", "warn"]);
  });

  it("warns about more work from 5% up, names the cost that comes first, and asks rather than asserts", () => {
    expect(keysOf(plan(), levers({ volume: 5 }))).not.toContain("volume");
    const l = levers({ volume: 5.5 });
    const c = realityChecks(runWhatIf(plan(), l), l, MONTHS, money).find((x) => x.key === "volume");
    expect(c?.text).toContain("before the invoices come in");
    expect(c?.text).toMatch(/\?$/);
  });

  it("names the lever a lever-level check belongs to, and leaves the scenario-level ones unattached", () => {
    const p = plan({ overheads: 150000, openingCash: 20000 });
    const l = levers({ price: 9, debtorDays: 20 });
    const by = Object.fromEntries(realityChecks(runWhatIf(p, l), l, MONTHS, money).map((c) => [c.key, c.lever]));
    expect(by.price).toBe("price");
    expect(by["debtor-days"]).toBe("debtorDays");
    // A month that closes below zero is not any one lever's doing.
    expect(by.negative).toBeUndefined();
    expect(by["into-profit"]).toBeUndefined();
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


/* ------------------------------------------------------------------ *
 * Held against the business's own record                              *
 * ------------------------------------------------------------------ */

describe("the days levers are measured against what the business actually did (§6.41.3)", () => {
  // The plan already assumes it collects in 25 days. Its own accounts say 46.
  const optimistic = plan({ days: { debtorDays: 25, inventoryDays: 2, creditorDays: 6 } });

  it("speaks up about a plan that already assumes better than history, before anything is moved", () => {
    const keys = keysOf(optimistic, NEUTRAL, HISTORY);
    expect(keys).toContain("debtorDays-history");
    // The old rule measured realism against the plan's own optimism, so this said nothing at all.
    expect(keysOf(optimistic, NEUTRAL, null)).toEqual([]);
  });

  it("names both figures and the gap between them", () => {
    const t = textOf(optimistic, NEUTRAL, "debtorDays-history", HISTORY);
    expect(t).toContain("imply 46 debtor days");
    expect(t).toContain("collects in 25");
    expect(t).toContain("21 days faster");
  });

  it("lets a plan that matches its own history alone", () => {
    expect(keysOf(plan({ days: HISTORY }), NEUTRAL, HISTORY)).toEqual([]);
  });

  it("passes a trim of under a tenth, and speaks at a tenth or more", () => {
    const at = (d: number) => keysOf(plan({ days: HISTORY }), levers({ debtorDays: d }), HISTORY);
    expect(at(42)).not.toContain("debtorDays-history");     // 46 → 42 is under a tenth
    expect(at(41)).toContain("debtorDays-history");         // 46 → 41 is over it
  });

  it("says nothing when the plan is more conservative than the record", () => {
    expect(keysOf(plan({ days: HISTORY }), levers({ debtorDays: 60, creditorDays: 3 }), HISTORY)).toEqual([]);
  });

  it("asks who agreed the longer supplier terms, and names the strain past 60 days", () => {
    const short = textOf(plan({ days: HISTORY }), levers({ creditorDays: 30 }), "creditorDays-history", HISTORY);
    expect(short).toContain("24 days longer than you do now");
    expect(short).toContain("agreed with your suppliers");
    const long = textOf(plan({ days: HISTORY }), levers({ creditorDays: 70 }), "creditorDays-history", HISTORY);
    expect(long).toContain("strains the relationship");
    expect(long).toContain("64 days longer");
  });

  it("keeps the rules of thumb for a business with no history to be held against", () => {
    const startup = plan({ days: { debtorDays: 45, inventoryDays: 10, creditorDays: 30 } });
    const keys = keysOf(startup, levers({ debtorDays: 20 }), null);
    expect(keys).toContain("debtor-days");
    expect(keys).not.toContain("debtorDays-history");
  });

  it("never says both things about one lever", () => {
    const keys = keysOf(plan({ days: HISTORY }), levers({ debtorDays: 20, creditorDays: 70, stockDays: 0 }), HISTORY);
    expect(keys.filter((k) => k.startsWith("debtor"))).toEqual(["debtorDays-history"]);
    expect(keys.filter((k) => k.startsWith("creditor"))).toEqual(["creditorDays-history"]);
    expect(keys.filter((k) => k.startsWith("stock"))).toEqual(["stockDays-history"]);
  });

  it("attaches each to its own slider", () => {
    const l = levers({ debtorDays: 20, creditorDays: 70 });
    const by = Object.fromEntries(realityChecks(runWhatIf(plan({ days: HISTORY }), l), l, MONTHS, money, HISTORY)
      .map((c) => [c.key, c.lever]));
    expect(by["debtorDays-history"]).toBe("debtorDays");
    expect(by["creditorDays-history"]).toBe("creditorDays");
  });
});
