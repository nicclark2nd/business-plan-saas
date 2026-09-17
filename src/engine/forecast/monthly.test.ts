import { describe, expect, it } from "vitest";
import { balancePath, buildMonthlyCashFlow, inMonth, monthlyInvariants, ramp, spreadEven, type MonthlyShapes } from "./monthly";
import { assembleBase, assembleMonths, assembleOpening, type PlanSources } from "./assemble";
import { buildForecast, FORECAST_YEARS } from "./model";
import { planCogsByYear, type CostProduct } from "../cogs/direct";
import { planRevenueByYear } from "../sales/product";

const flat12 = (v: number) => Array(12).fill(v) as number[];
const zero12 = () => Array(12).fill(0) as number[];
const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

const shapes = (over: Partial<MonthlyShapes> = {}): MonthlyShapes => ({
  revenue: zero12(), cogs: zero12(), overheads: zero12(), capex: zero12(), depreciation: zero12(),
  debtProceeds: zero12(), equityRaised: zero12(), debtRepaid: zero12(), interest: zero12(),
  grantsReceived: zero12(), grantIncome: zero12(),
  extraordinaryReceipts: zero12(), extraordinaryPayments: zero12(), disposalProceeds: zero12(),
  gstOnSales: zero12(), gstOnCogs: zero12(), gstOnOverheads: zero12(), gstOnCapex: zero12(), gstRemitted: zero12(),
  ...over,
});

const noBalances = { accountsReceivable: 0, inventory: 0, accountsPayable: 0, prepaid: 0, accrued: 0 };

describe("the shape of a year", () => {
  it("a ramp always finishes at exactly one, so December lands on the annual balance", () => {
    expect(ramp([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])[11]).toBe(1);
    expect(ramp(flat12(100))[11]).toBe(1);
    expect(ramp([500, ...Array(11).fill(0)])[0]).toBe(1);
  });

  it("falls back to a straight line rather than dividing by a year that never moves", () => {
    expect(ramp(zero12())).toEqual(Array.from({ length: 12 }, (_, i) => (i + 1) / 12));
  });

  it("follows the driver, so a seasonal year builds debtors in its busy months", () => {
    const seasonal = [0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100];       // everything sells in the last quarter
    const path = balancePath(0, 30000, seasonal);
    expect(path[5]).toBe(0);                                            // nothing sold, so nothing owed
    expect(path[9]).toBeCloseTo(10000, 6);
    expect(path[11]).toBeCloseTo(30000, 6);                             // and it ends exactly where the year does
  });

  it("moves from the opening balance, not from zero", () => {
    const path = balancePath(8000, 2000, flat12(1));
    expect(path[0]).toBeCloseTo(7500, 6);
    expect(path[11]).toBeCloseTo(2000, 6);
  });

  it("spreads a total across twelve months that add back to it exactly", () => {
    for (const v of [0, 1, 100, 12345.67, 0.07, -900.01]) expect(sum(spreadEven(v))).toBe(Math.round(v * 100) / 100);
  });

  it("places a one-off in the month it happens", () => {
    expect(inMonth(5000, 12)[11]).toBe(5000);
    expect(sum(inMonth(5000, 12))).toBe(5000);
  });
});

describe("the twelve months", () => {
  it("runs the cash forward and finds the month it is tightest", () => {
    const m = buildMonthlyCashFlow({
      openingCash: 10000, opening: noBalances, closing: noBalances, taxPaid: 0, dividends: 0,
      shapes: shapes({ revenue: flat12(1000), overheads: [500, 500, 9000, 500, 500, 500, 500, 500, 500, 500, 500, 500] }),
    });
    expect(m.months[2].closingCash).toBe(3000);
    expect(m.low.month).toBe(3);
    expect(m.low.closingCash).toBe(3000);
    expect(m.negative).toEqual([]);
  });

  it("names every month that closes below zero, which the annual column cannot", () => {
    const m = buildMonthlyCashFlow({
      openingCash: 0, opening: noBalances, closing: noBalances, taxPaid: 0, dividends: 0,
      // A year that ends 6,000 up but is underwater from February to June.
      shapes: shapes({ revenue: [0, 0, 0, 0, 0, 0, 3000, 3000, 3000, 3000, 3000, 3000], overheads: flat12(1000) }),
    });
    expect(m.total.closingCash).toBe(6000);
    expect(m.negative).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);   // month 9 is back to exactly nil
    expect(m.low.month).toBe(6);
  });

  it("takes the dividend in month twelve and spreads the tax", () => {
    const m = buildMonthlyCashFlow({
      openingCash: 0, opening: noBalances, closing: noBalances, taxPaid: 12000, dividends: 9000,
      shapes: shapes(),
    });
    expect(m.months[0].taxPaid).toBe(1000);
    expect(m.months[0].dividendsPaid).toBe(0);
    expect(m.months[11].dividendsPaid).toBe(9000);
    expect(m.total.taxPaid).toBe(12000);
    expect(m.total.dividendsPaid).toBe(9000);
  });

  it("collects later when clients pay later — the same money, moved", () => {
    const paidOnTheDay = buildMonthlyCashFlow({
      openingCash: 0, opening: noBalances, closing: noBalances, taxPaid: 0, dividends: 0,
      shapes: shapes({ revenue: flat12(10000) }),
    });
    const paidInThirty = buildMonthlyCashFlow({
      openingCash: 0, opening: noBalances, closing: { ...noBalances, accountsReceivable: 10000 },
      taxPaid: 0, dividends: 0, shapes: shapes({ revenue: flat12(10000) }),
    });
    expect(paidOnTheDay.total.receiptsFromCustomers).toBe(120000);
    expect(paidInThirty.total.receiptsFromCustomers).toBe(110000);     // a month's billing still outstanding
    expect(paidInThirty.months[11].accountsReceivable).toBe(10000);    // and it IS the annual balance
  });
});

/**
 * The point of the whole module. Six modules publish both a year and twelve months, and this is the one
 * check that holds all six to the same answer at once (§6.21.1).
 */
describe("Year 1 equals its own twelve months", () => {
  const products = [
    { id: "a", name: "House Slab", sold_as: "one_off", average_price: 16800, units_sold: 36, start_selling_year: 1, yearly_growth: {}, monthly_distribution: { "1": 4, "2": 4, "3": 6, "4": 8, "5": 10, "6": 12, "7": 12, "8": 12, "9": 10, "10": 9, "11": 8, "12": 5 } },
    { id: "b", name: "Driveways", sold_as: "one_off", average_price: 2328, units_sold: 30, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null },
  ];
  const sources = {
    products,
    costProducts: products.map((p) => ({ ...p, cost_per_unit: 400, yearly_cost_increase: {} })),
    fixedCogs: [{ annual_cost: 24000, yearly_growth_rates: {}, monthly_distribution: null }],
    overheads: [{ id: "o1", name: "Rent", current_value: 125000, yearly_change: {}, start_year: 1 }],
    salaries: [126000, 129780, 136269, 143082, 150237],
    marketing: [14000, 14000, 14000, 14000, 14000],
    onCostPct: 11.5,
    funding: [{
      id: "f1", kind: "debt" as const, name: "Equipment loan", amount: 250000, start_year: 1, start_month: 1,
      loan: { amount_drawn: 250000, interest_rate: 8, term_months: 60, repayment_type: "amortised" as const, payment_frequency: "monthly" as const, start_year: 1, start_month: 1 },
    }],
    assets: [{ id: "as1", name: "Excavator", source: "entered" as const, purchase_price: 90000, residual_value: 0, useful_life_months: 60, method: "straight_line" as const, start_year: 1, start_month: 4 }],
    extraordinary: [
      { id: "e1", description: "Grant", category: "income" as const, amount: 20000, year: 1, month: 2, source_asset_id: null },
      { id: "e2", description: "Legal claim", category: "expense" as const, amount: 15000, year: 1, month: 9, source_asset_id: null },
    ],
  } as unknown as PlanSources;

  const wc = Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 45, inventoryDays: 20, creditorDays: 30 }]));
  const ct = Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 80, prepaidClosing: 4000, accruedClosing: 2500 }]));

  const forecast = buildForecast({
    base: assembleBase(sources),
    opening: assembleOpening(null, 60000, 0),
    workingCapital: wc, cashTiming: ct, taxRate: 25, dividendRate: 30,
  });
  const monthly = buildMonthlyCashFlow({
    openingCash: forecast.cashFlow[1].openingCash,
    opening: { accountsReceivable: 0, inventory: 0, accountsPayable: 0, prepaid: 0, accrued: 0 },
    closing: {
      accountsReceivable: forecast.workingCapital[1].accountsReceivable,
      inventory: forecast.workingCapital[1].inventory,
      accountsPayable: forecast.workingCapital[1].accountsPayable,
      prepaid: forecast.workingCapital[1].prepaid,
      accrued: forecast.workingCapital[1].accrued,
    },
    taxPaid: forecast.cashFlow[1].taxPaid,
    dividends: forecast.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(sources),
  });

  it("agrees line by line, not merely on the total", () => {
    const failures = monthlyInvariants(monthly, forecast.cashFlow[1]).filter((i) => !i.passed);
    expect(failures.map((f) => `${f.label} out by ${f.difference}`)).toEqual([]);
  });

  it("closes the year exactly where the annual cash flow closes it", () => {
    expect(monthly.total.closingCash).toBeCloseTo(forecast.cashFlow[1].closingCash, 1);
    expect(monthly.months[11].closingCash).toBeCloseTo(forecast.balanceSheet[1].cash, 1);
  });

  it("ends the year on the balance sheet's own debtors, stock and creditors", () => {
    expect(monthly.months[11].accountsReceivable).toBeCloseTo(forecast.balanceSheet[1].accountsReceivable, 1);
    expect(monthly.months[11].inventory).toBeCloseTo(forecast.balanceSheet[1].inventory, 1);
    expect(monthly.months[11].accountsPayable).toBeCloseTo(forecast.balanceSheet[1].accountsPayable, 1);
  });

  it("catches a module whose twelve months stop adding to its own year", () => {
    const broken = { ...assembleMonths(sources) };
    broken.revenue = broken.revenue.map((v, i) => (i === 5 ? v - 5000 : v));   // one month quietly light
    const drifted = buildMonthlyCashFlow({
      openingCash: forecast.cashFlow[1].openingCash,
      opening: { accountsReceivable: 0, inventory: 0, accountsPayable: 0, prepaid: 0, accrued: 0 },
      closing: {
        accountsReceivable: forecast.workingCapital[1].accountsReceivable,
        inventory: forecast.workingCapital[1].inventory,
        accountsPayable: forecast.workingCapital[1].accountsPayable,
        prepaid: forecast.workingCapital[1].prepaid,
        accrued: forecast.workingCapital[1].accrued,
      },
      taxPaid: forecast.cashFlow[1].taxPaid, dividends: forecast.cashFlow[1].dividendsPaid, shapes: broken,
    });
    const failed = monthlyInvariants(drifted, forecast.cashFlow[1]).filter((i) => !i.passed);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.some((f) => f.label.includes("Closing cash"))).toBe(true);
  });
});

/**
 * The fault an agreeing set of statements cannot catch (§6.36). An ongoing line whose clients come from
 * another line was costed as if it had none, so cost of sales was 32 % light while the P&L, cash flow and
 * balance sheet all still agreed perfectly with each other.
 */
describe("cost of sales follows the line its clients come from", () => {
  const engine = { id: "engine", name: "Free audit", sold_as: "one_off", average_price: 500, units_sold: 240, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null };
  const sourced = { id: "sub", name: "Monthly support", sold_as: "recurring", average_price: 1200, units_sold: null, opening_clients: 0, clients_from_product_id: "engine", client_life_months: 24, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null };
  const products = [engine, sourced];
  const costProducts = products.map((p) => ({ ...p, cost_per_unit: 120, yearly_cost_increase: {} })) as CostProduct[];
  const sources = {
    products, costProducts, fixedCogs: [], overheads: [], salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0],
    onCostPct: 0, funding: [], assets: [], extraordinary: [],
  } as unknown as PlanSources;

  it("costs what the linked line actually wins", () => {
    const base = assembleBase(sources);
    const screen = planCogsByYear(costProducts, [], (c) => products.find((x) => x.id === c.clients_from_product_id) ?? null);
    for (const y of FORECAST_YEARS) expect(base[y].variableCogs, `Y${y}`).toBe(screen[y - 1].variable);
    expect(base[1].variableCogs).toBeGreaterThan(28800);      // 28,800 was the unlinked answer
  });

  it("and the months agree with the year, both linked", () => {
    const months = assembleMonths(sources);
    expect(sum(months.revenue)).toBeCloseTo(planRevenueByYear(products)[0].value, 1);
    expect(sum(months.cogs)).toBeCloseTo(assembleBase(sources)[1].variableCogs, 1);
  });
});

/**
 * The monthly view opens where the year opens (§6.66.1). Four call sites passed `prepaid: 0, accrued: 0`
 * as the monthly OPENING — the same hard-coded zero §6.66 removed from the annual model, left behind one
 * layer down. Unlike the annual fault this one was never silent: the twelve months stop adding to their own
 * year, and the strip says so. It was simply never exercised, because no plan had an opening balance to
 * carry until §6.66 gave it somewhere to live.
 */
describe("the monthly view opens where the year opens", () => {
  const history = {
    revenue: 1_000_000, cogs: 400_000, accounts_receivable: 0, inventory_wip: 0, accounts_payable: 0,
    prepayments: 12_000, accruals: 8_000, cash: 60_000, equity: 64_000,
  };
  const sources = { products: [], costProducts: [], fixedCogs: [], overheads: [], salaries: [], funding: [], assets: [], extraordinary: [] } as unknown as PlanSources;
  const carried = Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 12_000, accruedClosing: 8_000 }]));
  const days = Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }]));

  const opening = assembleOpening(history, 60_000, 0);
  const forecast = buildForecast({ base: assembleBase(sources), opening, workingCapital: days, cashTiming: carried, taxRate: 0, dividendRate: 0 });
  const monthlyWith = (open: { prepaid: number; accrued: number }) => buildMonthlyCashFlow({
    openingCash: forecast.cashFlow[1].openingCash,
    opening: { accountsReceivable: 0, inventory: 0, accountsPayable: 0, ...open },
    closing: {
      accountsReceivable: forecast.workingCapital[1].accountsReceivable,
      inventory: forecast.workingCapital[1].inventory,
      accountsPayable: forecast.workingCapital[1].accountsPayable,
      prepaid: forecast.workingCapital[1].prepaid,
      accrued: forecast.workingCapital[1].accrued,
    },
    taxPaid: forecast.cashFlow[1].taxPaid,
    dividends: forecast.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(sources),
  });

  it("reads the opening balances off the same opening the year used", () => {
    const failures = monthlyInvariants(monthlyWith({ prepaid: opening.prepaid, accrued: opening.accrued }), forecast.cashFlow[1]).filter((i) => !i.passed);
    expect(failures.map((f) => f.label)).toEqual([]);
  });

  it("breaks the twelve-months-add-to-the-year check when it opens at zero instead", () => {
    const failures = monthlyInvariants(monthlyWith({ prepaid: 0, accrued: 0 }), forecast.cashFlow[1]).filter((i) => !i.passed);
    // 12,000 of prepaid less 8,000 of accrued that the year never moved: exactly 4,000 of phantom cash out.
    expect(failures.map((f) => `${f.label.replace("Year 1's twelve months add to Year 1 \u2014 ", "")} ${f.difference}`)).toEqual([
      "Paid to suppliers and staff 4000",
      "Operating cash flow -4000",
      "Movement in cash -4000",
      "Closing cash -4000",
    ]);
  });
});
