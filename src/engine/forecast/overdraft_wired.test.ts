import { describe, expect, it } from "vitest";
import { assembleOpening, type PlanSources } from "./assemble";
import { FORECAST_YEARS } from "./model";
import { runForecast, type PlanInput } from "./run";
import { makePlan } from "./plans.fixture";
import type { FundingSource } from "../funding/sources";

/**
 * The facility, wired into the plan (§6.72).
 *
 * Stage three proved the sweep on its own. This proves the loop around it: the facility's interest reaches
 * the profit and loss, its balance reaches the balance sheet, its draws and repayments reach the cash flow,
 * and the three still agree afterwards — in every year, month by month.
 */
const overdraft = (over: Record<string, unknown> = {}): FundingSource => ({
  id: "od", kind: "debt", name: "Trading facility", amount: 0, start_year: 1, start_month: 1,
  loan: {
    id: "od", lender_name: "Trading facility", amount_drawn: 0, total_facility_amount: 250_000,
    interest_rate: 12, loan_type: "line_of_credit", start_year: 1, start_month: 1, ...over,
  },
});

const planWith = (seed: number, facilities: FundingSource[], debtorDays: number): PlanInput => {
  const p = makePlan(seed);
  const sources = { ...p.sources, funding: [...p.sources.funding, ...facilities] } as unknown as PlanSources;
  return {
    sources,
    opening: assembleOpening(null, 20_000, 0),          // deliberately thin, so the facility has work to do
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { ...p.days, debtorDays }])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.timing])),
    taxRate: 25, dividendRate: 0,
    openingTaxLosses: 0, openingRetainedEarnings: 0,
    components: [],
  };
};

const failures = (r: ReturnType<typeof runForecast>) =>
  r.checked.invariants.filter((i) => !i.passed).map((i) => `${i.label} off by ${i.difference}`);

describe("an overdraft wired into the plan", () => {
  it("leaves a plan without one exactly as it was", () => {
    const a = runForecast(planWith(3, [], 60));
    expect(a.overdraft).toBe(null);
    expect(failures(a)).toEqual([]);
  });

  it("keeps the three statements agreeing once the facility is in them", () => {
    const r = runForecast(planWith(3, [overdraft()], 90));
    expect(failures(r)).toEqual([]);
    expect(r.checked.reconciled).toBe(true);
  });

  it("settles, rather than chasing its own tax around", () => {
    for (const seed of [1, 3, 5, 9, 14, 21]) {
      const r = runForecast(planWith(seed, [overdraft()], 90));
      expect(r.checked.invariants.find((i) => i.key === "overdraft-settled")).toBeUndefined();
      expect(failures(r), `seed ${seed}`).toEqual([]);
    }
  });

  it("puts the facility's cost in the profit and loss and its balance on the balance sheet", () => {
    const withOd = runForecast(planWith(3, [overdraft()], 90));
    const without = runForecast(planWith(3, [], 90));
    const od = withOd.overdraft!;
    const used = FORECAST_YEARS.some((y) => od.byYear[y].drawn > 0);
    expect(used, "this plan never needed the facility, so it proves nothing").toBe(true);

    const y = FORECAST_YEARS.find((k) => od.byYear[k].interest > 0)!;
    expect(withOd.forecast.pnl[y].interest).toBeGreaterThan(without.forecast.pnl[y].interest);
    const drawnAtYearEnd = od.byYear[y].closingDrawn;
    if (drawnAtYearEnd > 0) {
      expect(withOd.forecast.balanceSheet[y].debtCurrent).toBeGreaterThan(without.forecast.balanceSheet[y].debtCurrent);
    }
  });

  it("stops the plan closing below zero while the facility has room", () => {
    const without = runForecast(planWith(1, [], 90));
    const withOd = runForecast(planWith(1, [overdraft({ total_facility_amount: 5_000_000 })], 90));
    const shortBefore = FORECAST_YEARS.filter((y) => without.forecast.cashFlow[y].closingCash < 0);
    expect(shortBefore.length, "this plan never runs short, so it proves nothing").toBeGreaterThan(0);
    for (const y of FORECAST_YEARS) expect(withOd.forecast.cashFlow[y].closingCash).toBeGreaterThanOrEqual(-0.5);
  });

  /**
   * THE POINT OF THE WHOLE EXERCISE.
   *
   * Until now the working-capital assumptions could not touch the profit and loss — debtor days decided WHEN
   * the money arrived, never whether it was earned, and nothing charged the business for being short in the
   * meantime. With a facility in the plan, slow payers cost real interest, and the bottom line feels it.
   */
  it("makes slow debtors cost real money, which they never did before", () => {
    const fast = runForecast(planWith(3, [overdraft()], 30));
    const slow = runForecast(planWith(3, [overdraft()], 120));
    expect(failures(fast)).toEqual([]);
    expect(failures(slow)).toEqual([]);

    const profit = (r: ReturnType<typeof runForecast>) =>
      FORECAST_YEARS.reduce((a, y) => a + r.forecast.pnl[y].netProfit, 0);
    const interest = (r: ReturnType<typeof runForecast>) =>
      FORECAST_YEARS.reduce((a, y) => a + r.forecast.pnl[y].interest, 0);

    expect(interest(slow)).toBeGreaterThan(interest(fast));
    expect(profit(slow)).toBeLessThan(profit(fast));

    // And with no facility at all, the same change leaves the bottom line untouched — which is the old bug.
    const fastNo = runForecast(planWith(3, [], 30));
    const slowNo = runForecast(planWith(3, [], 120));
    expect(profit(slowNo)).toBeCloseTo(profit(fastNo), 2);
  });
});
