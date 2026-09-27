import type { FundingSource, Loan } from "./sources";

/**
 * THE LOANS THE BUSINESS ALREADY OWES WHEN THE PLAN STARTS (§6.150).
 *
 * Historic carries them (bank loans due within twelve months, and after), and until now the forecast held
 * that balance flat for five years: no interest, no repayment. SEQ Concreting owed 188,823, paid 18,638 of
 * interest on it last year, and the forecast charged it nothing and repaid none of it. The only way to cost
 * them was to add them again on Funding — which counted the debt twice and booked it as fresh cash (Open
 * item 49; the "never ask twice" rule, SaaS_Requirements §0).
 *
 * So the accounts answer as much as they can, and only what they cannot is asked:
 *   balance    — the two Historic lines, Period 1.
 *   rate       — last year's interest paid over the average of this year's and last year's loan balances.
 *   term       — the balance over what falls due within twelve months: 188,823 against 98,849 is 23 months.
 *   repayment  — principal falling due within the year means it is being paid down; none means interest only.
 * Anything the client has changed stands in place of the worked-out figure, and says so.
 *
 * The result is ONE MORE LOAN on the funding list, with nothing arriving in the bank (`amount: 0`) — so the
 * schedule, the interest, the repayments and the current/non-current split all come from the same code as
 * every other loan, and nothing counts it as money raised.
 */
export type ExistingDebtFacts = {
  /** Period 1, the opening position. */
  current: number; nonCurrent: number;
  /** Period 1's interest paid, and Period 2's loan total — for the rate. Null when not given. */
  interestPaid: number | null; priorTotal: number | null;
};
export type ExistingDebtTerms = { interest_rate?: number | null; term_months?: number | null; repayment_type?: "amortised" | "interest_only" | null };
type From = "historic" | "entered" | "missing";
export type ExistingDebt = {
  total: number; current: number;
  rate: { value: number | null; from: From; interestPaid: number | null; averageBalance: number | null };
  term: { value: number | null; from: From };
  repayment: { value: "amortised" | "interest_only"; from: From };
  /** The loan the forecast carries, or null while the rate is still unknown. */
  source: FundingSource | null;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const pos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

export const EXISTING_DEBT_ID = "existing-debt";

export function existingDebt(f: ExistingDebtFacts, stored: ExistingDebtTerms | null | undefined): ExistingDebt | null {
  const current = Math.max(0, f.current || 0), nonCurrent = Math.max(0, f.nonCurrent || 0);
  const total = r2(current + nonCurrent);
  if (total <= 0) return null;

  const paid = pos(f.interestPaid);
  const average = paid ? (pos(f.priorTotal) ? (total + (f.priorTotal as number)) / 2 : total) : null;
  const derivedRate = paid && average ? r2((paid / average) * 100) : null;
  const derivedType: "amortised" | "interest_only" = current > 0 ? "amortised" : "interest_only";
  const derivedTerm = current <= 0 ? null : current >= total ? 12 : Math.min(360, Math.ceil((total / current) * 12));

  const sRate = stored?.interest_rate, sTerm = stored?.term_months, sType = stored?.repayment_type;
  const rate = typeof sRate === "number" && Number.isFinite(sRate) && sRate >= 0
    ? { value: sRate, from: "entered" as From } : { value: derivedRate, from: (derivedRate === null ? "missing" : "historic") as From };
  const term = typeof sTerm === "number" && Number.isFinite(sTerm) && sTerm >= 1
    ? { value: Math.trunc(sTerm), from: "entered" as From } : { value: derivedTerm, from: (derivedTerm === null ? "missing" : "historic") as From };
  const repayment = sType === "amortised" || sType === "interest_only"
    ? { value: sType, from: "entered" as From } : { value: derivedType, from: "historic" as From };

  /* Interest only with no term known: nothing falls due inside the plan, so the term runs past Year 5. */
  const termMonths = term.value ?? (repayment.value === "interest_only" ? 61 : null);
  const source: FundingSource | null = rate.value === null || termMonths === null ? null : {
    id: EXISTING_DEBT_ID, kind: "debt", name: "Loans already owed", amount: 0, existing: true,
    start_year: 1, start_month: 1,
    loan: {
      id: EXISTING_DEBT_ID, lender_name: "Loans already owed", amount_drawn: total,
      interest_rate: rate.value, term_months: termMonths, repayment_type: repayment.value,
      payment_frequency: "monthly", start_year: 1, start_month: 1, loan_type: "term_loan",
    } satisfies Loan,
  };
  return { total, current, rate: { ...rate, interestPaid: paid, averageBalance: average === null ? null : r2(average) }, term, repayment, source };
}

/** The stored overrides, read defensively — the column is jsonb and anything not a clean value is "not changed". */
export function readExistingTerms(raw: unknown): ExistingDebtTerms {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const t = o.repayment_type;
  return {
    interest_rate: num(o.interest_rate), term_months: num(o.term_months),
    repayment_type: t === "amortised" || t === "interest_only" ? t : null,
  };
}

export type HistoricLoanRow = { period_number: unknown; bank_loans_current?: unknown; bank_loans_non_current?: unknown; interest_paid?: unknown };

/**
 * THE ONE READING of Historic for this (§6.41): the forecast (`loadPlan`) and the Funding screen both call
 * this, so the loan the screen shows is the loan the forecast carries.
 */
export function existingDebtFromHistory(periods: HistoricLoanRow[], stored: unknown): ExistingDebt | null {
  const at = (p: number) => periods.find((r) => Number(r.period_number) === p) ?? null;
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const p1 = at(1), p2 = at(2);
  if (!p1) return null;
  const prior = p2 ? (n(p2.bank_loans_current) ?? 0) + (n(p2.bank_loans_non_current) ?? 0) : null;
  return existingDebt({
    current: n(p1.bank_loans_current) ?? 0, nonCurrent: n(p1.bank_loans_non_current) ?? 0,
    interestPaid: n(p1.interest_paid), priorTotal: prior && prior > 0 ? prior : null,
  }, readExistingTerms(stored));
}
