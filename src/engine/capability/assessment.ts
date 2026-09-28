import type { ActualYear } from "./actual";
import { annualRepayment, r1, r2 } from "./model";

/**
 * THE PLANNER'S ASSESSMENT (§6.164) — where the business stands, from its accounts, before any plan exists.
 *
 * Nic, 28 Sep 2026: with a business that has accounts, the Planner first uploads them and assesses whether
 * the business can grow, borrow and sell; only then is the forward plan built. So this reads the last two
 * actual years and nothing else, and answers the three questions a Planner needs before a projection is
 * typed: WHY did profit and cash move, WHICH problems matter most and by how much, and WHAT DIRECTION the
 * plan should take on each. Every sentence is built from the accounts by a rule.
 */

export type BridgeStep = { label: string; value: number; kind: "start" | "step" | "end" };

/**
 * WHY OPERATING PROFIT MOVED, year on year: more sales at last year's margin, the margin itself moving,
 * overheads, depreciation. The four add up to the change exactly — gross profit's change is
 * Δsales × old margin + (new margin − old margin) × new sales.
 */
export function profitBridge(prev: ActualYear, last: ActualYear): BridgeStep[] {
  const gm = (y: ActualYear) => (y.pnl.revenue ? (y.pnl.revenue - y.pnl.cogs) / y.pnl.revenue : 0);
  const sales = r2((last.pnl.revenue - prev.pnl.revenue) * gm(prev));
  const margin = r2((gm(last) - gm(prev)) * last.pnl.revenue);
  const overheads = r2(-(last.pnl.overheads - prev.pnl.overheads));
  const dep = r2(-(last.pnl.depreciation - prev.pnl.depreciation));
  const other = r2(last.pnl.operatingProfit - prev.pnl.operatingProfit - sales - margin - overheads - dep);
  return [
    { label: `Operating profit, ${prev.year}`, value: prev.pnl.operatingProfit, kind: "start" },
    { label: "More sales, at last year's margin", value: sales, kind: "step" },
    { label: "Gross margin moving", value: margin, kind: "step" },
    { label: "Overheads", value: overheads, kind: "step" },
    { label: "Depreciation", value: dep, kind: "step" },
    ...(Math.abs(other) >= 1 ? [{ label: "Other", value: other, kind: "step" as const }] : []),
    { label: `Operating profit, ${last.year}`, value: last.pnl.operatingProfit, kind: "end" },
  ];
}

/**
 * WHERE THE CASH WENT in the last actual year: operating profit, what working capital took, interest and
 * tax, what was spent on assets and repaid on loans — and whatever is left over, so the steps land on the
 * bank balance the accounts actually show.
 */
export function cashBridge(prev: ActualYear, last: ActualYear): BridgeStep[] {
  const d = (f: (y: ActualYear) => number) => f(last) - f(prev);
  const debtors = r2(-d((y) => y.balanceSheet.accountsReceivable));
  const stock = r2(-d((y) => y.balanceSheet.inventory));
  const creditors = r2(d((y) => y.balanceSheet.accountsPayable));
  const interestTax = r2(-(last.pnl.interest + last.pnl.tax));
  const capex = r2(-last.capex);
  const repaid = r2(-last.cashFlow.debtRepaid);
  const start = prev.balanceSheet.cash, end = last.balanceSheet.cash;
  const known = last.pnl.operatingProfit + last.pnl.depreciation + debtors + stock + creditors + interestTax + capex + repaid;
  const other = r2(end - start - known);
  return [
    { label: `Cash at the end of ${prev.year}`, value: start, kind: "start" },
    { label: "Operating profit", value: last.pnl.operatingProfit, kind: "step" },
    { label: "Depreciation added back", value: last.pnl.depreciation, kind: "step" },
    { label: "Customers paying slower (debtors)", value: debtors, kind: "step" },
    { label: "Stock and work in progress", value: stock, kind: "step" },
    { label: "Suppliers (creditors)", value: creditors, kind: "step" },
    { label: "Interest and tax", value: interestTax, kind: "step" },
    { label: "Spent on assets", value: capex, kind: "step" },
    { label: "Loans repaid", value: repaid, kind: "step" },
    ...(Math.abs(other) >= 1 ? [{ label: "New borrowing, owner money and other", value: other, kind: "step" as const }] : []),
    { label: `Cash at the end of ${last.year}`, value: end, kind: "end" },
  ];
}

/** A target the plan should be built to — proposed here, agreed by the Planner (§6.165, `targets.ts`). */
export type Target =
  | { kind: "grossMargin"; value: number }
  | { kind: "overheadsCap"; value: number }
  | { kind: "debtorDays"; value: number }
  | { kind: "loanTermMonths"; value: number }
  | { kind: "cashFloor"; value: number }
  | { kind: "breakEven"; value: number };

export type Issue = {
  key: string;
  /** The capability it bears on most. */
  area: "grow" | "borrow" | "sell";
  title: string;
  /** What the accounts show, with the number. */
  finding: string;
  /** The likely cause, said plainly — a hypothesis for the Planner to test, not a verdict. */
  cause: string;
  /** What the plan should do about it, with the number, and where it is set. */
  direction: string;
  where: { label: string; to: string };
  /** The question to put to the client. */
  ask: string;
  target: Target;
  /** Money at stake, for ordering. */
  size: number;
  /** Survival comes first: a loan that cannot be repaid outranks a margin that has slipped. */
  urgent: boolean;
};

export function issuesFrom(prev: ActualYear | null, last: ActualYear, money: (v: number) => string): Issue[] {
  const m = money, y = last.year, out: Issue[] = [];
  const rev = last.pnl.revenue;
  const gm = (a: ActualYear) => (a.pnl.revenue ? ((a.pnl.revenue - a.pnl.cogs) / a.pnl.revenue) * 100 : 0);
  const monthlyOh = last.pnl.overheads / 12;
  const debt = last.balanceSheet.debtCurrent + last.balanceSheet.debtNonCurrent;
  const netOp = last.cashFlow.netOperating;             // before interest

  /* ---- the loans: can next year's repayments be met? ---- */
  const dueNext = last.balanceSheet.debtCurrent;
  const interest = last.pnl.interest;
  if (debt > 0 && dueNext + interest > Math.max(0, netOp)) {
    const avg = prev ? (debt + prev.balanceSheet.debtCurrent + prev.balanceSheet.debtNonCurrent) / 2 : debt;
    const rate = avg > 0 && interest > 0 ? (interest / avg) * 100 : 10;
    const five = annualRepayment(debt, rate, 5) ?? debt / 5;
    out.push({
      key: "loans", area: "borrow", urgent: true, size: dueNext + interest - Math.max(0, netOp),
      title: "The loans cannot be repaid from trading",
      finding: `${m(dueNext)} of loans fall due in ${y + 1}, with about ${m(interest)} of interest — and trading ${netOp < 0 ? `used ${m(-netOp)} of cash` : `produced only ${m(netOp)}`} in ${y}.`,
      cause: "The repayment schedule is shorter than the business's cash can carry.",
      direction: `Spread the ${m(debt)} owed over five years: about ${m(five)} a year in repayments and interest, against about ${m(dueNext + interest)} on the current schedule.`,
      where: { label: "Funding", to: "funding" },
      ask: "Will the bank extend the term, or allow interest-only for a year? What security does it already hold?",
      target: { kind: "loanTermMonths", value: 60 },
    } as Issue);
  }

  /* ---- the cash cushion ---- */
  if (monthlyOh > 0 && last.balanceSheet.cash < monthlyOh) {
    const cover = last.balanceSheet.cash / monthlyOh;
    out.push({
      key: "cash", area: "borrow", urgent: last.balanceSheet.cash < 0, size: monthlyOh - last.balanceSheet.cash,
      title: "Almost no cash cushion",
      finding: `${y} ended with ${m(last.balanceSheet.cash)} in the bank — about ${r1(Math.max(0, cover))} months of overheads.`,
      cause: "Profit and working capital have not been turning into cash, so every slow month lands on the overdraft.",
      direction: `Build the plan to hold a cash floor of at least one month of overheads, about ${m(monthlyOh)}, and fund any gap before it opens.`,
      where: { label: "Assumptions → Cash & capital", to: "assumptions?area=cash" },
      ask: "Is there an overdraft, and how close to the limit did the account get during the year?",
      target: { kind: "cashFloor", value: Math.round(monthlyOh) },
    } as Issue);
  }

  if (prev) {
    /* ---- the margin ---- */
    const drop = gm(prev) - gm(last);
    if (drop >= 1) {
      out.push({
        key: "margin", area: "grow", urgent: false, size: (drop / 100) * rev,
        title: "Gross margin slipped",
        finding: `Gross margin fell from ${r1(gm(prev))}% to ${r1(gm(last))}% — about ${m((drop / 100) * rev)} of profit on ${y}'s sales.`,
        cause: "Prices did not keep up with direct costs, or the mix of work moved to thinner jobs.",
        direction: `Plan gross margin back to ${r1(gm(prev))}% — set it through prices on Sales and costs on COGS.`,
        where: { label: "COGS", to: "cogs" },
        ask: "Did prices go up last year? Which jobs lost margin — materials, labour, or how they were quoted?",
        target: { kind: "grossMargin", value: r1(gm(prev)) },
      } as Issue);
    }

    /* ---- overheads against sales ---- */
    const salesGrowth = prev.pnl.revenue ? (rev - prev.pnl.revenue) / prev.pnl.revenue : 0;
    const ohGrowth = prev.pnl.overheads ? (last.pnl.overheads - prev.pnl.overheads) / prev.pnl.overheads : 0;
    if (last.pnl.overheads > prev.pnl.overheads && ohGrowth - salesGrowth > 0.05) {
      const ahead = last.pnl.overheads - prev.pnl.overheads * (1 + Math.max(0, salesGrowth));
      out.push({
        key: "overheads", area: "grow", urgent: false, size: ahead,
        title: "Overheads grew faster than sales",
        finding: `Overheads rose ${m(last.pnl.overheads - prev.pnl.overheads)} (${r1(ohGrowth * 100)}%) while sales rose ${r1(salesGrowth * 100)}% — about ${m(ahead)} more than sales growth would explain.`,
        cause: "Costs were added ahead of the sales that pay for them — people, premises or systems.",
        direction: `Hold overheads at ${y}'s ${m(last.pnl.overheads)} and let them grow only with sales.`,
        where: { label: "Overheads", to: "overheads" },
        ask: `Which of ${y}'s new costs were one-offs, and which are permanent? Did they buy capacity for more sales?`,
        target: { kind: "overheadsCap", value: Math.round(last.pnl.overheads) },
      } as Issue);
    }

    /* ---- customers paying ---- */
    const dPrev = prev.days.debtorDays, dLast = last.days.debtorDays;
    if (dLast - dPrev >= 5 || (dLast > 45 && dLast > dPrev)) {
      /* Last year's collection speed on this year's sales — the same figure as the debtor lever (§6.173). */
      const tied = Math.max(0, last.balanceSheet.accountsReceivable - (prev.pnl.revenue > 0 ? (prev.balanceSheet.accountsReceivable / prev.pnl.revenue) * rev : 0));
      out.push({
        key: "debtors", area: "borrow", urgent: false, size: tied,
        title: "Customers are paying slower",
        finding: `Customers took ${dLast} days to pay in ${y}, up from ${dPrev} — about ${m(tied)} more cash sitting in unpaid invoices.`,
        cause: "Slower payers, bigger jobs on longer terms, or invoices going out late.",
        direction: `Plan debtor days at ${dPrev} on Assumptions, and agree how collections get there.`,
        where: { label: "Assumptions → Days & timing", to: "assumptions?area=days" },
        ask: "Who are the slowest payers? Are invoices going out when the work is done, and are deposits taken on big jobs?",
        target: { kind: "debtorDays", value: dPrev },
      } as Issue);
    }
  }

  /* ---- a loss the margin and overheads findings do not already explain ---- */
  if (last.pnl.operatingProfit < 0 && !out.some((i) => i.key === "margin" || i.key === "overheads")) {
    out.push({
      key: "loss", area: "grow", urgent: false, size: -last.pnl.operatingProfit,
      title: "The business is trading at a loss",
      finding: `${y} made an operating loss of ${m(-last.pnl.operatingProfit)}.`,
      cause: "Gross profit does not cover the overheads.",
      direction: `Break even needs ${m(-last.pnl.operatingProfit)} more gross profit or that much less in overheads — plan which, before any growth.`,
      where: { label: "Overheads", to: "overheads" },
      ask: "Which lever is realistic — price, volume, direct cost or overheads — and by when?",
      target: { kind: "breakEven", value: 0 },
    } as Issue);
  }

  /* Survival first, then by money at stake. */
  return out.map((i) => ({ ...i, size: r2(Math.max(0, i.size)) }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.size - a.size);
}

/** WHAT THE PLANNER STILL NEEDS FROM THE CLIENT — one list, the agenda for the next meeting. */
export type AskItem = { label: string; why: string; done: boolean; to: string };
