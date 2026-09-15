/**
 * What a dollar of revenue is actually worth, depending on where it comes from (§6.41.2).
 *
 * Two levers on this screen raise revenue, and an owner reasonably assumes they are interchangeable. They
 * are not, and the difference is the largest single fact the planner knows about their business: revenue won
 * by raising a price costs nothing to deliver, so all of it reaches the operating line, while revenue won by
 * selling more has to be bought and made first. On a concreting plan that is 100c in the dollar against 42c.
 *
 * **It is measured, not derived.** The obvious shortcut is to quote gross margin off the profit and loss, and
 * it is wrong twice over: fixed cost of sales does not scale with volume, so the incremental margin is not
 * the reported one; and on a plan with an ongoing book, a volume lever wins new clients without touching the
 * clients already on the books, so the same percentage does not even produce the same revenue. So both are
 * run for real and each is measured against the revenue it actually produced.
 *
 * This depends on the plan and not on where the sliders are, so it is computed once when the plan loads and
 * stands there whether or not anything has been moved.
 */
import { planLevers, runPlan, type WhatIfPlan } from "./levers";

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

export type Worth = {
  /** What this lever did to Year 1 revenue, operating profit and the cash the year closes on. */
  revenue: number;
  operatingProfit: number;
  closingCash: number;
  /**
   * Operating profit kept per 1 of extra revenue. Null when the lever moves no revenue — a plan whose lines
   * all start in Year 3, say. Negative is real and worth saying out loud: the extra work loses money.
   *
   * Closing cash, not the lowest month: a minimum is not comparable between two runs (§6.41).
   */
  margin: number | null;
};

export type RevenueWorth = {
  /** The reference move each lever was measured at, in per cent. */
  step: number;
  price: Worth;
  volume: Worth;
  /** How many times more profit a pound of price-won revenue keeps than a pound won by selling more. */
  multiple: number | null;
};

export function revenueWorth(plan: WhatIfPlan, step = 1): RevenueWorth {
  const at = planLevers(plan.workingCapital[1]);
  const base = runPlan(plan, at).outcome;

  const of = (key: "price" | "volume"): Worth => {
    const o = runPlan(plan, { ...at, [key]: step }).outcome;
    const revenue = r2(o.revenue - base.revenue);
    const operatingProfit = r2(o.operatingProfit - base.operatingProfit);
    return {
      revenue, operatingProfit,
      closingCash: r2(o.closingCash - base.closingCash),
      margin: Math.abs(revenue) > 0.005 ? operatingProfit / revenue : null,
    };
  };

  const price = of("price"), volume = of("volume");
  const multiple = price.margin != null && volume.margin != null && volume.margin > 0
    ? Math.round((price.margin / volume.margin) * 100) / 100
    : null;
  return { step, price, volume, multiple };
}
