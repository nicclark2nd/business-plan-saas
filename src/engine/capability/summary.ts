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

  let happened = "There are no accounts in Historic yet, so everything here rests on the plan alone.";
  if (a && lastOp !== null) {
    const sales = aGrowth === null ? "" : `sales ${aGrowth >= 0 ? "grew" : "fell"} ${pct(aGrowth)} and `;
    const profit = prevOp === null ? (lastOp < 0 ? `the business made a ${m(-lastOp)} operating loss` : `it made ${m(lastOp)} of operating profit`)
      : prevOp >= 0 && lastOp < 0 ? `profit fell into a ${m(-lastOp)} loss`
      : prevOp < 0 && lastOp < 0 ? (lastOp < prevOp ? `the loss grew to ${m(-lastOp)}` : `the loss narrowed to ${m(-lastOp)}`)
      : lastOp < prevOp ? `operating profit fell to ${m(lastOp)}` : `operating profit rose to ${m(lastOp)}`;
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
    : ` and ${m(planOp)} of operating profit`;
  /* The monthly cash is always Year 1's; name its year whenever it is not the growth year. */
  const cash = below > 0 ? `, with the bank below ${bar > 0 ? "your floor" : "zero"} for ${below} of ${p.input.monthlyCash.length} months${gy !== y1 ? ` of ${y1}` : ""}` : "";
  const asks = pGrowth === null
    ? `The plan has no growth to measure in ${gy} yet.`
    : `The plan asks for ${pGrowth >= 0 ? "" : "a fall of "}${pct(pGrowth)} ${pGrowth >= 0 ? "growth" : "in sales"} in ${gy}${result}${cash}.`;

  let t: string;
  if (below > 0) {
    t = talk(f, `Talk to the owner about how ${y1} gets funded before talking about growth.`,
      `Work out how ${y1} gets funded before pushing for growth.`);
  } else if (aGrowth !== null && pGrowth !== null && aGrowth > 0 && pGrowth > aGrowth * 1.5) {
    t = talk(f, `Ask the owner what changes to grow ${pct(pGrowth)} when the business managed ${pct(aGrowth)}.`,
      `Be clear what changes to grow ${pct(pGrowth)} when the business managed ${pct(aGrowth)}.`);
  } else if (planOp !== null && planOp < 0) {
    const when = firstProfit ? ` — the plan reaches a profit in ${y1 + firstProfit - 1}` : "";
    t = talk(f, `Talk to the owner about which costs come down before growing${when}.`, `Work out which costs come down before growing${when}.`);
  } else {
    t = talk(f, "The plan holds together. Talk to the owner about what could knock it off course.",
      "The plan holds together. Think about what could knock it off course.");
  }
  return { happened, asks, talk: t };
}

export function borrowSummary(f: SummaryFacts): Summary {
  const m = f.money, a = f.actual, p = f.plan, y1 = p.firstYear;
  let happened = "There are no accounts in Historic yet, so a lender has only the plan to go on.";
  if (a) {
    const cf = a.posIn.cashFlow[1], bs = a.posIn.balanceSheet[1];
    const service = a.posIn.debtService[1] ?? 0;
    const dscr = val(a.borrow, "dscr");
    const debt = bs ? bs.debtCurrent + bs.debtNonCurrent : 0;
    const trading = cf && cf.netOperating < 0
      ? `trading used ${m(-cf.netOperating)} of cash, so nothing was left for the ${m(service)} of repayments and interest`
      : dscr !== null ? `trading covered repayments and interest ${r1(dscr)}×` : "the business had no loan repayments to cover";
    happened = `In ${a.year} ${trading}. It owes ${m(debt)}, with ${m(bs?.cash ?? 0)} in the bank.`;
  }
  const service = p.input.debtService[1] ?? 0;
  const dscr = val(p.borrow, "dscr");
  const asks = service <= 0 ? "The plan carries no borrowing."
    : dscr === null ? `The plan repays ${m(service)} in ${y1}.`
    : dscr <= 0 ? `The plan repays ${m(service)} in ${y1}, and trading produces no cash to pay it from.`
    : dscr < 1 ? `The plan repays ${m(service)} in ${y1}, and trading does not cover it (${r1(dscr)}×).`
    : dscr < 1.25 ? `The plan repays ${m(service)} in ${y1}, covered ${r1(dscr)}× — under the 1.25× lenders look for.`
    : `The plan repays ${m(service)} in ${y1}, covered ${r1(dscr)}×.`;
  const worst = Math.min(dscr ?? Infinity, a ? val(a.borrow, "dscr") ?? Infinity : Infinity);
  const stressSet = p.input.stress.salesPct !== null && p.input.stress.marginPts !== null && p.input.stress.debtorDaysAdded !== null;
  const t = worst < 1.25
    ? talk(f, "Talk to the owner about restructuring the loans already owed — a longer term or interest-only — before asking for more.",
      "Look at restructuring the loans already owed — a longer term or interest-only — before asking for more.")
    : !stressSet
      ? talk(f, "Describe a bad year on Assumptions, then talk to the owner about how much more a lender would add.",
        "Describe a bad year on Assumptions, then see how much more a lender would add.")
      : talk(f, "Talk to the owner about how much more to borrow, and what it would be secured against.",
        "Work out how much more to borrow, and what it would be secured against.");
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
    ? "There are no accounts in Historic yet — a buyer values proven earnings, so there is nothing to value yet."
    : eNow <= 0 ? `On ${a!.year}'s accounts the business made no earnings${addText} — a buyer has nothing to put a multiple on.`
    : `On ${a!.year}'s accounts the business earned ${m(eNow)}${addText}.`;

  const sy = saleYear(sale);
  const ePlan = earned(p.input, sy);
  const ranged = sale.multipleLow !== null && sale.multipleHigh !== null;
  const price = sale.askingPrice;
  const base = eNow ?? ePlan;
  let asks: string;
  if (price === null) asks = "No asking price is set yet, on Plan settings → Exit & sale.";
  else if (base === null || base <= 0) asks = `The asking price of ${m(price)} cannot be supported by a loss.`;
  else asks = `The asking price of ${m(price)} is ${r1(price / base)}× those earnings${ranged ? `, against similar sales at ${sale.multipleLow}–${sale.multipleHigh}×` : ""}.`;
  if (ePlan !== null && ePlan > 0) asks += ` If the plan is delivered, ${p.firstYear + sy - 1} earnings would be ${m(ePlan)}.`;

  const scored = p.input.transfer.filter((x) => x.score !== null && x.score !== undefined).length;
  const t = base === null || base <= 0
    ? talk(f, "Talk to the owner about getting to a steady profit first — nothing sells on a loss.", "Get to a steady profit first — nothing sells on a loss.")
    : price !== null && ranged && price / base > (sale.multipleHigh as number)
      ? talk(f, "Talk to the owner about the price, or about waiting until the numbers support it.", "Revisit the price, or wait until the numbers support it.")
      : scored < 6
        ? talk(f, "Score the change-of-owner factors, then talk to the owner about how the business runs without them.",
          "Score the change-of-owner factors, then work out how the business runs without you.")
        : talk(f, "Talk to the owner about timing — when the earnings best support the price.", "Think about timing — when the earnings best support the price.");
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
  const held = f.capped.length ? ` ${f.capped.join(" and ")} ${f.capped.length === 1 ? "holds" : "hold"} the score under 50.` : "";
  const means = `${f.headline}.${held}`;
  const top = f.issues[0];
  let t: string;
  if (top) {
    t = `${top.title}. ${f.adviser ? "" : "Ask yourself: "}${top.ask}`;
  } else if (tab === "grow") {
    t = talk(f, "Nothing in the accounts holds growth back. Talk to the owner about what growing would take.",
      "Nothing in the accounts holds growth back. Work out what growing would take.");
  } else if (tab === "borrow") {
    t = talk(f, "Nothing in the accounts would stop a lender. Talk to the owner about what they would borrow for, and against what.",
      "Nothing in the accounts would stop a lender. Work out what you would borrow for, and against what.");
  } else {
    t = f.earnings === null || f.earnings <= 0
      ? talk(f, "Talk to the owner about getting to a steady profit first — nothing sells on a loss.", "Get to a steady profit first — nothing sells on a loss.")
      : f.scored < 6
        ? talk(f, "Score the change-of-owner factors, then talk to the owner about how the business runs without them.",
          "Score the change-of-owner factors, then work out how the business runs without you.")
        : talk(f, "Talk to the owner about what a buyer would pay for these earnings.", "Think about what a buyer would pay for these earnings.");
  }
  return { happened: base.happened, asks: means, talk: t };
}
