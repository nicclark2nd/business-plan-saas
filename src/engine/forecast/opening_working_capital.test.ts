import { describe, expect, it } from "vitest";
import { FORECAST_YEARS, buildForecast, type ForecastInput, type OpeningBalance, type YearBase } from "./model";

/**
 * The balance the business already carries (§6.66).
 *
 * Prepayments and accruals are entered as CLOSING balances and the cash flow moves on the change in them.
 * They used to open from zero while every other working-capital balance opened from the last historic
 * period, so a business that has always paid its insurance a year ahead was shown paying that half-premium
 * a second time in Year 1, out of cash that left the bank before the plan started.
 *
 * "The statements agree" never caught it: the cash-flow bridge reconciles against the same movement, so the
 * plan agreed with itself about the wrong number. Only a test that knows what the cash SHOULD be catches it.
 */
const base = (p: Partial<YearBase> = {}): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, assetAdditions: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  grantsReceived: 0, grantIncome: 0, deferredIncomeCurrent: 0, deferredIncomeNonCurrent: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0, ...p,
});

/**
 * Equity is DERIVED from the rest, never typed, so the opening balance sheet balances whatever a test puts
 * on it. Hard-coding it to the cash figure is how the first draft of this file "found" five broken
 * invariants that were the fixture's fault rather than the engine's.
 */
const opening = (p: Partial<OpeningBalance> = {}): OpeningBalance => {
  const o = {
    cash: 200_000, accountsReceivable: 0, inventory: 0, otherCurrentAssets: 0, prepaid: 0, accrued: 0,
    fixedAssets: 0, otherNonCurrentAssets: 0, accountsPayable: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0,
    otherCurrentLiabilities: 0, otherNonCurrentLiabilities: 0, taxPayable: 0, equity: 0, ...p,
  };
  const assets = o.cash + o.accountsReceivable + o.inventory + o.otherCurrentAssets + o.prepaid + o.fixedAssets + o.otherNonCurrentAssets;
  const liabilities = o.accountsPayable + o.accrued + o.bankLoansCurrent + o.bankLoansNonCurrent
    + o.otherCurrentLiabilities + o.otherNonCurrentLiabilities + o.taxPayable;
  return { ...o, equity: p.equity ?? assets - liabilities };
};

/** No trading at all, so every movement in cash is the one thing under test. */
const plan = (over: Partial<ForecastInput> = {}): ForecastInput => ({
  base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base()])),
  opening: opening(),
  workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
  cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
  taxRate: 0, dividendRate: 0,
  ...over,
});

const everyYear = <T,>(v: T) => Object.fromEntries(FORECAST_YEARS.map((y) => [y, v])) as Record<number, T>;
const reconciled = (f: ReturnType<typeof buildForecast>) => {
  expect(f.invariants.filter((i) => !i.passed).map((i) => `${i.key} Y${i.year}`)).toEqual([]);
  return f;
};

describe("opening prepayments and accruals", () => {
  it("costs nothing in Year 1 to carry a prepayment the business already had", () => {
    const carried = { taxPaidPct: 100, prepaidClosing: 12_000, accruedClosing: 0 };
    const f = reconciled(buildForecast(plan({
      opening: opening({ prepaid: 12_000 }),
      cashTiming: everyYear(carried) as ForecastInput["cashTiming"],
    })));
    // The balance is unchanged all the way through, so it never touches cash — in any year.
    for (const y of FORECAST_YEARS) expect(f.cashFlow[y].netOperating).toBe(0);
    expect(f.balanceSheet[1].cash).toBe(200_000);
    expect(f.balanceSheet[1].prepaid).toBe(12_000);
  });

  it("charged Year 1 twice before the opening balance existed — the bug this fixes", () => {
    const carried = { taxPaidPct: 100, prepaidClosing: 12_000, accruedClosing: 0 };
    const wrong = buildForecast(plan({
      opening: opening({ prepaid: 0 }),                       // what the engine used to assume, always
      cashTiming: everyYear(carried) as ForecastInput["cashTiming"],
    }));
    // Establishing the balance from nothing costs a full 12,000 of cash the business never actually pays.
    expect(wrong.cashFlow[1].netOperating).toBe(-12_000);
    expect(wrong.reconciled).toBe(true);                       // and it balanced perfectly while being wrong
  });

  it("does not hand the business cash it does not have, on the accrual side", () => {
    const carried = { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 8_000 };
    const f = reconciled(buildForecast(plan({
      opening: opening({ accrued: 8_000 }),
      cashTiming: everyYear(carried) as ForecastInput["cashTiming"],
    })));
    for (const y of FORECAST_YEARS) expect(f.cashFlow[y].netOperating).toBe(0);
    expect(f.balanceSheet[1].accrued).toBe(8_000);
  });

  it("still charges a REAL increase, and releases a real unwind", () => {
    const f = reconciled(buildForecast(plan({
      opening: opening({ prepaid: 12_000 }),
      cashTiming: {
        1: { taxPaidPct: 100, prepaidClosing: 20_000, accruedClosing: 0 },   // paid 8,000 more in advance
        2: { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 },        // let the whole thing unwind
        3: { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 },
        4: { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 },
        5: { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 },
      } as ForecastInput["cashTiming"],
    })));
    expect(f.cashFlow[1].netOperating).toBe(-8_000);
    expect(f.cashFlow[2].netOperating).toBe(20_000);
    expect(f.cashFlow[3].netOperating).toBe(0);
  });

  it("keeps the three statements agreeing with an opening balance in place", () => {
    reconciled(buildForecast(plan({
      base: Object.fromEntries(FORECAST_YEARS.map((y) => [y, base({ revenue: 1_400_000, variableCogs: 500_000, overheads: 600_000, depreciation: 20_000 })])),
      opening: opening({ prepaid: 12_000, accrued: 8_000, accountsReceivable: 150_000, accountsPayable: 90_000 }),
      workingCapital: everyYear({ debtorDays: 46, inventoryDays: 2, creditorDays: 6 }) as ForecastInput["workingCapital"],
      cashTiming: everyYear({ taxPaidPct: 60, prepaidClosing: 12_000, accruedClosing: 8_000 }) as ForecastInput["cashTiming"],
      taxRate: 25,
    })));
  });
});
