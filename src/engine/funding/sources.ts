/**
 * Funding — where the money comes from, and whether it is enough (§6.20).
 *
 * APeX lists five kinds of funding on five tabs and adds them up: "Total Funding Raised: $820,108". That
 * number has nothing to be measured against, so the screen never answers the only question a lender, an SBA
 * reviewer or the owner actually has — does this business run out of money, and when? We build Funding after
 * Sales, COGS and Overheads precisely so it can answer that.
 *
 * Every source is one row in one list. A debt row is the only one that keeps costing after it arrives, so it
 * is the only one with a schedule: repayments out, interest to the P&L, closing balance to the balance sheet.
 */
import { YEARS } from "../sales/projection";
import type { Grant } from "./grants";
import type { Facility } from "./overdraft";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type FundingKind = "owner" | "debt" | "equity" | "grant" | "revenue_linked";
export type RepaymentType = "amortised" | "interest_only" | "pct_of_balance";
export type PaymentFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly";

export const PERIODS_PER_YEAR: Record<PaymentFrequency, number> = {
  weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4,
};

export type Loan = {
  id?: string;
  lender_name?: string;
  amount_drawn: number | null;          // what is actually borrowed; a facility may be larger
  total_facility_amount?: number | null;
  interest_rate: number | null;         // annual, per cent
  term_months?: number | null;
  repayment_type?: RepaymentType | null;
  payment_frequency?: PaymentFrequency | null;
  residual_value?: number | null;       // balloon at the end
  min_repayment_pct?: number | null;    // for a line of credit paid down as a % of balance
  start_year?: number | null;           // 1–5
  start_month?: number | null;          // 1–12 within that year
  annual_fee?: number | null;
  /**
   * Which kind of debt this is (§6.72). It reached the engine as a label and nothing else until the sweep
   * existed, which is exactly how "Overdraft / line of credit" ended up behaving as a term loan.
   */
  loan_type?: string | null;
};

/**
 * A facility is not a loan with a schedule, so it has none (§6.72).
 *
 * `loanMonths` is the single gate every balance, every year total and every monthly series funnels through
 * — `loanByYear`, `debtByYear`, `debtSplitByYear`, `assembleBase` and `assembleMonths` all arrive here. One
 * early return keeps a facility out of all of them, rather than ten call sites each remembering to ask.
 * What it owes, what it costs and what it repays come from the sweep instead.
 */
export const isFacility = (l: Loan | null | undefined) => l?.loan_type === "line_of_credit";

const startYear = (l: { start_year?: number | null }) => Math.min(5, Math.max(1, Math.trunc(num(l.start_year)) || 1));
const startMonth = (l: { start_month?: number | null }) => Math.min(12, Math.max(1, Math.trunc(num(l.start_month)) || 1));
export const drawMonth = (l: Loan) => (startYear(l) - 1) * 12 + (startMonth(l) - 1);

/**
 * The regular payment on an amortised loan, with a balloon left at the end.
 *
 *   payment = (P - B/(1+r)^n) · r / (1 - (1+r)^-n)
 *
 * At a zero rate that formula divides by nothing, so the balance is simply spread over the term.
 */
export function periodicPayment(principal: number, annualRatePct: number, termMonths: number, frequency: PaymentFrequency, balloon = 0): number {
  const P = num(principal), B = Math.min(Math.max(0, num(balloon)), P);
  const per = PERIODS_PER_YEAR[frequency] ?? 12;
  const n = Math.max(1, Math.round((Math.max(1, num(termMonths)) / 12) * per));
  const r = num(annualRatePct) / 100 / per;
  if (r === 0) return r2((P - B) / n);
  const disc = Math.pow(1 + r, -n);
  return r2(((P - B * disc) * r) / (1 - disc));
}

export type LoanMonth = { interest: number; principal: number; fees: number; payment: number; balance: number; drawn: number };

/**
 * The loan month by month across the five plan years. Payments are computed at their own frequency —
 * a fortnightly loan really does pay 26 times a year, and pretending otherwise understates the interest —
 * then landed in the month they fall in.
 */
export function loanMonths(l: Loan): LoanMonth[] {
  const out: LoanMonth[] = Array.from({ length: 60 }, () => ({ interest: 0, principal: 0, fees: 0, payment: 0, balance: 0, drawn: 0 }));
  if (isFacility(l)) return out;                  // swept, not scheduled (§6.72)
  const P = num(l.amount_drawn);
  const from = drawMonth(l);
  if (P <= 0 || from >= 60) return out;

  const freq = (l.payment_frequency ?? "monthly") as PaymentFrequency;
  const per = PERIODS_PER_YEAR[freq] ?? 12;
  const type = l.repayment_type ?? "amortised";
  const term = Math.max(1, Math.trunc(num(l.term_months)) || 60);
  const rate = num(l.interest_rate) / 100 / per;
  const balloon = Math.min(Math.max(0, num(l.residual_value)), P);
  const payment = type === "amortised" ? periodicPayment(P, num(l.interest_rate), term, freq, balloon) : 0;
  const periods = Math.max(1, Math.round((term / 12) * per));

  let balance = P;
  out[from].drawn = r2(P);
  // Payment k falls due at the END of period k, which is k/per years after the money is drawn. The loan is
  // drawn at the start of its month, so the first monthly payment belongs to that same month — not the next.
  // Getting this one month wrong drops a payment out of Year 1 and understates the interest by ~8 %.
  const lastPeriod = Math.ceil(((60 - from) * per) / 12);
  for (let k = 1; k <= lastPeriod && balance > 0.005; k++) {
    const m = from + Math.ceil((k * 12) / per) - 1;
    if (m >= 60) break;
    const interest = r2(balance * rate);
    let principal = 0;
    if (type === "amortised") {
      principal = k >= periods ? balance : Math.min(r2(payment - interest), balance);
      if (principal < 0) principal = 0;                       // rate above the payment: interest-only in effect
    } else if (type === "interest_only") {
      principal = k >= periods ? balance : 0;
    } else {                                                   // a line of credit paid down as a % of balance
      const pct = num(l.min_repayment_pct) / 100;
      principal = pct > 0 ? Math.min(r2(balance * pct), balance) : 0;
      if (k >= periods && num(l.term_months)) principal = balance;
    }
    balance = r2(balance - principal);
    out[m].interest = r2(out[m].interest + interest);
    out[m].principal = r2(out[m].principal + principal);
    out[m].payment = r2(out[m].payment + interest + principal);
  }

  // The annual fee is a real cost of the facility and belongs on the anniversary, not spread. It is a
  // financing cost, not interest — the P&L wants them apart and so does anyone reading the loan back.
  const fee = num(l.annual_fee);
  if (fee > 0) for (let m = from; m < 60; m += 12) { out[m].fees = r2(out[m].fees + fee); out[m].payment = r2(out[m].payment + fee); }

  let running = P;
  for (let m = 0; m < 60; m++) {
    if (m < from) { out[m].balance = 0; continue; }
    running = r2(running - out[m].principal);
    out[m].balance = running;
  }
  return out;
}

export type LoanYear = { year: number; interest: number; principal: number; fees: number; payments: number; closing: number };

export function loanByYear(l: Loan): LoanYear[] {
  const m = loanMonths(l);
  return YEARS.map((year, i) => {
    const slice = m.slice(i * 12, i * 12 + 12);
    return {
      year,
      interest: r2(slice.reduce((a, x) => a + x.interest, 0)),
      principal: r2(slice.reduce((a, x) => a + x.principal, 0)),
      fees: r2(slice.reduce((a, x) => a + x.fees, 0)),
      payments: r2(slice.reduce((a, x) => a + x.payment, 0)),
      closing: slice[11]?.balance ?? 0,
    };
  });
}

/** The one line a Debt dialog shows back: what it costs, and where it ends up. */
export function loanSummary(l: Loan) {
  const freq = (l.payment_frequency ?? "monthly") as PaymentFrequency;
  const years = loanByYear(l);
  const months = loanMonths(l);
  return {
    payment: l.repayment_type === "amortised"
      ? periodicPayment(num(l.amount_drawn), num(l.interest_rate), num(l.term_months) || 60, freq, num(l.residual_value))
      : l.repayment_type === "interest_only"
        ? r2(num(l.amount_drawn) * (num(l.interest_rate) / 100 / (PERIODS_PER_YEAR[freq] ?? 12)))
        : r2(num(l.amount_drawn) * (num(l.min_repayment_pct) / 100)),
    frequency: freq,
    year1Interest: years[0].interest,
    year1Payments: years[0].payments,
    closingYear1: years[0].closing,
    totalInterest: r2(months.reduce((a, x) => a + x.interest, 0)),
  };
}

/* ------------------------------------------------------------------ *
 * Revenue-linked finance                                              *
 * ------------------------------------------------------------------ */

export type RevenueLinked = {
  id?: string; provider?: string;
  amount_received: number | null;
  repayment_percent: number | null;     // per cent of revenue
  cap_multiple: number | null;          // repay this many times the principal, then it stops
  min_monthly_payment?: number | null;
  start_year?: number | null; start_month?: number | null;
};

/** Repayment cap — what the money really costs, which is the number the dialog shows back. */
export const rbfCap = (r: RevenueLinked) => r2(num(r.amount_received) * (num(r.cap_multiple) || 1));
export const rbfCost = (r: RevenueLinked) => r2(rbfCap(r) - num(r.amount_received));

/** Revenue-linked repayments follow the sales, and stop dead once the cap is repaid. */
export function rbfMonths(r: RevenueLinked, revenueMonths: number[]): number[] {
  const out = Array(60).fill(0);
  const cap = rbfCap(r);
  if (cap <= 0) return out;
  const from = (Math.max(1, num(r.start_year) || 1) - 1) * 12 + (Math.max(1, num(r.start_month) || 1) - 1);
  const pct = num(r.repayment_percent) / 100;
  const min = num(r.min_monthly_payment);
  let paid = 0;
  for (let m = from; m < 60 && paid < cap; m++) {
    const share = r2(num(revenueMonths[m]) * pct);
    const due = Math.max(share, min);
    const pay = Math.min(r2(due), r2(cap - paid));
    out[m] = pay; paid = r2(paid + pay);
  }
  return out;
}

export type RbfMonth = { payment: number; principal: number; cost: number; balance: number };

/**
 * Revenue-linked finance, split the way a balance sheet needs it (§6.37).
 *
 * The money is real debt: it arrives in the bank, it is repaid, and until it is repaid the business owes it.
 * None of that reached the forecast, because every function that feeds it asked for `s.loan` and a
 * revenue-linked source has `s.rbf` — so the cash came in, was never repaid, never appeared as a liability,
 * and the balance sheet came out over by the full amount in every year.
 *
 * **Each payment is split by the cap ratio**: a 1.4x cap means 1/1.4 of every dollar repaid retires the
 * principal and the rest is the cost of the money. That is not the easy answer, it is the only honest one —
 * the repayment stream follows future sales, so unlike a loan there is no term and no rate to amortise
 * against, and nothing about the deal is knowable on day one except the cap. Splitting on it retires the
 * balance to exactly zero at exactly the moment the cap is reached.
 *
 * The last payment absorbs any rounding into its cost rather than its principal, so the liability lands on
 * nil rather than on a few cents that would sit on the balance sheet forever.
 */
export function rbfSplitMonths(r: RevenueLinked, revenueMonths: number[]): RbfMonth[] {
  const out: RbfMonth[] = Array.from({ length: 60 }, () => ({ payment: 0, principal: 0, cost: 0, balance: 0 }));
  const drawn = num(r.amount_received);
  const cap = rbfCap(r);
  if (drawn <= 0 || cap <= 0) return out;

  const from = (Math.max(1, num(r.start_year) || 1) - 1) * 12 + (Math.max(1, num(r.start_month) || 1) - 1);
  const pay = rbfMonths(r, revenueMonths);
  const principalShare = drawn / cap;

  // Which payment settles it. Splitting every month at the cap ratio and rounding leaves a few cents of
  // principal behind — a liability of 0.10 sitting on the balance sheet forever, long after the deal is
  // done. The payment that exhausts the cap retires whatever is left and takes the difference on its cost.
  // If sales never reach the cap inside the plan, there is no such payment and the balance genuinely stays.
  const capExhausted = Math.abs(r2(pay.reduce((a, b) => a + num(b), 0)) - cap) < 0.005;
  const lastPayment = pay.reduce((last, v, i) => (num(v) > 0 ? i : last), -1);

  let balance = 0;
  for (let i = 0; i < 60; i++) {
    if (i === from) balance = drawn;                       // the month the money lands
    const payment = i >= from ? r2(num(pay[i])) : 0;
    const principal = capExhausted && i === lastPayment
      ? balance
      : Math.min(r2(payment * principalShare), balance);
    balance = r2(balance - principal);
    out[i] = { payment, principal, cost: r2(payment - principal), balance };
  }
  return out;
}

export type RbfYear = { year: number; principal: number; cost: number; closing: number };

/** The five years of a revenue-linked source, to sit beside `loanByYear` in everything that reads funding. */
export function rbfByYear(r: RevenueLinked, revenueMonths: number[]): RbfYear[] {
  const m = rbfSplitMonths(r, revenueMonths);
  return YEARS.map((year, i) => {
    const slice = m.slice(i * 12, i * 12 + 12);
    return {
      year,
      principal: r2(slice.reduce((a, x) => a + x.principal, 0)),
      cost: r2(slice.reduce((a, x) => a + x.cost, 0)),
      closing: slice[11]?.balance ?? 0,
    };
  });
}

/* ------------------------------------------------------------------ *
 * The whole funding picture                                           *
 * ------------------------------------------------------------------ */

export type FundingSource = {
  id: string; kind: FundingKind; name: string;
  amount: number;                       // what arrives in the bank
  start_year?: number | null; start_month?: number | null;
  loan?: Loan | null;                   // debt only
  rbf?: RevenueLinked | null;           // revenue-linked only
  grant?: Grant | null;                 // grant only — carries when it is EARNED, not just when it lands
  equity_percent?: number | null;
};

/** Money in, by month, across the five years — every kind of source, on the month it lands. */
export function fundingInMonths(sources: FundingSource[]): number[] {
  const out = Array(60).fill(0);
  for (const s of sources) {
    const m = (Math.max(1, num(s.start_year) || 1) - 1) * 12 + (Math.max(1, num(s.start_month) || 1) - 1);
    if (m < 60) out[m] = r2(out[m] + num(s.amount));
  }
  return out;
}

/** Money out, by month — loan repayments and revenue-linked shares. Equity and grants never repay. */
export function fundingOutMonths(sources: FundingSource[], revenueMonths: number[] = []): number[] {
  const out = Array(60).fill(0);
  for (const s of sources) {
    if (s.kind === "debt" && s.loan) {
      const m = loanMonths(s.loan);
      for (let i = 0; i < 60; i++) out[i] = r2(out[i] + m[i].payment);
    } else if (s.kind === "owner" && s.loan) {
      const m = loanMonths(s.loan);
      for (let i = 0; i < 60; i++) out[i] = r2(out[i] + m[i].payment);
    } else if (s.kind === "revenue_linked" && s.rbf) {
      const m = rbfMonths(s.rbf, revenueMonths);
      for (let i = 0; i < 60; i++) out[i] = r2(out[i] + m[i]);
    }
  }
  return out;
}

/**
 * The cost of borrowed money by year — a P&L charge, unlike principal, which only moves cash.
 *
 * `revenueMonths` is required rather than optional on purpose: a revenue-linked source repays out of sales,
 * so without them it would quietly report nothing, which is exactly the fault this is fixing (§6.37).
 */
export function interestByYear(sources: FundingSource[], revenueMonths: number[]): number[] {
  const out = YEARS.map(() => 0);
  for (const s of sources) {
    if (s.loan) {
      const y = loanByYear(s.loan);
      for (let i = 0; i < 5; i++) out[i] = r2(out[i] + y[i].interest);
    } else if (s.rbf) {
      const y = rbfByYear(s.rbf, revenueMonths);
      for (let i = 0; i < 5; i++) out[i] = r2(out[i] + y[i].cost);
    }
  }
  return out;
}

/** Debt still owed at the end of each year — the balance sheet's liability. */
export function debtByYear(sources: FundingSource[], revenueMonths: number[]): number[] {
  const out = YEARS.map(() => 0);
  for (const s of sources) {
    if (s.loan) {
      const y = loanByYear(s.loan);
      for (let i = 0; i < 5; i++) out[i] = r2(out[i] + y[i].closing);
    } else if (s.rbf) {
      const y = rbfByYear(s.rbf, revenueMonths);
      for (let i = 0; i < 5; i++) out[i] = r2(out[i] + y[i].closing);
    }
  }
  return out;
}

export type FundingTotals = { equity: number; debt: number; grants: number; revenueLinked: number; total: number };

export function fundingTotals(sources: FundingSource[]): FundingTotals {
  const t: FundingTotals = { equity: 0, debt: 0, grants: 0, revenueLinked: 0, total: 0 };
  for (const s of sources) {
    const a = num(s.amount);
    if (s.kind === "equity") t.equity = r2(t.equity + a);
    else if (s.kind === "grant") t.grants = r2(t.grants + a);
    else if (s.kind === "revenue_linked") t.revenueLinked = r2(t.revenueLinked + a);
    else if (s.kind === "debt") t.debt = r2(t.debt + a);
    else t[s.loan ? "debt" : "equity"] = r2(t[s.loan ? "debt" : "equity"] + a);   // owner loan vs owner capital
    t.total = r2(t.total + a);
  }
  return t;
}

/* ------------------------------------------------------------------ *
 * Is it enough?                                                       *
 * ------------------------------------------------------------------ */

export type CashInputs = {
  openingCash: number;
  revenueMonths: number[];              // 12 or 60
  cogsMonths: number[];
  overheadsMonths: number[];
  capexMonths?: number[];
  taxMonths?: number[];
};

export type CashPoint = { month: number; closing: number };
export type Adequacy = {
  months: CashPoint[];
  low: CashPoint;                       // the worst month and what the balance is there
  shortfall: number;                    // how much more funding it would take to stay above zero
  covered: boolean;
};

/**
 * The whole reason this module comes after Sales, COGS and Overheads: run the cash forward month by month
 * and say plainly whether the funding holds. Trading receipts are taken in the month they are earned — the
 * debtor-day timing lives with Review forecast, and doubling it here would give two different answers to the
 * same question. This is the funding check, not the cash flow statement.
 */
export function adequacy(sources: FundingSource[], c: CashInputs, monthsToRun = 12): Adequacy {
  const n = Math.max(1, monthsToRun);
  const inMonths = fundingInMonths(sources);
  const outMonths = fundingOutMonths(sources, c.revenueMonths);
  const at = (arr: number[] | undefined, i: number) => num(arr?.[i]);

  const months: CashPoint[] = [];
  let balance = num(c.openingCash);
  for (let i = 0; i < n; i++) {
    balance = r2(balance
      + at(c.revenueMonths, i) + inMonths[i]
      - at(c.cogsMonths, i) - at(c.overheadsMonths, i) - at(c.capexMonths, i) - at(c.taxMonths, i)
      - outMonths[i]);
    months.push({ month: i + 1, closing: balance });
  }
  const low = months.reduce((worst, p) => (p.closing < worst.closing ? p : worst), months[0]);
  return { months, low, shortfall: low.closing < 0 ? r2(-low.closing) : 0, covered: low.closing >= 0 };
}

/**
 * The facilities in a plan, in the shape the sweep wants (§6.72). Order is the order the client listed them,
 * which is also the order they are drawn on and repaid — stated rather than guessed at.
 */
export function facilitiesFrom(sources: FundingSource[]): Facility[] {
  const out: Facility[] = [];
  for (const s of sources) {
    if (!isFacility(s.loan)) continue;
    const l = s.loan!;
    // A facility's size is its LIMIT. `amount_drawn` is what happened to be drawn on the day it was typed.
    const limit = num(l.total_facility_amount) || num(l.amount_drawn);
    out.push({
      id: s.id, name: s.name || l.lender_name || "Overdraft",
      limit, interestRate: num(l.interest_rate), annualFee: num(l.annual_fee),
      availableFrom: drawMonth(l) + 1,
    });
  }
  return out;
}
