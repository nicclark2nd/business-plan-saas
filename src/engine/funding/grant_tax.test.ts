import { describe, expect, it } from "vitest";
import { grantsByYear, grantIsTaxable, type Grant } from "./grants";
import { buildForecast, FORECAST_YEARS, type YearBase } from "../forecast/model";

/**
 * A grant the tax office does not want (§6.74).
 *
 * Every grant in the plan was taxed, and plenty are not: Australian R&D and export grants, disaster and
 * drought relief, a good many state programmes. A client with a 100,000 relief grant was shown a tax bill
 * on money that carries none.
 */
const base = (p: Partial<YearBase> = {}): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, assetAdditions: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  grantsReceived: 0, grantIncome: 0, grantIncomeUntaxed: 0, deferredIncomeCurrent: 0, deferredIncomeNonCurrent: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0, ...p,
});

const opening = { cash: 100_000, accountsReceivable: 0, inventory: 0, accountsPayable: 0, fixedAssets: 0, equity: 100_000,
  taxPayable: 0, prepaid: 0, accrued: 0, otherCurrentAssets: 0, otherNonCurrentAssets: 0, otherCurrentLiabilities: 0,
  otherNonCurrentLiabilities: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0 };

const run = (perYear: (y: number) => Partial<YearBase>, openingTaxLosses = 0) => buildForecast({
  base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base(perYear(y))])),
  opening,
  workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
  cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
  taxRate: 25, dividendRate: 0, openingTaxLosses, openingRetainedEarnings: 0,
});

describe("a grant that is not assessable", () => {
  it("is taxable unless it has been said, in so many words, that it is not", () => {
    expect(grantIsTaxable({ amount: 1 })).toBe(true);
    expect(grantIsTaxable({ amount: 1, taxable: true })).toBe(true);
    expect(grantIsTaxable({ amount: 1, taxable: null })).toBe(true);
    expect(grantIsTaxable({ amount: 1, taxable: false })).toBe(false);
  });

  it("is still income, and still cash, and carries no tax", () => {
    const taxed = run((y) => (y === 1 ? { revenue: 200_000, overheads: 100_000, grantsReceived: 60_000, grantIncome: 60_000 } : {}));
    const exempt = run((y) => (y === 1 ? { revenue: 200_000, overheads: 100_000, grantsReceived: 60_000, grantIncome: 60_000, grantIncomeUntaxed: 60_000 } : {}));

    // Identical in the profit and loss, down to profit before tax.
    expect(exempt.pnl[1].grantIncome).toBe(60_000);
    expect(exempt.pnl[1].profitBeforeTax).toBe(taxed.pnl[1].profitBeforeTax);
    expect(exempt.pnl[1].profitBeforeTax).toBe(160_000);

    // And 15,000 apart in tax — a quarter of the grant, which is the whole point.
    expect(taxed.pnl[1].tax).toBe(40_000);
    expect(exempt.pnl[1].tax).toBe(25_000);
    expect(exempt.pnl[1].netProfit).toBe(135_000);
    expect(exempt.cashFlow[1].grantsReceived).toBe(60_000);
  });

  /**
   * The subtlety, and the reason the exemption is taken out BEFORE the loss pool rather than after.
   *
   * A business losing 100,000 including 50,000 of exempt grant income has a TAX loss of 150,000. Netting
   * the exemption against the loss would leave 100,000 carried forward and quietly tax that 50,000 again in
   * a later year — the exemption would be borrowed, not given.
   */
  it("leaves the whole loss to carry forward, and does not spend the exemption on it", () => {
    const f = run((y) => y === 1
      ? { revenue: 100_000, overheads: 250_000, grantsReceived: 50_000, grantIncome: 50_000, grantIncomeUntaxed: 50_000 }
      : { revenue: 400_000, overheads: 200_000 });

    expect(f.pnl[1].profitBeforeTax).toBe(-100_000);
    expect(f.pnl[1].tax).toBe(0);
    expect(f.pnl[1].lossesCarriedForward).toBe(150_000);       // not 100,000

    // Year 2 earns 200,000 and the whole 150,000 shelters it: tax on 50,000, not on 100,000.
    expect(f.pnl[2].profitBeforeTax).toBe(200_000);
    expect(f.pnl[2].lossRelief).toBe(150_000);
    expect(f.pnl[2].taxableProfit).toBe(50_000);
    expect(f.pnl[2].tax).toBe(12_500);
  });

  it("exempts a deferred grant on the same schedule it is earned on, not when the cash lands", () => {
    const g: Grant = { amount: 60_000, start_year: 1, start_month: 1, recognition_type: "deferred", recognition_period_months: 24, taxable: false };
    const y = grantsByYear([g]);
    expect(y[0].income).toBe(30_000);
    expect(y[0].incomeUntaxed).toBe(30_000);
    expect(y[1].incomeUntaxed).toBe(30_000);
    expect(y[2].incomeUntaxed).toBe(0);
    // The exemption never exceeds the income it belongs to, in any year.
    for (const year of y) expect(year.incomeUntaxed).toBeLessThanOrEqual(year.income + 0.005);
  });

  it("leaves a taxable grant exactly as it was", () => {
    const g: Grant = { amount: 60_000, start_year: 1, start_month: 1, recognition_type: "deferred", recognition_period_months: 24 };
    for (const year of grantsByYear([g])) expect(year.incomeUntaxed).toBe(0);
  });

  it("keeps the three statements agreeing with an exempt grant in them", () => {
    const f = run((y) => y === 1
      ? { revenue: 300_000, variableCogs: 100_000, overheads: 150_000, grantsReceived: 80_000, grantIncome: 80_000, grantIncomeUntaxed: 80_000 }
      : { revenue: 320_000, variableCogs: 110_000, overheads: 160_000 });
    expect(f.invariants.filter((i) => !i.passed).map((i) => i.label)).toEqual([]);
    expect(f.reconciled).toBe(true);
  });
});
