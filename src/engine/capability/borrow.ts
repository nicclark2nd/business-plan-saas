import type { CapabilityInput, Metric } from "./model";
import { annualRepayment, borrowingCapacity, ebitda, over, r1, r2 } from "./model";
import { LENDER_MIN_DSCR, securityGap } from "./judgements";

/**
 * CAPABILITY TO BORROW (§6.128, rebuilt §6.129).
 *
 * The question a lender actually asks: can this business repay its debt on time, including if trading gets
 * worse? Everything else on a credit paper is supporting evidence for that one sentence.
 *
 * THE PROPOSED LOAN IS GONE, AND THE TAB IS BETTER FOR IT.
 *
 * §6.128 asked the client to type an amount, a rate and a term for a loan they were contemplating, and every
 * metric here was measured against that typed loan. Three faults followed from it. The figures were never
 * saved, so the whole tab reset on refresh. The dial and the box sat on the same screen, which is what made a
 * dashboard read as a form. And it was answering a question the plan could not check — a loan that exists
 * only in a text box — while leaving unanswered the two questions the plan can:
 *
 *   1. Is the debt this business ALREADY carries covered, in the base case and in a bad year?
 *   2. What would these earnings support IN TOTAL, so the client can see the room above what they owe?
 *
 * Both come off the forecast. A loan actually being considered belongs on Funding, or bent in What-If, where
 * adding it moves the cash flow, the balance sheet, the statements and this tab together (§6.41) — which is a
 * far better answer than a number in a box that nothing else in the app has heard of.
 *
 * WHAT THE CAPACITY FIGURE IS PRICED AT. Working out the largest supportable loan needs a rate and a term.
 * The rate is the cost of capital the client set on Assumptions, because that is their own statement of what
 * money costs them; the term is stated as a constant below and printed on the card. Neither is guessed: with
 * no cost of capital the measure reports itself unanswerable and points at the box (§6.89).
 */

const pct = (v: number) => `${r1(v)}%`;
const times = (v: number) => `${r2(v)}×`;

/**
 * The term the capacity figure is priced over.
 *
 * A CONSTANT, NAMED, AND PRINTED ON THE CARD. Capacity is not a fact about the business — it is a fact about
 * the business AND a loan shape — so the shape has to be visible. Five years is the ordinary term for small
 * business term debt; a client who wants a different one enters the loan on Funding and reads the cover test
 * above, which is the honest instrument for that question.
 */
export const CAPACITY_TERM_YEARS = 5;

const FIX_COST = { label: "Set the cost of capital", to: "assumptions?area=cash" };
const FIX_STRESS = { label: "Set the downside", to: "assumptions?area=downside" };
const FIX_SECURITY = { label: "Value the security", to: "assets" };

/**
 * CASH AVAILABLE FOR DEBT SERVICE, defined once.
 *
 * Cash from operations with interest added back — because interest is part of what is being tested, and
 * a figure that has already paid it would be testing the loan against itself. Tax, working capital and
 * the ordinary cost of trading are all already inside it, which is exactly what a lender wants.
 */
export const cashForDebtService = (i: CapabilityInput, year: number): number | null => {
  const cf = i.cashFlow[year];
  return cf ? r2(cf.netOperating + cf.interestPaid) : null;
};

/**
 * THE DOWNSIDE, AND WHAT IT IS NOT.
 *
 * This is not a second forecast run. It is the plan's own Year 1 cash, reduced by three effects the client
 * chose on the Assumptions step: lost gross profit on lost sales, a thinner margin on what is left, and the
 * extra cash stuck in debtors when people pay later. It is an arithmetic overlay, it says so on the card, and
 * it is deliberately cruder than the forecast rather than quietly pretending to be one (§6.92.1).
 *
 * ALL THREE SETTINGS OR NONE. A downside with two of the three answered is not a milder downside, it is an
 * incomplete one, and a stressed cover figure built on it would be quoted to a lender as though the whole
 * test had been run (§6.89).
 */
export function stressedCash(i: CapabilityInput, year = 1): number | null {
  const { salesPct, marginPts, debtorDaysAdded } = i.stress;
  if (salesPct === null || marginPts === null || debtorDaysAdded === null) return null;
  const base = cashForDebtService(i, year);
  const p = i.pnl[year];
  if (base === null || !p || !p.revenue) return null;
  const gm = (p.grossMargin ?? 0) / 100;
  const lostSales = p.revenue * (salesPct / 100);
  const lostOnVolume = lostSales * gm;
  const remaining = p.revenue - lostSales;
  const lostOnMargin = remaining * (marginPts / 100);
  const extraDebtors = (remaining / 365) * debtorDaysAdded;
  return r2(base - lostOnVolume - lostOnMargin - extraDebtors);
}

export function borrowMetrics(i: CapabilityInput): Metric[] {
  const y1 = i.pnl[1];
  const bs1 = i.balanceSheet[1];
  const m = i.money;
  const coc = i.growth.costOfCapital;

  /*
   * WHAT THE PLAN ACTUALLY PAYS A LENDER, off the cash flow — principal and interest, every loan's own
   * schedule, fees and timing already inside it. Re-deriving it from the funding rows would be a second
   * reading of one fact, and the two would drift the first time a funding rule changed (§6.41).
   */
  const service = i.debtService[1] ?? 0;
  const hasDebt = service > 0;

  const base = cashForDebtService(i, 1);
  const stressed = stressedCash(i);
  const stressSet = i.stress.salesPct !== null && i.stress.marginPts !== null && i.stress.debtorDaysAdded !== null;
  /*
   * The same guard, one line up (§6.129.1): a business whose operations CONSUME cash has a cover of nothing,
   * not a cover of −10.38×. A negative multiple printed in a cover column is read as a small number by
   * anybody scanning, and it is the worst possible reading of the worst possible position.
   */
  const noCash = base !== null && base <= 0;
  const dscr = hasDebt ? (noCash ? 0 : over(base, service)) : null;
  const dscrStress = hasDebt ? (stressed !== null && stressed <= 0 ? 0 : over(stressed, service)) : null;

  const e1 = ebitda(y1);
  const debtNow = bs1 ? bs1.debtCurrent + bs1.debtNonCurrent : null;
  const netDebt = debtNow === null || !bs1 ? null : debtNow - bs1.cash;
  /*
   * A RATIO WITH A NEGATIVE DENOMINATOR IS NOT A SMALL RATIO (§6.129.1).
   *
   * Caught on SEQ the moment this tab met a real plan, and it is the §6.128.1 fault wearing its third
   * costume. SEQ's EBITDA is negative, so net debt ÷ EBITDA came out at −1.85× — which sailed under the
   * "under 2.5× is good" band and printed HEALTHY beside a business that earns nothing to repay from.
   * Arithmetically true, and a lie on a screen a bank reads.
   *
   * Debt against earnings has no meaning without earnings. The measure withholds itself and says why.
   */
  const leverage = e1 !== null && e1 > 0 ? over(netDebt, e1) : null;

  /*
   * Same rule as the cover test above (§6.129.1): where there is no operating profit the cover is NIL, and
   * "−19.68×" in a column of multiples is read as a small number by anyone scanning it.
   */
  const rawInterestCover = y1 && y1.interest > 0 ? over(y1.operatingProfit, y1.interest) : null;
  const interestCover = rawInterestCover === null ? null : Math.max(0, rawInterestCover);

  const current = bs1 ? over(bs1.currentAssets, bs1.currentLiabilities) : null;
  const quick = bs1 ? over(bs1.cash + bs1.accountsReceivable, bs1.currentLiabilities) : null;

  /* Runway is months, so the denominator is a month of outgoings, not a year of them. */
  const outflow = i.cashFlow[1] ? Math.abs(i.cashFlow[1]!.paidToSuppliersAndEmployees) / 12 : null;
  const runway = bs1 && outflow ? over(bs1.cash + i.undrawn, outflow) : null;

  /*
   * LOAN TO VALUE, ON THE DEBT THAT EXISTS. Not "would this new loan be secured" but "how much of the
   * security is already spoken for" — which is the question a client can act on, and the only one the plan
   * can answer. Null until at least one asset on Fixed Assets carries a figure.
   */
  const gap = securityGap(i.security);
  const lvr = !gap && i.collateral && debtNow !== null ? over(debtNow, i.collateral) : null;

  /*
   * HEADROOM, NOT A VERDICT ON A PARTICULAR LOAN. What the stressed cash flow supports IN TOTAL, at the
   * client's own cost of capital over a stated term, with existing repayments already taken out — so the
   * figure is what could be added, not what could be owed altogether.
   */
  const capacityBase = base !== null && coc !== null ? borrowingCapacity(base, service, coc, CAPACITY_TERM_YEARS, LENDER_MIN_DSCR) : null;
  const capacityStress = stressed !== null && coc !== null ? borrowingCapacity(stressed, service, coc, CAPACITY_TERM_YEARS, LENDER_MIN_DSCR) : null;
  /* What that headroom would cost a year, so a client can weigh it against the repayments they already make. */
  const capacityService = capacityStress !== null && coc !== null ? annualRepayment(capacityStress, coc, CAPACITY_TERM_YEARS) : null;

  const noDebt = "This plan carries no borrowing, so there is nothing to cover. Add a loan on the Funding step and every figure here answers.";

  return [
    {
      key: "dscr", name: "Debt service cover", unit: "x",
      value: dscr === null ? null : r2(dscr),
      display: dscr === null ? "—" : times(dscr),
      min: 0.5, max: 3, bands: [{ to: 1, s: "bad" }, { to: LENDER_MIN_DSCR, s: "bad" }, { to: 1.5, s: "watch" }, { to: 3, s: "good" }],
      /* §6.115.1 once more: "−137,633 available" is a minus sign asked to carry a whole sentence. */
      sub: !hasDebt ? `Lenders look for ${LENDER_MIN_DSCR}× or better`
        : noCash ? `${m(service)} of repayments, and nothing coming out of trading to make them with`
        : `${m(base ?? 0)} available against ${m(service)} of repayments`,
      note: dscr === null ? noDebt
        : noCash ? `Year 1 operations consume ${m(Math.abs(base ?? 0))} rather than producing any. There is no cash to repay from at all, so the cover is nil.`
        : dscr < 1 ? "The plan does not generate enough cash to make the repayments it has committed to."
        : dscr < LENDER_MIN_DSCR ? `Below the ${LENDER_MIN_DSCR}× most lenders require. This debt is large for this cash flow, before anything is added to it.`
        : `Passes, with ${m((base ?? 0) - service * LENDER_MIN_DSCR)} a year of room above the ${LENDER_MIN_DSCR}× minimum.`,
      bench: `${LENDER_MIN_DSCR}× is the common minimum; 1.0× means no cushion at all`,
      formula: "Cash from operations plus interest ÷ the principal and interest the plan repays in Year 1",
      reveals: "The central repayment test, on the debt the plan actually carries.",
      confidence: "Medium — it rests on the Year 1 forecast being right.",
      missing: dscr === null ? noDebt : undefined,
      fix: dscr === null ? { label: "Add the borrowing", to: "funding" } : undefined,
    },
    {
      key: "dscrStressed", name: "Debt service cover, stressed", unit: "x",
      value: dscrStress === null ? null : r2(dscrStress),
      display: dscrStress === null ? "—" : times(dscrStress),
      min: 0.5, max: 3, bands: [{ to: 1, s: "bad" }, { to: LENDER_MIN_DSCR, s: "bad" }, { to: 1.5, s: "watch" }, { to: 3, s: "good" }],
      sub: stressSet
        ? `Sales −${i.stress.salesPct}%, margin −${i.stress.marginPts} pts, paid ${i.stress.debtorDaysAdded} days later`
        : "The downside has not been described yet",
      note: dscrStress === null
        ? (!stressSet ? "A bad year has to be described before it can be tested. Three numbers on the Assumptions step, and this answers." : noDebt)
        : dscrStress < 1 ? "The downside you described leaves the business unable to make its repayments."
        : dscrStress < LENDER_MIN_DSCR ? "The downside takes cover below what a lender requires — there is no cushion."
        : "Even with your downside applied, the repayments are still covered.",
      bench: "Debt that only works in the good case is debt that fails in the bad one",
      formula: "Year 1 cash, less the gross profit on lost sales, less the margin squeeze, less the cash stuck in slower debtors — divided by the same repayments.",
      reveals: "Whether a plausible bad year would compromise repayment.",
      confidence: "Medium — an arithmetic overlay on the forecast, not a second forecast run. The three settings are yours.",
      missing: dscrStress === null ? (!stressSet ? "A downside case on the Assumptions step." : noDebt) : undefined,
      fix: dscrStress === null ? (!stressSet ? FIX_STRESS : { label: "Add the borrowing", to: "funding" }) : undefined,
    },
    {
      key: "capacity", name: "What this cash flow would still support", unit: "money",
      value: capacityStress, display: capacityStress === null ? "—" : m(capacityStress),
      min: 0, max: Math.max(capacityBase ?? 0, 1) * 1.4,
      /*
       * A HEADROOM FIGURE HAS NO FAILING BAND, and inventing one would be the §6.128.1 fault in reverse:
       * a business with no room to borrow is not thereby a bad business, it is a fully-lent one. The number
       * is context for the cover tests above, so every value reads the same.
       */
      bands: [{ to: Number.MAX_SAFE_INTEGER, s: "good" }],
      /* §6.115.1: "0 if the base case holds" beside a grey dial is a figure nobody can read. Say it. */
      sub: capacityBase === null ? undefined
        : capacityBase <= 0 ? "Even the base case supports nothing further"
        : `${m(capacityBase)} if the base case holds`,
      note: capacityStress === null
        ? (coc === null ? "How much more this cash flow would carry. It needs a rate to price it at — the cost of capital on the Assumptions step."
          : "Needs a downside case, so the figure is what a bad year supports rather than a good one.")
        : capacityStress <= 0 ? "A stressed year leaves no room for further borrowing at all. What the business already owes uses the cover up."
        : `Room for about ${m(capacityStress)} more, which would add roughly ${m(capacityService ?? 0)} a year to the ${m(service)} already repaid.`,
      bench: "Borrow what the bad year carries, not what the good year allows",
      formula: `The largest additional loan whose repayments keep cover at ${LENDER_MIN_DSCR}×, over ${CAPACITY_TERM_YEARS} years at your cost of capital, using stressed cash`,
      reveals: "How much is actually borrowable, as opposed to how much is wanted.",
      confidence: `Medium — same basis as the stressed cover above, priced over a ${CAPACITY_TERM_YEARS}-year term. A real loan on the Funding step is the exact answer.`,
      missing: capacityStress === null ? (coc === null ? "A cost of capital on the Assumptions step." : "A downside case on the Assumptions step.") : undefined,
      fix: capacityStress === null ? (coc === null ? FIX_COST : FIX_STRESS) : undefined,
    },
    {
      key: "leverage", name: "Net debt ÷ EBITDA", unit: "x",
      value: leverage === null ? null : r2(leverage),
      display: leverage === null ? "—" : times(leverage),
      min: 0, max: 6, bands: [{ to: 2.5, s: "good" }, { to: 3.5, s: "watch" }, { to: 6, s: "bad" }],
      sub: debtNow !== null && bs1 ? `${m(debtNow)} of debt against ${m(bs1.cash)} of cash` : undefined,
      note: leverage === null && e1 !== null && e1 <= 0
        ? `The business loses ${m(Math.abs(e1))} before interest, tax and depreciation. There are no earnings for the debt to be measured against.`
        : leverage === null ? "Needs a Year 1 forecast with a balance sheet."
        : leverage > 3.5 ? "Debt is high against earnings — most lenders will baulk before the cover test is even reached."
        : leverage > 2.5 ? "Debt is getting heavy against earnings."
        : "Debt stays modest against what the business earns.",
      bench: "Most lenders prefer under 2.5× for a small business",
      formula: "(Debt at the end of Year 1 − cash) ÷ EBITDA",
      reveals: "The size of the debt burden relative to earnings.",
      confidence: "High.",
      /*
       * The card prints `missing` INSTEAD of `note` when a measure is unanswered, so the explanation has to
       * live here or the client never reads it (§6.87). A heading with nothing under it is the same fault as
       * a blank with no reason beside it.
       */
      missing: leverage === null
        ? (e1 !== null && e1 <= 0
            ? `The business loses ${m(Math.abs(e1))} before interest, tax and depreciation, so there are no earnings for the debt to be measured against. This answers as soon as it makes money.`
            : "A Year 1 forecast with a balance sheet.")
        : undefined,
    },
    {
      key: "interestCover", name: "Interest cover", unit: "x",
      value: interestCover === null ? null : r2(interestCover),
      display: interestCover === null ? "—" : times(interestCover),
      min: 0, max: 12, bands: [{ to: 2, s: "bad" }, { to: 3, s: "watch" }, { to: 12, s: "good" }],
      note: interestCover === null ? "No interest in the plan yet, which is its own answer."
        : rawInterestCover !== null && rawInterestCover <= 0
          ? `There is no operating profit to cover the interest. The ${m(y1?.interest ?? 0)} of interest is being paid out of a loss, before a dollar of principal.`
        : interestCover < 1 ? "Operating profit does not cover the interest, let alone any principal."
        : interestCover < 3 ? "Operating profit barely covers the interest, before any principal is repaid."
        : "Interest is comfortably covered — though this test ignores principal, which the cover test above does not.",
      bench: "3× or better",
      formula: "Operating profit ÷ the interest in the Year 1 forecast",
      reveals: "Capacity to pay interest — not the debt itself.",
      confidence: "High.",
      missing: interestCover === null ? "A Year 1 forecast with borrowing in it." : undefined,
      fix: interestCover === null ? { label: "Add the borrowing", to: "funding" } : undefined,
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
      sub: i.undrawn ? `Includes ${m(i.undrawn)} of committed undrawn facility` : undefined,
      note: runway === null ? "Needs a forecast balance sheet and cash flow."
        : runway < 1.5 ? "About a month of cover. One slow payer or one bad month and the business is on the phone to the bank."
        : runway < 3 ? "Enough to absorb a slow month, not a slow quarter."
        : "Enough cover to absorb a poor run without borrowing.",
      bench: "Two to three months",
      formula: "(Cash at the end of Year 1 + undrawn facilities from the Funding step) ÷ average monthly cash paid out",
      reveals: "How long the business could survive a shortfall.",
      confidence: "High, if the undrawn facility really is committed — it is taken as the facility total on Funding less what has been drawn.",
      missing: runway === null ? "A Year 1 forecast." : undefined,
    },
    {
      key: "lvr", name: "Loan to value", unit: "pct",
      value: lvr === null ? null : r1(lvr * 100),
      display: lvr === null ? "—" : pct(lvr * 100),
      min: 0, max: 100, bands: [{ to: 65, s: "good" }, { to: 75, s: "watch" }, { to: 100, s: "bad" }],
      sub: gap ? `${m(gap.listed)} of ${m(gap.plant)} of existing plant listed`
        : i.collateral ? `${m(debtNow ?? 0)} of debt against ${m(i.collateral)} of security` : "No asset has a security value yet",
      note: gap ? "Waits until the plant already on the books is listed. Against only part of it, the whole debt would look as though it rested on a machine or two."
        : lvr === null ? "How much of the security behind this business is already spoken for."
        : lvr * 100 > 75 ? "Above the 75% most lenders stop at. There is little security left to offer for anything further."
        : "Inside the range a lender will normally consider, with security to spare.",
      bench: "75% is a common ceiling on secured lending",
      formula: "Debt at the end of Year 1 ÷ what a lender would advance against the assets",
      reveals: "Whether there is security left behind the business.",
      confidence: "Medium — a figure you put against each asset is not a bank valuation.",
      missing: gap ? `The plant already on your balance sheet (${m(gap.plant)}), listed on Fixed Assets with what a lender would advance against it.`
        : lvr === null ? "A security value against at least one asset on the Fixed Assets step." : undefined,
      fix: gap ? { label: "List the existing plant", to: "assets" } : lvr === null ? FIX_SECURITY : undefined,
    },
  ];
}

/**
 * Repayment dominates, because it is the question. Liquidity is second — a business that can service debt
 * on paper and has no cash in the bank still misses a payment. The balance-sheet ratios are context.
 *
 * CAPACITY NO LONGER CARRIES WEIGHT. It scored 2 when it was a verdict on a typed loan ("is the loan you
 * want inside what you can carry"), which was a pass/fail worth counting. As a headroom figure it has no
 * failing band, so a weight on it would add the same points to every plan and tell the score nothing.
 */
export const BORROW_WEIGHTS: Record<string, number> = {
  dscr: 3, dscrStressed: 3, runway: 2,
  leverage: 1.5, lvr: 1.5, quickRatio: 1, currentRatio: 1, interestCover: 1,
};
