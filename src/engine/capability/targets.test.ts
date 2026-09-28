import { describe, expect, it } from "vitest";
import { clampTarget, mayWriteThrough, readTargets } from "./targets";

describe("agreed targets (§6.165)", () => {
  it("clamps each kind to its range, whole where it must be", () => {
    expect(clampTarget("grossMargin", 142)).toBe(100);
    expect(clampTarget("grossMargin", 41.567)).toBe(41.57);
    expect(clampTarget("debtorDays", 30.6)).toBe(31);
    expect(clampTarget("loanTermMonths", 0)).toBe(1);
    expect(clampTarget("cashFloor", -5)).toBe(0);
    expect(clampTarget("breakEven", -2500)).toBe(-2500);
    expect(clampTarget("cashFloor", 68_319.58)).toBe(68_320);
    expect(clampTarget("cashFloor", Number.NaN)).toBeNull();
  });

  it("reads the column defensively", () => {
    expect(readTargets(null)).toBeNull();
    expect(readTargets({})).toEqual({});
    expect(readTargets({ grossMargin: { value: "42", proposed: 42, agreed_at: "2026-09-28" }, nonsense: { value: 1 }, debtorDays: { value: "x" } }))
      .toEqual({ grossMargin: { value: 42, proposed: 42, agreed_at: "2026-09-28" } });
  });

  it("writes through only to an empty setting or the one it wrote", () => {
    expect(mayWriteThrough(null, null)).toBe(true);
    expect(mayWriteThrough(60, 60)).toBe(true);
    expect(mayWriteThrough(48, 60)).toBe(false);
    expect(mayWriteThrough(48, null)).toBe(false);
  });
});
