import { describe, expect, it } from "vitest";
import { grantsByYear, grantsMonths, type Grant } from "./grants";
import { FORECAST_YEARS, buildForecast, type YearBase } from "../forecast/model";

const g = (o: Partial<Grant>): Grant => ({ amount: 0, start_year: 1, start_month: 1, recognition_type: "immediate", ...o });

describe("grants", () => {
  it("an immediate grant is earned the month it arrives, and owes nothing afterwards", () => {
    const y = grantsByYear([g({ amount: 60_000, recognition_type: "immediate" })]);
    expect(y[0].received).toBe(60_000);
    expect(y[0].income).toBe(60_000);
    expect(y[0].deferredClosing).toBe(0);
    expect(y.slice(1).every((x) => x.income === 0 && x.received === 0)).toBe(true);
  });

  it("a deferred grant is earned evenly, and what is not earned yet is a liability", () => {
    // 60,000 over 24 months from month 1: half earned in Year 1, and the other half owed to Year 2.
    const y = grantsByYear([g({ amount: 60_000, recognition_type: "deferred", recognition_period_months: 24 })]);
    expect(y[0].received).toBe(60_000);                  // all the cash arrives at once
    expect(y[0].income).toBe(30_000);                    // half of it is earned
    expect(y[0].deferredClosing).toBe(30_000);
    expect(y[0].deferredCurrent).toBe(30_000);           // the next twelve months earn all of it
    expect(y[0].deferredNonCurrent).toBe(0);
    expect(y[1].income).toBe(30_000);
    expect(y[1].received).toBe(0);                       // the cash came last year; only the income is new
    expect(y[1].deferredClosing).toBe(0);
  });

  it("splits the liability by when it will be earned, not evenly", () => {
    // 36,000 over 36 months: a third earned, and of the two thirds left only half lands within a year.
    const [y1] = grantsByYear([g({ amount: 36_000, recognition_type: "deferred", recognition_period_months: 36 })]);
    expect(y1.income).toBe(12_000);
    expect(y1.deferredClosing).toBe(24_000);
    expect(y1.deferredCurrent).toBe(12_000);
    expect(y1.deferredNonCurrent).toBe(12_000);
  });

  it("is still a liability at the end of the plan when it is earned beyond it", () => {
    // Ten years of recognition: five years in, half is earned and half is still owed to the future.
    const y = grantsByYear([g({ amount: 120_000, recognition_type: "deferred", recognition_period_months: 120 })]);
    expect(y[4].deferredClosing).toBe(60_000);
    expect(y[4].deferredCurrent).toBe(12_000);           // the twelve months after Year 5, answered honestly
    expect(y[4].deferredNonCurrent).toBe(48_000);
  });

  it("arrives when the grant says, not in Year 1", () => {
    const y = grantsByYear([g({ amount: 50_000, start_year: 3, start_month: 7 })]);
    expect(y[0].received + y[1].received).toBe(0);
    expect(y[2].received).toBe(50_000);
    expect(y[2].income).toBe(50_000);
  });

  it("a deferred grant with no period entered falls back to a year rather than dividing by nothing", () => {
    const [y1] = grantsByYear([g({ amount: 12_000, recognition_type: "deferred", recognition_period_months: null })]);
    expect(y1.income).toBe(12_000);                      // twelve months from month 1 is all of Year 1
    expect(y1.deferredClosing).toBe(0);
  });

  it("the twelve months add to the year, for cash and for income alike", () => {
    const grants = [
      g({ amount: 60_000, recognition_type: "deferred", recognition_period_months: 24, start_month: 4 }),
      g({ amount: 20_000, recognition_type: "immediate", start_month: 9 }),
    ];
    const m = grantsMonths(grants);
    const [y1] = grantsByYear(grants);
    const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
    expect(sum(m.received)).toBe(y1.received);
    expect(sum(m.earned)).toBe(y1.income);
    expect(m.received[3]).toBe(60_000);                  // month 4
    expect(m.received[8]).toBe(20_000);                  // month 9
  });

  it("ignores a grant with no money in it", () => {
    const y = grantsByYear([g({ amount: 0 }), g({ amount: null })]);
    expect(y.every((x) => x.received === 0 && x.income === 0 && x.deferredClosing === 0)).toBe(true);
  });
});

/**
 * The point of all of it: a grant must reach the statements as income and a liability, and the statements
 * must still agree with each other afterwards. The old treatment passed every check while being wrong —
 * cash up, equity up, balance sheet perfectly balanced around a grant that had become share capital.
 */
const base = (p: Partial<YearBase> = {}): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, assetAdditions: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  grantsReceived: 0, grantIncome: 0, deferredIncomeCurrent: 0, deferredIncomeNonCurrent: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0, ...p,
});

describe("a grant in the forecast", () => {
  const grant: Grant = { amount: 60_000, start_year: 1, start_month: 1, recognition_type: "deferred", recognition_period_months: 24 };
  const years = grantsByYear([grant]);
  const forecast = buildForecast({
    base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({
      revenue: 400_000, variableCogs: 150_000, overheads: 200_000,
      grantsReceived: years[y - 1].received, grantIncome: years[y - 1].income,
      deferredIncomeCurrent: years[y - 1].deferredCurrent, deferredIncomeNonCurrent: years[y - 1].deferredNonCurrent,
    })])),
    opening: { cash: 50_000, accountsReceivable: 0, inventory: 0, accountsPayable: 0, fixedAssets: 0, equity: 50_000,
      taxPayable: 0, otherCurrentAssets: 0, otherNonCurrentAssets: 0, otherCurrentLiabilities: 0,
      otherNonCurrentLiabilities: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0 },
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 25, dividendRate: 0, openingTaxLosses: 0, openingRetainedEarnings: 0,
  });

  it("puts the EARNED slice in the profit and loss, not the cash", () => {
    expect(forecast.pnl[1].grantIncome).toBe(30_000);
    expect(forecast.pnl[2].grantIncome).toBe(30_000);
    expect(forecast.pnl[3].grantIncome).toBe(0);
    // Below operating profit, so how the trade is doing is read without the grant flattering it.
    expect(forecast.pnl[1].operatingProfit).toBe(50_000);
    expect(forecast.pnl[1].profitBeforeTax).toBe(80_000);
  });

  it("puts the cash in OPERATING, all of it, in the year it arrives", () => {
    expect(forecast.cashFlow[1].grantsReceived).toBe(60_000);
    expect(forecast.cashFlow[2].grantsReceived).toBe(0);
    expect(forecast.cashFlow[1].equityRaised).toBe(0);      // it is not money raised
  });

  it("carries what is not yet earned as a liability, split by when it will be", () => {
    expect(forecast.balanceSheet[1].deferredIncomeCurrent).toBe(30_000);
    expect(forecast.balanceSheet[1].deferredIncomeNonCurrent).toBe(0);
    expect(forecast.balanceSheet[2].deferredIncomeCurrent).toBe(0);
  });

  it("does not turn a grant into share capital", () => {
    // Equity moves only by profit. The grant reaches it through the P&L as it is earned, never directly.
    const movement = forecast.balanceSheet[1].equity - 50_000;
    expect(movement).toBeCloseTo(forecast.pnl[1].netProfit, 2);
  });

  it("still reconciles — every invariant, every year", () => {
    expect(forecast.reconciled).toBe(true);
    expect(forecast.invariants.every((i) => i.passed)).toBe(true);
    for (const y of FORECAST_YEARS) expect(forecast.balanceSheet[y].balanceCheck).toBeCloseTo(0, 2);
  });

  it("taxes it as income, in the year it is earned", () => {
    // 30,000 of grant income at 25 % is 7,500 of tax that the old treatment never charged.
    const withoutGrant = buildForecast({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 400_000, variableCogs: 150_000, overheads: 200_000 })])),
      opening: { cash: 50_000, accountsReceivable: 0, inventory: 0, accountsPayable: 0, fixedAssets: 0, equity: 50_000,
        taxPayable: 0, otherCurrentAssets: 0, otherNonCurrentAssets: 0, otherCurrentLiabilities: 0,
        otherNonCurrentLiabilities: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0 },
      workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
      taxRate: 25, dividendRate: 0, openingTaxLosses: 0, openingRetainedEarnings: 0,
    });
    expect(forecast.pnl[1].tax - withoutGrant.pnl[1].tax).toBeCloseTo(7_500, 2);
  });
});
