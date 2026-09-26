import type { CapabilityInput, Metric, Unit } from "./model";
import { growMetrics } from "./grow";
import { borrowMetrics } from "./borrow";
import { sellMetrics } from "./sell";

/**
 * RANGES SET FOR THIS PLAN (§6.140, open item 32).
 *
 * Every band on Financial Capabilities is a general small-business range, and the screen says so. A
 * concreter, a café and a software business do not share a sensible margin, cash cycle or debtor days —
 * so the person who knows the industry (the owner, or the consultant writing the plan) can move the two
 * lines that matter on any measure: where "watch" starts and where the good or bad end starts.
 *
 * WHAT CAN BE MOVED. Measures with the plain three-band shape (bad / watch / good, or good / watch / bad),
 * whose lines are fixed numbers. Not the ones whose lines already come from the plan — the price multiple
 * (the similar-sales range), return on growth (the cost of capital), the lowest cash month (the cash floor)
 * — nor debt cover, whose middle line is the lender's own minimum and is used in the borrowing arithmetic.
 *
 * WHAT IS STORED. Only what was changed: `{ "grow:operatingMargin": [first line, second line] }`. Keyed by tab
 * as well as measure, because revenue growth and cash conversion appear on two tabs with different general
 * ranges. A measure with no entry uses the general range, and a change to the general range reaches every
 * plan that has not overridden it.
 */
export type Ranges = Record<string, [number, number]>;

export type Kind = "grow" | "borrow" | "sell";
export const rangeKey = (kind: Kind, key: string) => `${kind}:${key}`;

export type Adjustable = {
  kind: Kind;
  /** The stored key, `kind:measure`. */
  id: string;
  key: string;
  name: string;
  unit: Unit;
  /** The general lines, from the engine itself — never a second copy (§6.41). */
  general: [number, number];
  /** Low is good (debtor days, leverage) or high is good (margins, cover). */
  lowIsGood: boolean;
  /** The three severities in order, for describing a range in words. */
  order: [string, string, string];
};

const NOT_ADJUSTABLE = new Set(["dscr", "dscrStressed"]);

/** Which measures carry a plain three-band range the client may set. */
export function adjustable(m: Metric): boolean {
  if (NOT_ADJUSTABLE.has(m.key) || m.bands.length !== 3) return false;
  const [a, b, c] = m.bands.map((x) => x.s);
  return new Set([a, b, c]).size === 3 && b === "watch";
}

/** A blank plan, only to read each measure's general range from the engine. */
const BLANK: CapabilityInput = {
  money: (v) => String(v),
  pnl: {}, cashFlow: {}, balanceSheet: {}, days: {},
  monthlyCash: [], monthlyProfit: [], debtService: {}, capex: {},
  growth: { cashBuffer: null, costOfCapital: null },
  stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
  sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null },
  transfer: [], collateral: null, undrawn: 0,
  recurringShare: null, largestProductShare: null, leadershipPay: null,
};

export function adjustableMeasures(): Adjustable[] {
  const sets: [Kind, Metric[]][] = [
    ["grow", growMetrics(BLANK)], ["borrow", borrowMetrics(BLANK)], ["sell", sellMetrics(BLANK)],
  ];
  return sets.flatMap(([kind, ms]) => ms.filter(adjustable).map((m) => ({
    kind, id: rangeKey(kind, m.key), key: m.key, name: m.name, unit: m.unit,
    general: [m.bands[0].to, m.bands[1].to] as [number, number],
    lowIsGood: m.bands[0].s === "good",
    order: m.bands.map((b) => b.s) as [string, string, string],
  })));
}

/** A stored pair is used only if it is two finite numbers, rising. Anything else falls back to general. */
export function validPair(p: unknown): p is [number, number] {
  return Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v)) && p[0] < p[1];
}

/** Read what the database holds, keeping only the pairs that would draw a sensible dial. */
export function readRanges(raw: unknown): Ranges {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => validPair(v))) as Ranges;
}

const fmt = (v: number, unit: Unit) =>
  unit === "pct" ? `${v}%` : unit === "x" ? `${v}×` : unit === "days" ? `${v} days` : unit === "months" ? `${v} months` : String(v);

/** The range in words — what the card's benchmark line says once the plan has its own. */
export function describe(a: number, b: number, unit: Unit, lowIsGood: boolean): string {
  return lowIsGood
    ? `Set for this plan: ${fmt(a, unit)} or under is strong, up to ${fmt(b, unit)} to watch, above that weak`
    : `Set for this plan: under ${fmt(a, unit)} is weak, up to ${fmt(b, unit)} to watch, above that strong`;
}

/**
 * The plan's ranges laid over the measures, before anything is scored. The gauge's top stretches if a line
 * was set above it, so the needle and the lines always fit on the dial.
 */
export function applyRanges(metrics: Metric[], ranges: Ranges | undefined, kind: Kind): Metric[] {
  if (!ranges) return metrics;
  return metrics.map((m) => {
    const r = ranges[rangeKey(kind, m.key)];
    if (!r || !validPair(r) || !adjustable(m)) return m;
    const [a, b] = r;
    const max = Math.max(m.max, Math.ceil(b * 1.25));
    const min = Math.min(m.min, Math.floor(Math.min(0, a)));
    return {
      ...m, min, max,
      bands: [{ ...m.bands[0], to: a }, { ...m.bands[1], to: b }, { ...m.bands[2], to: max }],
      bench: describe(a, b, m.unit, m.bands[0].s === "good"),
      rangeSet: true,
    };
  });
}
