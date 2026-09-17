import { describe, expect, it } from "vitest";
import { buildForecast, FORECAST_YEARS, type ForecastInput, type YearBase } from "./model";

const base = (over: Partial<YearBase> = {}): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, assetAdditions: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  grantsReceived: 0, grantIncome: 0, deferredIncomeCurrent: 0, deferredIncomeNonCurrent: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0, ...over,
});

/** Revenue and overheads only, so the profit of each year is exactly what is asked for. */
const run = (profits: number[], over: Partial<ForecastInput> = {}) => buildForecast({
  base: Object.fromEntries(FORECAST_YEARS.map((y, i) => [y, profits[i] >= 0
    ? base({ revenue: profits[i] })
    : base({ overheads: -profits[i] })])),
  opening: {
    cash: 500000, accountsReceivable: 0, inventory: 0, otherCurrentAssets: 0, fixedAssets: 0,
    otherNonCurrentAssets: 0, accountsPayable: 0, bankLoansCurrent: 0, bankLoansNonCurrent: 0,
    otherCurrentLiabilities: 0, otherNonCurrentLiabilities: 0, equity: 500000, taxPayable: 0, prepaid: 0, accrued: 0,
  },
  workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
  cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
  taxRate: 30, dividendRate: 0, ...over,
});

describe("losses carried forward (§6.37)", () => {
  it("charges nothing on a loss, and does not then forget it", () => {
    const f = run([-100000, -50000, 200000, 100000, 100000]);
    expect(f.pnl[1].tax).toBe(0);
    expect(f.pnl[1].lossesCarriedForward).toBe(100000);
    expect(f.pnl[2].lossesCarriedForward).toBe(150000);

    // Year 3 makes 200,000 with 150,000 of losses behind it: only 50,000 is taxable.
    expect(f.pnl[3].lossRelief).toBe(150000);
    expect(f.pnl[3].taxableProfit).toBe(50000);
    expect(f.pnl[3].tax).toBe(15000);
    expect(f.pnl[3].lossesCarriedForward).toBe(0);

    // And once relieved, the pool is spent — Year 4 is taxed in full.
    expect(f.pnl[4].tax).toBe(30000);
  });

  it("relieves only as much as the year can absorb", () => {
    const f = run([-200000, 50000, 50000, 50000, 50000]);
    expect(f.pnl[2].lossRelief).toBe(50000);
    expect(f.pnl[2].tax).toBe(0);
    expect(f.pnl[2].lossesCarriedForward).toBe(150000);
    expect(f.pnl[5].lossesCarriedForward).toBe(0);
    expect(FORECAST_YEARS.reduce((a, y) => a + f.pnl[y].tax, 0)).toBe(0);   // never in profit overall
  });

  it("takes the losses a business brings in with it", () => {
    const f = run([100000, 0, 0, 0, 0], { openingTaxLosses: 60000 });
    expect(f.pnl[1].lossRelief).toBe(60000);
    expect(f.pnl[1].tax).toBe(12000);
  });

  it("still balances, and still reconciles, with relief in play", () => {
    const f = run([-100000, -50000, 200000, 100000, 100000]);
    for (const y of FORECAST_YEARS) expect(f.balanceSheet[y].balanceCheck, `Y${y}`).toBe(0);
    expect(f.reconciled).toBe(true);
  });
});

describe("a dividend can only come out of accumulated profit (§6.37)", () => {
  it("is not paid while the company is still carrying losses", () => {
    const f = run([-100000, 60000, 60000, 0, 0], { dividendRate: 50 });
    expect(f.pnl[1].dividends).toBe(0);

    // Year 2 makes 60,000 and pays no tax (relieved), but retained earnings are still -40,000.
    expect(f.pnl[2].netProfit).toBe(60000);
    expect(f.pnl[2].dividends).toBe(0);
    expect(f.pnl[2].dividendsWithheld).toBe(30000);

    // Year 3 clears the deficit part-way through, so only what is distributable is paid.
    expect(f.pnl[3].dividends).toBeGreaterThan(0);
    expect(f.pnl[3].dividends).toBeLessThanOrEqual(f.pnl[3].netProfit * 0.5);
  });

  it("pays the policy in full once there is profit behind it", () => {
    const f = run([100000, 100000, 100000, 100000, 100000], { dividendRate: 40 });
    for (const y of FORECAST_YEARS) {
      expect(f.pnl[y].dividends).toBeCloseTo(f.pnl[y].netProfit * 0.4, 2);
      expect(f.pnl[y].dividendsWithheld).toBe(0);
    }
  });

  it("never pays out cash the balance sheet cannot support", () => {
    const f = run([-100000, 60000, 60000, 0, 0], { dividendRate: 50 });
    for (const y of FORECAST_YEARS) expect(f.balanceSheet[y].balanceCheck, `Y${y}`).toBe(0);
    expect(f.reconciled).toBe(true);
  });
});
