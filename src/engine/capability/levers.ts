import type { BalanceSheetYear, CashFlowYear, PnlYear, WorkingCapitalDays } from "@/engine/forecast/model";
import type { CapabilityInput, Metric } from "./model";
import { over, r1, r2, statusOf } from "./model";
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

export type LeverKey = "overheads" | "margin" | "debtors" | "stock";
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
  target: "overheadsCap" | "grossMargin" | "debtorDays" | null;
  /** For the payment levers: the days now and the days aimed at. */
  days?: { from: number; to: number };
  effect: Effect;
};

/** What a lever does to the judged year. */
type Effect = { cogsCut: number; overheadsCut: number; arCut: number; invCut: number; debtorDays?: number; inventoryDays?: number };
const NONE: Effect = { cogsCut: 0, overheadsCut: 0, arCut: 0, invCut: 0 };

/** Where the levers aim. On the accounts: the year before. On the plan: the agreed targets where there are any. */
export type LeverRefs = { grossMargin?: number | null; overheadsCap?: number | null; debtorDays?: number | null };

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
        label: refs.overheadsCap != null ? `Overheads no more than ${m(cap)}` : "Hold overheads to sales growth",
        detail: refs.overheadsCap != null
          ? `The agreed cap. Overheads stand at ${m(y2.overheads)}.`
          : `Overheads rose ${r1(ohG * 100)}% against sales ${r1(g * 100)}%. Keeping them in step is worth ${m(excess)} a year.`,
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
      label: `Gross margin back to ${r1(ref)}%`,
      detail: `From ${r1(gm(y2))}%, through prices and how jobs are quoted: ${m(gain)} a year on the same sales.`,
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
        label: `Customers paying in ${Math.round(dd1)} days`,
        detail: `From ${Math.round(dd2)} days. Frees ${m(release)} of cash, once — it is not profit.`,
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
        label: `Stock back to ${Math.round(sd1)} days`,
        detail: `From ${Math.round(sd2)} days. Frees ${m(release)} of cash, once.`,
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
    e.cogsCut += l.effect.cogsCut; e.overheadsCut += l.effect.overheadsCut; e.arCut += l.effect.arCut; e.invCut += l.effect.invCut;
    if (l.effect.debtorDays !== undefined) e.debtorDays = l.effect.debtorDays;
    if (l.effect.inventoryDays !== undefined) e.inventoryDays = l.effect.inventoryDays;
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
function bsWith(b: BalanceSheetYear, e: Effect): BalanceSheetYear {
  const cash = e.cogsCut + e.overheadsCut + e.arCut + e.invCut;
  return { ...b, accountsReceivable: b.accountsReceivable - e.arCut, inventory: b.inventory - e.invCut, cash: b.cash + cash };
}
function cfWith(c: CashFlowYear, e: Effect): CashFlowYear {
  const cash = e.cogsCut + e.overheadsCut + e.arCut + e.invCut;
  return { ...c, netOperating: c.netOperating + cash, netMovement: c.netMovement + cash, closingCash: c.closingCash + cash };
}
function daysWith(d: WorkingCapitalDays | undefined, e: Effect): WorkingCapitalDays | undefined {
  if (!d) return d;
  return { ...d, ...(e.debtorDays !== undefined ? { debtorDays: e.debtorDays } : {}), ...(e.inventoryDays !== undefined ? { inventoryDays: e.inventoryDays } : {}) };
}

/**
 * The view with the judged year re-run: slot 2 of the growth input, and on the accounts the latest actual year
 * too (the year-end cash card reads it). `ramp` spreads the gain across the twelve months when the monthly cash
 * belongs to the judged year (the plan view with accounts); otherwise the months are left alone.
 */
export function withLevers(v: ViewInput, last: ActualYear | null, levers: Pick<Lever, "effect">[], ramp: boolean): { v: ViewInput; last: ActualYear | null } {
  if (!levers.length) return { v, last };
  const e = sum(levers);
  const g = v.grow;
  const cashGain = e.cogsCut + e.overheadsCut + e.arCut + e.invCut;
  const grow: PlanFacts = {
    ...g,
    pnl: { ...g.pnl, ...(g.pnl[2] ? { 2: pnlWith(g.pnl[2], e) } : {}) },
    balanceSheet: { ...g.balanceSheet, ...(g.balanceSheet[2] ? { 2: bsWith(g.balanceSheet[2], e) } : {}) },
    cashFlow: { ...g.cashFlow, ...(g.cashFlow[2] ? { 2: cfWith(g.cashFlow[2], e) } : {}) },
    /* The cycle card reads slot 1 (set to the judged year's days by the views). */
    days: Object.fromEntries(Object.entries(g.days).map(([k, d]) => [k, k === "1" || k === "2" ? daysWith(d, e)! : d])) as PlanFacts["days"],
    monthlyCash: ramp ? g.monthlyCash.map((c, k) => c + (cashGain * (k + 1)) / 12) : g.monthlyCash,
  };
  const nextLast = last ? { ...last, pnl: pnlWith(last.pnl, e), balanceSheet: bsWith(last.balanceSheet, e), cashFlow: cfWith(last.cashFlow, e), days: daysWith(last.days, e)! } : null;
  return { v: { ...v, grow }, last: nextLast };
}

/** The Grow cards and score with some levers pulled. */
export function growWith(v: ViewInput, last: ActualYear | null, levers: Pick<Lever, "effect">[], ramp: boolean, money: (x: number) => string) {
  const r = withLevers(v, last, levers, ramp);
  const V = buildView(r.v, money, r.last);
  const all = [...V.grow];
  return { metrics: all, score: V.scores.grow.value, input: V.growIn, last: r.last };
}

/** Each lever with the dials it moves on its own — the ones whose band improves, or failing that whose figure changes. */
export function withMoves(levers: Omit<Lever, "moves">[], v: ViewInput, last: ActualYear | null, ramp: boolean, money: (x: number) => string, base: Metric[]): Lever[] {
  return levers.map((l) => {
    const after = growWith(v, last, [l], ramp, money).metrics;
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

/**
 * WHAT WOULD MOVE THIS DIAL — one line under a card that is not in its best band: the levers that move it, and
 * where they would take it, re-measured the way the card measures.
 */
export function moveLine(key: string, levers: Lever[], v: ViewInput, last: ActualYear | null, ramp: boolean, money: (x: number) => string, base: Metric[]): string | null {
  const b = base.find((x) => x.key === key);
  if (!b || b.value === null) return null;
  if (statusOf(b.value, b.bands) === "good") return null;
  const useful = levers.filter((l) => {
    const a = growWith(v, last, [l], ramp, money).metrics.find((x) => x.key === key);
    /* By value, not display: a return that is still "Profit fell" with one lever may clear the bar with two. */
    return a && a.value !== null && Math.abs(a.value - (b.value as number)) > 1e-9;
  });
  if (!useful.length) return null;
  const a = growWith(v, last, useful, ramp, money).metrics.find((x) => x.key === key);
  if (!a || a.value === null || a.display === b.display) return null;
  const names = useful.map((l) => `${lower(l.label)}${l.profit > 0 ? ` (+${money(l.profit)})` : l.cash > 0 ? ` (frees ${money(l.cash)})` : ""}`);
  const s = statusOf(a.value, a.bands);
  return `${cap(join(names))} would take it to ${a.display}${s === "good" ? "" : s === "watch" ? " — better, not yet comfortable" : " — still not enough on its own"}.`;
}

/** The table under the headline: the judged year now, and with every lever pulled. */
export type WithLeversRow = { label: string; now: string; after: string; better: boolean };
export function leverTable(levers: Lever[], v: ViewInput, last: ActualYear | null, ramp: boolean, money: (x: number) => string, base: { metrics: Metric[]; score: number | null }): WithLeversRow[] {
  if (!levers.length) return [];
  const after = growWith(v, last, levers, ramp, money);
  const pick = (ms: Metric[], k: string) => ms.find((x) => x.key === k);
  const rows: WithLeversRow[] = [];
  const add = (label: string, k: string) => {
    const a = pick(after.metrics, k), b = pick(base.metrics, k);
    if (a && b && a.value !== null && b.value !== null) rows.push({ label, now: b.display, after: a.display, better: a.value !== b.value });
  };
  add("Operating margin", "operatingMargin");
  const g2 = v.grow.pnl[2], a2 = after.input.pnl[2];
  if (g2 && a2) rows.push({ label: "Operating profit", now: money(g2.operatingProfit), after: money(a2.operatingProfit), better: a2.operatingProfit > g2.operatingProfit });
  add(last ? "Cash at the year end" : "Lowest month", last ? "yearEndCash" : "lowestCash");
  add("Cash conversion cycle", "cashCycle");
  const moved = rows.filter((r) => r.now !== r.after);
  /* The score row always shows — "still 49" is the answer when the levers are not enough. */
  if (base.score !== null && after.score !== null) moved.push({ label: "Capability to grow", now: `${base.score}/100`, after: `${after.score}/100`, better: after.score > base.score });
  return moved;
}

/* ------------------------------------------------------------------ *
 * How the dials connect — the paragraph under the headline            *
 * ------------------------------------------------------------------ */

export function growStory(i: CapabilityInput, names: YearNames, last: ActualYear | null, levers: Lever[]): string | null {
  const m = i.money, y1 = i.pnl[1], y2 = i.pnl[2];
  if (!y1 || !y2 || y1.revenue <= 0) return null;
  const n2 = names[2] ?? "the year";
  const dRev = y2.revenue - y1.revenue, g = dRev / y1.revenue;
  const gm = (p: PnlYear) => (p.revenue ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0);
  const dGm = gm(y2) - gm(y1);
  const ohG = y1.overheads > 0 ? (y2.overheads - y1.overheads) / y1.overheads : 0;
  const dOh = y2.overheads - y1.overheads;

  const against: string[] = [], forIt: string[] = [];
  if (dGm <= -0.5) against.push(`margin fell from ${r1(gm(y1))}% to ${r1(gm(y2))}%`);
  else if (dGm >= 0.5) forIt.push(`margin rose from ${r1(gm(y1))}% to ${r1(gm(y2))}%`);
  if (dOh > 0 && ohG - Math.max(0, g) > 0.02) against.push(`overheads rose ${m(dOh)} (${r1(ohG * 100)}%)`);
  else if (dOh <= y1.overheads * Math.max(0, g) + 1) forIt.push("overheads kept in step");

  const flat = Math.abs(g) < 0.005;
  const sales = flat ? `Sales are flat at ${m(y2.revenue)} in ${n2}` : `Sales ${dRev >= 0 ? "grew" : "fell"} ${m(Math.abs(dRev))} (${r1(Math.abs(g) * 100)}%) into ${n2}`;
  let s = against.length ? `${sales}, but ${join(against)}.` : forIt.length ? `${sales}, and ${join(forIt)}.` : `${sales}.`;

  const inc = dRev > 0 ? over((y2.revenue - y2.cogs) - (y1.revenue - y1.cogs), dRev) : null;
  const op1 = y1.operatingProfit, op2 = y2.operatingProfit, dOp = op2 - op1;
  const profit = op2 < 0 && op1 >= 0 ? `operating profit fell ${m(-dOp)} into a ${m(-op2)} loss`
    : op2 < 0 ? (op2 < op1 ? `the loss grew to ${m(-op2)}` : `the loss narrowed to ${m(-op2)}`)
    : Math.abs(dOp) < Math.max(1, Math.abs(op1) * 0.005) ? `operating profit holds at ${m(op2)}`
    : dOp < 0 ? `operating profit fell ${m(-dOp)} to ${m(op2)}` : `operating profit rose ${m(dOp)} to ${m(op2)}`;
  s += inc !== null && inc < 0
    ? ` So each extra dollar of sales cost more than it earned (incremental margin ${r1(inc * 100)}%), and ${profit}.`
    : ` ${cap(profit)}.`;

  const terms = levers.find((l) => l.key === "debtors");
  const end = last ? ` leaving ${m(last.balanceSheet.cash)} in the bank` : "";
  /* The accounts are told in the past tense; the plan in the present. */
  if (terms && terms.days) s += last
    ? ` Customers took ${terms.days.from} days to pay rather than ${terms.days.to}, which tied up another ${m(terms.cash)} of cash,${end}.`
    : ` With customers taking ${terms.days.from} days to pay rather than ${terms.days.to}, another ${m(terms.cash)} of cash is tied up in unpaid invoices.`;
  else if (end) s += ` The year ended with ${m(last!.balanceSheet.cash)} in the bank.`;
  return s;
}

const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

