import { describe, expect, it } from "vitest";
import {
  assetsByYear, bookValueAtDisposal, bookValueByYear, depreciationByYear, withDisposals,
  type FixedAsset,
} from "./depreciation";
import { disposalBookValueByYear, soldMonthByAsset, type ExtraordinaryItem } from "../extraordinary/items";
import { assembleBase } from "../forecast/assemble";
import { buildForecast, FORECAST_YEARS } from "../forecast/model";

/**
 * A sold asset stops wearing out (§6.56).
 *
 * The fault this file exists to prevent: the assets engine knew nothing about disposals, so a lathe sold in
 * Year 1 went on costing the profit 5,000 a year through Years 2, 3 and 4 — and the statements still
 * reconciled, because the same false charge came off the balance sheet as came off the profit. Internally
 * consistent and factually wrong is the hardest kind of fault to find, so it is pinned here.
 */
const lathe: FixedAsset = {
  id: "lathe", name: "Lathe", purchase_price: 20_000, residual_value: 0,
  useful_life_months: 48, method: "straight_line", already_owned: true,
};
const ute: FixedAsset = {
  id: "ute", name: "Ute", source: "entered", purchase_price: 60_000, residual_value: 0,
  useful_life_months: 60, method: "straight_line", start_year: 1, start_month: 1,
};
const sale = (assetId: string, year: number, month: number, amount: number): ExtraordinaryItem => ({
  id: `s-${assetId}-${year}-${month}`, description: "Sold it", category: "income",
  amount, year, month, source_asset_id: assetId,
});

describe("an asset that has been sold", () => {
  it("stops depreciating the month it goes", () => {
    // Sold in the very first month: it never wears out in this plan at all.
    const [gone] = withDisposals([lathe], soldMonthByAsset([sale("lathe", 1, 1, 50_000)]));
    expect(depreciationByYear(gone)).toEqual([0, 0, 0, 0, 0]);
    // Sold in month 7 of Year 2 — 18 months of the plan gone, at 416.67 a month.
    const [mid] = withDisposals([lathe], soldMonthByAsset([sale("lathe", 2, 7, 9_000)]));
    const y = depreciationByYear(mid);
    expect(y[0]).toBeCloseTo(5_000, 2);
    expect(y[1]).toBeCloseTo(2_500, 2);
    expect(y.slice(2)).toEqual([0, 0, 0]);
  });

  it("leaves an asset nobody sold exactly as it was", () => {
    const [same] = withDisposals([lathe], soldMonthByAsset([sale("something-else", 1, 1, 10)]));
    expect(depreciationByYear(same)).toEqual(depreciationByYear(lathe));
    expect(bookValueByYear(same)).toEqual(bookValueByYear(lathe));
  });

  it("is off the books from the year of the sale", () => {
    const [gone] = withDisposals([ute], soldMonthByAsset([sale("ute", 3, 1, 40_000)]));
    const book = bookValueByYear(gone);
    expect(book[0]).toBe(48_000);
    expect(book[1]).toBe(36_000);
    expect(book.slice(2)).toEqual([0, 0, 0]);       // sold in Year 3: the business does not still own it
    expect(assetsByYear([gone])[4].bookValue).toBe(0);
  });

  it("values the sale at what the asset was carrying the day it left", () => {
    // 60,000 over 60 months = 1,000 a month. Sold in month 4 of Year 2: 15 months charged, 45,000 left.
    const [gone] = withDisposals([ute], soldMonthByAsset([sale("ute", 2, 4, 52_000)]));
    expect(bookValueAtDisposal(gone)).toBeCloseTo(45_000, 2);
    expect(disposalBookValueByYear([sale("ute", 2, 4, 52_000)], [ute])[1]).toBeCloseTo(45_000, 2);
  });

  it("puts nothing on the books for an asset that was never sold", () => {
    expect(bookValueAtDisposal(ute)).toBe(0);
  });

  it("can only leave once — the earliest sale is the one that counts", () => {
    const map = soldMonthByAsset([sale("ute", 4, 1, 10_000), sale("ute", 2, 1, 30_000)]);
    expect(map.ute).toBe(12);
  });

  it("ignores a money-out one-off that happens to name an asset", () => {
    const repair: ExtraordinaryItem = {
      id: "r", description: "Rebuild", category: "expense", amount: 5_000, year: 2, month: 1, source_asset_id: "ute",
    };
    expect(soldMonthByAsset([repair])).toEqual({});
  });
});

describe("the forecast, end to end, with a disposal in it", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sources: any = {
    products: [{ id: "p", name: "Slabs", sold_as: "one_off", average_price: 10_000, units_sold: 40, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null }],
    fixedCogs: [], overheads: [{ id: "o", name: "Rent", current_value: 60_000, yearly_change: {}, start_year: 1 }],
    salaries: [0, 0, 0, 0, 0], marketing: [0, 0, 0, 0, 0], onCostPct: 0,
    funding: [], assets: [ute], extraordinary: [sale("ute", 2, 4, 52_000)],
  };
  sources.costProducts = sources.products.map((p: Record<string, unknown>) => ({ ...p, cost_per_unit: 4_000, yearly_cost_increase: {} }));

  const base = assembleBase(sources);

  it("charges only the depreciation the asset earned before it was sold", () => {
    expect(base[1].depreciation).toBeCloseTo(12_000, 2);
    expect(base[2].depreciation).toBeCloseTo(3_000, 2);     // three months of Year 2, then it goes
    expect(base[3].depreciation).toBe(0);
    expect(base[4].depreciation).toBe(0);
    expect(base[5].depreciation).toBe(0);
  });

  it("puts only the gain over book value into profit, and the whole cheque into investing", () => {
    expect(base[2].disposalProceeds).toBe(52_000);
    expect(base[2].disposedBookValue).toBeCloseTo(45_000, 2);
    expect(base[2].extraordinaryIncome).toBe(0);           // never counted as income as well
    const f = buildForecast({
      base,
      opening: {
        cash: 100_000, accountsReceivable: 0, inventory: 0, otherCurrentAssets: 0,
        fixedAssets: 0, otherNonCurrentAssets: 0, accountsPayable: 0,
        bankLoansCurrent: 0, bankLoansNonCurrent: 0, otherCurrentLiabilities: 0, otherNonCurrentLiabilities: 0,
        equity: 100_000, taxPayable: 0, prepaid: 0, accrued: 0,
      },
      workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { debtorDays: 0, inventoryDays: 0, creditorDays: 0 }])),
      cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 }])),
      taxRate: 25, dividendRate: 0,
    });
    expect(f.pnl[2].disposalGainLoss).toBeCloseTo(7_000, 2);
    expect(f.cashFlow[2].disposalProceeds).toBe(52_000);
    // The one thing that makes all of it true: the statements still reconcile, on the honest figures now.
    expect(f.invariants.filter((i) => !i.passed).map((i) => `${i.key} Y${i.year} off by ${i.difference}`)).toEqual([]);
    // And the asset is gone from the balance sheet rather than being written down forever.
    // Nothing but the ute was ever on the books, and the ute has gone: the plant line is empty and STAYS
    // empty, rather than being written down by 1,000 a month for an asset that is not there.
    expect(f.balanceSheet[1].fixedAssets).toBeCloseTo(48_000, 2);
    expect(f.balanceSheet[2].fixedAssets).toBe(0);
    expect(f.balanceSheet[5].fixedAssets).toBe(0);
  });
});
