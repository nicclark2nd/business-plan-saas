import { describe, expect, it } from "vitest";
import { bridgeLines, bridgeTotal } from "./bridge";
import { runForecast, type PlanInput } from "../forecast/run";
import { assembleOpening, type PlanSources } from "../forecast/assemble";
import { FORECAST_YEARS } from "../forecast/model";
import { makePlan } from "../forecast/plans.fixture";

const planFor = (seed: number): PlanInput => {
  const p = makePlan(seed);
  return {
    sources: p.sources as unknown as PlanSources,
    opening: assembleOpening(null, 40_000, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.timing])),
    taxRate: 25, dividendRate: 0,
    openingTaxLosses: 0, openingRetainedEarnings: 0,
    components: [],
  };
};

describe("the profit-to-cash bridge", () => {
  /**
   * The whole claim this screen makes is "these lines are why the two numbers differ". If they add to
   * anything other than the operating cash flow the statement prints, the screen is telling a story that
   * is not the plan's. Across 30 generated plans, in every year.
   */
  it("lands on the operating cash flow, every year, across 30 plans", () => {
    const broken: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const { forecast } = runForecast(planFor(seed));
      for (const y of FORECAST_YEARS) {
        const b = forecast.bridge[y];
        /* Thirteen lines each rounded to the cent against one total rounded to the cent: five cents is
           the honest tolerance, and anything real is thousands out, not pennies. */
        if (Math.abs(bridgeTotal(b) - b.operatingCashFlow) > 0.05) {
          broken.push(`seed ${seed} Y${y}: ${bridgeTotal(b)} vs ${b.operatingCashFlow}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  /**
   * And the operating cash flow it lands on is the one on the CASH FLOW, not a second reading of it. Two
   * screens one menu item apart showing different operating cash flows is the fault this project keeps
   * finding (§6.41).
   */
  it("is the same operating cash flow the cash flow statement shows", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { forecast } = runForecast(planFor(seed));
      for (const y of FORECAST_YEARS) {
        expect(Math.abs(forecast.bridge[y].operatingCashFlow - forecast.cashFlow[y].netOperating)).toBeLessThan(0.02);
      }
    }
  });

  it("keeps the profit even when it is nil, and drops the empty lines", () => {
    const lines = bridgeLines({
      netProfit: 0, depreciation: 0, disposalGainLoss: 0, interestReclassified: 0,
      receivablesMovement: -500, inventoryMovement: 0, payablesMovement: 0,
      prepaidMovement: 0, accruedMovement: 0, taxTimingMovement: 0,
      deferredIncomeMovement: 0, gstMovement: 0, gstOnCapexCredit: 0, operatingCashFlow: -500,
    });
    expect(lines.map((l) => l.key)).toEqual(["netProfit", "receivablesMovement"]);
  });

  it("carries the engine's reversal of a disposal gain through unchanged", () => {
    const lines = bridgeLines({
      netProfit: 1000, depreciation: 0, disposalGainLoss: -300, interestReclassified: 0,
      receivablesMovement: 0, inventoryMovement: 0, payablesMovement: 0,
      prepaidMovement: 0, accruedMovement: 0, taxTimingMovement: 0,
      deferredIncomeMovement: 0, gstMovement: 0, gstOnCapexCredit: 0, operatingCashFlow: 700,
    });
    /* The engine stores this already reversed, so 300 here IS the reversal of a 300 gain. */
    expect(lines.find((l) => l.key === "disposalGainLoss")?.value).toBe(-300);
  });
});
