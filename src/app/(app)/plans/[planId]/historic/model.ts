import type { PeriodField } from "@/engine/historic/derive";

/** Historic — three areas (SaaS §6.15): Profit & loss · Balance sheet · Import. Periods run newest first (Period 1 = latest year). */
export type LineDef = { field: PeriodField; label: string; calc?: boolean; indent?: boolean; strong?: boolean; help?: string };

export const PNL_LINES: LineDef[] = [
  { field: "revenue", label: "Revenue" },
  { field: "cogs", label: "Cost of goods sold", indent: true },
  { field: "gross_margin", label: "Gross margin", calc: true, strong: true },
  { field: "overheads", label: "Overheads", indent: true },
  { field: "depreciation_amortisation", label: "Depreciation & amortisation", indent: true },
  { field: "operating_profit", label: "Operating profit", calc: true, strong: true },
  { field: "extraordinary_income_expenses", label: "Extraordinary income / (expense)", indent: true, help: "One-offs: insurance payout, sale of a vehicle, a legal settlement. Positive = income." },
  { field: "interest_paid", label: "Interest paid", indent: true },
  { field: "net_profit_before_tax", label: "Net profit before tax", calc: true, strong: true },
  { field: "tax_paid", label: "Tax", indent: true },
  { field: "net_profit", label: "Net profit after tax", calc: true, strong: true },
  { field: "dividends_paid", label: "Dividends / drawings paid", indent: true },
  { field: "retained_profit", label: "Retained profit", calc: true, strong: true },
];

export const BS_LINES: LineDef[] = [
  { field: "cash", label: "Cash at bank" },
  { field: "accounts_receivable", label: "Accounts receivable (debtors)" },
  { field: "inventory_wip", label: "Inventory / work in progress" },
  { field: "other_current_assets", label: "Other current assets" },
  { field: "current_assets", label: "Current assets", calc: true, strong: true },
  { field: "fixed_assets", label: "Fixed assets (net)" },
  { field: "other_non_current_assets", label: "Other non-current assets" },
  { field: "non_current_assets", label: "Non-current assets", calc: true, strong: true },
  { field: "total_assets", label: "Total assets", calc: true, strong: true },
  { field: "accounts_payable", label: "Accounts payable (creditors)" },
  { field: "bank_loans_current", label: "Bank loans — due within 12 months" },
  { field: "other_current_liabilities", label: "Other current liabilities" },
  { field: "current_liabilities", label: "Current liabilities", calc: true, strong: true },
  { field: "bank_loans_non_current", label: "Bank loans — due after 12 months" },
  { field: "other_non_current_liabilities", label: "Other non-current liabilities" },
  { field: "non_current_liabilities", label: "Non-current liabilities", calc: true, strong: true },
  { field: "total_liabilities", label: "Total liabilities", calc: true, strong: true },
  { field: "equity", label: "Equity (assets − liabilities)", calc: true, strong: true },
];

export type Period = { period_number: number; period_end: string | null; period_length: number; source: string | null } & Record<PeriodField, number>;
