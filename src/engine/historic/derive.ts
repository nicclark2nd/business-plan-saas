/**
 * Historic period derivation — ported from APeX `financialCalculations.ts` (totals → components) and the
 * Input Form's subtotal logic (components → totals). Two entry paths, one self-consistent 33-line record.
 *
 * Totals path (the upload template, and what an accountant's statements give you): Revenue, Gross Margin,
 * Net Profit After Tax, Total Assets, Total Current Assets, Total Liabilities, Total Current Liabilities, plus
 * the lines a lender wants separately. Components (COGS, Overheads, Other assets/liabilities, Equity) are derived.
 *
 * Components path (typing into the grid): Revenue, COGS, Overheads, Other current assets … and the subtotals are derived.
 */
export const PERIOD_FIELDS = [
  "revenue", "cogs", "gross_margin", "overheads", "depreciation_amortisation", "operating_profit", "extraordinary_income_expenses",
  "interest_paid", "net_profit_before_tax", "tax_paid", "net_profit", "dividends_paid", "retained_profit",
  "cash", "accounts_receivable", "inventory_wip", "other_current_assets", "current_assets", "fixed_assets", "other_non_current_assets",
  "non_current_assets", "total_assets", "accounts_payable", "bank_loans_current", "other_current_liabilities", "current_liabilities",
  "bank_loans_non_current", "other_non_current_liabilities", "non_current_liabilities", "total_liabilities", "equity",
] as const;
export type PeriodField = (typeof PERIOD_FIELDS)[number];
export type PeriodValues = Record<PeriodField, number>;
export type PeriodInput = Partial<Record<PeriodField, number | null | undefined>>;

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The lines a user types on the grid. Everything else is calculated from them. */
export const COMPONENT_INPUTS: PeriodField[] = [
  "revenue", "cogs", "overheads", "depreciation_amortisation", "extraordinary_income_expenses", "interest_paid", "tax_paid", "dividends_paid",
  "cash", "accounts_receivable", "inventory_wip", "other_current_assets", "fixed_assets", "other_non_current_assets",
  "accounts_payable", "bank_loans_current", "other_current_liabilities", "bank_loans_non_current", "other_non_current_liabilities",
];

/** Components → totals. Equity is the balancing figure (assets − liabilities). */
export function deriveFromComponents(p: PeriodInput): PeriodValues {
  const revenue = n(p.revenue), cogs = n(p.cogs), overheads = n(p.overheads), da = n(p.depreciation_amortisation);
  const extra = n(p.extraordinary_income_expenses), interest = n(p.interest_paid), tax = n(p.tax_paid), div = n(p.dividends_paid);
  const gross_margin = revenue - cogs;
  const operating_profit = gross_margin - overheads - da;
  const net_profit_before_tax = operating_profit + extra - interest;
  const net_profit = net_profit_before_tax - tax;
  const retained_profit = net_profit - div;
  const cash = n(p.cash), ar = n(p.accounts_receivable), inv = n(p.inventory_wip), oca = n(p.other_current_assets);
  const fa = n(p.fixed_assets), onca = n(p.other_non_current_assets);
  const ap = n(p.accounts_payable), blc = n(p.bank_loans_current), ocl = n(p.other_current_liabilities), blnc = n(p.bank_loans_non_current), oncl = n(p.other_non_current_liabilities);
  const current_assets = cash + ar + inv + oca, non_current_assets = fa + onca, total_assets = current_assets + non_current_assets;
  const current_liabilities = ap + blc + ocl, non_current_liabilities = blnc + oncl, total_liabilities = current_liabilities + non_current_liabilities;
  return {
    revenue, cogs, gross_margin: r2(gross_margin), overheads, depreciation_amortisation: da, operating_profit: r2(operating_profit),
    extraordinary_income_expenses: extra, interest_paid: interest, net_profit_before_tax: r2(net_profit_before_tax), tax_paid: tax,
    net_profit: r2(net_profit), dividends_paid: div, retained_profit: r2(retained_profit),
    cash, accounts_receivable: ar, inventory_wip: inv, other_current_assets: oca, current_assets: r2(current_assets), fixed_assets: fa,
    other_non_current_assets: onca, non_current_assets: r2(non_current_assets), total_assets: r2(total_assets),
    accounts_payable: ap, bank_loans_current: blc, other_current_liabilities: ocl, current_liabilities: r2(current_liabilities),
    bank_loans_non_current: blnc, other_non_current_liabilities: oncl, non_current_liabilities: r2(non_current_liabilities),
    total_liabilities: r2(total_liabilities), equity: r2(total_assets - total_liabilities),
  };
}

/**
 * Totals → components (APeX `calculateFinancials`, step for step). Note APeX's sign convention: the template's
 * "Extraordinary Income_Expenses" is added back when walking from NPBT up to operating profit, so a positive
 * number there is treated as an expense. Kept identical so existing templates load to the same figures.
 */
export function deriveFromTotals(p: PeriodInput): PeriodValues {
  const revenue = n(p.revenue), gross_margin = n(p.gross_margin), net_profit = n(p.net_profit);
  const tax = n(p.tax_paid), interest = n(p.interest_paid), extra = n(p.extraordinary_income_expenses), da = n(p.depreciation_amortisation), div = n(p.dividends_paid);
  const cogs = revenue - gross_margin;
  const net_profit_before_tax = net_profit + tax;
  const operating_profit = net_profit_before_tax + interest + extra;
  const overheads = gross_margin - operating_profit - da;
  const retained_profit = net_profit - div;
  const cash = n(p.cash), ar = n(p.accounts_receivable), inv = n(p.inventory_wip), current_assets = n(p.current_assets), fa = n(p.fixed_assets), total_assets = n(p.total_assets);
  const other_current_assets = current_assets - cash - ar - inv;
  const non_current_assets = total_assets - current_assets;
  const other_non_current_assets = non_current_assets - fa;
  const ap = n(p.accounts_payable), blc = n(p.bank_loans_current), current_liabilities = n(p.current_liabilities), blnc = n(p.bank_loans_non_current), total_liabilities = n(p.total_liabilities);
  const other_current_liabilities = current_liabilities - ap - blc;
  const non_current_liabilities = total_liabilities - current_liabilities;
  const other_non_current_liabilities = non_current_liabilities - blnc;
  return {
    revenue, cogs: r2(cogs), gross_margin, overheads: r2(overheads), depreciation_amortisation: da, operating_profit: r2(operating_profit),
    extraordinary_income_expenses: extra, interest_paid: interest, net_profit_before_tax: r2(net_profit_before_tax), tax_paid: tax,
    net_profit, dividends_paid: div, retained_profit: r2(retained_profit),
    cash, accounts_receivable: ar, inventory_wip: inv, other_current_assets: r2(other_current_assets), current_assets, fixed_assets: fa,
    other_non_current_assets: r2(other_non_current_assets), non_current_assets: r2(non_current_assets), total_assets,
    accounts_payable: ap, bank_loans_current: blc, other_current_liabilities: r2(other_current_liabilities), current_liabilities,
    bank_loans_non_current: blnc, other_non_current_liabilities: r2(other_non_current_liabilities), non_current_liabilities: r2(non_current_liabilities),
    total_liabilities, equity: r2(total_assets - total_liabilities),
  };
}

/** What a lender reads off a period, and what the forecast inherits as working-capital defaults. Days are annualised by period length. */
export function periodRatios(p: PeriodValues, periodLengthMonths = 12) {
  const annualise = 12 / Math.max(1, periodLengthMonths);
  const rev = p.revenue * annualise, cogs = p.cogs * annualise;
  const days = (bal: number, base: number) => (base > 0 ? Math.round((bal / base) * 365) : 0);
  return {
    grossMarginPct: p.revenue ? r2((p.gross_margin / p.revenue) * 100) : 0,
    netMarginPct: p.revenue ? r2((p.net_profit / p.revenue) * 100) : 0,
    debtorDays: days(p.accounts_receivable, rev),
    inventoryDays: days(p.inventory_wip, cogs),
    creditorDays: days(p.accounts_payable, cogs),
    currentRatio: p.current_liabilities ? r2(p.current_assets / p.current_liabilities) : 0,
  };
}

/** Column labels the upload template uses (APeX `excelImport.ts`), mapped to fields. Missing rows are simply not supplied. */
export const TEMPLATE_ROWS: Record<string, PeriodField> = {
  "Revenue": "revenue", "Cost of Goods": "cogs", "Gross Margin": "gross_margin", "Overheads": "overheads",
  "Depreciation & Amortisation": "depreciation_amortisation", "Operating Profit": "operating_profit",
  "Extraordinary Income_Expenses": "extraordinary_income_expenses", "Interest Paid": "interest_paid",
  "Net Profit Before Tax": "net_profit_before_tax", "Tax Paid": "tax_paid", "Net Profit After Tax": "net_profit",
  "Dividends Paid": "dividends_paid", "Retained Profit": "retained_profit",
  "Cash": "cash", "Accounts Receivable": "accounts_receivable", "Inventory_WIP": "inventory_wip",
  "Other Current Assets": "other_current_assets", "Total Current Assets": "current_assets", "Fixed Assets": "fixed_assets",
  "Other Non Current Assets": "other_non_current_assets", "Non Current Assets": "non_current_assets", "Total Assets": "total_assets",
  "Accounts Payable": "accounts_payable", "Bank Loans - Current": "bank_loans_current", "Other Current Liabilities": "other_current_liabilities",
  "Total Current Liabilities": "current_liabilities", "Bank Loans - Non Current": "bank_loans_non_current",
  "Other Non Current Liabilities": "other_non_current_liabilities", "Non Current Liabilities": "non_current_liabilities",
  "Total Liabilities": "total_liabilities", "Equity": "equity",
};

/** A parsed template: label → four columns (Period 1 = most recent). */
export type TemplateSheet = { periodEnd: (string | number | null)[]; periodLength: (number | null)[]; rows: Record<string, (number | null)[]> };

export function periodsFromTemplate(sheet: TemplateSheet) {
  return [0, 1, 2, 3].map((i) => {
    const input: PeriodInput = {};
    let any = false;
    for (const [label, field] of Object.entries(TEMPLATE_ROWS)) {
      const v = sheet.rows[label]?.[i];
      if (typeof v === "number" && Number.isFinite(v)) { input[field] = v; any = true; }
    }
    return { period_number: i + 1, period_end: sheet.periodEnd[i] ?? null, period_length: sheet.periodLength[i] ?? 12, present: any, values: deriveFromTotals(input) };
  });
}
