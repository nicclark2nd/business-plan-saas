import { describe, it, expect } from "vitest";
import { existingDebt, existingDebtFromHistory, readExistingTerms } from "./existing";
import { assembleBase } from "../forecast/assemble";
import { FORECAST_YEARS, buildForecast } from "../forecast/model";
import { loanByYear } from "./sources";

/* SEQ Concreting, Period 1 and 2 of Historic. */
const seq = { current: 98_849, nonCurrent: 89_974, interestPaid: 18_638, priorTotal: 172_000 };

describe("the loans already owed, read from Historic (§6.150)", () => {
  it("works out SEQ's rate, term and repayment with nothing asked", () => {
    const d = existingDebt(seq, null)!;
    expect(d.total).toBe(188_823);
    expect(d.rate).toMatchObject({ value: 10.33, from: "historic", interestPaid: 18_638 });
    expect(d.term).toEqual({ value: 23, from: "historic" });
    expect(d.repayment).toEqual({ value: "amortised", from: "historic" });
    expect(d.source).toMatchObject({ kind: "debt", amount: 0, existing: true, loan: { amount_drawn: 188_823, interest_rate: 10.33, term_months: 23 } });
  });
  it("lets the client's figure stand in place of the worked-out one", () => {
    const d = existingDebt(seq, { interest_rate: 8, term_months: 36 })!;
    expect(d.rate).toMatchObject({ value: 8, from: "entered" });
    expect(d.term).toEqual({ value: 36, from: "entered" });
  });
  it("asks for the rate only when there is no interest to read it from", () => {
    const d = existingDebt({ ...seq, interestPaid: null }, null)!;
    expect(d.rate).toMatchObject({ value: null, from: "missing" });
    expect(d.source).toBeNull();
  });
  it("reads nothing falling due as interest only, running past the plan", () => {
    const d = existingDebt({ current: 0, nonCurrent: 50_000, interestPaid: 4_000, priorTotal: 50_000 }, null)!;
    expect(d.repayment.value).toBe("interest_only");
    expect(d.source?.loan?.term_months).toBe(61);
  });
  it("is nothing when there is no debt", () => expect(existingDebt({ current: 0, nonCurrent: 0, interestPaid: 5, priorTotal: 0 }, null)).toBeNull());
});

describe("the forecast carries them once, and they run down (§6.150)", () => {
  const existing = existingDebt(seq, null)!.source!;
  const sources = { products: [], costProducts: [], fixedCogs: [], overheads: [], salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0], onCostPct: 0, funding: [existing], assets: [], extraordinary: [] };
  const opening = {
    cash: 300_000, accountsReceivable: 0, inventory: 0, otherCurrentAssets: 0, fixedAssets: 0, otherNonCurrentAssets: 0,
    accountsPayable: 0, bankLoansCurrent: 98_849, bankLoansNonCurrent: 89_974, otherCurrentLiabilities: 0, otherNonCurrentLiabilities: 0,
    equity: 300_000 - 188_823, taxPayable: 0, prepaid: 0, accrued: 0, bankLoansModelled: true,
  };
  const f = buildForecast({
    base: assembleBase(sources as never), opening,
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
    taxRate: 25, dividendRate: 0,
  });
  const sched = loanByYear(existing.loan!);

  it("charges its interest and books no fresh cash", () => {
    expect(f.pnl[1].interest).toBeCloseTo(sched[0].interest, 1);
    expect(f.cashFlow[1].debtProceeds).toBe(0);
    expect(f.cashFlow[1].debtRepaid).toBeCloseTo(sched[0].principal, 1);
  });
  it("owes what the schedule says is left — not that plus the opening balance", () => {
    const owed = (y: number) => f.balanceSheet[y].debtCurrent + f.balanceSheet[y].debtNonCurrent;
    expect(owed(1)).toBeCloseTo(sched[0].closing, 1);
    expect(owed(2)).toBeCloseTo(0, 1);
  });
  it("still balances in every year", () => {
    expect(f.invariants.filter((i) => !i.passed).map((i) => `${i.key} Y${i.year} ${i.difference}`)).toEqual([]);
  });
});

describe("existingDebtFromHistory — the one reading both the forecast and Funding use", () => {
  const rows = [
    { period_number: 1, bank_loans_current: 98849, bank_loans_non_current: 89974, interest_paid: 18638 },
    { period_number: 2, bank_loans_current: 60000, bank_loans_non_current: 112000, interest_paid: 15000 },
  ];
  it("reads Period 1's balance and Period 2's for the average", () => {
    const d = existingDebtFromHistory(rows, null)!;
    expect(d.total).toBe(188823);
    expect(d.rate.averageBalance).toBe(180411.5);
    expect(d.rate.from).toBe("historic");
  });
  it("takes stored changes, and ignores anything in the jsonb that is not a clean value", () => {
    const d = existingDebtFromHistory(rows, { interest_rate: 7.5, term_months: "lots", repayment_type: "balloon" })!;
    expect(d.rate).toMatchObject({ value: 7.5, from: "entered" });
    expect(d.term.from).toBe("historic");
    expect(d.repayment.from).toBe("historic");
  });
  it("is null with no Historic, or no loans on it", () => {
    expect(existingDebtFromHistory([], null)).toBeNull();
    expect(existingDebtFromHistory([{ period_number: 1, bank_loans_current: 0, bank_loans_non_current: null, interest_paid: 500 }], null)).toBeNull();
  });
  it("readExistingTerms turns anything odd into 'not changed'", () => {
    expect(readExistingTerms(null)).toEqual({ interest_rate: null, term_months: null, repayment_type: null });
    expect(readExistingTerms({ interest_rate: 9, repayment_type: "interest_only" })).toEqual({ interest_rate: 9, term_months: null, repayment_type: "interest_only" });
  });
});
