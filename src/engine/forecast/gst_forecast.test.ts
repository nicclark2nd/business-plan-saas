import { describe, expect, it } from "vitest";
import { assembleGst, onShape, shapeOf, type GstPlanSources } from "./gst_assemble";
import { assembleBase, assembleOpening, type PlanSources } from "./assemble";
import { buildForecast, FORECAST_YEARS, type ForecastInput } from "./model";
import { NOT_REGISTERED, type GstSettings } from "../plan/gst";

const AU: GstSettings = { registered: true, label: "GST", rate: 10, frequency: "quarterly", lagMonths: 1, reclaimable: true };

const products = [
  { id: "a", name: "House slab", sold_as: "one_off", average_price: 16800, units_sold: 36, start_selling_year: 1,
    yearly_growth: { "2": { price: 3, units: 5 } }, monthly_distribution: null, cost_per_unit: 9000, yearly_cost_increase: {} },
  { id: "b", name: "Export work", sold_as: "one_off", average_price: 40000, units_sold: 4, start_selling_year: 1,
    yearly_growth: {}, monthly_distribution: null, cost_per_unit: 20000, yearly_cost_increase: {}, gst_applies: false },
];
const overheads = [
  { id: "o1", name: "Yard rent", current_value: 96000, yearly_change: {}, start_year: 1 },
  { id: "o2", name: "Bank fees", current_value: 4800, yearly_change: {}, start_year: 1, gst_applies: false },
];
const assets = [{ id: "as1", name: "Excavator", source: "entered" as const, purchase_price: 120000, residual_value: 0, useful_life_months: 60, method: "straight_line" as const, start_year: 1, start_month: 3 }];

const sources = {
  products, costProducts: products, fixedCogs: [], overheads,
  salaries: [180000, 185000, 190000, 195000, 200000], marketing: [12000, 12000, 12000, 12000, 12000],
  onCostPct: 11.5, funding: [], assets, extraordinary: [],
} as unknown as PlanSources & GstPlanSources;

const run = (g: GstSettings, over: Partial<ForecastInput> = {}) => {
  const gst = assembleGst(sources, [g]);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];
  return {
    gst,
    f: buildForecast({
      base,
      opening: assembleOpening(null, 150000, 0),
      workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 45, inventoryDays: 15, creditorDays: 30 }])),
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 80, prepaidClosing: 0, accruedClosing: 0 }])),
      taxRate: 25, dividendRate: 20, ...over,
    }),
  };
};

describe("the three rules GST must not break (§6.38)", () => {
  const off = run(NOT_REGISTERED);
  const on = run(AU);

  it("1. does not change the profit by a cent", () => {
    for (const y of FORECAST_YEARS) {
      expect(on.f.pnl[y].revenue, `revenue Y${y}`).toBe(off.f.pnl[y].revenue);
      expect(on.f.pnl[y].cogs, `cogs Y${y}`).toBe(off.f.pnl[y].cogs);
      expect(on.f.pnl[y].overheads, `overheads Y${y}`).toBe(off.f.pnl[y].overheads);
      expect(on.f.pnl[y].operatingProfit, `operating Y${y}`).toBe(off.f.pnl[y].operatingProfit);
      expect(on.f.pnl[y].netProfit, `net Y${y}`).toBe(off.f.pnl[y].netProfit);
    }
  });

  it("2. carries debtors and creditors tax-inclusive", () => {
    expect(on.f.balanceSheet[1].accountsReceivable).toBeGreaterThan(off.f.balanceSheet[1].accountsReceivable);
    expect(on.f.balanceSheet[1].accountsPayable).toBeGreaterThan(off.f.balanceSheet[1].accountsPayable);
    // Stock is the exception: carried tax-exclusive, so it does not move.
    expect(on.f.balanceSheet[1].inventory).toBe(off.f.balanceSheet[1].inventory);
  });

  it("3. shows the net position as a liability or an asset, never as cash", () => {
    const net = on.gst.schedules[1].closingPayable;
    expect(off.f.balanceSheet[1].gstPayable).toBe(0);
    expect(off.f.balanceSheet[1].gstReceivable).toBe(0);
    // The year closes owing the last quarter, which is the ordinary case.
    expect(net).toBeGreaterThan(0);
    expect(on.f.balanceSheet[1].gstPayable).toBe(net);
    expect(on.f.balanceSheet[1].gstReceivable).toBe(0);

    // But the quarter the excavator lands in is a credit quarter, and the refund arrives in month 4 —
    // money IN, which is exactly the cash a capital purchase actually generates.
    const q1 = on.gst.schedules[1].months.slice(0, 3).reduce((a, m) => a + m.net, 0);
    expect(q1).toBeLessThan(0);
    expect(on.gst.schedules[1].months[3].remitted).toBeLessThan(0);
  });
});

describe("and it still all holds together", () => {
  const on = run(AU);

  it("balances in every year", () => {
    for (const y of FORECAST_YEARS) expect(on.f.balanceSheet[y].balanceCheck, `Y${y}`).toBe(0);
  });

  it("profit still explains the cash, and each year still opens where the last closed", () => {
    expect(on.f.invariants.filter((i) => !i.passed).map((i) => `${i.label} Y${i.year} out by ${i.difference}`)).toEqual([]);
    expect(on.f.reconciled).toBe(true);
  });

  it("holds at every rate and every filing frequency", () => {
    for (const rate of [5, 10, 15, 20, 25]) {
      for (const frequency of ["monthly", "quarterly", "annually"] as const) {
        const r = run({ registered: true, label: "GST", rate, frequency, lagMonths: 1, reclaimable: true });
        expect(r.f.reconciled, `${rate}% ${frequency}`).toBe(true);
        for (const y of FORECAST_YEARS) expect(r.f.balanceSheet[y].balanceCheck, `${rate}% ${frequency} Y${y}`).toBe(0);
      }
    }
  });

  it("holds when the business never pays tax and never pays a dividend either", () => {
    const r = run(AU, { taxRate: 0, dividendRate: 0 });
    expect(r.f.reconciled).toBe(true);
  });
});

describe("an exempt line is genuinely exempt", () => {
  const on = run(AU);

  it("charges nothing on a GST-free sale", () => {
    // Only the slab line is taxable: 36 x 16,800 = 604,800, so 60,480 of tax, not the whole 764,800.
    expect(on.gst.byYear[1].onSales).toBeCloseTo(60480, 0);
  });

  it("claims nothing on a line marked free of it", () => {
    // Yard rent 96,000 and marketing 12,000 are taxable; bank fees are not, and wages never are.
    expect(on.gst.byYear[1].onOverheads).toBeCloseTo(10800, 0);
  });

  it("never claims a credit on the payroll", () => {
    const salariesAndOnCosts = 180000 * 1.115;
    expect(on.gst.byYear[1].onOverheads).toBeLessThan(salariesAndOnCosts * 0.1);
  });

  it("claims the tax on an asset, and pays it with the asset", () => {
    expect(on.gst.byYear[1].onCapex).toBeCloseTo(12000, 0);
    expect(on.f.cashFlow[1].capex).toBeCloseTo(132000, 0);      // 120,000 plus the tax on it
  });
});

describe("the shape a later year borrows from Year 1", () => {
  it("is exact in Year 1 by construction", () => {
    const months = [4, 4, 6, 8, 10, 12, 12, 12, 10, 9, 8, 5].map((v) => v * 1000);
    const total = months.reduce((a, b) => a + b, 0);
    expect(onShape(total, shapeOf(months))).toEqual(months);
  });

  it("falls back to an even spread rather than dividing by a year with nothing in it", () => {
    expect(shapeOf(Array(12).fill(0))).toEqual(Array(12).fill(1 / 12));
    expect(onShape(1200, shapeOf(Array(12).fill(0)))).toEqual(Array(12).fill(100));
  });
});

/**
 * The §6.21.1 check, with tax switched on. Six modules publish a year and twelve months; GST now rides on
 * four of those lines and adds a fifth of its own. If any of them stops adding up, this is where it shows.
 */
describe("Year 1 still equals its own twelve months, with GST on", () => {
  const assembleMonthsWith = async (g: GstSettings) => {
    const { assembleMonths } = await import("./assemble");
    const { buildMonthlyCashFlow, monthlyInvariants } = await import("./monthly");
    const gst = assembleGst(sources, [g]);
    const base = assembleBase(sources);
    for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];
    const f = buildForecast({
      base,
      opening: assembleOpening(null, 150000, 0),
      workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 45, inventoryDays: 15, creditorDays: 30 }])),
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 80, prepaidClosing: 0, accruedClosing: 0 }])),
      taxRate: 25, dividendRate: 20,
    });
    const monthly = buildMonthlyCashFlow({
      openingCash: f.cashFlow[1].openingCash,
      opening: { accountsReceivable: 0, inventory: 0, accountsPayable: 0, prepaid: 0, accrued: 0 },
      closing: {
        accountsReceivable: f.workingCapital[1].accountsReceivable,
        inventory: f.workingCapital[1].inventory,
        accountsPayable: f.workingCapital[1].accountsPayable,
        prepaid: f.workingCapital[1].prepaid,
        accrued: f.workingCapital[1].accrued,
      },
      taxPaid: f.cashFlow[1].taxPaid,
      dividends: f.cashFlow[1].dividendsPaid,
      shapes: assembleMonths(sources, [g]),
    });
    return { f, monthly, failures: monthlyInvariants(monthly, f.cashFlow[1]).filter((i) => !i.passed) };
  };

  it("agrees line by line when registered", async () => {
    const r = await assembleMonthsWith(AU);
    expect(r.failures.map((x) => `${x.label} out by ${x.difference}`)).toEqual([]);
  });

  it("agrees line by line when not registered", async () => {
    const r = await assembleMonthsWith(NOT_REGISTERED);
    expect(r.failures.map((x) => `${x.label} out by ${x.difference}`)).toEqual([]);
  });

  it("agrees at every filing frequency, which is what moves the remittance months", async () => {
    for (const frequency of ["monthly", "quarterly", "annually"] as const) {
      const r = await assembleMonthsWith({ registered: true, label: "GST", rate: 10, frequency, lagMonths: 1, reclaimable: true });
      expect(r.failures.map((x) => `${frequency}: ${x.label} out by ${x.difference}`)).toEqual([]);
    }
  });

  it("shows the BAS leaving the bank in the months it actually leaves", async () => {
    const r = await assembleMonthsWith(AU);
    const paid = r.monthly.months.filter((m) => m.gstRemitted !== 0).map((m) => m.month);
    expect(paid).toEqual([4, 7, 10]);                   // three returns inside the year, the fourth after it
    expect(r.monthly.total.gstRemitted).toBe(r.f.cashFlow[1].gstRemitted);
  });
});

/**
 * A GST-free sale is zero-rated, not exempt: the exporter charges nothing and still claims every credit on
 * what the job cost. Filtering the cost side by the sales flag stripped those credits (§6.38).
 */
describe("a GST-free sale still claims its costs back", () => {
  const on = run(AU);

  it("charges nothing on the export but claims the credit on making it", () => {
    // Export work: 4 x 40,000 sold GST-free, costing 4 x 20,000 which DOES carry GST.
    // Slab line: 36 x 16,800 sold with GST, costing 36 x 9,000.
    const taxableCost = 36 * 9000 + 4 * 20000;
    expect(on.gst.byYear[1].onSales).toBeCloseTo(60480, 0);            // only the slab line is charged
    expect(on.gst.byYear[1].onCogs).toBeCloseTo(taxableCost * 0.1, 0);  // both lines claim
  });

  it("still balances with the two sides treated differently", () => {
    for (const y of FORECAST_YEARS) expect(on.f.balanceSheet[y].balanceCheck, `Y${y}`).toBe(0);
    expect(on.f.reconciled).toBe(true);
  });
});

/** The parts must add to the whole, or the balance sheet is out by the rounding between them (§6.38). */
describe("the yearly figures and the schedule are one computation", () => {
  for (const frequency of ["monthly", "quarterly", "annually"] as const) {
    it(`agrees to the cent — ${frequency}`, () => {
      const r = run({ registered: true, label: "GST", rate: 10, frequency, lagMonths: 1, reclaimable: true });
      for (const y of FORECAST_YEARS) {
        const b = r.gst.byYear[y], s = r.gst.schedules[y];
        expect(b.onSales, `collected Y${y}`).toBe(s.collected);
        expect(Math.round((b.onCogs + b.onOverheads + b.onCapex) * 100) / 100, `credits Y${y}`).toBe(s.credits);
        expect(b.remitted, `remitted Y${y}`).toBe(s.remitted);
        expect(b.payableClosing, `payable Y${y}`).toBe(s.closingPayable);
      }
    });
  }
});
