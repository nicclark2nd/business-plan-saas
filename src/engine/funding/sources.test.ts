import { describe, it, expect } from "vitest";
import {
  periodicPayment, loanMonths, loanByYear, loanSummary, rbfCap, rbfCost, rbfMonths,
  fundingTotals, interestByYear, debtByYear, adequacy, type Loan, type FundingSource,
} from "./sources";

// APeX's Citibank row: 200,000 at 5 % over 60 months, amortised, monthly.
const citibank: Loan = {
  lender_name: "Citibank", amount_drawn: 200000, interest_rate: 5, term_months: 60,
  repayment_type: "amortised", payment_frequency: "monthly", start_year: 1, start_month: 1,
};

describe("debt", () => {
  it("prices an amortised loan the way a bank does", () => {
    // 200,000 at 5 % over 60 monthly payments = 3,774.25
    expect(periodicPayment(200000, 5, 60, "monthly")).toBe(3774.25);
  });

  it("repays the loan to zero over its term and charges the right interest", () => {
    const years = loanByYear(citibank);
    expect(years[4].closing).toBe(0);
    const principal = years.reduce((a, y) => a + y.principal, 0);
    expect(Math.round(principal)).toBe(200000);                  // every cent of it comes back
    expect(years[0].interest).toBeCloseTo(9179.9, 1);            // Year 1 interest, to the cent
  });

  it("a balloon buys a smaller payment and is still owing when the plan ends", () => {
    expect(periodicPayment(200000, 5, 60, "monthly", 50000)).toBe(3039.02);   // vs 3,774.25 without one
    const overSeven = { ...citibank, term_months: 84, residual_value: 50000 };
    expect(loanByYear(overSeven)[4].closing).toBeCloseTo(98325, 0);           // the plan ends before the loan does
    const overFive = { ...citibank, residual_value: 50000 };
    expect(loanMonths(overFive)[58].balance).toBeCloseTo(52818.86, 1);        // the balloon, waiting
    expect(loanMonths(overFive)[59].principal).toBeCloseTo(52818.86, 1);      // and paid in the last month
  });

  it("interest-only pays interest all the way and the principal at the end", () => {
    const io = { ...citibank, repayment_type: "interest_only" as const };
    const years = loanByYear(io);
    expect(years[0].principal).toBe(0);
    expect(years[0].interest).toBeCloseTo(9999.96, 1);           // a full 5 % on the whole 200,000
    expect(years[4].closing).toBe(0);                            // repaid at the end of the term
    expect(years[0].closing).toBe(200000);
  });

  it("really does pay 26 times a year when it is fortnightly, and clears just as cleanly", () => {
    const fortnightly = { ...citibank, payment_frequency: "fortnightly" as const };
    const y = loanByYear(fortnightly);
    expect(y[0].payments).toBeGreaterThan(44000);                 // 26 payments, not 12 pretending
    expect(y[4].closing).toBe(0);
    const total = y.reduce((a, x) => a + x.interest, 0);
    expect(total).toBeLessThan(26454.76);                         // principal falls sooner, so it costs less
  });

  it("a line of credit paid as a % of balance never quite clears, and says so", () => {
    const loc: Loan = { amount_drawn: 100000, interest_rate: 25, repayment_type: "pct_of_balance", min_repayment_pct: 2, payment_frequency: "monthly", start_year: 1, start_month: 1, term_months: 0 };
    const years = loanByYear(loc);
    expect(years[0].closing).toBeLessThan(100000);
    expect(years[4].closing).toBeGreaterThan(0);
  });

  it("does not draw the money before the month it arrives", () => {
    const later = { ...citibank, start_year: 2, start_month: 3 };
    const m = loanMonths(later);
    expect(m[0].payment).toBe(0);
    expect(m[13].payment).toBe(0);
    expect(m[14].drawn).toBe(200000);
    expect(loanByYear(later)[0].interest).toBe(0);
  });

  it("shows the dialog the numbers it needs to show back", () => {
    const s = loanSummary(citibank);
    expect(s.payment).toBe(3774.25);
    expect(s.year1Interest).toBeCloseTo(9179.9, 1);
    expect(s.closingYear1).toBeLessThan(200000);
    expect(s.totalInterest).toBeCloseTo(26454.76, 1);
  });

  it("an annual fee is charged on the anniversary, not smeared across the year", () => {
    const withFee = { ...citibank, annual_fee: 300 };
    const m = loanMonths(withFee);
    expect(m[0].payment).toBeCloseTo(loanMonths(citibank)[0].payment + 300, 2);
    expect(m[1].payment).toBeCloseTo(loanMonths(citibank)[1].payment, 2);
    expect(m[0].fees).toBe(300);
    expect(m[0].interest).toBe(loanMonths(citibank)[0].interest);   // a fee is a cost, but it is not interest
  });
});

describe("revenue-linked", () => {
  const rbf = { provider: "Citibank", amount_received: 80000, repayment_percent: 7, cap_multiple: 1.5, min_monthly_payment: 2400, start_year: 1, start_month: 1 };

  it("costs the cap less the principal — the number the client has to see", () => {
    expect(rbfCap(rbf)).toBe(120000);       // APeX's own figures
    expect(rbfCost(rbf)).toBe(40000);
  });

  it("takes its share of revenue and stops dead at the cap", () => {
    const revenue = Array(60).fill(50000);
    const paid = rbfMonths(rbf, revenue);
    expect(paid[0]).toBe(3500);                                  // 7 % of 50,000
    expect(r(paid.reduce((a, b) => a + b, 0))).toBe(120000);      // never a cent over the cap
  });

  it("falls back to the minimum payment in a month with no sales", () => {
    expect(rbfMonths(rbf, Array(60).fill(0))[0]).toBe(2400);
  });
});

const r = (v: number) => Math.round(v * 100) / 100;

describe("the funding picture", () => {
  const sources: FundingSource[] = [
    { id: "a", kind: "owner", name: "Nic Clark", amount: 100000, start_year: 1, start_month: 1 },
    { id: "b", kind: "debt", name: "Citibank", amount: 200000, start_year: 1, start_month: 1, loan: citibank },
    { id: "c", kind: "equity", name: "John Smith", amount: 100000, start_year: 1, start_month: 1, equity_percent: 5 },
    { id: "d", kind: "grant", name: "Export grant", amount: 20000, start_year: 1, start_month: 6 },
  ];

  it("splits the totals the way a lender reads them", () => {
    const t = fundingTotals(sources);
    expect(t.equity).toBe(200000);        // owner capital + the investor
    expect(t.debt).toBe(200000);
    expect(t.grants).toBe(20000);
    expect(t.total).toBe(420000);
  });

  it("sends only the interest to the P&L and only the balance to the balance sheet", () => {
    expect(interestByYear(sources)[0]).toBeCloseTo(9179.9, 1);
    expect(debtByYear(sources)[4]).toBe(0);
  });
});

describe("is it enough", () => {
  const trading = { openingCash: 0, revenueMonths: Array(12).fill(40000), cogsMonths: Array(12).fill(16000), overheadsMonths: Array(12).fill(30000) };

  it("says plainly that the funding does not hold, and by how much", () => {
    const a = adequacy([], trading);
    expect(a.covered).toBe(false);
    expect(a.low.month).toBe(12);                                // it bleeds 6,000 a month
    expect(a.low.closing).toBe(-72000);
    expect(a.shortfall).toBe(72000);
  });

  it("clears once there is enough money in, and names the tightest month", () => {
    const owner: FundingSource[] = [{ id: "o", kind: "owner", name: "Owner", amount: 100000, start_year: 1, start_month: 1 }];
    const a = adequacy(owner, trading);
    expect(a.covered).toBe(true);
    expect(a.shortfall).toBe(0);
    expect(a.low.closing).toBe(28000);
  });

  it("counts the loan repayments against the cash, not just the money it brought in", () => {
    const withLoan: FundingSource[] = [{ id: "b", kind: "debt", name: "Citibank", amount: 200000, start_year: 1, start_month: 1, loan: citibank }];
    const a = adequacy(withLoan, trading);
    const noRepayments = 200000 - 72000;
    expect(a.months[11].closing).toBeLessThan(noRepayments);      // a year of repayments is really gone
    expect(a.covered).toBe(true);
  });
});
