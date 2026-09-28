import type { CapabilityInput, Metric } from "./model";
import { score } from "./model";
import { GROW_WEIGHTS, growMetrics } from "./grow";
import { BORROW_WEIGHTS, borrowMetrics } from "./borrow";
import { SELL_WEIGHTS, sellMetrics } from "./sell";
import { applyRanges } from "./ranges";
import { withTrends } from "./series";
import { inAccounts, nameYears, yearEndCash, type ActualYear, type YearNames } from "./actual";

type PlanFacts = Omit<CapabilityInput, "money">;

/**
 * ONE VIEW'S CARDS, SCORES AND INPUTS (§6.158) — the same arithmetic for the accounts and for the plan; only
 * the input and the year names differ. Actual has no lowest month (annual accounts cannot show one), so the
 * year-end cash stands in for it, and its cards carry no five-year line.
 */
export function buildView(
  v: { grow: PlanFacts; position: PlanFacts; growNames: YearNames; positionNames: YearNames },
  money: (x: number) => string, last: ActualYear | null,
) {
  const growIn: CapabilityInput = { ...v.grow, money };
  /* A buyer on the actual view is pricing the business as it stands: the latest year, not a planned sale year. */
  const posIn: CapabilityInput = { ...v.position, money, ...(last ? { sale: { ...v.position.sale, exitYear: null } } : {}) };
  let growAll = withTrends("grow", applyRanges(growMetrics(growIn), growIn.ranges, "grow"), growIn);
  if (last) {
    growAll = growAll.map((m) => (m.key === "lowestCash" ? yearEndCash(last, growIn.growth.cashBuffer, money) : { ...m, trend: undefined, trendAt: undefined }));
  }
  const said = (m: Metric) => (last ? inAccounts(m) : m);
  /* The lowest month is always the plan's first year's months, whatever sits in slot 1 of the growth input. */
  const all = growAll.map((m) => said(nameYears(m, m.key === "lowestCash" ? v.positionNames : v.growNames)));
  const grow = all.filter((m) => !m.unscored);
  const bare = (m: Metric) => (last ? { ...m, trend: undefined, trendAt: undefined } : m);
  const borrow = withTrends("borrow", applyRanges(borrowMetrics(posIn), posIn.ranges, "borrow"), posIn).map((m) => said(nameYears(bare(m), v.positionNames)));
  /* Cards the accounts cannot answer at all are left off the actual view rather than shown waiting on the plan (§6.169). */
  const PLAN_ONLY = new Set(["recurringShare", "largestProduct", "leadershipPay"]);
  let sell = withTrends("sell", applyRanges(sellMetrics(posIn), posIn.ranges, "sell"), posIn)
    .filter((m) => !last || !PLAN_ONLY.has(m.key))
    .map((m) => said(nameYears(bare(m), v.positionNames)));
  /*
   * ONE GROWTH FIGURE ON THE PAGE (§6.163). Sell's growth card read 2027 → 2028 while Grow's read 2026 →
   * 2027 — two answers to one question. Both now come off the growth input: the last two actual years on
   * the accounts, and the last actual year into Year 1 on the plan.
   */
  const rev = applyRanges(sellMetrics({ ...growIn, sale: { ...growIn.sale, exitYear: null } }), growIn.ranges, "sell").find((m) => m.key === "revenueGrowth");
  if (rev) sell = sell.map((m) => (m.key === "revenueGrowth" ? said(nameYears(bare(rev), v.growNames)) : m));
  const growWeights = { ...GROW_WEIGHTS, yearEndCash: GROW_WEIGHTS.lowestCash ?? 1 };
  return {
    growIn, posIn, grow, borrow, sell, waiting: all.length - grow.length, growWeights,
    scores: { grow: score(grow, growWeights), borrow: score(borrow, BORROW_WEIGHTS), sell: score(sell, SELL_WEIGHTS) },
  };
}
