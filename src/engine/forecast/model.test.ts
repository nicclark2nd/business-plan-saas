import { describe, expect, it } from "vitest";
import { FORECAST_YEARS, buildForecast, type ForecastInput, type YearBase } from "./model";

const base = (p: Partial<YearBase> = {}): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, assetAdditions: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  grantsReceived: 0, grantIncome: 0, deferredIncomeCurrent: 0, deferredIncomeNonCurrent: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0, ...p,
});

const input = (over: Partial<ForecastInput> = {}): ForecastInput => ({
  base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 1_000_000, variableCogs: 400_000, overheads: 300_000 })])),
  opening: {
    cash: 50_000, accountsReceivable: 0, inventory: 0, otherCurrentAssets: 0, fixedAssets: 0,
    otherNonCurrentAssets: 0, accountsPayable: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0,
    otherCurrentLiabilities: 0, otherNonCurrentLiabilities: 0,
    equity: 50_000, taxPayable: 0, prepaid: 0, accrued: 0,
  },
  workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 45, inventoryDays: 20, creditorDays: 30 }])),
  cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
  taxRate: 25, dividendRate: 0,
  ...over,
});

/** The whole point of the module: three statements that have to agree, in every scenario we can think of. */
const expectReconciled = (f: ReturnType<typeof buildForecast>) => {
  const failed = f.invariants.filter((i) => !i.passed);
  expect(failed.map((i) => `${i.key} Y${i.year} off by ${i.difference}`)).toEqual([]);
  expect(f.reconciled).toBe(true);
};

describe("forecast", () => {
  it("reconciles on a plain trading plan", () => expectReconciled(buildForecast(input())));

  it("reconciles with debt, interest, capex, disposals, dividends and one-offs at once", () => {
    expectReconciled(buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({
        revenue: 2_119_240, variableCogs: 60_276, fixedCogs: 120_000, overheads: 636_290,
        depreciation: 24_000, capex: y === 1 ? 90_000 : 12_000, assetAdditions: y === 1 ? 90_000 : 12_000, interest: 18_500,
        debtProceeds: y === 1 ? 250_000 : 0, debtRepaid: 40_000,
        debtCurrent: 40_000, debtNonCurrent: Math.max(0, 210_000 - 40_000 * y),
        equityRaised: y === 1 ? 100_000 : 0,
        extraordinaryIncome: y === 2 ? 35_000 : 0, extraordinaryExpense: y === 3 ? 15_000 : 0,
        disposalProceeds: y === 4 ? 22_000 : 0, disposedBookValue: y === 4 ? 18_000 : 0,
      })])),
      dividendRate: 30,
    })));
  });

  it("reconciles when the business loses money", () => {
    expectReconciled(buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({
        revenue: 200_000, variableCogs: 180_000, overheads: 150_000, interest: 9_000, depreciation: 5_000,
      })])),
    })));
  });

  it("reconciles when tax is deferred and working capital moves every year", () => {
    expectReconciled(buildForecast(input({
      workingCapital: { 1: { debtorDays: 30, inventoryDays: 10, creditorDays: 20 },
        2: { debtorDays: 60, inventoryDays: 45, creditorDays: 15 },
        3: { debtorDays: 20, inventoryDays: 5, creditorDays: 60 },
        4: { debtorDays: 90, inventoryDays: 60, creditorDays: 30 },
        5: { debtorDays: 45, inventoryDays: 20, creditorDays: 30 } },
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 60, prepaidClosing: 8_000 * y, accruedClosing: 5_000 * y }])),
    })));
  });

  it("reconciles with nothing in the plan at all", () => {
    expectReconciled(buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base()])),
      opening: { cash: 0, accountsReceivable: 0, inventory: 0, otherCurrentAssets: 0, fixedAssets: 0,
        otherNonCurrentAssets: 0, accountsPayable: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0,
    otherCurrentLiabilities: 0, otherNonCurrentLiabilities: 0,
        equity: 0, taxPayable: 0, prepaid: 0, accrued: 0 },
    })));
  });

  /** Nic's first placement check: a one-off must not flatter trading, and must not dodge tax. */
  it("puts extraordinary income below operating profit and above tax", () => {
    const f = buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 1_000_000, variableCogs: 400_000, overheads: 300_000, extraordinaryIncome: y === 1 ? 100_000 : 0 })])),
    }));
    const y1 = f.pnl[1], y2 = f.pnl[2];
    expect(y1.operatingProfit).toBe(y2.operatingProfit);          // trading is untouched
    expect(y1.profitBeforeTax - y2.profitBeforeTax).toBe(100_000); // but it is in the taxable total
    expect(y1.tax).toBeGreaterThan(y2.tax);                        // and it is taxed
  });

  /** Second placement check: selling the ute is not revenue. */
  it("puts disposal proceeds in investing, and only the gain in profit", () => {
    const f = buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 500_000, disposalProceeds: y === 1 ? 22_000 : 0, disposedBookValue: y === 1 ? 18_000 : 0 })])),
    }));
    expect(f.pnl[1].revenue).toBe(500_000);            // not revenue
    expect(f.pnl[1].disposalGainLoss).toBe(4_000);     // only the gain
    expect(f.cashFlow[1].netInvesting).toBe(22_000);   // the whole proceeds, in investing
    expect(f.cashFlow[1].receiptsFromCustomers).toBeLessThan(500_001);
    expectReconciled(f);
  });

  /** Third: interest is a cost in the P&L and a financing outflow — once each, never twice. */
  it("keeps interest out of operating cash", () => {
    const f = buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 800_000, variableCogs: 300_000, overheads: 200_000, interest: 25_000 })])),
    }));
    expect(f.pnl[1].interest).toBe(25_000);
    expect(f.cashFlow[1].interestPaid).toBe(25_000);
    expect(f.cashFlow[1].netFinancing).toBe(-25_000);
    expect(f.bridge[1].interestReclassified).toBe(25_000);
    expectReconciled(f);
  });

  it("charges no tax on a loss", () => {
    const f = buildForecast(input({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 100_000, overheads: 200_000 })])),
    }));
    expect(f.pnl[1].tax).toBe(0);
    expect(f.pnl[1].netProfit).toBeLessThan(0);
  });

  it("leaves unpaid tax on the balance sheet", () => {
    const f = buildForecast(input({
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 0, prepaidClosing: 0, accruedClosing: 0 }])),
    }));
    expect(f.cashFlow[1].taxPaid).toBe(0);
    expect(f.balanceSheet[1].taxPayable).toBe(f.pnl[1].tax);
    expect(f.balanceSheet[5].taxPayable).toBeCloseTo(FORECAST_YEARS.reduce((a, y) => a + f.pnl[y].tax, 0), 1);
    expectReconciled(f);
  });

  it("rolls each year's closing cash into the next year's opening", () => {
    const f = buildForecast(input());
    expect(f.cashFlow[1].openingCash).toBe(50_000);
    for (const y of [2, 3, 4, 5]) expect(f.cashFlow[y].openingCash).toBe(f.cashFlow[y - 1].closingCash);
  });

  it("reports which year failed rather than a bare false", () => {
    const f = buildForecast(input());
    expect(f.invariants).toHaveLength(20);
    expect(new Set(f.invariants.map((i) => i.key)).size).toBe(4);
    for (const i of f.invariants) expect(i.label.length).toBeGreaterThan(0);
  });

  /**
   * §6.32.4: the balance sheet came out short by exactly the business's existing bank debt, in every year,
   * because assembleOpening never read it. An opening position that balances has to stay balanced.
   */
  it("carries the opening bank debt, so an opening sheet that balances stays balanced", () => {
    const opening = {
      cash: 80_000, accountsReceivable: 275_000, inventory: 7_000, otherCurrentAssets: 7_148,
      fixedAssets: 129_294, otherNonCurrentAssets: 900,
      accountsPayable: 21_727, bankLoansCurrent: 60_000, bankLoansNonCurrent: 128_823,
      otherCurrentLiabilities: 135_399, otherNonCurrentLiabilities: 635,
      equity: 0, taxPayable: 0, prepaid: 0, accrued: 0,
    };
    // Assets less liabilities is what equity must be for the opening sheet to balance.
    const assets = opening.cash + opening.accountsReceivable + opening.inventory + opening.otherCurrentAssets
      + opening.fixedAssets + opening.otherNonCurrentAssets;
    const liabilities = opening.accountsPayable + opening.bankLoansCurrent + opening.bankLoansNonCurrent
      + opening.otherCurrentLiabilities + opening.otherNonCurrentLiabilities;
    const f = buildForecast(input({ opening: { ...opening, equity: assets - liabilities } }));
    expectReconciled(f);
    expect(f.balanceSheet[1].debtCurrent).toBe(60_000);
    expect(f.balanceSheet[1].debtNonCurrent).toBe(128_823);
  });
});
