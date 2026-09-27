import type { BalanceSheetYear, CashFlowYear, PnlYear, WorkingCapitalDays } from "@/engine/forecast/model";
import { daysFromHistory } from "@/engine/forecast/assumptions";
import type { CapabilityInput, Metric, Severity } from "./model";
import { over, r1, r2, statusOf } from "./model";

/**
 * ACTUAL AND PLAN (§6.158).
 *
 * Nic, 27 Sep 2026: "If the plan has historical information then I want the last two historic financial
 * years as the financial capabilities." The consultant and the client use this page to BUILD the plan, so it
 * opens on what the accounts say — the last two actual years — and the plan is the second view, measured
 * from the last actual year into the first plan year. Projections alone are the owner's hopes; the accounts
 * are what happened.
 *
 * THE MEASURES ARE NOT REWRITTEN. Every capability measure already reads "one year into the next" off a
 * `CapabilityInput` keyed 1, 2, 3 …, so the accounts are turned into that same shape here and handed to the
 * same functions. What changes is which year sits in which slot, and the NAME each slot is printed with — a
 * card that said "Year 2" now says "2026", whichever view it is on.
 *
 * WHAT THE ACCOUNTS CANNOT GIVE is the month. Annual accounts show the bank on the last day of the year and
 * nothing in between, so the actual view has no "lowest month"; it shows the year-end cash against a month
 * of overheads instead, and says why.
 */

export type HistoricRow = { period_number: number } & Partial<Record<string, number | string | null>>;
/** What each slot is called on screen: {1: "2025", 2: "2026"}. */
export type YearNames = Record<number, string>;

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number.isFinite(Number(v)) ? Number(v) : 0);

/** One actual year, in the forecast's own shapes, so the capability measures read it without knowing. */
export type ActualYear = {
  year: number;
  pnl: PnlYear; balanceSheet: BalanceSheetYear; cashFlow: CashFlowYear; days: WorkingCapitalDays;
  capex: number; debtService: number;
};

/**
 * Period p of Historic (1 = the last actual year) as an ActualYear. `prev` is the year before it, needed for
 * every movement — cash from operations, capex, principal repaid. Null when the period is missing.
 */
export function actualYear(rows: HistoricRow[], p: number, firstYear: number): ActualYear | null {
  const h = rows.find((r) => Number(r.period_number) === p);
  if (!h || !n(h.revenue)) return null;
  const prev = rows.find((r) => Number(r.period_number) === p + 1) ?? null;
  const d = (k: string) => (prev ? n(h[k]) - n(prev[k]) : 0);

  const revenue = n(h.revenue), cogs = n(h.cogs), overheads = n(h.overheads), dep = n(h.depreciation_amortisation);
  const grossProfit = revenue - cogs;
  const operatingProfit = n(h.operating_profit) || grossProfit - overheads - dep;
  const interest = n(h.interest_paid);
  const pbt = n(h.net_profit_before_tax), tax = n(h.tax_paid), netProfit = n(h.net_profit) || pbt - tax;
  const extra = n(h.extraordinary_income_expenses);

  const pnl: PnlYear = {
    revenue, variableCogs: cogs, fixedCogs: 0, cogs, grossProfit,
    grossMargin: revenue ? r2((grossProfit / revenue) * 100) : null,
    overheads, depreciation: dep, operatingProfit,
    grantIncome: 0, extraordinaryIncome: Math.max(0, extra), extraordinaryExpense: Math.max(0, -extra), disposalGainLoss: 0,
    interest, profitBeforeTax: pbt, lossRelief: 0, taxableProfit: Math.max(0, pbt), lossesCarriedForward: 0,
    tax, netProfit, dividends: n(h.dividends_paid), retainedProfit: n(h.retained_profit), dividendsWithheld: 0,
  } as PnlYear;

  const balanceSheet = {
    cash: n(h.cash), accountsReceivable: n(h.accounts_receivable), inventory: n(h.inventory_wip), prepaid: n(h.prepayments),
    gstReceivable: 0, otherCurrentAssets: n(h.other_current_assets), currentAssets: n(h.current_assets),
    fixedAssets: n(h.fixed_assets), otherNonCurrentAssets: n(h.other_non_current_assets), nonCurrentAssets: n(h.non_current_assets),
    totalAssets: n(h.total_assets), accountsPayable: n(h.accounts_payable), accrued: n(h.accruals), taxPayable: 0, gstPayable: 0,
    debtCurrent: n(h.bank_loans_current), deferredIncomeCurrent: 0, otherCurrentLiabilities: n(h.other_current_liabilities),
    currentLiabilities: n(h.current_liabilities), debtNonCurrent: n(h.bank_loans_non_current), deferredIncomeNonCurrent: 0,
    otherNonCurrentLiabilities: n(h.other_non_current_liabilities), nonCurrentLiabilities: n(h.non_current_liabilities),
    totalLiabilities: n(h.total_liabilities), equity: n(h.equity), totalLiabilitiesAndEquity: n(h.total_assets), balanceCheck: 0,
  } as BalanceSheetYear;

  /*
   * CASH FROM OPERATIONS, THE INDIRECT WAY — the way an accountant reconciles profit to cash, and the same
   * definition the forecast's bridge uses: profit after tax, depreciation added back, interest added back
   * (the forecast keeps interest under financing), and the movement in debtors, stock, prepayments,
   * creditors and accruals. Without the year before there are no movements, so it is profit plus
   * depreciation plus interest, and says less.
   */
  const netOperating = r2(netProfit + dep + interest - d("accounts_receivable") - d("inventory_wip") - d("prepayments")
    + d("accounts_payable") + d("accruals"));
  /* Capex from the fixed-asset movement: what the assets grew by, plus what wore out. Never negative. */
  const capex = prev ? Math.max(0, r2(d("fixed_assets") + dep)) : 0;
  /* Principal repaid: what the year before said fell due within twelve months. */
  const principal = prev ? n(prev.bank_loans_current) : 0;

  const cashFlow = {
    openingCash: prev ? n(prev.cash) : n(h.cash), receiptsFromCustomers: revenue, grantsReceived: 0, extraordinaryReceipts: 0,
    paidToSuppliersAndEmployees: cogs + overheads, extraordinaryPayments: 0, taxPaid: tax, netOperating,
    gstRemitted: 0, capex, disposalProceeds: 0, netInvesting: -capex,
    debtProceeds: 0, equityRaised: 0, debtRepaid: principal, interestPaid: interest, dividendsPaid: n(h.dividends_paid),
    netFinancing: 0, netMovement: 0, closingCash: n(h.cash),
  } as CashFlowYear;

  const days = daysFromHistory({ revenue, cogs, accounts_receivable: n(h.accounts_receivable), inventory_wip: n(h.inventory_wip), accounts_payable: n(h.accounts_payable) })
    ?? { debtorDays: 0, inventoryDays: 0, creditorDays: 0 };

  return { year: firstYear - p, pnl, balanceSheet, cashFlow, days, capex, debtService: r2(interest + principal) };
}

/** Put years into slots 1, 2, … of an input. */
function slot(base: Omit<CapabilityInput, "money">, years: (ActualYear | null)[]) {
  const pick = <K extends keyof ActualYear>(k: K) => Object.fromEntries(years.map((y, i) => [i + 1, y?.[k]]).filter(([, v]) => v !== undefined));
  return {
    ...base,
    pnl: pick("pnl"), balanceSheet: pick("balanceSheet"), cashFlow: pick("cashFlow"), days: pick("days"),
    capex: pick("capex"), debtService: pick("debtService"),
    monthlyCash: [], monthlyProfit: [],
  } as Omit<CapabilityInput, "money">;
}

export type Views = {
  hasHistory: boolean;
  actual: { grow: Omit<CapabilityInput, "money">; position: Omit<CapabilityInput, "money">; growNames: YearNames; positionNames: YearNames; span: string; last: ActualYear } | null;
  plan: { grow: Omit<CapabilityInput, "money">; position: Omit<CapabilityInput, "money">; growNames: YearNames; positionNames: YearNames; span: string };
};

/**
 * THE TWO VIEWS, from the plan's input and its Historic rows.
 *
 *   Actual · grow      2025 → 2026 (the last two actual years)
 *   Actual · position  2026 (borrow and sell are read on the latest year a lender or buyer would see)
 *   Plan · grow        2026 actual → 2027 plan, then the plan's own later years
 *   Plan · position    the plan's years, 2027 onward, as before
 * A business with no accounts has no actual view, and its plan grows 2027 → 2028 inside the forecast.
 */
export function capabilityViews(plan: Omit<CapabilityInput, "money">, rows: HistoricRow[], firstYear: number): Views {
  const planNames: YearNames = Object.fromEntries([1, 2, 3, 4, 5].map((y) => [y, String(firstYear + y - 1)]));
  const last = actualYear(rows, 1, firstYear);
  const before = actualYear(rows, 2, firstYear);
  if (!last) {
    return { hasHistory: false, actual: null, plan: { grow: plan, position: plan, growNames: planNames, positionNames: planNames, span: `${firstYear} → ${firstYear + 1} onward` } };
  }
  /* The cycle card reads slot 1; on the actual view it should read the latest year, not the one before. */
  const actualGrow = { ...slot(plan, [before, last]), days: { 1: last.days, 2: last.days } } as Omit<CapabilityInput, "money">;
  const actual = {
    grow: actualGrow, position: slot(plan, [last]),
    growNames: { 1: String(last.year - 1), 2: String(last.year) }, positionNames: { 1: String(last.year) },
    span: before ? `${last.year - 1} → ${last.year}` : String(last.year), last,
  };
  /* The plan's growth starts from the last actual year: slot 1 is 2026 actual, slots 2–5 are 2027–2030. */
  const shift = <T,>(rec: Partial<Record<number, T>>, first: T | undefined) =>
    Object.fromEntries([[1, first], ...[1, 2, 3, 4].map((y) => [y + 1, rec[y]])].filter(([, v]) => v !== undefined));
  const planGrow = {
    ...plan,
    pnl: shift(plan.pnl, last.pnl), balanceSheet: shift(plan.balanceSheet, last.balanceSheet),
    cashFlow: shift(plan.cashFlow, last.cashFlow),
    /* The cycle card reads slot 1, and on the plan view it should read the plan's own days, not last year's. */
    days: shift(plan.days, plan.days[1]),
    capex: shift(plan.capex, last.capex), debtService: shift(plan.debtService, last.debtService),
  } as Omit<CapabilityInput, "money">;
  const growNames: YearNames = { 1: `${last.year} actual`, 2: String(firstYear), 3: String(firstYear + 1), 4: String(firstYear + 2), 5: String(firstYear + 3) };
  return {
    hasHistory: true, actual,
    plan: { grow: planGrow, position: plan, growNames, positionNames: planNames, span: `${last.year} → ${firstYear} onward` },
  };
}

/**
 * "Year 2" → "2026", everywhere a card says it (§6.157, §6.158). The measures still count slots; this is the
 * one place a slot becomes the year a person reads. "Years 2, 3 and 4" becomes "2027, 2028 and 2029".
 */
export function nameYears(m: Metric, names: YearNames): Metric {
  const one = (d: string) => names[Number(d)] ?? `Year ${d}`;
  const fix = (s: string | undefined) => s === undefined ? s : s
    .replace(/\bYears ((?:[1-5], )*[1-5] and [1-5])\b/g, (_, list: string) => list.replace(/[1-5]/g, one))
    .replace(/\bYear ([1-5])\b/g, (_, d: string) => one(d));
  return {
    ...m, name: fix(m.name)!, note: fix(m.note)!, bench: fix(m.bench)!, sub: fix(m.sub), formula: fix(m.formula)!,
    reveals: fix(m.reveals)!, confidence: fix(m.confidence)!, missing: fix(m.missing), action: fix(m.action),
    trendLabel: fix(m.trendLabel),
  };
}

/**
 * THE MONTH THE ACCOUNTS CANNOT SHOW (§6.158). In place of the lowest month on the actual view: the cash the
 * last actual year closed with, measured in months of overheads. Same bands idea as a floor — under a month
 * is thin, and when a floor is set the reading is judged against it.
 */
export function yearEndCash(last: ActualYear, floor: number | null, money: (v: number) => string): Metric {
  const cash = last.balanceSheet.cash;
  const monthly = last.pnl.overheads / 12;
  const months = monthly > 0 ? over(cash, monthly) : null;
  const judged = floor !== null && floor > 0;
  return {
    key: "yearEndCash", name: `Cash at the end of ${last.year}`, unit: "money",
    value: cash, display: money(cash),
    min: Math.min(0, cash) - Math.max(monthly, 1), max: Math.max(cash, judged ? floor! : monthly * 2, 1) * 1.5,
    bands: judged
      ? [{ to: 0, s: "bad" }, { to: floor!, s: "watch" }, { to: Number.MAX_SAFE_INTEGER, s: "good" }]
      : [{ to: 0, s: "bad" }, { to: monthly, s: "watch" }, { to: Number.MAX_SAFE_INTEGER, s: "good" }],
    sub: months === null ? undefined : `About ${r1(months)} ${r1(months) === 1 ? "month" : "months"} of overheads`,
    note: cash < 0 ? `${last.year} ended overdrawn. The accounts only show the last day of the year, so the months in between may have been worse.`
      : judged && cash < floor! ? `${last.year} ended below your floor of ${money(floor!)}. The accounts only show the last day of the year — the months in between may have been lower still.`
      : months !== null && months < 1 ? `${last.year} ended with less than a month of overheads in the bank. The accounts only show the last day of the year, so the tight months are not visible here.`
      : `${last.year} ended with a cushion. The accounts only show the last day of the year, so this says nothing about the tightest month.`,
    bench: judged ? `Judged against your floor of ${money(floor!)}` : "Under a month of overheads is thin for a trading business",
    formula: `Cash at the end of ${last.year} ÷ a month of ${last.year} overheads`,
    reveals: "Whether the business came out of the year with any room — the nearest thing annual accounts show to the lowest month.",
    confidence: "High for the day it was taken; silent about every other day of the year.",
  };
}

/**
 * THE SAME CARD, SAID ABOUT THE ACCOUNTS (§6.158). The measures were written for the plan — "the plan loses
 * money", "this plan's own forecast". On the actual view the figures are what happened, and a card that
 * called 2026's accounts "the plan's forecast" would be describing the wrong thing.
 */
export function inAccounts(m: Metric): Metric {
  const fix = (s: string | undefined) => s === undefined ? s : s
    .replace(/in this plan's own forecast/g, "in the accounts")
    .replace(/the plan's own forecast/g, "the accounts")
    .replace(/the plan's own EBITDA/g, "the EBITDA in the accounts")
    .replace(/Return on the growth plan/g, "Return on growth spending")
    .replace(/the growth plan/g, "the growth")
    .replace(/The plan forecasts no growth/g, "The accounts show no growth")
    .replace(/the profit the plan forecasts/g, "the profit")
    .replace(/\bThe plan\b/g, "The business").replace(/\bthe plan\b/g, "the business").replace(/\bThis plan\b/g, "This business");
  return {
    ...m, name: fix(m.name)!, note: fix(m.note)!, bench: fix(m.bench)!, sub: fix(m.sub), formula: fix(m.formula)!,
    reveals: fix(m.reveals)!, confidence: fix(m.confidence)!, missing: fix(m.missing), action: fix(m.action),
  };
}

/**
 * THE OTHER VIEW'S READING, ON THE SAME CARD (§6.159, stage 2 of §6.158).
 *
 * The point of having both views is the gap between them. So every card that exists in both carries one line
 * for the other: on the plan, what the business actually did; on the accounts, what the plan says it will do.
 * And when the plan reads BETTER than the track record — a better band, or sales growth half as much again
 * as the business has managed — the line says so, because that is the question a consultant, a lender or a
 * buyer asks first: what changes to make that true?
 */
export type Comparison = { label: string; display: string; ahead: boolean };
const RANK: Record<Severity, number> = { bad: 0, watch: 1, good: 2 };
export function compareWith(m: Metric, other: Metric | undefined, label: string, onPlan: boolean): Comparison | null {
  if (!other || other.value === null || m.value === null) return null;
  const s = statusOf(m.value, m.bands), o = statusOf(other.value, other.bands);
  const plan = onPlan ? { v: m.value, s } : { v: other.value, s: o };
  const done = onPlan ? { v: other.value, s: o } : { v: m.value, s };
  const betterBand = plan.s !== null && done.s !== null && RANK[plan.s] > RANK[done.s];
  const fasterGrowth = m.key === "revenueGrowth" && done.v > 0 && plan.v > done.v * 1.5;
  return { label, display: other.display, ahead: betterBand || fasterGrowth };
}
