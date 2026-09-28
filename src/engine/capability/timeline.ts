import type { CapabilityInput } from "./model";
import { SCORE_BANDS, statusOf } from "./model";
import { buildView } from "./views";
import type { Views } from "./actual";

/**
 * WHEN THE BUSINESS BECOMES READY (§6.166).
 *
 * The Plan view scores the plan's first year. A Planner also needs the year each capability arrives: a
 * business that cannot borrow in 2027 may well be able to in 2030, and one with no accounts is assessed the
 * other way round — the plan is built first, then read year by year to see when it could grow, borrow or
 * sell (Nic, 28 Sep 2026). So each plan year is scored on its own, by the same `buildView` the page uses,
 * with that year moved into slot 1:
 *
 *   borrow and sell   plan year k, and the years after it (a buyer in year k prices year k's earnings)
 *   grow              the year before k into year k, with year k's months for the lowest-cash test —
 *                     for Year 1 that is exactly the Plan view (the last actual year into Year 1, or with
 *                     no accounts Year 1 into Year 2), so the first grow and borrow columns equal the page's.
 *
 * Sell in year k is read as if the business were sold that year, so it can differ from the page's Sell score
 * where a later sale year is set on Plan settings → Exit & sale.
 */
type PlanFacts = Omit<CapabilityInput, "money">;
export type MonthsByYear = Record<number, { cash: number[]; profit: number[] }>;
export type Kind = "grow" | "borrow" | "sell";
export type TimelineYear = { k: number; year: number; scores: Record<Kind, number | null> };
export type Readiness = {
  /** The first calendar year from which it stays ready to the end of the plan; null if it never does. */
  from: number | null;
  /** The first year it reads ready at all — earlier than `from` when it gets there and slips back. */
  first: number | null;
  /** Years after `first` in which it falls back below ready. */
  slips: number[];
};

const YEARS = [1, 2, 3, 4, 5];

/** {1: rec[start], 2: rec[start + 1], …} — the plan's years from `start` on, moved to the front. */
function from<T>(rec: Partial<Record<number, T>>, start: number): Partial<Record<number, T>> {
  const out: Partial<Record<number, T>> = {};
  for (let y = start; y <= 5; y++) if (rec[y] !== undefined) out[y - start + 1] = rec[y];
  return out;
}

function yearInputs(plan: PlanFacts, views: Views, months: MonthsByYear, k: number) {
  const m = months[k] ?? { cash: [], profit: [] };
  const position: PlanFacts = {
    ...plan,
    pnl: from(plan.pnl, k), balanceSheet: from(plan.balanceSheet, k), cashFlow: from(plan.cashFlow, k),
    days: from(plan.days, k) as PlanFacts["days"], capex: from(plan.capex, k), debtService: from(plan.debtService, k),
    monthlyCash: m.cash, monthlyProfit: m.profit,
    sale: { ...plan.sale, exitYear: null },
  };
  if (k === 1) return { grow: views.plan.grow, position };
  const grow: PlanFacts = {
    ...plan,
    pnl: from(plan.pnl, k - 1), balanceSheet: from(plan.balanceSheet, k - 1), cashFlow: from(plan.cashFlow, k - 1),
    /* The cycle card reads slot 1, and should read year k's own days (as the Plan view does for Year 1). */
    days: { ...from(plan.days, k - 1), 1: plan.days[k] } as PlanFacts["days"],
    priorDays: plan.days[k - 1] ?? null,
    capex: from(plan.capex, k - 1), debtService: from(plan.debtService, k - 1),
    monthlyCash: m.cash, monthlyProfit: m.profit,
  };
  return { grow, position };
}

export function capabilityTimeline(plan: PlanFacts, views: Views, months: MonthsByYear, firstYear: number, money: (v: number) => string): TimelineYear[] {
  return YEARS.filter((k) => plan.pnl[k] !== undefined).map((k) => {
    const { grow, position } = yearInputs(plan, views, months, k);
    const V = buildView({ grow, position, growNames: {}, positionNames: {} }, money, null);
    return { k, year: firstYear + k - 1, scores: { grow: V.scores.grow.value, borrow: V.scores.borrow.value, sell: V.scores.sell.value } };
  });
}

export function readiness(line: TimelineYear[], kind: Kind): Readiness {
  const ready = line.map((y) => statusOf(y.scores[kind], SCORE_BANDS) === "good");
  const i = ready.indexOf(true);
  if (i < 0) return { from: null, first: null, slips: [] };
  let j = ready.length;
  while (j > 0 && ready[j - 1]) j--;
  return {
    from: j < ready.length ? line[j].year : null,
    first: line[i].year,
    slips: line.filter((_, n) => n > i && !ready[n]).map((y) => y.year),
  };
}
