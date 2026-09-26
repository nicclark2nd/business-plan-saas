import type { CapabilityInput, Metric } from "./model";
import { LENDER_MIN_DSCR, annualRepayment, borrowingCapacity, ebitda, over, r1, r2 } from "./model";

/**
 * CAPABILITY TO BORROW (§6.128).
 *
 * The question a lender actually asks: can this business repay the loan on time, including if trading
 * gets worse? Everything else on a credit paper is supporting evidence for that one sentence.
 *
 * THE LOAN BEING CONSIDERED IS NOT IN THE PLAN, and that is not an oversight. A loan under consideration
 * is a scenario; writing it into Funding would put debt on the client's balance sheet and change every
 * statement in the app because they were curious. So the proposal is held by the screen, and every metric
 * that needs it says plainly that it is waiting rather than assuming zero (§6.89).
 */

const pct = (v: number) => `${r1(v)}%`;
const times = (v: number) => `${r2(v)}×`;

/**
 * CASH AVAILABLE FOR DEBT SERVICE, defined once.
 *
 * Cash from operations with interest added back — because interest is part of what is being tested, and
 * a figure that has already paid it would be testing the loan against itself. Tax, working capital and
 * the ordinary cost of trading are all already inside it, which is exactly what a lender wants.
 */
const cashForDebtService = (i: CapabilityInput, year: number): number | null => {
  const cf = i.cashFlow[year];
  return cf ? r2(cf.netOperating + cf.interestPaid) : null;
};

/**
 * THE DOWNSIDE, AND WHAT IT IS NOT.
 *
 * This is not a second forecast run. It is the plan's own Year 1 cash, reduced by three effects the
 * client chooses: lost gross profit on lost sales, a thinner margin on what is left, and the extra cash
 * stuck in debtors when people pay later. It is an arithmetic overlay, it says so on the card, and it is
 * deliberately cruder than the forecast rather than quietly pretending to be one (§6.92.1).
 */
export function stressedCash(i: CapabilityInput): number | null {
  const base = cashForDebtService(i, 1);
  const y1 = i.pnl[1];
  if (base === null || !y1 || !y1.revenue) return null;
  const gm = (y1.grossMargin ?? 0) / 100;
  const lostSales = y1.revenue * (i.stress.salesPct / 100);
  const lostOnVolume = lostSales * gm;
  const remaining = y1.revenue - lostSales;
  const lostOnMargin = remaining * (i.stress.marginPts / 100);
  const extraDebtors = (remaining / 365) * i.stress.debtorDaysAdded;
  return r2(base - lostOnVolume - lostOnMargin - extraDebtors);
}

export function borrowMetrics(i: CapabilityInput): Metric[] {
  const y1 = i.pnl[1];
  const bs1 = i.balanceSheet[1];
  const m = i.money;
  const p = i.proposal;

  const existing = i.debtService[1] ?? 0;
  const newService = p ? annualRepayment(p.amount, p.ratePct, p.termYears) : null;
  const totalService = p && newService !== null ? r2(existing + newService) : null;

  const base = cashForDebtService(i, 1);
  const stressed = stressedCash(i);
  const dscr = totalService ? over(base, totalService) : null;
  const dscrStress = totalService ? over(stressed, totalService) : null;

  const e1 = ebitda(y1);
  const debtNow = bs1 ? bs1.debtCurrent + bs1.debtNonCurrent : null;
  const debtPro = debtNow === null ? null : debtNow + (p?.amount ?? 0);
  const netDebt = debtPro === null || !bs1 ? null : debtPro - bs1.cash;
  const leverage = e1 ? over(netDebt, e1) : null;

  const newInterest = p ? p.amount * (p.ratePct / 100) : 0;
  const interestPro = y1 ? y1.interest + newInterest : null;
  const interestCover = y1 && interestPro && interestPro > 0 ? over(y1.operatingProfit, interestPro) : null;

  const current = bs1 ? over(bs1.currentAssets, bs1.currentLiabilities) : null;
  const quick = bs1 ? over(bs1.cash + bs1.accountsReceivable, bs1.currentLiabilities) : null;

  /* Runway is months, so the denominator is a month of outgoings, not a year of them. */
  const outflow = i.cashFlow[1] ? Math.abs(i.cashFlow[1]!.paidToSuppliersAndEmployees) / 12 : null;
  const runway = bs1 && outflow ? over(bs1.cash + (p?.undrawn ?? 0), outflow) : null;

  const lvr = p && p.collateral ? over(p.amount, p.collateral) : null;

  const capacityBase = base !== null && p ? borrowingCapacity(base, existing, p.ratePct, p.termYears, LENDER_MIN_DSCR) : null;
  const capacityStress = stressed !== null && p ? borrowingCapacity(stressed, existing, p.ratePct, p.termYears, LENDER_MIN_DSCR) : null;

  const waiting = "Enter the loan you are considering above.";

  return [
    {
      key: "dscr", name: "Debt service cover", unit: "x",
      value: dscr === null ? null : r2(dscr),
      display: dscr === null ? "—" : times(dscr),
      min: 0.5, max: 3, bands: [{ to: 1, s: "bad" }, { to: LENDER_MIN_DSCR, s: "bad" }, { to: 1.5, s: "watch" }, { to: 3, s: "good" }],
      sub: totalService ? `${m(base ?? 0)} available against ${m(totalService)} of repayments` : `Lenders look for ${LENDER_MIN_DSCR}× or better`,
      note: dscr === null ? "This is the test a lender runs first."
        : dscr < 1 ? "The plan does not generate enough cash to make the repayments at all."
        : dscr < LENDER_MIN_DSCR ? `Below the ${LENDER_MIN_DSCR}× most lenders require. The loan is too large for this cash flow.`
        : `Passes, with ${m((base ?? 0) - (totalService ?? 0) * LENDER_MIN_DSCR)} a year of room above the ${LENDER_MIN_DSCR}× minimum.`,
      bench: `${LENDER_MIN_DSCR}× is the common minimum; 1.0× means no cushion at all`,
      formula: "Cash from operations plus interest ÷ (existing repayments + the proposed loan's repayments)",
      reveals: "The central repayment test, on the actual loan being considered.",
      confidence: "Medium — it rests on the Year 1 forecast being right.",
      missing: dscr === null ? waiting : undefined,
    },
    {
      key: "dscrStressed", name: "Debt service cover, stressed", unit: "x",
      value: dscrStress === null ? null : r2(dscrStress),
      display: dscrStress === null ? "—" : times(dscrStress),
      min: 0.5, max: 3, bands: [{ to: 1, s: "bad" }, { to: LENDER_MIN_DSCR, s: "bad" }, { to: 1.5, s: "watch" }, { to: 3, s: "good" }],
      sub: `Sales −${i.stress.salesPct}%, margin −${i.stress.marginPts} pts, paid ${i.stress.debtorDaysAdded} days later`,
      note: dscrStress === null ? "Shows whether a bad year would break the loan."
        : dscrStress < 1 ? "A moderate downturn leaves the business unable to make the repayments."
        : dscrStress < LENDER_MIN_DSCR ? "A moderate downturn takes cover below what the lender requires — there is no cushion."
        : "Even with the downside applied, the repayments are still covered.",
      bench: "A loan that only works in the good case is a loan that fails in the bad one",
      formula: "Year 1 cash, less the gross profit on lost sales, less the margin squeeze, less the cash stuck in slower debtors — divided by the same repayments.",
      reveals: "Whether a plausible bad year would compromise repayment.",
      confidence: "Medium — an arithmetic overlay on the forecast, not a second forecast run. The three settings are yours to choose.",
      missing: dscrStress === null ? waiting : undefined,
    },
    {
      key: "capacity", name: "What this cash flow supports", unit: "money",
      value: capacityStress, display: capacityStress === null ? "—" : m(capacityStress),
      min: 0, max: Math.max(capacityBase ?? 0, p?.amount ?? 0) * 1.4 || 1,
      bands: p ? [{ to: p.amount * 0.999, s: "bad" }, { to: Number.MAX_SAFE_INTEGER, s: "good" }]
        : [{ to: Number.MAX_SAFE_INTEGER, s: "good" }],
      sub: capacityBase !== null ? `${m(capacityBase)} if the base case holds` : undefined,
      note: capacityStress === null ? "The largest loan this cash flow carries."
        : p && capacityStress < p.amount ? `The loan you are considering is larger than the ${m(capacityStress)} a stressed year supports. The gap has to come from somewhere else — asset finance, equity, or a smaller loan.`
        : "The loan sits inside what the cash flow supports even under stress.",
      bench: "Borrow what the bad year carries, not what the good year allows",
      formula: `The largest loan whose repayments keep cover at ${LENDER_MIN_DSCR}×, at the rate and term entered, using stressed cash`,
      reveals: "How much is actually borrowable, as opposed to how much is wanted.",
      confidence: "Medium — same basis as the stressed cover above.",
      missing: capacityStress === null ? waiting : undefined,
    },
    {
      key: "leverage", name: "Net debt ÷ EBITDA", unit: "x",
      value: leverage === null ? null : r2(leverage),
      display: leverage === null ? "—" : times(leverage),
      min: 0, max: 6, bands: [{ to: 2.5, s: "good" }, { to: 3.5, s: "watch" }, { to: 6, s: "bad" }],
      sub: debtNow !== null && p ? `${times(over(debtNow - (bs1?.cash ?? 0), e1 ?? 1) ?? 0)} before this loan` : undefined,
      note: leverage === null ? "Needs a Year 1 forecast with a balance sheet."
        : leverage > 3.5 ? "Debt is high against earnings — most lenders will baulk before the cover test is even reached."
        : leverage > 2.5 ? "Debt is getting heavy against earnings."
        : "Debt stays modest against what the business earns.",
      bench: "Most lenders prefer under 2.5× for a small business",
      formula: "(Existing debt + the proposed loan − cash) ÷ EBITDA",
      reveals: "The size of the debt burden relative to earnings.",
      confidence: "High.",
      missing: leverage === null ? "A Year 1 forecast." : undefined,
    },
    {
      key: "interestCover", name: "Interest cover", unit: "x",
      value: interestCover === null ? null : r2(interestCover),
      display: interestCover === null ? "—" : times(interestCover),
      min: 0, max: 12, bands: [{ to: 2, s: "bad" }, { to: 3, s: "watch" }, { to: 12, s: "good" }],
      note: interestCover === null ? "No interest in the plan yet, which is its own answer."
        : interestCover < 3 ? "Operating profit barely covers the interest, before any principal is repaid."
        : "Interest is comfortably covered — though this test ignores principal, which the cover test above does not.",
      bench: "3× or better",
      formula: "Operating profit ÷ (interest in the plan + interest on the proposed loan)",
      reveals: "Capacity to pay interest — not the loan itself.",
      confidence: "High.",
      missing: interestCover === null ? "A Year 1 forecast with borrowing in it." : undefined,
    },
    {
      key: "currentRatio", name: "Current ratio", unit: "plain",
      value: current === null ? null : r2(current),
      display: current === null ? "—" : r2(current).toFixed(2),
      min: 0, max: 3, bands: [{ to: 1, s: "bad" }, { to: 1.5, s: "watch" }, { to: 3, s: "good" }],
      note: current === null ? "Needs a forecast balance sheet."
        : current < 1 ? "Short-term bills exceed short-term assets — the business is technically illiquid."
        : current < 1.5 ? "Adequate, but there is not much slack."
        : "Comfortable short-term position.",
      bench: "1.5 or better",
      formula: "Current assets ÷ current liabilities, end of Year 1",
      reveals: "Broad short-term liquidity.",
      confidence: "High.",
      missing: current === null ? "A Year 1 forecast balance sheet." : undefined,
    },
    {
      key: "quickRatio", name: "Quick ratio", unit: "plain",
      value: quick === null ? null : r2(quick),
      display: quick === null ? "—" : r2(quick).toFixed(2),
      min: 0, max: 2.5, bands: [{ to: 0.8, s: "bad" }, { to: 1, s: "watch" }, { to: 2.5, s: "good" }],
      note: quick === null ? "Needs a forecast balance sheet."
        : quick < 1 ? "Meeting short-term bills depends on selling stock, which cannot be relied on in a bad month."
        : "Short-term bills can be met without shifting stock.",
      bench: "1.0 or better",
      formula: "(Cash + receivables) ÷ current liabilities, end of Year 1",
      reveals: "Liquidity without relying on selling inventory.",
      confidence: "High.",
      missing: quick === null ? "A Year 1 forecast balance sheet." : undefined,
    },
    {
      key: "runway", name: "Cash runway", unit: "months",
      value: runway === null ? null : r1(runway),
      display: runway === null ? "—" : `${r1(runway)} months`,
      min: 0, max: 6, bands: [{ to: 1.5, s: "bad" }, { to: 3, s: "watch" }, { to: 6, s: "good" }],
      sub: p?.undrawn ? `Includes ${m(p.undrawn)} of committed undrawn facility` : undefined,
      note: runway === null ? "Needs a forecast balance sheet and cash flow."
        : runway < 1.5 ? "About a month of cover. One slow payer or one bad month and the business is on the phone to the bank."
        : runway < 3 ? "Enough to absorb a slow month, not a slow quarter."
        : "Enough cover to absorb a poor run without borrowing.",
      bench: "Two to three months",
      formula: "(Cash at the end of Year 1 + committed undrawn facilities) ÷ average monthly cash paid out",
      reveals: "How long the business could survive a shortfall.",
      confidence: "High, if the undrawn facility really is committed.",
      missing: runway === null ? "A Year 1 forecast." : undefined,
    },
    {
      key: "lvr", name: "Loan to value", unit: "pct",
      value: lvr === null ? null : r1(lvr * 100),
      display: lvr === null ? "—" : pct(lvr * 100),
      min: 0, max: 100, bands: [{ to: 65, s: "good" }, { to: 75, s: "watch" }, { to: 100, s: "bad" }],
      sub: p?.collateral ? `Against ${m(p.collateral)} of security` : undefined,
      note: lvr === null ? "Tells you whether the lender has enough security to say yes."
        : lvr * 100 > 75 ? "Above the 75% most lenders stop at. Expect a smaller loan or more security."
        : "Inside the range a lender will normally consider.",
      bench: "75% is a common ceiling on secured lending",
      formula: "The proposed loan ÷ the value of what secures it",
      reveals: "Whether there is enough security behind the loan.",
      confidence: "Medium — a desktop valuation is not a bank valuation.",
      missing: lvr === null ? "The loan above, and a value for the security behind it." : undefined,
    },
  ];
}

/**
 * Repayment dominates, because it is the question. Liquidity is second — a business that can service debt
 * on paper and has no cash in the bank still misses a payment. The balance-sheet ratios are context.
 */
export const BORROW_WEIGHTS: Record<string, number> = {
  dscr: 3, dscrStressed: 3, capacity: 2, runway: 2,
  leverage: 1.5, lvr: 1.5, quickRatio: 1, currentRatio: 1, interestCover: 1,
};
