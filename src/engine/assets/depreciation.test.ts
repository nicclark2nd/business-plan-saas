import { describe, it, expect } from "vitest";
import { depreciationByYear, depreciationMonths, bookValueByYear, capexByYear, assetsByYear, assetsMonths, type FixedAsset } from "./depreciation";

const ute: FixedAsset = { name: "Ute", source: "entered", purchase_price: 60000, residual_value: 0, useful_life_months: 60, method: "straight_line", start_year: 1, start_month: 1 };

describe("fixed assets", () => {
  it("writes a straight-line asset off evenly over its life", () => {
    expect(depreciationByYear(ute)).toEqual([12000, 12000, 12000, 12000, 12000]);
    expect(bookValueByYear(ute)).toEqual([48000, 36000, 24000, 12000, 0]);
  });

  it("never writes off more than the asset is worth above its residual", () => {
    const withResidual = { ...ute, residual_value: 15000 };
    const years = depreciationByYear(withResidual);
    expect(years.reduce((a, b) => a + b, 0)).toBe(45000);       // 60,000 - 15,000, not a cent more
    expect(bookValueByYear(withResidual)[4]).toBe(15000);       // it stops at what it is still worth
  });

  it("a short life finishes early and then charges nothing", () => {
    const laptop = { ...ute, purchase_price: 6000, useful_life_months: 36 };
    const years = depreciationByYear(laptop);
    expect(years).toEqual([2000, 2000, 2000, 0, 0]);
    expect(years.reduce((a, b) => a + b, 0)).toBe(6000);
  });

  it("depreciates from the month it arrives, not the start of the plan", () => {
    const midYear = { ...ute, start_year: 2, start_month: 7 };
    const y = depreciationByYear(midYear);
    expect(y[0]).toBe(0);
    expect(y[1]).toBe(6000);                                    // Jul–Jun of year 2: six months
    expect(depreciationMonths(midYear)[17]).toBe(0);            // the month before it arrives
    expect(depreciationMonths(midYear)[18]).toBe(1000);
  });

  it("diminishing value front-loads the write-off and still stops at the residual", () => {
    const dv = { ...ute, method: "diminishing" as const, residual_value: 5000 };
    const y = depreciationByYear(dv);
    expect(y[0]).toBeGreaterThan(y[1]);                         // early years carry more
    expect(y[1]).toBeGreaterThan(y[4]);
    expect(bookValueByYear(dv)[4]).toBeGreaterThanOrEqual(5000);
  });

  it("a financed asset costs no cash the year it is bought — the lender paid for it", () => {
    expect(capexByYear({ ...ute, source: "finance" })).toEqual([0, 0, 0, 0, 0]);
    expect(capexByYear(ute)).toEqual([60000, 0, 0, 0, 0]);
    expect(depreciationByYear({ ...ute, source: "finance" })[0]).toBe(12000);   // but it still depreciates
  });

  it("adds the assets up and splits Year 1 across the months", () => {
    const laptop = { ...ute, name: "Laptop", purchase_price: 6000, useful_life_months: 36 };
    const totals = assetsByYear([ute, laptop]);
    expect(totals[0].depreciation).toBe(14000);
    expect(totals[0].capex).toBe(66000);
    expect(assetsMonths([ute, laptop])[0]).toBe(1166.67);
    expect(assetsMonths([ute, laptop]).reduce((a, b) => a + b, 0)).toBeCloseTo(14000, 1);
  });
});
