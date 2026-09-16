import { describe, expect, it } from "vitest";
import { assetsByYear, bookValueByYear, capexByYear, depreciationByYear, type FixedAsset } from "./depreciation";

/** A lathe the business has had for years: worth 20,000 now, four years left in it. */
const lathe: FixedAsset = {
  id: "l", name: "Lathe", source: "entered", already_owned: true,
  purchase_price: 20_000, residual_value: 0, useful_life_months: 48,
  method: "straight_line", start_year: 1, start_month: 1,
};
/** The same thing bought new in Year 1, for comparison. */
const bought: FixedAsset = { ...lathe, id: "b", already_owned: false };

describe("an asset the business already owns", () => {
  it("costs nothing: the money left before the plan began", () => {
    expect(capexByYear(lathe)).toEqual([0, 0, 0, 0, 0]);
    expect(capexByYear(bought)).toEqual([20_000, 0, 0, 0, 0]);
  });

  it("adds nothing to the balance sheet either — the opening figure already holds it", () => {
    // Otherwise itemising a lathe that is already inside 129,294 of opening plant counts it twice.
    expect(assetsByYear([lathe])[0].additions).toBe(0);
    expect(assetsByYear([bought])[0].additions).toBe(20_000);
  });

  it("but it WEARS OUT, which the single opening lump never did", () => {
    expect(depreciationByYear(lathe)).toEqual([5_000, 5_000, 5_000, 5_000, 0]);
    expect(bookValueByYear(lathe)).toEqual([15_000, 10_000, 5_000, 0, 0]);
  });

  it("starts wearing out in the plan's first month, whatever is in its start fields", () => {
    const late = { ...lathe, start_year: 4, start_month: 7 };
    expect(depreciationByYear(late)).toEqual(depreciationByYear(lathe));
  });

  it("wears out exactly as the same thing bought new would", () => {
    // The only difference between owning it and buying it today is the cash and the addition, never the wear.
    expect(depreciationByYear(lathe)).toEqual(depreciationByYear(bought));
  });

  it("is worth what is left of it, so selling it can be priced honestly", () => {
    // What a disposal reads for a sale in Year 3 is the book value at the close of Year 2.
    expect(bookValueByYear(lathe)[1]).toBe(10_000);
  });
});
