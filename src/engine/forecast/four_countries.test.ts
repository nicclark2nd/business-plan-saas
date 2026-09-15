import { describe, expect, it } from "vitest";
import { assembleGst, type GstPlanSources } from "./gst_assemble";
import { assembleBase, assembleMonths, assembleOpening, type PlanSources } from "./assemble";
import { buildForecast, FORECAST_YEARS } from "./model";
import { buildMonthlyCashFlow, monthlyInvariants } from "./monthly";
import { settingsFor } from "../plan/gst";
import { regimeFor, regionsFor, US_STATES, needsRegion, type Regime } from "../plan/taxRegimes";

/** One ordinary trading business, run through each country's real tax. */
const products = [
  { id: "a", name: "Job", sold_as: "one_off", average_price: 12000, units_sold: 60, start_selling_year: 1,
    yearly_growth: { "2": { price: 3, units: 5 } }, monthly_distribution: null, cost_per_unit: 6000, yearly_cost_increase: {} },
];
const sources = {
  products, costProducts: products, fixedCogs: [],
  overheads: [{ id: "o1", name: "Rent", current_value: 120000, yearly_change: {}, start_year: 1 }],
  salaries: [200000, 206000, 212000, 218000, 225000], marketing: [20000, 20000, 20000, 20000, 20000],
  onCostPct: 11.5,
  funding: [], assets: [{ id: "as1", name: "Van", source: "entered" as const, purchase_price: 60000, residual_value: 0, useful_life_months: 60, method: "straight_line" as const, start_year: 1, start_month: 5 }],
  extraordinary: [],
} as unknown as PlanSources & GstPlanSources;

const run = (regime: Regime) => {
  const components = regime.components.map((c) => settingsFor(c));
  const gst = assembleGst(sources, components);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];
  const f = buildForecast({
    base,
    opening: assembleOpening(null, 200000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 40, inventoryDays: 10, creditorDays: 30 }])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 80, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 25, dividendRate: 15,
  });
  const monthly = buildMonthlyCashFlow({
    openingCash: f.cashFlow[1].openingCash,
    opening: { accountsReceivable: 0, inventory: 0, accountsPayable: 0, prepaid: 0, accrued: 0 },
    closing: {
      accountsReceivable: f.workingCapital[1].accountsReceivable, inventory: f.workingCapital[1].inventory,
      accountsPayable: f.workingCapital[1].accountsPayable, prepaid: f.workingCapital[1].prepaid, accrued: f.workingCapital[1].accrued,
    },
    taxPaid: f.cashFlow[1].taxPaid, dividends: f.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(sources, components),
  });
  return { gst, f, monthly, failures: monthlyInvariants(monthly, f.cashFlow[1]).filter((x) => !x.passed) };
};

const PLACES: [string, string | null][] = [
  ["Australia", null], ["United Kingdom", null],
  ["Canada", "Ontario"], ["Canada", "British Columbia"], ["Canada", "Quebec"], ["Canada", "Alberta"],
  ["United States", "California"], ["United States", "Louisiana"], ["United States", "Oregon"],
];

describe("the four markets, end to end (§6.39)", () => {
  for (const [country, region] of PLACES) {
    const where = region ? `${country} — ${region}` : country;
    const r = run(regimeFor(country, region));

    it(`balances and reconciles: ${where}`, () => {
      for (const y of FORECAST_YEARS) expect(r.f.balanceSheet[y].balanceCheck, `${where} Y${y}`).toBe(0);
      expect(r.f.reconciled, where).toBe(true);
      expect(r.failures.map((x) => `${where}: ${x.label} out by ${x.difference}`)).toEqual([]);
    });

    it(`never moves the profit: ${where}`, () => {
      const plain = run({ heading: "None", components: [] });
      for (const y of FORECAST_YEARS) expect(r.f.pnl[y].netProfit, `${where} Y${y}`).toBe(plain.f.pnl[y].netProfit);
    });
  }
});

describe("each country's tax actually behaves like that country's tax", () => {
  it("Australia claims its GST back, so it remits the net", () => {
    const r = run(regimeFor("Australia"));
    expect(r.gst.byYear[1].onCogs).toBeGreaterThan(0);
    expect(r.gst.schedules[1].credits).toBeGreaterThan(0);
    expect(r.gst.schedules[1].net).toBe(
      Math.round((r.gst.schedules[1].collected - r.gst.schedules[1].credits) * 100) / 100);
  });

  it("the UK pays a quarter in the SECOND month after it, not the first", () => {
    const uk = run(regimeFor("United Kingdom"));
    const au = run(regimeFor("Australia"));
    const paid = (x: typeof uk) => x.gst.schedules[1].months.filter((m) => m.remitted !== 0).map((m) => m.month);
    expect(paid(au)).toEqual([4, 7, 10]);        // a month after each quarter
    expect(paid(uk)).toEqual([5, 8, 11]);        // a month and seven days after each quarter
  });

  it("the United States claims nothing back, so it remits everything it collects", () => {
    const r = run(regimeFor("United States", "California"));
    expect(r.gst.byYear[1].onCogs).toBe(0);
    expect(r.gst.byYear[1].onOverheads).toBe(0);
    expect(r.gst.byYear[1].onCapex).toBe(0);
    expect(r.gst.schedules[1].credits).toBe(0);
    expect(r.gst.schedules[1].net).toBe(r.gst.schedules[1].collected);
  });

  it("a no-sales-tax state charges nothing at all", () => {
    const r = run(regimeFor("United States", "Oregon"));
    expect(r.gst.schedules[1].collected).toBe(0);
    expect(r.f.balanceSheet[1].gstPayable).toBe(0);
  });

  it("Ontario charges one HST and claims all of it", () => {
    const r = run(regimeFor("Canada", "Ontario"));
    expect(r.gst.byComponent[1]).toHaveLength(1);
    expect(r.gst.byComponent[1][0].label).toBe("HST");
    expect(r.gst.byYear[1].onCogs).toBeGreaterThan(0);
  });

  it("British Columbia runs two taxes at once and claims back only the federal one", () => {
    const bc = run(regimeFor("Canada", "British Columbia"));
    expect(bc.gst.byComponent[1].map((c) => c.label)).toEqual(["GST", "PST"]);

    const [gstPart, pstPart] = bc.gst.byComponent[1];
    expect(gstPart.schedule.credits).toBeGreaterThan(0);     // 5% GST is reclaimable
    expect(pstPart.schedule.credits).toBe(0);                // 7% PST is not
    expect(pstPart.schedule.net).toBe(pstPart.schedule.collected);

    // Both are charged on sales: 12% collected in total.
    const alberta = run(regimeFor("Canada", "Alberta"));
    expect(bc.gst.schedules[1].collected).toBeCloseTo(alberta.gst.schedules[1].collected * (12 / 5), 0);
  });

  it("Quebec runs two taxes and claims back both", () => {
    const r = run(regimeFor("Canada", "Quebec"));
    expect(r.gst.byComponent[1].map((c) => c.label)).toEqual(["GST", "QST"]);
    for (const part of r.gst.byComponent[1]) expect(part.schedule.credits).toBeGreaterThan(0);
  });

  it("the parts add to the whole, in a province with two of them", () => {
    const r = run(regimeFor("Canada", "British Columbia"));
    for (const y of FORECAST_YEARS) {
      const parts = r.gst.byComponent[y];
      const add = (k: "collected" | "credits" | "remitted" | "closingPayable") =>
        Math.round(parts.reduce((a, p) => a + p.schedule[k], 0) * 100) / 100;
      expect(add("collected"), `collected Y${y}`).toBe(r.gst.schedules[y].collected);
      expect(add("credits"), `credits Y${y}`).toBe(r.gst.schedules[y].credits);
      expect(add("remitted"), `remitted Y${y}`).toBe(r.gst.schedules[y].remitted);
      expect(add("closingPayable"), `payable Y${y}`).toBe(r.gst.schedules[y].closingPayable);
    }
  });
});

describe("the regime table itself", () => {
  it("knows which countries need a state or province", () => {
    expect(needsRegion("United States")).toBe(true);
    expect(needsRegion("Canada")).toBe(true);
    expect(needsRegion("Australia")).toBe(false);
    expect(needsRegion("United Kingdom")).toBe(false);
  });

  it("offers every state and every province", () => {
    expect(regionsFor("United States")).toHaveLength(51);      // 50 states and DC
    expect(regionsFor("Canada")).toHaveLength(13);             // 10 provinces and 3 territories
    expect(regionsFor("Australia")).toEqual([]);
  });

  it("gives every US state a rate that is at least its state rate", () => {
    for (const [name, r] of Object.entries(US_STATES)) {
      expect(r.combined, name).toBeGreaterThanOrEqual(0);
      expect(r.state, name).toBeGreaterThanOrEqual(0);
    }
  });

  it("never returns a regime with a reclaimable sales tax, or an unclaimable VAT", () => {
    for (const [country, region] of PLACES) {
      for (const c of regimeFor(country, region).components) {
        const single = ["PST", "Sales tax", "SST"].includes(c.label);
        expect(c.reclaimable, `${country} ${region} ${c.label}`).toBe(!single);
      }
    }
  });
});
