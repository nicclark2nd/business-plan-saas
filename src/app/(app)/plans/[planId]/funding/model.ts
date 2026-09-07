import type { FundingKind, Loan, RevenueLinked, RepaymentType, PaymentFrequency } from "@/engine/funding/sources";

/** Funding — one list, every kind of source in it (SaaS §6.20). */

export type OwnerType = "owner_capital" | "owner_loan";
export type LoanType = "term_loan" | "line_of_credit" | "equipment_finance" | "vehicle_finance" | "director_loan";
export type Recognition = "immediate" | "deferred";

/** One row of the list, whichever table it came from. */
export type FundingRow = {
  _key: string;
  id: string;
  kind: FundingKind;
  name: string;
  amount: number;
  start_year: number;
  start_month: number;
  // owner
  owner_type?: OwnerType;
  // debt (and an owner loan, which is the same thing with a friendlier name)
  loan_type?: LoanType;
  total_facility_amount?: number;
  interest_rate?: number;
  term_months?: number;
  repayment_type?: RepaymentType;
  payment_frequency?: PaymentFrequency;
  residual_value?: number;
  min_repayment_pct?: number;
  annual_fee?: number;
  // equity
  equity_percent?: number;
  pre_money_valuation?: number | null;
  dividend_policy?: boolean;
  // grant
  has_conditions?: boolean;
  conditions?: string | null;
  recognition_type?: Recognition;
  recognition_period_months?: number | null;
  // revenue-linked
  repayment_percent?: number;
  cap_multiple?: number;
  min_monthly_payment?: number;
  _error?: string;
};

export const KIND_LABEL: Record<FundingKind, string> = {
  owner: "Owner funding", debt: "Loan", equity: "Investor", grant: "Grant", revenue_linked: "Revenue-based",
};

/** Guided mode asks the question in plain language before it shows anyone a form (§7.2). */
export const KIND_CARDS: { kind: FundingKind; title: string; blurb: string }[] = [
  { kind: "owner", title: "My own money", blurb: "Cash you put in yourself — as capital, or as a loan to the business you expect back." },
  { kind: "debt", title: "A loan", blurb: "A bank or finance company. Term loan, overdraft, or finance on a vehicle or equipment." },
  { kind: "equity", title: "An investor", blurb: "Someone buys a share of the business. Nothing is repaid, but you own less of it." },
  { kind: "grant", title: "A grant", blurb: "Government or industry money you do not pay back, though it may carry conditions." },
  { kind: "revenue_linked", title: "Revenue-based finance", blurb: "Money now, repaid as a share of sales until a capped total is reached." },
];

export const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: "term_loan", label: "Term loan" },
  { value: "equipment_finance", label: "Equipment finance" },
  { value: "vehicle_finance", label: "Vehicle finance" },
  { value: "line_of_credit", label: "Overdraft / line of credit" },
  { value: "director_loan", label: "Director loan" },
];

/** These two buy something the business then owns, so they carry an asset into Fixed Assets (§6.20). */
export const ASSET_BACKED: LoanType[] = ["equipment_finance", "vehicle_finance"];
export const isAssetBacked = (t: LoanType | undefined) => !!t && ASSET_BACKED.includes(t);

export const REPAYMENT_TYPES: { value: RepaymentType; label: string }[] = [
  { value: "amortised", label: "Principal + interest" },
  { value: "interest_only", label: "Interest only" },
  { value: "pct_of_balance", label: "% of balance" },
];

export const FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" },
];

/** A row becomes the engine's shape only when it is a kind that keeps costing after it arrives. */
export function loanOf(r: FundingRow): Loan | null {
  if (r.kind === "debt" || (r.kind === "owner" && r.owner_type === "owner_loan")) {
    return {
      id: r.id, lender_name: r.name, amount_drawn: r.amount,
      total_facility_amount: r.total_facility_amount ?? r.amount,
      interest_rate: r.interest_rate ?? 0, term_months: r.term_months ?? 60,
      repayment_type: r.repayment_type ?? "amortised", payment_frequency: r.payment_frequency ?? "monthly",
      residual_value: r.residual_value ?? 0, min_repayment_pct: r.min_repayment_pct ?? 0,
      annual_fee: r.annual_fee ?? 0, start_year: r.start_year, start_month: r.start_month,
    };
  }
  return null;
}

export function rbfOf(r: FundingRow): RevenueLinked | null {
  if (r.kind !== "revenue_linked") return null;
  return {
    id: r.id, provider: r.name, amount_received: r.amount,
    repayment_percent: r.repayment_percent ?? 0, cap_multiple: r.cap_multiple ?? 1.5,
    min_monthly_payment: r.min_monthly_payment ?? 0, start_year: r.start_year, start_month: r.start_month,
  };
}
