import type { CapabilityInput, Metric } from "./model";
import { ebitda, r1 } from "./model";
import { saleYear } from "./judgements";

/**
 * THREE LINES FOR THE PERSON IN THE ROOM (§6.160).
 *
 * The verdict below speaks about the plan. This box speaks to the consultant — or to the owner, when there is
 * no consultant — and reads both views at once: what the accounts say happened, what the plan asks for, and
 * the one conversation to have first. It invents nothing: every figure is on a card further down the page,
 * and every sentence is chosen by a rule, so the same plan always gets the same three lines.
 */
export type Summary = { happened: string; asks: string; talk: string };

export type SummaryFacts = {
  /** Coach, consultant or accounting firm: the talk line is addressed to them, about "the owner". */
  adviser: boolean;
  money: (v: number) => string;
  /** The accounts view — null for a business with no accounts. */
  actual: { growIn: CapabilityInput; posIn: CapabilityInput; year: number; grow: Metric[]; borrow: Metric[] } | null;
  /** The plan: its own input (years 1–5) and the plan-view cards. */
  plan: { input: CapabilityInput; firstYear: number; grow: Metric[]; borrow: Metric[]; monthNames: string[] };
};

const val = (ms: Metric[], key: string) => ms.find((m) => m.key === key)?.value ?? null;
const pct = (v: number) => `${r1(Math.abs(v))}%`;

function talk(f: Pick<SummaryFacts, "adviser">, adviser: string, owner: string) {
  return f.adviser ? adviser : owner;
}

export function growSummary(f: SummaryFacts): Summary {
  const m = f.money, a = f.actual, p = f.plan, y1 = p.firstYear;
  const lastOp = a ? a.posIn.pnl[1]?.operatingProfit ?? null : null;
  const prevOp = a ? a.growIn.pnl[1]?.operatingProfit ?? null : null;
  const aGrowth = a ? val(a.grow, "revenueGrowth") : null;

  let happened = "There are no past accounts in Historic yet, so everything here comes from the plan.";
  if (a && lastOp !== null) {
    const sales = aGrowth === null ? "" : `sales ${aGrowth >= 0 ? "went up" : "went down"} ${pct(aGrowth)} and `;
    const profit = prevOp === null ? (lastOp < 0 ? `the business made a loss of ${m(-lastOp)}` : `it made a profit of ${m(lastOp)}`)
      : prevOp >= 0 && lastOp < 0 ? `the business went from a profit to a loss of ${m(-lastOp)}`
      : prevOp < 0 && lastOp < 0 ? (lastOp < prevOp ? `the loss grew to ${m(-lastOp)}` : `the loss shrank to ${m(-lastOp)}`)
      : lastOp < prevOp ? `profit fell to ${m(lastOp)}` : `profit rose to ${m(lastOp)}`;
    happened = `In ${a.year} ${sales}${profit}.`;
  }

  const pGrowth = val(p.grow, "revenueGrowth");
  /*
   * THE GROWTH YEAR (§6.172). With accounts, growth is measured from the last actual year into Year 1, so the
   * plan's growth year is Year 1. With none there is no year before Year 1, so the Grow tab measures Year 1 into
   * Year 2 — and this line has to name Year 2, not Year 1 (ZZ read "0% growth in 2027" beside a tab reading 2028).
   */
  const gs = a ? 1 : 2;
  const gy = y1 + gs - 1;
  const planOp = p.input.pnl[gs]?.operatingProfit ?? null;
  const floor = p.input.growth.cashBuffer;
  const bar = floor !== null && floor > 0 ? floor : 0;
  const below = p.input.monthlyCash.filter((c) => c < bar).length;
  const firstProfit = [1, 2, 3, 4, 5].find((y) => (p.input.pnl[y]?.operatingProfit ?? 0) > 0) ?? null;
  const result = planOp === null ? ""
    : planOp < 0 ? (lastOp !== null && planOp < lastOp ? " and a bigger loss" : lastOp !== null && lastOp < 0 ? " and a smaller loss" : " and a loss")
    : ` and a profit of ${m(planOp)}`;
  /* The monthly cash is always Year 1's; name its year whenever it is not the growth year. */
  const cash = below > 0 ? `, with the bank below ${bar > 0 ? "your cash floor" : "zero"} for ${below} of ${p.input.monthlyCash.length} months${gy !== y1 ? ` of ${y1}` : ""}` : "";
  const asks = pGrowth === null
    ? `The plan has no growth to measure in ${gy} yet.`
    : `The plan asks for ${pGrowth >= 0 ? "" : "a drop of "}${pct(pGrowth)} ${pGrowth >= 0 ? "growth" : "in sales"} in ${gy}${result}${cash}.`;

  let t: string;
  if (below > 0) {
    t = talk(f, `Talk to the owner about how ${y1} will be paid for before talking about growth.`,
      `Work out how ${y1} will be paid for before pushing for growth.`);
  } else if (aGrowth !== null && pGrowth !== null && aGrowth > 0 && pGrowth > aGrowth * 1.5) {
    t = talk(f, `Ask the owner what will change to grow ${pct(pGrowth)} when the business only managed ${pct(aGrowth)}.`,
      `Be clear what will change to grow ${pct(pGrowth)} when the business only managed ${pct(aGrowth)}.`);
  } else if (planOp !== null && planOp < 0) {
    const when = firstProfit ? ` — the plan makes a profit from ${y1 + firstProfit - 1}` : "";
    t = talk(f, `Talk to the owner about which costs come down before growing${when}.`, `Work out which costs come down before growing${when}.`);
  } else {
    t = talk(f, "The plan works. Talk to the owner about what could throw it off track.",
      "The plan works. Think about what could throw it off track.");
  }
  return { happened, asks, talk: t };
}

export function borrowSummary(f: SummaryFacts): Summary {
  const m = f.money, a = f.actual, p = f.plan, y1 = p.firstYear;
  let happened = "There are no past accounts in Historic yet, so a lender only has the plan to go on.";
  if (a) {
    const cf = a.posIn.cashFlow[1], bs = a.posIn.balanceSheet[1];
    const service = a.posIn.debtService[1] ?? 0;
    const dscr = val(a.borrow, "dscr");
    const debt = bs ? bs.debtCurrent + bs.debtNonCurrent : 0;
    const trading = cf && cf.netOperating < 0
      ? `the business used up ${m(-cf.netOperating)} of cash, so there was nothing left for the ${m(service)} of loan payments`
      : dscr !== null ? `cash from trading covered the loan payments ${r1(dscr)}×` : "the business had no loan payments to make";
    happened = `In ${a.year} ${trading}. It owes ${m(debt)}, with ${m(bs?.cash ?? 0)} in the bank.`;
  }
  const service = p.input.debtService[1] ?? 0;
  const dscr = val(p.borrow, "dscr");
  const asks = service <= 0 ? "The plan has no loans."
    : dscr === null ? `The plan pays ${m(service)} on loans in ${y1}.`
    : dscr <= 0 ? `The plan pays ${m(service)} on loans in ${y1}, but trading brings in no cash to pay it from.`
    : dscr < 1 ? `The plan pays ${m(service)} on loans in ${y1}, and trading does not cover it (${r1(dscr)}×).`
    : dscr < 1.25 ? `The plan pays ${m(service)} on loans in ${y1}, covered ${r1(dscr)}× — less than the 1.25× lenders want.`
    : `The plan pays ${m(service)} on loans in ${y1}, covered ${r1(dscr)}×.`;
  const worst = Math.min(dscr ?? Infinity, a ? val(a.borrow, "dscr") ?? Infinity : Infinity);
  const stressSet = p.input.stress.salesPct !== null && p.input.stress.marginPts !== null && p.input.stress.debtorDaysAdded !== null;
  const t = worst < 1.25
    ? talk(f, "Talk to the owner about changing the loans they already have — a longer term or interest-only — before asking for more.",
      "Look at changing the loans you already have — a longer term or interest-only — before asking for more.")
    : !stressSet
      ? talk(f, "Set up a bad year on Assumptions, then talk to the owner about how much more a bank would lend.",
        "Set up a bad year on Assumptions, then see how much more a bank would lend.")
      : talk(f, "Talk to the owner about how much more to borrow, and what the bank would hold as security.",
        "Work out how much more to borrow, and what the bank would hold as security.");
  return { happened, asks, talk: t };
}

export function sellSummary(f: SummaryFacts): Summary {
  const m = f.money, a = f.actual, p = f.plan;
  const sale = p.input.sale;
  const adds = sale.addBacks ?? 0;
  const earned = (i: CapabilityInput, y: number) => { const e = ebitda(i.pnl[y]); return e === null ? null : e + adds; };
  const eNow = a ? earned(a.posIn, 1) : null;
  const addText = adds > 0 ? ` after ${m(adds)} of owner add-backs` : "";
  const happened = eNow === null
    ? "There are no past accounts in Historic yet. A buyer pays for proven profit, so there is nothing to value yet."
    : eNow <= 0 ? `On ${a!.year}'s accounts the business made no profit${addText} — a buyer has nothing to base a price on.`
    : `On ${a!.year}'s accounts the business made ${m(eNow)}${addText}.`;

  const sy = saleYear(sale);
  const ePlan = earned(p.input, sy);
  const ranged = sale.multipleLow !== null && sale.multipleHigh !== null;
  const price = sale.askingPrice;
  const base = eNow ?? ePlan;
  let asks: string;
  if (price === null) asks = "No asking price has been set yet (Plan settings → Exit & sale).";
  else if (base === null || base <= 0) asks = `A loss cannot support an asking price of ${m(price)}.`;
  else asks = `The asking price of ${m(price)} is ${r1(price / base)}× that profit${ranged ? `. Similar businesses sold for ${sale.multipleLow}–${sale.multipleHigh}×` : ""}.`;
  if (ePlan !== null && ePlan > 0) asks += ` If the plan works, ${p.firstYear + sy - 1} profit would be ${m(ePlan)}.`;

  const scored = p.input.transfer.filter((x) => x.score !== null && x.score !== undefined).length;
  const t = base === null || base <= 0
    ? talk(f, "Talk to the owner about making a steady profit first — no one buys a business that loses money.", "Make a steady profit first — no one buys a business that loses money.")
    : price !== null && ranged && price / base > (sale.multipleHigh as number)
      ? talk(f, "Talk to the owner about the price, or about waiting until the numbers back it up.", "Rethink the price, or wait until the numbers back it up.")
      : scored < 6
        ? talk(f, "Score the six new-owner questions, then talk to the owner about how the business runs without them.",
          "Score the six new-owner questions, then work out how the business runs without you.")
        : talk(f, "Talk to the owner about timing — when the profit best backs up the price.", "Think about timing — when the profit best backs up the price.");
  return { happened, asks, talk: t };
}

/**
 * THE ACCOUNTS VIEW SPEAKS ONLY OF THE ACCOUNTS (§6.169).
 *
 * Nic, 28 Sep 2026: "We are on the button 'Actual: 2025 → 2026' therefore no data or comments should be about
 * the projected year." The three lines used to read both views at once, so the Actual view told him what the
 * plan asks for 2027. Now: what happened (the same line as before — it is the accounts), what it means (the
 * accounts' own verdict, and the measure holding the score down), and what to talk about first — the top
 * problem the Planner's assessment found for this capability, so step 8 and this page say the same thing.
 */
export type ActualSummaryFacts = {
  adviser: boolean;
  /** The verdict headline on the accounts, as the page shows it. */
  headline: string;
  /** Names of the measures holding the score under 50 (the decisive cap). */
  capped: string[];
  /** The assessment's issues for this capability, most urgent first. */
  issues: { title: string; ask: string }[];
  /** Earnings on the latest accounts after add-backs — sell's fallback needs to know whether there are any. */
  earnings: number | null;
  /** How many change-of-owner factors are scored. */
  scored: number;
};

export function actualSummary(tab: "grow" | "borrow" | "sell", base: Summary, f: ActualSummaryFacts): Summary {
  const held = f.capped.length ? ` ${f.capped.join(" and ")} ${f.capped.length === 1 ? "keeps" : "keep"} the score below 50.` : "";
  const means = `${f.headline}.${held}`;
  const top = f.issues[0];
  let t: string;
  if (top) {
    t = `${top.title}. ${f.adviser ? "" : "Ask yourself: "}${top.ask}`;
  } else if (tab === "grow") {
    t = talk(f, "Nothing in the accounts is holding growth back. Talk to the owner about what growing would take.",
      "Nothing in the accounts is holding growth back. Work out what growing would take.");
  } else if (tab === "borrow") {
    t = talk(f, "Nothing in the accounts would stop a bank lending. Talk to the owner about what they would borrow for, and what the bank would hold as security.",
      "Nothing in the accounts would stop a bank lending. Work out what you would borrow for, and what the bank would hold as security.");
  } else {
    t = f.earnings === null || f.earnings <= 0
      ? talk(f, "Talk to the owner about making a steady profit first — no one buys a business that loses money.", "Make a steady profit first — no one buys a business that loses money.")
      : f.scored < 6
        ? talk(f, "Score the six new-owner questions, then talk to the owner about how the business runs without them.",
          "Score the six new-owner questions, then work out how the business runs without you.")
        : talk(f, "Talk to the owner about what a buyer would pay for this profit.", "Think about what a buyer would pay for this profit.");
  }
  return { happened: base.happened, asks: means, talk: t };
}
