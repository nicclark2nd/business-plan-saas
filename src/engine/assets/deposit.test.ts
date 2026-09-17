import { describe, expect, it } from "vitest";
import { FORECAST_YEARS, buildForecast, type YearBase } from "../forecast/model";

/**
 * A financed asset with a deposit (§6.52).
 *
 * Nothing in the engine knows the word "deposit". It does not need to: the price of the thing and the size
 * of the advance are read from two different places — the asset and the loan — and the gap between them
 * simply is cash that left the business. This proves it, because the whole design rests on it.
 */
const base = (p: Partial<YearBase> = {}): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, assetAdditions: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  grantsReceived: 0, grantIncome: 0, deferredIncomeCurrent: 0, deferredIncomeNonCurrent: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0, ...p,
});

/**
 * Year 1 buys the van; the later years carry the loan still owed and keep writing the van down. Leaving the
 * debt off the later years is what a fixture does and a plan never can — the balance sheet then holds the
 * borrowed cash with nothing owed against it, and the invariant says so, loudly.
 */
const run = (y1: Partial<YearBase>, owed: number) => buildForecast({
  base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, y === 1 ? base(y1) : base({ debtNonCurrent: owed, depreciation: 18_000 })])),
  opening: { cash: 200_000, accountsReceivable: 0, inventory: 0, accountsPayable: 0, fixedAssets: 0, equity: 200_000,
    taxPayable: 0, prepaid: 0, accrued: 0, otherCurrentAssets: 0, otherNonCurrentAssets: 0, otherCurrentLiabilities: 0,
    otherNonCurrentLiabilities: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0 },
  workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
  cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
  taxRate: 0, dividendRate: 0, openingTaxLosses: 0, openingRetainedEarnings: 0,
});

describe("a van bought on finance with money down", () => {
  // A 90,000 van: 10,000 of the business's own money, 80,000 from the lender.
  const f = run({ capex: 90_000, assetAdditions: 90_000, debtProceeds: 80_000, debtNonCurrent: 80_000, depreciation: 18_000 }, 80_000);

  it("pays the supplier the whole price and takes back only what was borrowed", () => {
    expect(f.cashFlow[1].capex).toBe(90_000);          // the supplier is paid in full
    expect(f.cashFlow[1].debtProceeds).toBe(80_000);   // the lender advances its part
    expect(f.cashFlow[1].netInvesting).toBe(-90_000);
    expect(f.cashFlow[1].netFinancing).toBe(80_000);
  });

  it("leaves the business out of pocket by exactly the deposit", () => {
    expect(f.cashFlow[1].netMovement).toBe(-10_000);
    expect(f.balanceSheet[1].cash).toBe(190_000);
  });

  it("puts the whole van on the books, not just the financed part", () => {
    expect(f.balanceSheet[1].fixedAssets).toBe(72_000);   // 90,000 less a year's depreciation
    expect(f.balanceSheet[1].debtNonCurrent).toBe(80_000);
    expect(f.balanceSheet[1].balanceCheck).toBeCloseTo(0, 2);
    expect(f.reconciled).toBe(true);
  });

  it("is the same plan as financing it in full, less the deposit", () => {
    const whole = run({ capex: 90_000, assetAdditions: 90_000, debtProceeds: 90_000, debtNonCurrent: 90_000, depreciation: 18_000 }, 90_000);
    expect(whole.cashFlow[1].netMovement).toBe(0);      // nothing down: borrowed in, paid out, net nil
    expect(whole.balanceSheet[1].fixedAssets).toBe(f.balanceSheet[1].fixedAssets);
    expect(whole.balanceSheet[1].cash - f.balanceSheet[1].cash).toBe(10_000);
  });
});
