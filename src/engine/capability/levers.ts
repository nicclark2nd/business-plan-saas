import type { BalanceSheetYear, CashFlowYear, PnlYear, WorkingCapitalDays } from "@/engine/forecast/model";
import type { CapabilityInput, Metric } from "./model";
import { annualRepayment, over, r1, r2, statusOf } from "./model";
import { buildView } from "./views";
import type { ActualYear, YearNames } from "./actual";

/**
 * WHAT FIXES IT (§6.173) — the Grow tab's levers, worked out from the dials themselves.
 *
 * Nic, 29 Sep 2026: the text under each dial states facts, but it must also say what the Planner can do — and
 * each dial has to take the others into account. The dials are one business seen eight ways, so the levers
 * come from how they connect: the margin that slipped, the overheads that outran sales, the customers who
 * paid slower. Each lever carries its money, and the page re-scores the judged year with the levers pulled —
 * the same `buildView`, so "what it would take" is measured exactly as the score itself is.
 *
 * Every figure is the app's own; nothing is invented or estimated beyond the one assumption each lever names.
 */
type PlanFacts = Omit<CapabilityInput, "money">;
export type ViewInput = { grow: PlanFacts; position: PlanFacts; growNames: YearNames; positionNames: YearNames };

export type LeverKey = "overheads" | "margin" | "debtors" | "stock" | "loans" | "overdraft" | "price";
/** Which tab the levers are for: it decides which year they change and which cards they are measured on. */
export type LeverKind = "grow" | "borrow" | "sell";
export type Lever = {
  key: LeverKey;
  /** "Hold overheads to sales growth" */
  label: string;
  /** How it is worked out, with the numbers: "Overheads rose 18.5% against sales 5.7% …" */
  detail: string;
  /** Operating profit gained in the judged year. */
  profit: number;
  /** Cash gained in the judged year (profit plus working capital released). */
  cash: number;
  /** Dials whose reading this lever alone moves, by name. */
  moves: string[];
  /** The Planner's-assessment target this lever corresponds to. */
  target: "overheadsCap" | "grossMargin" | "debtorDays" | "loanTermMonths" | null;
  /** Loan payments saved in the judged year (the loan lever). */
  saves?: number;
  /** The asking price now and the price the profit supports (the price lever). */
  price?: { from: number; to: number };
  /** For the payment levers: the days now and the days aimed at. */
  days?: { from: number; to: number };
  effect: Effect;
};

/** What a lever does to the judged year. */
type Effect = {
  cogsCut: number; overheadsCut: number; arCut: number; invCut: number; debtorDays?: number; inventoryDays?: number;
  /** Loan payments saved in the year, and the debt that moves from "due within a year" to "due later". */
  serviceCut: number; reclass: number;
  /** An overdraft arranged but not used — counts towards the cash runway. */
  undrawnAdd: number;
  /** The position-input year the lever changes (Borrow: 1; Sell: the sale year). */
  slot?: number;
  /** A new asking price (the price lever). */
  priceTo?: number;
};
const NONE: Effect = { cogsCut: 0, overheadsCut: 0, arCut: 0, invCut: 0, serviceCut: 0, reclass: 0, undrawnAdd: 0 };

/** Where the levers aim. On the accounts: the year before. On the plan: the agreed targets where there are any. */
export type LeverRefs = { grossMargin?: number | null; overheadsCap?: number | null; debtorDays?: number | null; loanTermMonths?: number | null };

const days = (bal: number, base: number) => (base > 0 ? (bal / base) * 365 : 0);

export function growLevers(i: CapabilityInput, refs: LeverRefs = {}): Omit<Lever, "moves">[] {
  const m = i.money, y1 = i.pnl[1], y2 = i.pnl[2], b1 = i.balanceSheet[1], b2 = i.balanceSheet[2];
  if (!y1 || !y2 || !b2 || y2.revenue <= 0) return [];
  const out: Omit<Lever, "moves">[] = [];
  const g = y1.revenue > 0 ? (y2.revenue - y1.revenue) / y1.revenue : 0;
  const gm = (p: PnlYear) => (p.revenue ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0);

  /* ---- overheads that outran the sales ---- */
  const cap = refs.overheadsCap ?? (y1.overheads > 0 ? y1.overheads * (1 + Math.max(0, g)) : null);
  if (cap !== null) {
    const excess = r2(y2.overheads - cap);
    if (excess >= Math.max(1000, y2.overheads * 0.01)) {
      const ohG = y1.overheads > 0 ? (y2.overheads - y1.overheads) / y1.overheads : 0;
      out.push({
        key: "overheads", target: "overheadsCap",
        label: `Bring overheads down to ${m(cap)}`,
        detail: refs.overheadsCap != null
          ? `The target you agreed. Overheads are ${m(y2.overheads)} now.`
          : `Overheads went up ${r1(ohG * 100)}% while sales went up ${r1(g * 100)}%. Keeping overheads in line with sales keeps ${m(excess)} a year in the business.`,
        profit: excess, cash: excess, effect: { ...NONE, overheadsCut: excess },
      });
    }
  }

  /* ---- the margin ---- */
  const ref = refs.grossMargin ?? gm(y1);
  const gap = ref - gm(y2);
  if (gap >= 0.5) {
    const gain = r2((gap / 100) * y2.revenue);
    out.push({
      key: "margin", target: "grossMargin",
      label: `Lift gross margin back to ${r1(ref)}%`,
      detail: `It is ${r1(gm(y2))}% now. Raising prices or quoting jobs better adds ${m(gain)} a year on the same sales.`,
      profit: gain, cash: gain, effect: { ...NONE, cogsCut: gain },
    });
  }

  /* ---- customers paying ---- */
  const dd2 = days(b2.accountsReceivable, y2.revenue);
  const dd1 = refs.debtorDays ?? (b1 && y1.revenue > 0 ? days(b1.accountsReceivable, y1.revenue) : null);
  if (dd1 !== null && dd2 - dd1 >= 3) {
    const release = r2(b2.accountsReceivable - (dd1 / 365) * y2.revenue);
    if (release >= 1000) {
      out.push({
        key: "debtors", target: "debtorDays",
        label: `Get customers to pay in ${Math.round(dd1)} days`,
        detail: `They take ${Math.round(dd2)} days now. Getting paid sooner puts ${m(release)} back in the bank, once. This is cash, not extra profit.`,
        profit: 0, cash: release, days: { from: Math.round(dd2), to: Math.round(dd1) }, effect: { ...NONE, arCut: release, debtorDays: Math.round(dd1) },
      });
    }
  }

  /* ---- stock ---- */
  const sd2 = days(b2.inventory, y2.cogs);
  const sd1 = b1 && y1.cogs > 0 ? days(b1.inventory, y1.cogs) : null;
  if (sd1 !== null && sd2 - sd1 >= 3) {
    const release = r2(b2.inventory - (sd1 / 365) * y2.cogs);
    if (release >= 1000) {
      out.push({
        key: "stock", target: null,
        label: `Hold less stock — ${Math.round(sd1)} days' worth`,
        detail: `It is ${Math.round(sd2)} days' worth now. Holding less puts ${m(release)} back in the bank, once.`,
        profit: 0, cash: release, effect: { ...NONE, invCut: release, inventoryDays: Math.round(sd1) },
      });
    }
  }

  /* Most money first — profit levers are worth it every year, so they lead a cash lever of the same size. */
  return out.sort((a, b) => (b.profit || b.cash * 0.5) - (a.profit || a.cash * 0.5));
}

/* ------------------------------------------------------------------ *
 * Pulling the levers                                                  *
 * ------------------------------------------------------------------ */

function sum(levers: Pick<Lever, "effect">[]): Effect {
  const e = { ...NONE } as Effect;
  for (const l of levers) {
    const x = l.effect;
    e.cogsCut += x.cogsCut; e.overheadsCut += x.overheadsCut; e.arCut += x.arCut; e.invCut += x.invCut;
    e.serviceCut += x.serviceCut; e.reclass += x.reclass; e.undrawnAdd += x.undrawnAdd;
    if (x.debtorDays !== undefined) e.debtorDays = x.debtorDays;
    if (x.inventoryDays !== undefined) e.inventoryDays = x.inventoryDays;
    if (x.slot !== undefined) e.slot = Math.max(e.slot ?? 1, x.slot);
    if (x.priceTo !== undefined) e.priceTo = x.priceTo;
  }
  return e;
}

function pnlWith(p: PnlYear, e: Effect): PnlYear {
  const profit = e.cogsCut + e.overheadsCut;
  const cogs = p.cogs - e.cogsCut, grossProfit = p.revenue - cogs;
  return {
    ...p, cogs, grossProfit, grossMargin: p.revenue ? r2((grossProfit / p.revenue) * 100) : p.grossMargin,
    overheads: p.overheads - e.overheadsCut, operatingProfit: p.operatingProfit + profit,
    profitBeforeTax: p.profitBeforeTax + profit, netProfit: p.netProfit + profit,
  };
}
/* Profit and loan payments saved arrive as cash; debtors and stock turn into cash (current assets unchanged). */
function bsWith(b: BalanceSheetYear, e: Effect): BalanceSheetYear {
  const added = e.cogsCut + e.overheadsCut + e.serviceCut;
  return {
    ...b, accountsReceivable: b.accountsReceivable - e.arCut, inventory: b.inventory - e.invCut,
    cash: b.cash + added + e.arCut + e.invCut, currentAssets: b.currentAssets + added,
    debtCurrent: b.debtCurrent - e.reclass, debtNonCurrent: b.debtNonCurrent + e.reclass,
    currentLiabilities: b.currentLiabilities - e.reclass,
  };
}
/* Trading cash gains the profit and the working capital; loan payments saved are financing, not trading. */
function cfWith(c: CashFlowYear, e: Effect): CashFlowYear {
  const trading = e.cogsCut + e.overheadsCut + e.arCut + e.invCut;
  return { ...c, netOperating: c.netOperating + trading, netMovement: c.netMovement + trading + e.serviceCut, closingCash: c.closingCash + trading + e.serviceCut };
}
function daysWith(d: WorkingCapitalDays | undefined, e: Effect): WorkingCapitalDays | undefined {
  if (!d) return d;
  return { ...d, ...(e.debtorDays !== undefined ? { debtorDays: e.debtorDays } : {}), ...(e.inventoryDays !== undefined ? { inventoryDays: e.inventoryDays } : {}) };
}
const withYear = <T,>(rec: Partial<Record<number, T>>, k: number, f: (x: T) => T) => (rec[k] === undefined ? rec : { ...rec, [k]: f(rec[k] as T) });

/**
 * The view with the judged year re-run. Grow judges slot 2 of the growth input; Borrow judges slot 1 of the
 * position input. On the accounts the latest actual year is changed too (the year-end cash card reads it).
 * `ramp` spreads a Grow gain across the twelve months when the monthly cash belongs to the judged year.
 */
export function withLevers(v: ViewInput, last: ActualYear | null, levers: Pick<Lever, "effect">[], ramp: boolean, kind: LeverKind = "grow"): { v: ViewInput; last: ActualYear | null } {
  if (!levers.length) return { v, last };
  const e = sum(levers);
  const nextLast = last ? {
    ...last, pnl: pnlWith(last.pnl, e), balanceSheet: bsWith(last.balanceSheet, e), cashFlow: cfWith(last.cashFlow, e),
    days: daysWith(last.days, e)!, debtService: Math.max(0, last.debtService - e.serviceCut),
  } : null;
  if (kind === "borrow" || kind === "sell") {
    const p = v.position, k = e.slot ?? 1;
    const position: PlanFacts = {
      ...p,
      pnl: withYear(p.pnl, k, (x) => pnlWith(x, e)), balanceSheet: withYear(p.balanceSheet, k, (x) => bsWith(x, e)),
      cashFlow: withYear(p.cashFlow, k, (x) => cfWith(x, e)),
      days: Object.fromEntries(Object.entries(p.days).map(([key, d]) => [key, key === String(k) ? daysWith(d, e)! : d])) as PlanFacts["days"],
      debtService: withYear(p.debtService, k, (x) => Math.max(0, x - e.serviceCut)),
      undrawn: p.undrawn + e.undrawnAdd,
      sale: e.priceTo !== undefined ? { ...p.sale, askingPrice: e.priceTo } : p.sale,
    };
    return { v: { ...v, position }, last: nextLast };
  }
  const g = v.grow;
  const cashGain = e.cogsCut + e.overheadsCut + e.arCut + e.invCut;
  const grow: PlanFacts = {
    ...g,
    pnl: withYear(g.pnl, 2, (x) => pnlWith(x, e)), balanceSheet: withYear(g.balanceSheet, 2, (x) => bsWith(x, e)),
    cashFlow: withYear(g.cashFlow, 2, (x) => cfWith(x, e)),
    /* The cycle card reads slot 1 (set to the judged year's days by the views). */
    days: Object.fromEntries(Object.entries(g.days).map(([k, d]) => [k, k === "1" || k === "2" ? daysWith(d, e)! : d])) as PlanFacts["days"],
    monthlyCash: ramp ? g.monthlyCash.map((c, k) => c + (cashGain * (k + 1)) / 12) : g.monthlyCash,
  };
  return { v: { ...v, grow }, last: nextLast };
}

/** A tab's cards and score with some levers pulled. */
export function viewWith(v: ViewInput, last: ActualYear | null, levers: Pick<Lever, "effect">[], ramp: boolean, money: (x: number) => string, kind: LeverKind = "grow") {
  const r = withLevers(v, last, levers, ramp, kind);
  const V = buildView(r.v, money, r.last);
  return { metrics: [...V[kind]], score: V.scores[kind].value, input: kind === "grow" ? V.growIn : V.posIn, last: r.last };
}
/** Kept for the Grow tab's callers. */
export const growWith = (v: ViewInput, last: ActualYear | null, levers: Pick<Lever, "effect">[], ramp: boolean, money: (x: number) => string) =>
  viewWith(v, last, levers, ramp, money, "grow");

/** Each lever with the dials it moves on its own — the ones whose band improves first, then those whose figure changes. */
export function withMoves(levers: Omit<Lever, "moves">[], v: ViewInput, last: ActualYear | null, ramp: boolean, money: (x: number) => string, base: Metric[], kind: LeverKind = "grow"): Lever[] {
  return levers.map((l) => {
    const after = viewWith(v, last, [l], ramp, money, kind).metrics;
    const better: string[] = [], changed: string[] = [];
    for (const b of base) {
      const a = after.find((x) => x.key === b.key);
      if (!a || a.value === null || b.value === null || a.display === b.display) continue;
      const sb = statusOf(b.value, b.bands), sa = statusOf(a.value, a.bands);
      if (sb && sa && RANK[sa] > RANK[sb]) better.push(b.name); else changed.push(b.name);
    }
    return { ...l, moves: [...better, ...changed].slice(0, 3) };
  });
}
const RANK = { bad: 0, watch: 1, good: 2 } as const;

/** What a lever is worth, in the words the page uses beside it. */
export const worth = (l: Pick<Lever, "profit" | "cash" | "saves" | "key" | "effect" | "price">, money: (x: number) => string) =>
  l.price ? `${money(l.price.from)} → ${money(l.price.to)}`
  : l.saves ? `${money(l.saves)} a year less in loan payments`
  : l.key === "overdraft" ? `${money(l.effect.undrawnAdd)} to fall back on`
  : l.profit > 0 ? `+${money(l.profit)} a year` : `+${money(l.cash)} cash`;

/**
 * WHAT WOULD MOVE THIS DIAL — one line under a card that is not in its best band: the levers that move it, and
 * where they would take it, re-measured the way the card measures.
 */
export function moveLine(key: string, levers: Lever[], v: ViewInput, last: ActualYear | null, ramp: boolean, money: (x: number) => string, base: Metric[], kind: LeverKind = "grow"): string | null {
  const b = base.find((x) => x.key === key);
  if (!b || b.value === null || b.unscored) return null;
  if (statusOf(b.value, b.bands) === "good") return null;
  const useful = levers.filter((l) => {
    const a = viewWith(v, last, [l], ramp, money, kind).metrics.find((x) => x.key === key);
    /* By value, not display: a return that is still "Profit fell" with one lever may clear the bar with two. */
    return a && a.value !== null && Math.abs(a.value - (b.value as number)) > 1e-9;
  });
  /* No single lever moves it (loan cover stays nil until trading turns positive) — then all of them together. */
  if (!useful.length) {
    const all = viewWith(v, last, levers, ramp, money, kind).metrics.find((x) => x.key === key);
    if (all && all.value !== null && Math.abs(all.value - (b.value as number)) > 1e-9) useful.push(...levers.filter((l) => l.key !== "overdraft" || key === "runway"));
  }
  if (!useful.length) return null;
  const a = viewWith(v, last, useful, ramp, money, kind).metrics.find((x) => x.key === key);
  if (!a || a.value === null || a.display === b.display) return null;
  const names = useful.map((l) => `${lower(l.label)} (${worth(l, money)})`);
  const s = statusOf(a.value, a.bands);
  return `${cap(join(names))}. That would take this to ${a.display}${s === "good" ? "." : s === "watch" ? " — better, but not yet in the safe zone." : " — still not enough on its own."}`;
}

/** The table under the headline: the judged year now, and with every lever pulled. */
export type WithLeversRow = { label: string; now: string; after: string; better: boolean };
export function leverTable(levers: Lever[], v: ViewInput, last: ActualYear | null, ramp: boolean, money: (x: number) => string,
  base: { metrics: Metric[]; score: number | null }, kind: LeverKind = "grow"): WithLeversRow[] {
  if (!levers.length) return [];
  const after = viewWith(v, last, levers, ramp, money, kind);
  const pick = (ms: Metric[], k: string) => ms.find((x) => x.key === k);
  const rows: WithLeversRow[] = [];
  const add = (label: string, k: string) => {
    const a = pick(after.metrics, k), b = pick(base.metrics, k);
    if (a && b && a.value !== null && b.value !== null) rows.push({ label, now: b.display, after: a.display, better: a.value !== b.value });
  };
  const moneyRow = (label: string, now: number | undefined, then: number | undefined, higherIsBetter = true) => {
    if (now !== undefined && then !== undefined) rows.push({ label, now: money(now), after: money(then), better: higherIsBetter ? then > now : then < now });
  };
  if (kind === "grow") {
    add("Operating margin", "operatingMargin");
    moneyRow("Operating profit", v.grow.pnl[2]?.operatingProfit, after.input.pnl[2]?.operatingProfit);
    add(last ? "Cash at the year end" : "Lowest month", last ? "yearEndCash" : "lowestCash");
    add("Cash conversion cycle", "cashCycle");
  } else if (kind === "sell") {
    const k = levers.reduce((s, l) => Math.max(s, l.effect.slot ?? 1), 1);
    const add2 = (label: string, key: string) => add(label, key);
    const nowE = v.position.pnl[k], thenE = after.input.pnl[k];
    const adds = v.position.sale.addBacks ?? 0;
    if (nowE && thenE) moneyRow("Profit after add-backs", nowE.operatingProfit + nowE.depreciation + adds, thenE.operatingProfit + thenE.depreciation + adds);
    moneyRow("Asking price", v.position.sale.askingPrice ?? undefined, after.input.sale.askingPrice ?? undefined, false);
    add2("Asking price ÷ profit", "priceMultiple");
    add2("Profit margin after add-backs", "normalisedMargin");
    add2("Cash return on the asking price", "fcfYield");
    add2("Free cash flow", "freeCashFlow");
  } else {
    moneyRow("Loan payments for the year", v.position.debtService[1], after.input.debtService[1], false);
    moneyRow("Cash from trading", v.position.cashFlow[1]?.netOperating, after.input.cashFlow[1]?.netOperating);
    add("Debt service cover", "dscr");
    add("Debt service cover, bad year", "dscrStressed");
    add("Interest cover", "interestCover");
    add("Cash runway", "runway");
  }
  const moved = rows.filter((r) => r.now !== r.after);
  /* The score row always shows — "still 49" is the answer when the levers are not enough. */
  const label = kind === "grow" ? "Capability to grow" : kind === "borrow" ? "Capability to borrow" : "Capability to sell";
  if (base.score !== null && after.score !== null) moved.push({ label, now: `${base.score}/100`, after: `${after.score}/100`, better: after.score > base.score });
  return moved;
}

/* ------------------------------------------------------------------ *
 * Borrow's levers (§6.176)                                            *
 * ------------------------------------------------------------------ */

/** A loan as the lever needs it: what is owed, its rate, and the years left to pay it. */
export type LoanFacts = { name: string; balance: number; ratePct: number; years: number };

/**
 * BORROW'S LEVERS: spread the loans over longer (the one lever only this tab has), the profit and payment
 * levers Grow already found — each one is also more cash to pay loans from — and, on the plan, an overdraft
 * to fall back on when the bank would otherwise run dry.
 */
export function borrowLevers(pos: CapabilityInput, grow: Omit<Lever, "moves">[], loans: LoanFacts[], refs: LeverRefs, allowOverdraft: boolean): Omit<Lever, "moves">[] {
  const m = pos.money, out: Omit<Lever, "moves">[] = [];
  const target = (refs.loanTermMonths ?? 60) / 12;

  /* ---- the loans: a longer term ---- */
  let saves = 0, reclass = 0, floor = 0;
  const spread: string[] = [];
  for (const l of loans) {
    if (!(l.balance > 0) || !(l.years > 0) || l.years >= target) continue;
    const now = annualRepayment(l.balance, l.ratePct, l.years), then = annualRepayment(l.balance, l.ratePct, target);
    if (now === null || then === null || now - then < 1000) continue;
    saves += now - then;
    floor += then;
    /* Principal due within a year falls in the same proportion. */
    reclass += (l.balance / l.years) - (l.balance / target);
    spread.push(l.name);
  }
  const service = pos.debtService[1] ?? 0;
  /*
   * Never below what the spread loans alone would cost: the old payment is an estimate from the balance, rate
   * and years left, and can run above what the business actually paid (§6.176).
   */
  saves = r2(Math.max(0, Math.min(saves, service - floor)));
  if (saves >= 1000) {
    const owed = loans.filter((l) => spread.includes(l.name)).reduce((t, l) => t + l.balance, 0);
    const yrs = Math.round(target * 10) / 10;
    out.push({
      key: "loans", target: "loanTermMonths", profit: 0, cash: saves, saves,
      label: `Spread the ${m(owed)} owed over ${yrs} years`,
      detail: `Loan payments drop from about ${m(service)} to ${m(service - saves)} a year. Ask the bank for a longer term.`,
      effect: { ...NONE, serviceCut: saves, reclass: r2(Math.max(0, reclass)) },
    });
  }

  /* ---- profit and payment levers: more cash to pay the loans from ---- */
  for (const g of grow) out.push(g);

  /* ---- an overdraft to fall back on (plan only — the accounts cannot have one they did not arrange) ---- */
  /*
   * Sized to the plan's own worst month, not to a rule of thumb: "two months of spending" came to 380,000 on
   * SEQ, an overdraft no bank would write for a business losing money. Enough to carry the lowest month.
   */
  if (allowOverdraft && pos.monthlyCash.length) {
    const low = Math.min(...pos.monthlyCash);
    const need = Math.ceil(Math.max(0, -low - pos.undrawn) / 10_000) * 10_000;
    if (low < 0 && need >= 10_000) {
      out.push({
        key: "overdraft", target: null, profit: 0, cash: 0,
        label: `Arrange an overdraft of ${m(need)}`,
        detail: `The bank goes as low as ${m(low)} during the year. An overdraft of ${m(need)} covers that, and costs little until it is used. Arrange it before it is needed.`,
        effect: { ...NONE, undrawnAdd: need },
      });
    }
  }
  return out;
}

/** How Borrow's dials connect — short sentences, past tense on the accounts, present on the plan. */
export function borrowStory(pos: CapabilityInput, names: YearNames, last: ActualYear | null): string | null {
  const m = pos.money, cf = pos.cashFlow[1], bs = pos.balanceSheet[1];
  if (!cf || !bs) return null;
  const past = !!last, t = (was: string, is: string) => (past ? was : is);
  const y = names[1] ?? "the year";
  const service = pos.debtService[1] ?? 0;
  const trading = cf.netOperating;
  const out: string[] = [];
  out.push(trading < 0
    ? `In ${y} the business ${t("used up", "uses up")} ${m(-trading)} of cash from trading, after paying for jobs, wages and overheads.`
    : `In ${y} trading ${t("brought", "brings")} in ${m(trading)} of cash, after paying for jobs, wages and overheads.`);
  if (service > 0) {
    const cover = trading > 0 ? trading / service : 0;
    out.push(trading <= 0
      ? `Loan payments ${t("were", "are")} ${m(service)}, so none of them ${t("were", "are")} covered by trading.`
      : cover < 1 ? `Loan payments ${t("were", "are")} ${m(service)}, so trading ${t("covered", "covers")} only part of them.`
      : `Loan payments ${t("were", "are")} ${m(service)}, and trading ${t("covered", "covers")} them ${r1(cover)} times (lenders want 1.25).`);
  } else out.push(`There ${t("were", "are")} no loan payments to make.`);
  const debt = bs.debtCurrent + bs.debtNonCurrent;
  if (debt > 0) out.push(`The business ${t("owed", "owes")} ${m(debt)} at the end of the year, and ${m(bs.debtCurrent)} of it ${t("was", "is")} due within the next year.`);
  out.push(bs.cash < 0 ? `The bank ${t("was", "is")} overdrawn by ${m(-bs.cash)} at the year end.` : `The year ${t("ended", "ends")} with ${m(bs.cash)} in the bank.`);
  return out.join(" ");
}

/* ------------------------------------------------------------------ *
 * Sell's levers (§6.177)                                              *
 * ------------------------------------------------------------------ */

/**
 * SELL'S LEVERS: the profit and payment levers, pulled on the sale year (a buyer prices that year's profit),
 * then the price — what the profit, with those fixes, supports at the top of what similar businesses sold
 * for. The price comes last because it depends on the others.
 */
export function sellLevers(pos: CapabilityInput, profit: Omit<Lever, "moves">[], slot: number): Omit<Lever, "moves">[] {
  /* A buyer prices profit, so the profit levers lead; cash levers after; the price last, because it depends on them. */
  const m = pos.money, out: Omit<Lever, "moves">[] = profit.map((l) => ({ ...l, effect: { ...l.effect, slot } }))
    .sort((a, b) => b.profit - a.profit || b.cash - a.cash);
  const p = pos.pnl[slot], sale = pos.sale;
  const price = sale.askingPrice !== null && sale.askingPrice > 0 ? sale.askingPrice : null;
  const high = sale.multipleHigh;
  if (!p || price === null || high === null || !(high > 0)) return out;
  const gain = profit.reduce((t, l) => t + l.profit, 0);
  const earnings = p.operatingProfit + p.depreciation + (sale.addBacks ?? 0) + gain;
  if (earnings <= 0) return out;
  const supported = Math.floor((earnings * high) / 10_000) * 10_000;
  if (supported >= price || supported < 10_000) return out;
  out.push({
    key: "price", target: null, profit: 0, cash: 0, price: { from: price, to: supported },
    label: "Lower the asking price",
    detail: `That is ${high}× the profit after add-backs${gain > 0 ? " with the fixes above" : ""} (${m(earnings)}) — the top of what similar businesses sold for. It is ${m(price)} now.`,
    effect: { ...NONE, slot, priceTo: supported },
  });
  return out;
}

/** The profit a buyer would need to see to pay the asking price, at the top of the range — or null. */
export function profitForPrice(pos: CapabilityInput): { price: number; needed: number; high: number } | null {
  const sale = pos.sale;
  if (sale.askingPrice === null || !(sale.askingPrice > 0) || sale.multipleHigh === null || !(sale.multipleHigh > 0)) return null;
  return { price: sale.askingPrice, needed: r2(sale.askingPrice / sale.multipleHigh), high: sale.multipleHigh };
}

/** How Sell's dials connect — plain words, past tense on the accounts, present on the plan. */
export function sellStory(pos: CapabilityInput, slot: number, year: string, past: boolean): string | null {
  const m = pos.money, p = pos.pnl[slot], sale = pos.sale;
  if (!p) return null;
  const t = (was: string, is: string) => (past ? was : is);
  const e = p.operatingProfit + p.depreciation, adds = sale.addBacks ?? 0, earned = e + adds;
  const out: string[] = [];
  out.push(e < 0
    ? `In ${year} the business ${t("made", "makes")} a loss of ${m(-e)} before interest, tax and depreciation.`
    : `In ${year} the business ${t("made", "makes")} ${m(e)} before interest, tax and depreciation.`);
  if (adds > 0) out.push(`With ${m(adds)} of owner add-backs, a buyer ${t("would have seen", "would see")} ${earned < 0 ? `a loss of ${m(-earned)}` : `${m(earned)} of profit`}.`);
  const lo = sale.multipleLow, hi = sale.multipleHigh, price = sale.askingPrice;
  if (earned > 0 && lo !== null && hi !== null) out.push(`Similar businesses sold for ${lo}–${hi} times profit, which puts this one at about ${m(earned * lo)}–${m(earned * hi)}.`);
  if (price !== null && price > 0) out.push(earned > 0
    ? `The asking price is ${m(price)} — about ${r1(price / earned)} times that profit.`
    : `The asking price is ${m(price)}, but there is no profit to base a price on.`);
  return out.join(" ");
}

/* ------------------------------------------------------------------ *
 * How the dials connect — the paragraph under the headline            *
 * ------------------------------------------------------------------ */

export function growStory(i: CapabilityInput, names: YearNames, last: ActualYear | null, levers: Lever[]): string | null {
  const m = i.money, y1 = i.pnl[1], y2 = i.pnl[2];
  if (!y1 || !y2 || y1.revenue <= 0) return null;
  /* Plain English (§6.174): short sentences, the past for the accounts, the present for the plan. */
  const past = !!last;
  const t = (was: string, is: string) => (past ? was : is);
  const n2 = names[2] ?? "the year";
  const dRev = y2.revenue - y1.revenue, g = dRev / y1.revenue;
  const gm = (p: PnlYear) => (p.revenue ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0);
  const dGm = gm(y2) - gm(y1);
  const ohG = y1.overheads > 0 ? (y2.overheads - y1.overheads) / y1.overheads : 0;
  const dOh = y2.overheads - y1.overheads;

  const flat = Math.abs(g) < 0.005;
  const out: string[] = [];
  out.push(flat ? `Sales ${t("stayed", "stay")} flat at ${m(y2.revenue)} in ${n2}.`
    : `Sales ${dRev >= 0 ? t("went up", "go up") : t("went down", "go down")} ${m(Math.abs(dRev))} (${r1(Math.abs(g) * 100)}%) in ${n2}.`);

  const against: string[] = [];
  if (dGm <= -0.5) against.push(`gross margin ${t("dropped", "drops")} from ${r1(gm(y1))}% to ${r1(gm(y2))}%`);
  if (dOh > 0 && ohG - Math.max(0, g) > 0.02) against.push(`overheads ${t("went up", "go up")} ${m(dOh)} (${r1(ohG * 100)}%)`);
  if (against.length) out.push(`But ${join(against)}.`);
  else if (dGm >= 0.5) out.push(`Gross margin ${t("improved", "improves")} from ${r1(gm(y1))}% to ${r1(gm(y2))}%.`);

  const inc = dRev > 0 ? over((y2.revenue - y2.cogs) - (y1.revenue - y1.cogs), dRev) : null;
  const op1 = y1.operatingProfit, op2 = y2.operatingProfit, dOp = op2 - op1;
  const profit = op2 < 0 && op1 >= 0 ? `the business ${t("went", "goes")} from a profit to a ${m(-op2)} loss`
    : op2 < 0 ? (op2 < op1 ? `the loss ${t("grew", "grows")} to ${m(-op2)}` : `the loss ${t("shrank", "shrinks")} to ${m(-op2)}`)
    : Math.abs(dOp) < Math.max(1, Math.abs(op1) * 0.005) ? `profit ${t("stayed", "stays")} at ${m(op2)}`
    : dOp < 0 ? `profit ${t("fell", "falls")} by ${m(-dOp)} to ${m(op2)}` : `profit ${t("rose", "rises")} by ${m(dOp)} to ${m(op2)}`;
  out.push(inc !== null && inc < 0
    ? `Because of this, each extra dollar of sales ${t("cost", "costs")} more than it ${t("brought", "brings")} in, and ${profit}.`
    : `${cap(profit)}.`);

  const terms = levers.find((l) => l.key === "debtors");
  if (terms && terms.days) out.push(`Customers also ${t("took", "take")} ${terms.days.from} days to pay instead of ${terms.days.to}, which ${t("kept", "keeps")} ${m(terms.cash)} of cash out of the bank.`);
  if (last) out.push(`The year ended with ${m(last.balanceSheet.cash)} in the bank.`);
  return out.join(" ");
}

const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

