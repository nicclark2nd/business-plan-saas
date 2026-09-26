import type { CapabilityInput, Metric } from "./model";
import { ebitda, over, r1, r2 } from "./model";

/**
 * CAPABILITY TO GROW (§6.128).
 *
 * The question: can this business increase profit while funding the cash, people and assets that growth
 * needs? Nearly all of it computes from the forecast already in the plan, which is why it is the tab that
 * ships first.
 *
 * THE ORDER IS AN ARGUMENT, not a list. Growth first (is there any), then what it earns (incremental
 * margin, operating leverage, return on the plan), then what it costs in cash (the cycle, working capital
 * per dollar, conversion), and last the thing that actually stops a growing business — the lowest month.
 * A reader going top to bottom is walked through the case rather than handed nine numbers.
 */

const pct = (v: number) => `${r1(v)}%`;

export function growMetrics(i: CapabilityInput): Metric[] {
  const y1 = i.pnl[1], y2 = i.pnl[2];
  const bs1 = i.balanceSheet[1], bs2 = i.balanceSheet[2];
  const cf1 = i.cashFlow[1];
  const d1 = i.days[1];
  const m = i.money;

  /* Growth is measured Year 1 → Year 2: the forecast's own next step, not a historic comparison. */
  const revGrowth = y1 && y2 ? over(y2.revenue - y1.revenue, y1.revenue) : null;
  const gpGrowth = y1 && y2 ? (y2.revenue - y2.cogs) - (y1.revenue - y1.cogs) : null;
  const incMargin = y1 && y2 && y2.revenue !== y1.revenue ? over(gpGrowth, y2.revenue - y1.revenue) : null;
  /*
   * OPERATING LEVERAGE NEEDS A PROFIT TO BE LEVERAGED (§6.129.1). The denominator is `Math.abs(...)`, so a
   * plan whose LOSS shrinks between two years produced a big cheerful multiple — SEQ read "13.18× · Healthy ·
   * profit is growing faster than sales" on a plan that loses money in both years. A loss getting smaller is
   * worth knowing and is not operating leverage.
   */
  const opLev = y1 && y2 && y1.operatingProfit > 0 && revGrowth
    ? over(over(y2.operatingProfit - y1.operatingProfit, y1.operatingProfit), revGrowth) : null;

  /** Operating working capital: what trading ties up, ignoring cash and debt. */
  const owc = (b?: typeof bs1) => b ? b.accountsReceivable + b.inventory - b.accountsPayable : null;
  const owc1 = owc(bs1), owc2 = owc(bs2);
  const wcPerDollar = owc1 !== null && owc2 !== null && y1 && y2 && y2.revenue !== y1.revenue
    ? over(owc2 - owc1, y2.revenue - y1.revenue) : null;

  const e1 = ebitda(y1);
  /*
   * CASH CONVERSION NEEDS EARNINGS TO CONVERT (§6.129.1, the sixth costume). SEQ read "186.8% · Healthy"
   * because operating cash of −137,633 divided by EBITDA of −76,054 is a positive number. Two negatives do
   * not make a business that turns its profit into cash; they make one that has neither.
   */
  const conversion = cf1 && e1 !== null && e1 > 0 ? over(cf1.netOperating, e1) : null;

  const ccc = d1 ? d1.inventoryDays + d1.debtorDays - d1.creditorDays : null;

  /* The growth investment: next year's capex plus the extra working capital it drags behind it. */
  const invested = (i.capex[2] ?? null) !== null && owc1 !== null && owc2 !== null
    ? (i.capex[2] as number) + Math.max(0, owc2 - owc1) : null;
  const extraProfit = y1 && y2 ? (y2.operatingProfit - y1.operatingProfit) : null;
  const returnOnPlan = invested && invested > 0 ? over(extraProfit, invested) : null;
  /* Computable and judgeable are different things: `judged` is the return only once a bar exists for it. */
  const judged = returnOnPlan !== null && i.growth.costOfCapital !== null ? returnOnPlan : null;

  const lowCash = i.monthlyCash.length ? Math.min(...i.monthlyCash) : null;
  const lowMonth = lowCash === null ? null : i.monthlyCash.indexOf(lowCash) + 1;
  /*
   * BOTH JUDGEMENTS ARE NULLABLE NOW (§6.129), and the two are treated differently on purpose.
   *
   * The cash floor is a THRESHOLD: the lowest month is a fact with or without it, so the value still shows
   * and only the band it is judged against waits. The cost of capital is a BAR: a return on the growth plan
   * means nothing until somebody says what the money costs, so that dial withholds its judgement and points
   * at the box — while still printing the figure in its sentence, because the arithmetic is not the problem.
   */
  const buffer = i.growth.cashBuffer;
  const coc = i.growth.costOfCapital;
  const CASH_FIX = { label: "Set a cash floor", to: "assumptions?area=cash" };

  /*
   * IS THERE A PROFIT TO GROW? (§6.128.1)
   *
   * Found the moment this screen met a real plan. SEQ Concreting scored 100 out of 100 for growth while
   * its own Year 1 forecast loses $137,000 — because not one of the eight measures asked whether the
   * business makes money. Every one of them was true: the cycle was fine, cash held up, the extra sales
   * carried margin. The dashboard was answering "is this growth well run" and printing the answer under a
   * heading that reads "can this business grow".
   *
   * > GROWING A LOSS MAKES A BIGGER LOSS. A score that cannot see that is worse than no score, because it
   * > arrives with a green dial and a sentence saying the plan stands up.
   *
   * So the question comes first, carries the heaviest weight, and is the one thing on the tab that can
   * pull a well-run plan down on its own.
   */
  const opMargin = y2 && y2.revenue ? over(y2.operatingProfit, y2.revenue) : null;

  return [
    {
      key: "operatingMargin", name: "Operating margin", unit: "pct",
      value: opMargin === null ? null : r1(opMargin * 100),
      display: opMargin === null ? "—" : pct(opMargin * 100),
      min: -20, max: 25, bands: [{ to: 0, s: "bad" }, { to: 5, s: "watch" }, { to: 25, s: "good" }],
      sub: y2 ? `${m(y2.operatingProfit)} on ${m(y2.revenue)} in Year 2` : undefined,
      note: opMargin === null ? "Needs a Year 2 forecast."
        : opMargin < 0 ? "The plan loses money in Year 2. Growing it makes the loss bigger, not smaller — this is the thing to fix before anything else on this page."
        : opMargin * 100 < 5 ? "There is a profit, but a thin one. Growth will not have much to work with."
        : "The business makes money before it grows, which is what makes growing it worth doing.",
      bench: "Anything above zero beats growing a loss; 5% gives growth something to work with",
      formula: "Year 2 operating profit ÷ Year 2 revenue",
      reveals: "Whether there is a profit to grow in the first place.",
      confidence: "High — the plan's own forecast.",
      missing: opMargin === null ? "A Year 2 forecast with sales and costs in it." : undefined,
    },
    {
      key: "revenueGrowth", name: "Revenue growth", unit: "pct",
      value: revGrowth === null ? null : r1(revGrowth * 100),
      display: revGrowth === null ? "—" : pct(revGrowth * 100),
      min: -10, max: 30, bands: [{ to: 0, s: "bad" }, { to: 5, s: "watch" }, { to: 30, s: "good" }],
      sub: y1 && y2 ? `${m(y1.revenue)} → ${m(y2.revenue)}` : undefined,
      note: revGrowth === null ? "No forecast to measure growth against yet."
        : revGrowth <= 0 ? "The plan forecasts no growth in Year 2, so nothing below is growth — it is maintenance."
        : `Year 2 revenue is ${pct(revGrowth * 100)} above Year 1 in this plan's own forecast.`,
      bench: "Below the rate of price inflation is not real growth",
      formula: "(Year 2 revenue − Year 1 revenue) ÷ Year 1 revenue",
      reveals: "Whether the plan actually grows, and by how much.",
      confidence: "High — it is the plan's own forecast, not an estimate.",
      missing: revGrowth === null ? "Sales lines for Year 1 and Year 2." : undefined,
      trend: y1 && y2 ? [y1.revenue, y2.revenue] : undefined, trendLabel: "Year 1 to Year 2",
    },
    {
      key: "incrementalMargin", name: "Incremental gross margin", unit: "pct",
      value: incMargin === null ? null : r1(incMargin * 100),
      display: incMargin === null ? "—" : pct(incMargin * 100),
      min: 0, max: 60, bands: [{ to: 15, s: "bad" }, { to: 25, s: "watch" }, { to: 60, s: "good" }],
      sub: y1?.grossMargin !== null && y1?.grossMargin !== undefined ? `Against a ${r1(y1.grossMargin)}% average today` : undefined,
      note: incMargin === null ? "Needs two forecast years with different revenue."
        : y1?.grossMargin != null && incMargin * 100 < y1.grossMargin
          ? "New sales earn a thinner margin than the ones already on the books, so growth dilutes the average."
          : "New sales carry at least the margin the business already earns.",
      bench: "Should be at or above today's gross margin",
      formula: "Change in gross profit ÷ change in revenue, Year 1 to Year 2",
      reveals: "Whether the growth being planned is worth having after direct costs.",
      confidence: "High — both figures come from the forecast.",
      missing: incMargin === null ? "A forecast where Year 2 revenue differs from Year 1." : undefined,
    },
    {
      key: "operatingLeverage", name: "Operating leverage", unit: "x",
      value: opLev === null ? null : r2(opLev),
      display: opLev === null ? "—" : `${r2(opLev)}×`,
      min: 0, max: 3, bands: [{ to: 0.75, s: "bad" }, { to: 1.1, s: "watch" }, { to: 3, s: "good" }],
      note: opLev === null ? "Needs an operating profit in Year 1 to compare against."
        : opLev < 1 ? "Overheads are rising about as fast as sales, so growth is not yet making the business more profitable."
        : "Profit is growing faster than sales — the business is getting more efficient as it grows.",
      bench: "Above 1.0× means profit grows faster than sales",
      formula: "% change in operating profit ÷ % change in revenue, Year 1 to Year 2",
      reveals: "Whether growth improves profit or simply needs costs to rise with it.",
      confidence: "High.",
      missing: opLev === null
        ? (y1 && y1.operatingProfit <= 0
            ? "A Year 1 operating profit. There is no leverage on a loss — only a loss that gets bigger or smaller."
            : "A Year 1 operating profit and some forecast growth.")
        : undefined,
    },
    {
      key: "returnOnPlan", name: "Return on the growth plan", unit: "pct",
      /* The bar is what the money costs, which the client sets — not a number this app picked for them. */
      value: judged === null ? null : r1(judged * 100),
      display: judged === null ? "—" : pct(judged * 100),
      min: 0, max: Math.max(40, (coc ?? 20) * 2),
      bands: coc === null
        ? [{ to: Number.MAX_SAFE_INTEGER, s: "good" }]
        : [{ to: coc, s: "bad" }, { to: coc * 1.3, s: "watch" }, { to: Number.MAX_SAFE_INTEGER, s: "good" }],
      sub: invested ? `${m(extraProfit ?? 0)} more profit on ${m(invested)} invested` : undefined,
      note: returnOnPlan === null ? "Needs Year 2 capital spending recorded on the Fixed Assets step."
        : coc === null ? `The plan returns ${pct(returnOnPlan * 100)} on what the growth costs. Whether that is enough depends on what your money costs, which nobody has said yet.`
        : returnOnPlan * 100 < coc ? `The extra profit does not clear the ${coc}% the money costs. The plan spends more than the growth returns.`
        : "The extra profit clears the cost of capital you set.",
      bench: coc === null ? "It has to beat what the money costs — set that on Assumptions" : `Has to beat the ${coc}% you said the money costs`,
      formula: "Extra operating profit in Year 2 ÷ (Year 2 capex + the extra working capital growth ties up)",
      reveals: "Whether the money the growth plan needs earns an adequate return.",
      confidence: "Medium — it assumes Year 2's capex is what buys Year 2's extra profit, which is rarely exactly true.",
      /*
       * A RETURN WITH NO BAR IS NOT A PASS (§6.89). The percentage is computable and is printed in the note
       * above, but the SCORE must not treat an unjudged return as a good one — so the value is withheld, the
       * metric drops out of both sides of the score, and the pencil points at the box that would settle it.
       */
      missing: returnOnPlan === null ? "Capital spending for Year 2 on the Fixed Assets step."
        : coc === null ? "What your money costs, on the Assumptions step." : undefined,
      fix: returnOnPlan !== null && coc === null
        ? { label: "Set the cost of capital", to: "assumptions?area=cash" }
        : returnOnPlan === null ? { label: "Add Year 2 capex", to: "assets" } : undefined,
    },
    {
      key: "cashCycle", name: "Cash conversion cycle", unit: "days",
      value: ccc, display: ccc === null ? "—" : `${Math.round(ccc)} days`,
      min: 0, max: 150, bands: [{ to: 45, s: "good" }, { to: 70, s: "bad" }, { to: 150, s: "bad" }],
      sub: d1 ? `${d1.inventoryDays} stock + ${d1.debtorDays} debtor − ${d1.creditorDays} creditor` : undefined,
      note: ccc === null ? "Set your working-capital assumptions and this answers itself."
        : ccc > 70 ? "Cash is tied up for more than two months between paying suppliers and being paid."
        : ccc > 45 ? "A normal cycle for a business that carries stock and offers terms."
        : "Cash comes back quickly, which is what makes growth affordable.",
      bench: "Under 45 days is comfortable; over 70 makes growth expensive",
      formula: "Stock days + debtor days − creditor days, from your Assumptions step",
      reveals: "How long every dollar of growth is out of the bank before it comes back.",
      confidence: "High — these are the same days the cash flow forecast runs on.",
      missing: ccc === null ? "Working-capital days on the Assumptions step." : undefined,
    },
    {
      key: "workingCapitalPerDollar", name: "Cash tied up per extra $1 of sales", unit: "cents",
      value: wcPerDollar === null ? null : r2(wcPerDollar),
      display: wcPerDollar === null ? "—" : `${Math.round(wcPerDollar * 100)}¢`,
      min: 0, max: 0.5, bands: [{ to: 0.15, s: "good" }, { to: 0.25, s: "watch" }, { to: 0.5, s: "bad" }],
      sub: wcPerDollar === null ? undefined : `Every ${m(1_000_000)} of new sales ties up ${m(wcPerDollar * 1_000_000)}`,
      note: wcPerDollar === null ? "Needs two forecast years with a balance sheet."
        : wcPerDollar > 0.25 ? "Growth is cash-hungry: a large slice of every new sale sits in stock and debtors before it reaches the bank."
        : "Each extra dollar of sales ties up a manageable amount of cash.",
      bench: "Under 15¢ is comfortable for a business carrying stock",
      formula: "Increase in (receivables + stock − payables) ÷ increase in revenue, Year 1 to Year 2",
      reveals: "How much cash the growth itself will swallow before it pays anything back.",
      confidence: "High.",
      missing: wcPerDollar === null ? "A forecast balance sheet for Year 1 and Year 2." : undefined,
    },
    {
      key: "cashConversion", name: "Operating cash conversion", unit: "pct",
      value: conversion === null ? null : r1(conversion * 100),
      display: conversion === null ? "—" : pct(conversion * 100),
      min: 0, max: 130, bands: [{ to: 70, s: "bad" }, { to: 85, s: "watch" }, { to: 130, s: "good" }],
      note: conversion === null && e1 !== null && e1 <= 0
        ? "There are no earnings to convert — the business makes a loss before interest, tax and depreciation, so no share of it can arrive as cash."
        : conversion === null ? "Needs a Year 1 forecast with an operating profit."
        : conversion * 100 < 70 ? "Profit is not turning into cash — most of it is sitting in stock and unpaid invoices."
        : "Most of the profit the plan forecasts actually arrives as cash.",
      bench: "85% or better means earnings are real cash",
      formula: "Year 1 cash from operations ÷ Year 1 EBITDA",
      reveals: "Whether forecast profit becomes money in the bank.",
      confidence: "High.",
      missing: conversion === null
        ? (e1 !== null && e1 <= 0 ? "Positive earnings. A loss has no share that turns into cash." : "A Year 1 forecast with sales and costs in it.")
        : undefined,
    },
    {
      key: "lowestCash", name: "Lowest month in Year 1", unit: "money",
      value: lowCash, display: lowCash === null ? "—" : m(lowCash),
      min: buffer && buffer > 0 ? -buffer : -(Math.abs(lowCash ?? 100_000) + 100_000),
      max: buffer && buffer > 0 ? buffer * 4 : Math.max(Math.abs(lowCash ?? 0) * 2, 200_000),
      /*
       * WITHOUT A FLOOR THE ONLY LINE IS ZERO, and that is an honest reading rather than a softer one: a plan
       * whose worst month is a thousand dollars in the bank passes a test it should not, and the bench line
       * says so instead of the dial pretending a floor was set.
       */
      bands: buffer && buffer > 0
        ? [{ to: 0, s: "bad" }, { to: buffer, s: "watch" }, { to: Number.MAX_SAFE_INTEGER, s: "good" }]
        : [{ to: 0, s: "bad" }, { to: Number.MAX_SAFE_INTEGER, s: "good" }],
      sub: lowMonth ? `Month ${lowMonth} of Year 1` : undefined,
      note: lowCash === null ? "Needs a monthly cash forecast."
        : lowCash < 0 ? "The plan runs out of money before the year ends. Nothing else on this page matters until that is fixed."
        : buffer !== null && buffer > 0 && lowCash < buffer ? `Cash stays positive but dips below the ${m(buffer)} floor you set.`
        : buffer === null ? "Cash stays above water every month of Year 1 — though nobody has said how far above water it needs to stay."
        : "Cash stays above water every month of Year 1.",
      bench: buffer !== null && buffer > 0
        ? `Your floor is ${m(buffer)} — it is the month, not the year, that runs a business out of money`
        : "No floor set, so this is only judged against zero",
      formula: "The lowest closing balance in the twelve-month cash forecast",
      reveals: "Whether the growth can be funded out of the year as it is planned.",
      confidence: "High — the same monthly figures the dashboard charts.",
      missing: lowCash === null ? "Sales and costs, so the monthly cash forecast can run." : undefined,
      fix: lowCash !== null && buffer === null ? CASH_FIX : undefined,
      trend: i.monthlyCash.length ? i.monthlyCash : undefined, trendLabel: "Year 1, month by month",
    },
  ];
}

/**
 * The weights, and the reasoning for them in one line each.
 *
 * A growth plan fails for one of three reasons: it does not earn enough, it cannot be funded, or it never
 * turns into cash. The cash side carries the most weight because it is the one that kills a business that
 * is otherwise succeeding — which is the whole argument the tab exists to make.
 */
export const GROW_WEIGHTS: Record<string, number> = {
  operatingMargin: 3, lowestCash: 2, cashConversion: 1.5, cashCycle: 1.5, workingCapitalPerDollar: 1.5,
  returnOnPlan: 1.5, incrementalMargin: 1, operatingLeverage: 1, revenueGrowth: 1,
};
