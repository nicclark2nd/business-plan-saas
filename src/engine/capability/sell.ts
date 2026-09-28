import type { CapabilityInput, Metric } from "./model";
import { NO_EARNINGS, ebitda, over, r1, r2 } from "./model";
import { TRANSFER_FACTORS, saleYear } from "./judgements";

/**
 * CAPABILITY TO SELL (§6.128.2).
 *
 * The question: would the earnings and the customers survive a change of owner, and is the price being
 * asked one a buyer could justify?
 *
 * WHERE THE SOFT FIGURES LIVE, AND WHY NOT HERE (§6.129).
 *
 * §6.128.2 got this half right and half wrong. The asking price, the owner add-backs and the comparable
 * multiples are indeed not plan facts — they are a POSITION IN A NEGOTIATION — but the conclusion drawn from
 * that was "so type them on the dashboard and throw them away", which meant the sale score changed between
 * two visits and nothing could print it. They are beliefs, and a plan is allowed to store a belief: the four
 * numbers are now in Plan settings → Exit & sale, and the six change-of-owner judgements are scored on
 * Leadership Team → Risk & Succession, where they are also the key-person risk a lender asks about.
 *
 * So this file reads and judges. It collects nothing, and a measure with no figure behind it names the box
 * that would fill it rather than growing one.
 *
 * TWO THINGS ARE STILL MISSING AND SAY SO. Nothing in this app holds customers, so the concentration
 * measure a buyer cares most about cannot be answered at all — it sits on the screen dark, with the
 * sentence saying what would answer it, because a valuation page that quietly omits the largest risk in
 * most small businesses is worse than one that names it (§6.89). And maintenance capex is proxied by
 * depreciation, which is a convention rather than a fact, so the card says that out loud.
 */

const pct = (v: number) => `${r1(v)}%`;

export function sellMetrics(i: CapabilityInput): Metric[] {
  /*
   * ONE YEAR FOR THE WHOLE TAB (§6.163). The price was judged on the sale year while the margin, the cash
   * return and the leadership share were judged on Year 1 — so SEQ's Plan view priced 2028 earnings beside a
   * 2027 margin. A buyer looks at one set of numbers: the year the sale is aimed at (Year 1 until one is
   * chosen). Every card below reads that year; only revenue growth still compares two.
   */
  const saleAt = saleYear(i.sale);
  const y1 = i.pnl[saleAt], y2 = i.pnl[saleAt + 1] ?? (saleAt > 1 ? undefined : i.pnl[2]);
  const bs1 = i.balanceSheet[saleAt];
  const cf1 = i.cashFlow[saleAt];
  const m = i.money;
  const sale = i.sale;
  const FIX_PRICE = { label: "Set the asking price", to: "settings?area=exit" };
  const FIX_RANGE = { label: "Add what similar businesses sold for", to: "settings?area=exit" };
  const FIX_TRANSFER = { label: "Score the six new-owner questions", to: "people?area=risk" };

  const e1 = ebitda(y1);
  /* Normalised: what a buyer would inherit, once the seller's own costs are put back. */
  const normalised = e1 === null ? null : r2(e1 + (sale.addBacks ?? 0));
  const normalisedMargin = y1?.revenue ? over(normalised, y1.revenue) : null;

  /*
   * CASH CONVERSION NEEDS EARNINGS TO CONVERT (§6.129.1, the sixth costume). SEQ read "186.8% · Healthy"
   * because operating cash of −137,633 divided by EBITDA of −76,054 is a positive number. Two negatives do
   * not make a business that turns its profit into cash; they make one that has neither.
   */
  const conversion = cf1 && e1 !== null && e1 > 0 ? over(cf1.netOperating, e1) : null;

  /*
   * MAINTENANCE CAPEX, PROXIED BY DEPRECIATION. A business that spends its depreciation keeps its assets
   * standing still, which is the definition being reached for. It is a convention, not a measurement, and
   * the confidence line on the card says so rather than letting it pass as fact.
   */
  const maintenance = y1?.depreciation ?? null;
  const fcf = cf1 && maintenance !== null ? r2(cf1.netOperating - maintenance) : null;
  const fcfMargin = y1?.revenue ? over(fcf, y1.revenue) : null;

  const revGrowth = y1 && y2 ? over(y2.revenue - y1.revenue, y1.revenue) : null;

  /* After-tax operating profit over the capital the business actually uses. */
  const taxRate = y1 && y1.profitBeforeTax ? Math.max(0, Math.min(0.5, y1.tax / y1.profitBeforeTax)) : 0.25;
  const invested = bs1 ? bs1.equity + bs1.debtCurrent + bs1.debtNonCurrent : null;
  const roic = y1 && invested && invested > 0 ? over(y1.operatingProfit * (1 - taxRate), invested) : null;

  const price = sale.askingPrice !== null && sale.askingPrice > 0 ? sale.askingPrice : null;
  /*
   * THE PRICE IS JUDGED ON THE SALE YEAR'S EARNINGS (§6.135). `normalised` above stays Year 1 for the margin
   * and leadership measures; the multiple uses the year the client said the sale is aimed at.
   */
  const sy = saleYear(sale);
  const eSale = ebitda(i.pnl[sy]);
  const normalisedSale = eSale === null ? null : r2(eSale + (sale.addBacks ?? 0));
  const multiple = price && normalisedSale && normalisedSale > 0 ? over(price, normalisedSale) : null;
  const yieldOnPrice = price && fcf !== null ? over(fcf, price) : null;

  /*
   * ALL SIX OR NOTHING (§6.89). An average over four of the six factors is not a partial answer, it is a
   * flattering one — whichever two were skipped are the two a seller was least comfortable scoring. Rows only
   * exist for factors actually judged, so counting them is the check.
   */
  const scored = i.transfer.filter((t) => t.score > 0).map((t) => t.score);
  const transfer = scored.length === TRANSFER_FACTORS.length
    ? r1(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  /* Named in the sentence below, because "3 of 6 scored" is more use than "not answered". */
  const transferNote = i.transfer.find((t) => t.score > 0 && (t.note ?? "").trim())?.note ?? null;

  const leadershipShare = i.leadershipPay !== null && normalised && normalised > 0
    ? over(i.leadershipPay, normalised) : null;
  /* 1,580% is not a reading anyone can use; "15.8× the earnings" is (§6.163). */
  const shareShown = (v: number) => (v > 1 ? `${r1(v)}× profit` : pct(v * 100));
  const intensity = bs1 && y1?.revenue ? over(bs1.fixedAssets, y1.revenue) : null;

  /* Both or neither: a range with one end is not a range, and the price dial needs a top to judge against. */
  const ranged = sale.multipleLow !== null && sale.multipleHigh !== null;
  const high = sale.multipleHigh ?? 0;
  const low = sale.multipleLow ?? 0;

  return [
    {
      key: "priceMultiple", name: "Asking price ÷ profit", unit: "x",
      /*
       * THIS IS THE DECISIVE MEASURE, so it is the one that must not be judged on half its inputs. A price
       * with no comparable range has nothing to be too high against, so the value waits — and because the
       * weight is 3, guessing a range here would cap a perfectly sound plan at 49 on a number the app made up.
       */
      ...(price && normalisedSale !== null && normalisedSale <= 0 ? { unscored: NO_EARNINGS } : {}),
      value: multiple === null || !ranged ? null : r2(multiple),
      display: multiple === null ? "—" : `${r2(multiple)}×`,
      min: 0, max: Math.max(8, high * 1.6),
      bands: ranged
        ? [{ to: high, s: "good" }, { to: high + 0.4, s: "watch" }, { to: Number.MAX_SAFE_INTEGER, s: "bad" }]
        : [{ to: Number.MAX_SAFE_INTEGER, s: "good" }],
      sub: price && normalisedSale ? `${m(price)} against ${m(normalisedSale)} of Year ${sy} profit (after add-backs)` : undefined,
      note: multiple === null ? "The one number a buyer looks at first."
        : !ranged ? `The price is ${r2(multiple)}× profit. To know if that is high or low, it needs what similar businesses sold for.`
        : multiple > high ? `Higher than similar businesses have sold for. At ${high}× the price would be ${m(normalisedSale! * high)}.`
        : multiple < low ? "Lower than similar businesses have sold for — the price may be too low."
        : "In line with what similar businesses have sold for.",
      bench: ranged ? `Similar businesses sold for ${low}× to ${high}× profit` : "Add what similar businesses sold for in Plan settings",
      formula: `Asking price ÷ (Year ${sy} EBITDA + owner add-backs)${sy === 1 && sale.exitYear === null ? " — Year 1 until a sale year is chosen in Plan settings → Exit & sale" : ", the year the sale is aimed at"}`,
      reveals: "Whether the price can be justified against what similar businesses actually changed hands for.",
      confidence: "The arithmetic is exact; the comparable range is your judgement, and it is the part a buyer will argue with.",
      missing: multiple === null ? "An asking price in Plan settings, and a plan that makes a profit."
        : !ranged ? "What similar businesses sold for, in Plan settings." : undefined,
      fix: multiple === null ? FIX_PRICE : !ranged ? FIX_RANGE : undefined,
    },
    {
      key: "normalisedMargin", name: "Profit margin after add-backs", unit: "pct",
      value: normalisedMargin === null ? null : r1(normalisedMargin * 100),
      display: normalisedMargin === null ? "—" : pct(normalisedMargin * 100),
      min: 0, max: 30, bands: [{ to: 8, s: "bad" }, { to: 12, s: "watch" }, { to: 30, s: "good" }],
      sub: normalised !== null && y1 ? `${m(normalised)} on ${m(y1.revenue)}` : undefined,
      /*
       * A LOSS IS SAID IN WORDS, NOT LEFT TO A MINUS SIGN (§6.115.1). On SEQ this card read "−3.5%" over the
       * sentence "No add-backs entered, so this is the plan's own EBITDA" — a note about bookkeeping on a
       * business that has nothing to sell. The worst fact goes first, always.
       */
      note: normalisedMargin === null ? "Needs a Year 1 forecast."
        : normalisedMargin < 0 ? `The business makes a loss of ${m(Math.abs(normalised ?? 0))} before interest, tax and depreciation. No one pays a multiple of a loss${sale.addBacks ? ", and the add-backs entered do not cover it" : " — if there are add-backs, enter those first"}.`
        : sale.addBacks ? `Includes ${m(sale.addBacks)} of add-backs. A buyer's accountant will check every one.`
        : "No add-backs entered yet. Most owner-run businesses have some — costs a new owner would not have.",
      bench: "8% to 12% is normal for a small business. More than that helps the sale",
      formula: "(EBITDA + owner add-backs from Plan settings) ÷ revenue",
      reveals: "The operating profit a buyer might reasonably expect to inherit.",
      confidence: "Medium once add-backs are entered — they are a claim, not a measurement.",
      missing: normalisedMargin === null ? "A Year 1 forecast with sales and costs." : undefined,
    },
    {
      key: "fcfYield", name: "Cash return on the asking price", unit: "pct",
      value: yieldOnPrice === null ? null : r1(yieldOnPrice * 100),
      display: yieldOnPrice === null ? "—" : pct(yieldOnPrice * 100),
      min: 0, max: 30, bands: [{ to: 8, s: "bad" }, { to: 12, s: "watch" }, { to: 30, s: "good" }],
      sub: price ? `Against ${m(price)}` : undefined,
      note: yieldOnPrice === null ? "What a buyer's money would earn at this price."
        : yieldOnPrice * 100 < 10 ? "A buyer could earn more elsewhere for less work. Expect them to push the price down."
        : "A return a buyer would take seriously for the risk of running a business.",
      bench: "Buyers of small businesses usually want 12% or more",
      formula: "Free cash flow ÷ asking price",
      reveals: "The cash return the price implies, before financing and deal costs.",
      confidence: "Medium — it inherits the maintenance-capex assumption below.",
      missing: yieldOnPrice === null ? "An asking price, in Plan settings → Exit & sale." : undefined,
      fix: yieldOnPrice === null ? FIX_PRICE : undefined,
    },
    {
      key: "transferability", name: "Survives a change of owner", unit: "plain",
      value: transfer, display: transfer === null ? "—" : `${transfer} / 5`,
      min: 1, max: 5, bands: [{ to: 2.5, s: "bad" }, { to: 3.5, s: "watch" }, { to: 5, s: "good" }],
      sub: transfer === null
        ? `${scored.length} of ${TRANSFER_FACTORS.length} scored`
        : `Average of ${TRANSFER_FACTORS.length} scores`,
      note: transfer === null
        ? `Six scores on Leadership Team → Risk & Succession, and ${scored.length} are done. This waits for all six, because the ones left out are usually the hardest to face.`
        : transfer < 2.5 ? "Most of what makes this business work would leave with the owner. That stops more sales than price does."
        : transfer < 3.5 ? `It could be handed over, with work. Fix each weak area before putting the business up for sale, not during.${transferNote ? ` Your own note: “${transferNote}”.` : ""}`
        : "The business would keep running under a new owner. That is what a buyer is really paying for.",
      bench: "Below 3 and a buyer is buying a job, not a business",
      formula: `The average of the ${TRANSFER_FACTORS.length} judgements scored on Leadership Team → Risk & Succession, each 1 to 5`,
      reveals: "Whether there is a business here or an owner with customers.",
      confidence: "It is a judgement, yours or your client's. It is the softest thing on this page and often the most important.",
      missing: transfer === null ? `All six new-owner questions scored on Leadership Team → Risk & Succession.` : undefined,
      fix: transfer === null ? FIX_TRANSFER : undefined,
    },
    {
      key: "recurringShare", name: "Revenue from ongoing clients", unit: "pct",
      value: i.recurringShare === null ? null : r1(i.recurringShare * 100),
      display: i.recurringShare === null ? "—" : pct(i.recurringShare * 100),
      min: 0, max: 100, bands: [{ to: 30, s: "bad" }, { to: 55, s: "watch" }, { to: 100, s: "good" }],
      note: i.recurringShare === null ? "Needs products on the Sales step."
        : i.recurringShare * 100 < 30 ? "Almost all sales have to be won again next year, so a buyer will pay less."
        : "A good part of next year's sales is already locked in.",
      bench: "Above 55% and a buyer can see next year's sales already coming",
      formula: "Year 1 revenue from products marked Ongoing client ÷ total Year 1 revenue",
      reveals: "How much of the revenue a buyer inherits rather than has to go and win.",
      confidence: "High — it reads how you marked each product on the Sales step.",
      missing: i.recurringShare === null ? "Products on the Sales step, marked one-off or ongoing." : undefined,
      fix: i.recurringShare === null ? { label: "Add products", to: "sales" } : undefined,
    },
    {
      /*
       * WHAT REPLACED THE PERMANENTLY-BLANK CUSTOMER CARD (§6.128.4).
       *
       * §6.128.2 put an unanswerable "largest customer share" on this tab, reasoning that naming the gap
       * beat hiding it. Seen on a real screen, it was one of four grey cards clustered where the eye
       * lands first, and the honesty cost more than it bought.
       *
       * This is the concentration the plan genuinely holds. It is not the same question — a business can
       * sell one product to four hundred customers — so the card says which question it is answering and
       * where the other one has to come from.
       */
      key: "largestProduct", name: "Largest product share", unit: "pct",
      value: i.largestProductShare === null ? null : r1(i.largestProductShare * 100),
      display: i.largestProductShare === null ? "—" : pct(i.largestProductShare * 100),
      min: 0, max: 100, bands: [{ to: 35, s: "good" }, { to: 60, s: "watch" }, { to: 100, s: "bad" }],
      note: i.largestProductShare === null ? "Needs products on the Sales step."
        : i.largestProductShare * 100 > 60 ? "Most sales come from one product. A buyer will ask what happens if it stops selling."
        : "Sales are spread across enough products that no single one carries the business.",
      bench: "Above 60% from one product and a buyer is buying that product, not the business",
      formula: "Year 1 revenue from the largest product or service ÷ total Year 1 revenue",
      reveals: "How much of the earnings depend on one thing continuing to sell.",
      confidence: "High for products — but this is NOT customer concentration, which is what a buyer asks first. This app holds no customers; work that one out from your sales ledger.",
      missing: i.largestProductShare === null ? "Products on the Sales step." : undefined,
      fix: i.largestProductShare === null ? { label: "Add products", to: "sales" } : undefined,
    },
    {
      key: "leadershipPay", name: "Leadership pay against earnings", unit: "pct",
      ...(leadershipShare === null && i.leadershipPay !== null && normalised !== null && normalised <= 0 ? { unscored: NO_EARNINGS } : {}),
      value: leadershipShare === null ? null : r1(leadershipShare * 100),
      display: leadershipShare === null ? "—" : shareShown(leadershipShare),
      min: 0, max: 150, bands: [{ to: 40, s: "good" }, { to: 80, s: "watch" }, { to: 150, s: "bad" }],
      /* No "141,400 against −76,054": a share of a negative number is not a comparison, so the sub goes. */
      sub: i.leadershipPay !== null && normalised !== null && normalised > 0
        ? `${m(i.leadershipPay)} against ${m(normalised)}` : undefined,
      /*
       * TWO REASONS TO BE BLANK, AND THEY ARE NOT THE SAME SENTENCE (§6.128.4).
       *
       * Caught on SEQ, which HAS a leadership team: the card read "needs people on the Leadership Team
       * step" while two of them sat on that step with salaries. It was blank because the earnings are
       * negative and a share of a negative number means nothing. A missing-data message that names the
       * wrong cause sends a client to fix something that is not broken — worse than saying nothing.
       */
      note: leadershipShare === null && i.leadershipPay !== null
        ? "There is no profit yet, so this cannot be worked out. The pay is real, but the profit to pay it from is not there yet."
        : leadershipShare === null ? "Needs people on the Leadership Team step and a Year 1 forecast."
        : leadershipShare > 1 ? "The people running it are paid more than the business earns. A buyer would have to keep paying them from profit that is not there."
        : leadershipShare * 100 > 80 ? "Paying the people who run it takes most of what the business earns. A buyer has to keep paying that, and will offer less."
        : "There is profit left after paying the people who run the business. That is what a buyer checks.",
      bench: "Under 40% of profit leaves a buyer room. Over 80% leaves little",
      formula: "Year 1 leadership salaries ÷ normalised EBITDA",
      reveals: "Whether the earnings survive paying people to run the business once the owner has gone.",
      confidence: "High — read from the Leadership Team step. A below-market owner salary will flatter it, which is what add-backs are for.",
      missing: leadershipShare === null
        ? (i.leadershipPay !== null
            ? `${m(i.leadershipPay)} of leadership pay, and no profit to pay it from.`
            : "People on the Leadership Team step.")
        : undefined,
      /* No pencil when the earnings are the problem: there is no box on any screen that fixes a loss. */
      fix: leadershipShare === null && i.leadershipPay === null ? { label: "Add the leadership team", to: "people" } : undefined,
    },
    {
      key: "assetIntensity", name: "Assets behind each dollar of sales", unit: "cents",
      value: intensity === null ? null : r2(intensity),
      display: intensity === null ? "—" : `${Math.round(intensity * 100)}¢`,
      min: 0, max: 1.2, bands: [{ to: 0.3, s: "good" }, { to: 0.6, s: "watch" }, { to: 1.2, s: "bad" }],
      sub: bs1 && y1?.revenue ? `${m(bs1.fixedAssets)} of assets on ${m(y1.revenue)}` : undefined,
      note: intensity === null ? "Needs a Year 1 forecast with a balance sheet."
        : intensity > 0.6 ? "The business needs a lot of equipment. A buyer is paying for machines as well as profit, and will ask what needs replacing and when."
        : "The business needs little equipment, so a buyer is mostly paying for the profit.",
      bench: "Under 30¢ is light. Above 60¢ and a buyer is mostly buying equipment",
      formula: "Fixed assets at the end of Year 1 ÷ Year 1 revenue",
      reveals: "How much plant a buyer has to fund to keep the revenue coming.",
      confidence: "High — from the forecast balance sheet. It does not say how old the assets are.",
      missing: intensity === null ? "A Year 1 forecast with a balance sheet." : undefined,
    },
    {
      key: "cashConversion", name: "Operating cash conversion", unit: "pct",
      value: conversion === null ? null : r1(conversion * 100),
      display: conversion === null ? "—" : pct(conversion * 100),
      min: 0, max: 130, bands: [{ to: 70, s: "bad" }, { to: 85, s: "watch" }, { to: 130, s: "good" }],
      note: conversion === null ? "Needs a Year 1 forecast."
        : conversion * 100 < 70 ? "The profit is not turning into cash, and a buyer's accountant will spot that in the first week."
        : conversion * 100 < 85 ? `About ${pct(conversion * 100)} of the profit reaches the bank. A buyer's accountant will ask where the rest is.`
        : "The profit turns into cash, which makes it believable to a buyer.",
      bench: "85% or more",
      formula: "Year 1 cash from operations ÷ EBITDA",
      reveals: "Whether the profit being sold is real.",
      confidence: "High.",
      ...(conversion === null && e1 !== null && e1 <= 0 ? { unscored: NO_EARNINGS } : {}),
      missing: conversion === null
        ? (e1 !== null && e1 <= 0
            ? `The business loses ${m(Math.abs(e1))} before interest, tax and depreciation, so there is no profit to turn into cash. This fills in once it makes money.`
            : "A Year 1 forecast.")
        : undefined,
    },
    {
      key: "freeCashFlow", name: "Free cash flow", unit: "pct",
      value: fcfMargin === null ? null : r1(fcfMargin * 100),
      display: fcf === null ? "—" : m(fcf),
      min: 0, max: 20, bands: [{ to: 3, s: "bad" }, { to: 6, s: "watch" }, { to: 20, s: "good" }],
      sub: fcfMargin === null ? undefined : `${pct(fcfMargin * 100)} of revenue`,
      note: fcf === null ? "Needs a Year 1 forecast."
        : fcf < 0 ? `After keeping its equipment going, the business uses up ${m(Math.abs(fcf))} a year. A buyer would be putting money in, not taking it out.`
        : "The cash left after keeping the equipment going — the money a buyer would actually get.",
      bench: "5% to 7% of sales is good for a small business",
      formula: "Year 1 cash from operations − maintenance capital spending",
      reveals: "The cash a buyer could take out without running the business down.",
      confidence: "Medium — maintenance capex is taken as equal to depreciation, which is a convention, not a measurement of what the assets actually need.",
      missing: fcf === null ? "A Year 1 forecast." : undefined,
    },
    {
      key: "roic", name: "Return on invested capital", unit: "pct",
      value: roic === null ? null : r1(roic * 100),
      display: roic === null ? "—" : pct(roic * 100),
      min: 0, max: 40, bands: [{ to: 8, s: "bad" }, { to: 14, s: "watch" }, { to: 40, s: "good" }],
      note: roic === null ? "Needs a Year 1 forecast with a balance sheet."
        : roic * 100 < 8 ? "The business earns less on the money tied up in it than a buyer could get elsewhere, without the work."
        : "The business earns a strong return on the money tied up in it.",
      bench: "More than the money costs — about 10% to 12%",
      formula: "After-tax operating profit ÷ (equity + debt)",
      reveals: "Whether this is a good business, separately from whether it is a good price.",
      confidence: "Medium — it uses the forecast's own effective tax rate.",
      missing: roic === null ? "A Year 1 forecast with a balance sheet." : undefined,
    },
    {
      key: "revenueGrowth", name: "Revenue growth", unit: "pct",
      value: revGrowth === null ? null : r1(revGrowth * 100),
      display: revGrowth === null ? "—" : pct(revGrowth * 100),
      min: -10, max: 30, bands: [{ to: 0, s: "bad" }, { to: 4, s: "watch" }, { to: 30, s: "good" }],
      note: revGrowth === null ? "Needs two forecast years."
        : revGrowth <= 0 ? "A buyer pays less for a business that is not growing, and will ask why."
        : "Growth a buyer can see in the forecast they are given.",
      bench: "A buyer pays less for flat sales and more for steady growth",
      formula: "(Year 2 revenue − Year 1 revenue) ÷ Year 1 revenue",
      reveals: "Whether the earnings being sold are rising or drifting.",
      confidence: "High.",
      missing: revGrowth === null ? "Sales lines for Year 1 and Year 2." : undefined,
    },
  ];
}

/**
 * Price decides the deal, so it is decisive: a business priced above every comparable is not ready to
 * sell, however good it is. Transferability is next, because it is what makes the earnings survive
 * settlement — and it is the one most sellers have never thought about.
 *
 * NORMALISED MARGIN IS NOW DECISIVE TOO (§6.129.1), and it is the same argument §6.128.1 made about growth.
 * SEQ scored 58 and read "Saleable, with work to do first" on a business losing 76,000 a year, because the
 * one measure that could have capped it — the price against comparables — was unanswerable for want of an
 * asking price, and eight tidy measures carried the rest. A business with no earnings is not saleable with
 * work to do first; there is nothing to apply a multiple to. Weighted decisively, the loss holds the whole
 * tab in the at-risk band and the screen names which measure did it.
 */
export const SELL_WEIGHTS: Record<string, number> = {
  priceMultiple: 3, normalisedMargin: 3, transferability: 2, fcfYield: 2,
  recurringShare: 1.5, cashConversion: 1.5, largestProduct: 1.5, leadershipPay: 1.5,
  freeCashFlow: 1, roic: 1, revenueGrowth: 1, assetIntensity: 1,
};
