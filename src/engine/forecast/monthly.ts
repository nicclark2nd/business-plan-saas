/**
 * Year 1, month by month (§6.36).
 *
 * The annual cash flow answers whether the year works. This answers the question that actually sinks
 * businesses: **whether every month in it works.** A year that closes on 28,000 can still be 40,000 short in
 * February, and the annual column cannot say so.
 *
 * APeX has no monthly cash flow at all — its cash flow is annual, and the monthly detail lives scattered
 * across Sales, Expenses and the loan schedule with nothing adding them up. So this has no screen to copy.
 *
 * **It recomputes nothing.** Every line across is the month series the owning module already publishes —
 * `planYear1Months`, `planCogsMonths`, `overheadsMonths`, `capexMonths`, `assetsMonths`, `loanMonths`,
 * `fundingInMonths`, `extraordinaryCashMonths` — and every one of those already sums to the year the annual
 * forecast reads. That is what makes the reconciliation check below meaningful rather than circular: if a
 * module's twelve months stop adding to its own year, this is where it shows up, on the statement a lender
 * reads first, instead of quietly in a column nobody totals.
 *
 * **The one thing it decides is when a balance-sheet movement happens inside the year**, because no module
 * owns that. Debtors, stock, creditors, prepayments and accruals each have one opening balance and one
 * closing balance, and the annual model already fixes both. What this adds is the path between them: the
 * balance moves with its own driver's cumulative share of the year — debtors with revenue, stock and
 * creditors with cost of sales — so a seasonal business shows its receivables building through the busy
 * months rather than a twelfth at a time. Because every ramp reaches exactly 1 in month twelve, **the
 * December balance IS the annual balance**, and the twelve months add to the year by construction rather
 * than by luck.
 *
 * That is an apportionment of one fact, not a second computation of it. It is deliberately NOT an
 * independent collection-lag model: a lag model would produce its own December debtors, which would disagree
 * with the annual balance sheet's, and then the plan would hold two answers to "what are you owed at year
 * end" — the exact fault this project keeps paying for.
 *
 * Two placements are stated rather than modelled, because they are timing the client can see and argue with:
 * tax paid in the year is spread evenly, the way instalments fall; a dividend is taken in month twelve,
 * because a private company declares one once the year's profit is known.
 */
import type { CashFlowYear, Invariant } from "./model";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const sum = (a: number[]) => a.reduce((x, y) => x + n(y), 0);

/** The twelve-slot month series each module publishes for Year 1. Nothing here is derived in this file. */
export type MonthlyShapes = {
  revenue: number[];
  cogs: number[];
  overheads: number[];
  capex: number[];
  depreciation: number[];
  debtProceeds: number[];
  equityRaised: number[];
  debtRepaid: number[];
  interest: number[];
  extraordinaryReceipts: number[];
  extraordinaryPayments: number[];
  disposalProceeds: number[];
};

export type Balances = {
  accountsReceivable: number; inventory: number; accountsPayable: number; prepaid: number; accrued: number;
};

export type MonthlyInput = {
  openingCash: number;
  /** Where the balance-sheet items start and end the year. Both come from the annual model, unchanged. */
  opening: Balances;
  closing: Balances;
  /** The year's tax actually paid and dividend actually taken, from the annual model. Placed, not recomputed. */
  taxPaid: number;
  dividends: number;
  shapes: MonthlyShapes;
};

export type MonthCash = {
  month: number;
  openingCash: number;
  receiptsFromCustomers: number; extraordinaryReceipts: number;
  paidToSuppliersAndEmployees: number; extraordinaryPayments: number; taxPaid: number;
  netOperating: number;
  capex: number; disposalProceeds: number; netInvesting: number;
  debtProceeds: number; equityRaised: number; debtRepaid: number; interestPaid: number; dividendsPaid: number;
  netFinancing: number;
  netMovement: number; closingCash: number;
  /** Month-end balances, so the path between opening and closing is visible rather than asserted. */
  accountsReceivable: number; inventory: number; accountsPayable: number;
};

export type MonthlyTotal = Pick<MonthCash,
  "openingCash" | "receiptsFromCustomers" | "extraordinaryReceipts" | "paidToSuppliersAndEmployees"
  | "extraordinaryPayments" | "taxPaid" | "netOperating" | "capex" | "disposalProceeds" | "netInvesting"
  | "debtProceeds" | "equityRaised" | "debtRepaid" | "interestPaid" | "dividendsPaid" | "netFinancing"
  | "netMovement" | "closingCash">;

export type MonthlyCashFlow = {
  months: MonthCash[];
  /** The tightest month and what the balance is there — the whole reason to look at this at all. */
  low: { month: number; closingCash: number };
  /** Months that close below zero. Empty is the answer the client wants. */
  negative: number[];
  /** The twelve added up, for the column that proves it against the year. */
  total: MonthlyTotal;
};

const MONTHS = 12;
const flat = () => Array.from({ length: MONTHS }, (_, i) => (i + 1) / MONTHS);

/**
 * A driver's cumulative share of its own year — 0 to 1 across the twelve months, ending at exactly 1.
 * A driver that never moves (no revenue at all, or a plan with none yet) falls back to a straight line
 * rather than dividing by nothing.
 */
export function ramp(driver: number[]): number[] {
  const total = sum(driver);
  if (!(Math.abs(total) > 0)) return flat();
  let run = 0;
  return Array.from({ length: MONTHS }, (_, i) => { run += n(driver[i]); return run / total; });
}

/** The twelve month-end balances between one opening figure and one closing figure, on a driver's shape. */
export const balancePath = (open: number, close: number, driver: number[]) =>
  ramp(driver).map((share) => n(open) + (n(close) - n(open)) * share);

/** An amount spread evenly across the year, the last month taking the remainder so the twelve add exactly. */
export function spreadEven(total: number): number[] {
  const each = r2(n(total) / MONTHS);
  const out = Array.from({ length: MONTHS }, () => each);
  out[MONTHS - 1] = r2(n(total) - each * (MONTHS - 1));
  return out;
}

/**
 * Twelve raw figures rounded for display, with December taking the remainder (§6.17) so the twelve shown
 * add to the year exactly. Rounding each month on its own left the receipts line four cents adrift of its
 * own total — inside every tolerance, and still a column that does not add up on screen.
 */
export function settle(raw: number[]): number[] {
  const total = r2(sum(raw));
  const out = raw.map(r2);
  out[MONTHS - 1] = r2(total - sum(out.slice(0, MONTHS - 1)));
  return out;
}

/** An amount taken once, in the month given (1 to 12). */
export function inMonth(total: number, month: number): number[] {
  const out = Array.from({ length: MONTHS }, () => 0);
  out[Math.min(MONTHS, Math.max(1, Math.trunc(month))) - 1] = r2(n(total));
  return out;
}

const at = (a: number[] | undefined, i: number) => n(a?.[i]);

export function buildMonthlyCashFlow(input: MonthlyInput): MonthlyCashFlow {
  const s = input.shapes;
  const costDriver = Array.from({ length: MONTHS }, (_, i) => at(s.cogs, i) + at(s.overheads, i));

  const arPath = balancePath(input.opening.accountsReceivable, input.closing.accountsReceivable, s.revenue);
  const invPath = balancePath(input.opening.inventory, input.closing.inventory, s.cogs);
  const apPath = balancePath(input.opening.accountsPayable, input.closing.accountsPayable, s.cogs);
  const prePath = balancePath(input.opening.prepaid, input.closing.prepaid, costDriver);
  const accPath = balancePath(input.opening.accrued, input.closing.accrued, costDriver);

  const taxMonths = spreadEven(input.taxPaid);
  const dividendMonths = inMonth(input.dividends, MONTHS);

  // The only two lines that carry a balance-sheet movement, so the only two that need settling. Everything
  // else arrives from its own module already adding to its own year.
  const prior = (path: number[], open: number, i: number) => (i === 0 ? n(open) : path[i - 1]);
  const receiptsRaw = Array.from({ length: MONTHS }, (_, i) =>
    at(s.revenue, i) - (arPath[i] - prior(arPath, input.opening.accountsReceivable, i)));
  const suppliersRaw = Array.from({ length: MONTHS }, (_, i) =>
    at(s.overheads, i) + at(s.cogs, i)
    + (invPath[i] - prior(invPath, input.opening.inventory, i))
    - (apPath[i] - prior(apPath, input.opening.accountsPayable, i))
    + (prePath[i] - prior(prePath, input.opening.prepaid, i))
    - (accPath[i] - prior(accPath, input.opening.accrued, i)));
  const receiptsMonths = settle(receiptsRaw);
  const suppliersMonths = settle(suppliersRaw);

  const months: MonthCash[] = [];
  let cash = n(input.openingCash);

  for (let i = 0; i < MONTHS; i++) {
    const ar = arPath[i], inv = invPath[i], ap = apPath[i];
    const receipts = receiptsMonths[i];
    const suppliers = suppliersMonths[i];
    const extraIn = at(s.extraordinaryReceipts, i);
    const extraOut = at(s.extraordinaryPayments, i);
    const tax = taxMonths[i];
    const netOperating = receipts + extraIn - suppliers - extraOut - tax;

    const capex = at(s.capex, i);
    const disposal = at(s.disposalProceeds, i);
    const netInvesting = disposal - capex;

    const debtIn = at(s.debtProceeds, i);
    const equityIn = at(s.equityRaised, i);
    const debtOut = at(s.debtRepaid, i);
    const interest = at(s.interest, i);
    const dividend = dividendMonths[i];
    const netFinancing = debtIn + equityIn - debtOut - interest - dividend;

    const netMovement = netOperating + netInvesting + netFinancing;
    const openingCash = cash;
    const closingCash = openingCash + netMovement;

    months.push({
      month: i + 1,
      openingCash: r2(openingCash),
      receiptsFromCustomers: r2(receipts), extraordinaryReceipts: r2(extraIn),
      paidToSuppliersAndEmployees: r2(suppliers), extraordinaryPayments: r2(extraOut), taxPaid: r2(tax),
      netOperating: r2(netOperating),
      capex: r2(capex), disposalProceeds: r2(disposal), netInvesting: r2(netInvesting),
      debtProceeds: r2(debtIn), equityRaised: r2(equityIn), debtRepaid: r2(debtOut),
      interestPaid: r2(interest), dividendsPaid: r2(dividend), netFinancing: r2(netFinancing),
      netMovement: r2(netMovement), closingCash: r2(closingCash),
      accountsReceivable: r2(ar), inventory: r2(inv), accountsPayable: r2(ap),
    });

    cash = closingCash;
  }

  const low = months.reduce((worst, m) => (m.closingCash < worst.closingCash ? m : worst), months[0]);
  const add = (k: keyof MonthCash) => r2(sum(months.map((m) => m[k] as number)));

  return {
    months,
    low: { month: low.month, closingCash: low.closingCash },
    negative: months.filter((m) => m.closingCash < 0).map((m) => m.month),
    total: {
      openingCash: months[0].openingCash,
      receiptsFromCustomers: add("receiptsFromCustomers"), extraordinaryReceipts: add("extraordinaryReceipts"),
      paidToSuppliersAndEmployees: add("paidToSuppliersAndEmployees"),
      extraordinaryPayments: add("extraordinaryPayments"), taxPaid: add("taxPaid"),
      netOperating: add("netOperating"), capex: add("capex"), disposalProceeds: add("disposalProceeds"),
      netInvesting: add("netInvesting"), debtProceeds: add("debtProceeds"), equityRaised: add("equityRaised"),
      debtRepaid: add("debtRepaid"), interestPaid: add("interestPaid"), dividendsPaid: add("dividendsPaid"),
      netFinancing: add("netFinancing"), netMovement: add("netMovement"),
      closingCash: months[MONTHS - 1].closingCash,
    },
  };
}

/**
 * The reconciliation invariant (§6.21.1) applied to the statement it matters most on: **Year 1 must equal its
 * own twelve months.** Six modules publish both a year and twelve months; this is the one check that holds
 * all six to it at once, and it is checked line by line rather than only on the total, because two lines that
 * are wrong in opposite directions add up to a total that looks right.
 */
export function monthlyInvariants(monthly: MonthlyCashFlow, year1: CashFlowYear): Invariant[] {
  const lines: [keyof MonthlyTotal & keyof CashFlowYear, string][] = [
    ["receiptsFromCustomers", "Received from customers"],
    ["extraordinaryReceipts", "One-off receipts"],
    ["paidToSuppliersAndEmployees", "Paid to suppliers and staff"],
    ["extraordinaryPayments", "One-off payments"],
    ["taxPaid", "Tax paid"],
    ["netOperating", "Operating cash flow"],
    ["capex", "Assets bought"],
    ["disposalProceeds", "Assets sold"],
    ["debtProceeds", "Money borrowed"],
    ["equityRaised", "Money invested"],
    ["debtRepaid", "Loan repayments"],
    ["interestPaid", "Interest paid"],
    ["dividendsPaid", "Dividends paid"],
    ["netMovement", "Movement in cash"],
    ["closingCash", "Closing cash"],
  ];
  return lines.map(([key, label]) => {
    const difference = r2(n(monthly.total[key]) - n(year1[key]));
    return {
      key: "year-1-months-to-year",
      label: `Year 1's twelve months add to Year 1 — ${label}`,
      year: 1 as const,
      difference,
      passed: Math.abs(difference) <= 0.5,
    };
  });
}
