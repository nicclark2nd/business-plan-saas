import { describe, expect, it } from "vitest";
import { assembleBase, assembleOpening, debtSplitByYear, principalByYear, raisedByYear } from "./assemble";
import { buildForecast, FORECAST_YEARS } from "./model";
import { planRevenueByYear } from "../sales/product";
import { planCogsByYear } from "../cogs/direct";
import { overheadsByYear, planOverheadLines } from "../overheads/expenses";
import { assetsByYear } from "../assets/depreciation";

/** Nic's plan, shrunk to the shapes each module owns. */
const products = [
  { id: "a", name: "House Slab", sold_as: "one_off", average_price: 16800, units_sold: 36, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null },
  { id: "b", name: "Driveways", sold_as: "one_off", average_price: 2328, units_sold: 30, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null },
];
const costProducts = products.map((p) => ({ ...p, cost_per_unit: 400, yearly_cost_increase: {} }));
const overheadRows = [{ id: "o1", name: "Rent", current_value: 125000, yearly_change: {}, start_year: 1 }];
const funding = [{
  id: "f1", kind: "debt" as const, name: "Equipment loan", amount: 250000, start_year: 1, start_month: 1,
  loan: {
    amount_drawn: 250000, interest_rate: 8, term_months: 60, repayment_type: "amortised" as const,
    payment_frequency: "monthly" as const, start_year: 1, start_month: 1,
  },
}];
const assets = [{ id: "as1", name: "Excavator", source: "entered" as const, purchase_price: 90000, residual_value: 0, useful_life_months: 60, method: "straight_line" as const, start_year: 1, start_month: 1 }];
const extraordinary = [
  { id: "e1", description: "Insurance settlement", category: "income" as const, amount: 35000, year: 2, month: 3, source_asset_id: null },
  { id: "e2", description: "Sell the excavator", category: "income" as const, amount: 40000, year: 3, month: 6, source_asset_id: "as1" },
  { id: "e3", description: "Legal claim", category: "expense" as const, amount: 15000, year: 4, month: 1, source_asset_id: null },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sources: any = {
  products, costProducts, fixedCogs: [], overheads: overheadRows,
  salaries: [126000, 129780, 136269, 143082, 150237], marketing: [14000, 14000, 14000, 14000, 14000],
  onCostPct: 11.5, funding, assets, extraordinary,
};

describe("assemble", () => {
  /**
   * The reason this module exists. If any figure here were recomputed rather than read, this test is what
   * would catch it — the forecast must agree with the screen the number came from, by construction.
   */
  it("takes every figure from the module that owns it", () => {
    const base = assembleBase(sources);
    const revenue = planRevenueByYear(products);
    const cogs = planCogsByYear(costProducts, [], () => null);
    const oh = overheadsByYear(planOverheadLines(overheadRows, sources.salaries, sources.marketing), 11.5);
    const as = assetsByYear(assets);
    for (const y of FORECAST_YEARS) {
      const i = y - 1;
      expect(base[y].revenue, `revenue Y${y}`).toBe(revenue[i].value);
      expect(base[y].variableCogs, `variable cogs Y${y}`).toBe(cogs[i].variable);
      expect(base[y].fixedCogs, `fixed cogs Y${y}`).toBe(cogs[i].fixed);
      expect(base[y].overheads, `overheads Y${y}`).toBe(oh[i].total);
      expect(base[y].depreciation, `depreciation Y${y}`).toBe(as[i].depreciation);
      expect(base[y].capex, `capex Y${y}`).toBe(as[i].capex);
    }
  });

  it("splits debt into what falls due next year and what does not", () => {
    const { current, nonCurrent } = debtSplitByYear(funding, []);
    const closing = current.map((c, i) => c + nonCurrent[i]);
    for (const y of FORECAST_YEARS) {
      expect(current[y - 1], `current Y${y}`).toBeGreaterThanOrEqual(0);
      expect(nonCurrent[y - 1], `non-current Y${y}`).toBeGreaterThanOrEqual(0);
    }
    // A loan amortises, so it owes less each year and the current slice never exceeds the whole.
    for (let i = 1; i < 5; i++) expect(closing[i]).toBeLessThanOrEqual(closing[i - 1] + 0.01);
    // Nothing is deferred past the end of the plan.
    expect(nonCurrent[4]).toBe(0);
  });

  it("counts money raised in the year it lands, borrowed apart from equity", () => {
    const r = raisedByYear(funding);
    expect(r.debt[0]).toBe(250000);
    expect(r.equity[0]).toBe(0);
    expect(r.debt.slice(1)).toEqual([0, 0, 0, 0]);
  });

  it("never lets principal be mistaken for a cost", () => {
    const principal = principalByYear(funding, []);
    const base = assembleBase(sources);
    for (const y of FORECAST_YEARS) {
      expect(base[y].debtRepaid).toBe(principal[y - 1]);
    }
    // Principal is real and is never in the P&L; interest is real and always is.
    expect(principal.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    for (const y of FORECAST_YEARS) {
      expect(base[y].interest).toBeGreaterThan(0);
    }
  });

  /** A disposal's book value comes from the asset, never from a second copy stored on the item. */
  it("values a disposal from the asset it names", () => {
    const base = assembleBase(sources);
    expect(base[3].disposalProceeds).toBe(40000);
    // 90,000 over 60 months, sold in Year 3: two years written off, so 54,000 left on the books.
    expect(base[3].disposedBookValue).toBeCloseTo(54000, 0);
    // And the proceeds must not also appear as extraordinary income, or the gain is counted twice.
    expect(base[3].extraordinaryIncome).toBe(0);
    expect(base[2].extraordinaryIncome).toBe(35000);
    expect(base[4].extraordinaryExpense).toBe(15000);
  });

  it("reconciles end to end on an assembled plan", () => {
    const f = buildForecast({
      base: assembleBase(sources),
      opening: assembleOpening(null, 50000, 0),
      workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 45, inventoryDays: 15, creditorDays: 30 }])),
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
      taxRate: 25, dividendRate: 0,
    });
    expect(f.invariants.filter((i) => !i.passed).map((i) => `${i.key} Y${i.year} off by ${i.difference}`)).toEqual([]);
    expect(f.pnl[1].revenue).toBe(planRevenueByYear(products)[0].value);
  });

  it("opens flat for a startup and from history when there is history", () => {
    const startup = assembleOpening(null, 25000, 0);
    expect(startup.cash).toBe(25000);
    expect(startup.equity).toBe(25000);
    expect(startup.accountsReceivable).toBe(0);

    const trading = assembleOpening({ cash: 80000, accounts_receivable: 120000, accounts_payable: 45000, equity: 300000, fixed_assets: 210000 }, 0, 9000);
    expect(trading.cash).toBe(80000);
    expect(trading.accountsReceivable).toBe(120000);
    expect(trading.equity).toBe(300000);
    expect(trading.taxPayable).toBe(9000);
  });
});
