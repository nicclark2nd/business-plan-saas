import { describe, expect, it } from "vitest";
import { checkTargets, clampTarget, mayWriteThrough, readTargets, type TargetFacts } from "./targets";

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

describe("the plan against its agreed targets (§6.167)", () => {
  const money = (v: number) => Math.round(v).toLocaleString("en-AU");
  const at = (value: number) => ({ value, proposed: value, agreed_at: "2026-09-28" });
  const facts: TargetFacts = {
    firstYear: 2027,
    y1: { revenue: 2_000_000, cogs: 1_218_000, overheads: 845_000, operatingProfit: -63_000 },
    debtorDays: 46, loanTermMonths: 24, lowestCash: { value: -12_400, when: "Mar 2029" },
  };
  const all = { grossMargin: at(42), overheadsCap: at(819_835), breakEven: at(0), debtorDays: at(30), loanTermMonths: at(60), cashFloor: at(68_320) };

  it("reads every target, with the gap in its own terms and in money", () => {
    const c = Object.fromEntries(checkTargets(all, facts, money).map((x) => [x.kind, x]));
    expect(c.grossMargin.plan).toBe("Plan has 39.1% in 2027");
    expect(c.grossMargin.met).toBe(false);
    expect(c.grossMargin.gap).toBe("2.9 points short — about 58,000 less profit on 2027's sales");
    expect(c.overheadsCap.gap).toBe("25,165 over");
    expect(c.breakEven.plan).toBe("Plan has a loss of 63,000");
    expect(c.debtorDays.gap).toBe("16 days slower — about 87,671 more cash stuck in unpaid invoices");
    expect(c.loanTermMonths.gap).toBe("36 months shorter, so the yearly payments are higher");
    expect(c.cashFloor.plan).toBe("Lowest month overdrawn by 12,400, Mar 2029");
    expect(c.cashFloor.gap).toBe("80,720 below the cash floor at its lowest");
  });

  it("says met, and says when the plan has nothing to read yet", () => {
    const good = { ...facts, y1: { revenue: 2_000_000, cogs: 1_100_000, overheads: 800_000, operatingProfit: 100_000 }, debtorDays: 30, loanTermMonths: 60, lowestCash: { value: 90_000, when: "Jan 2027" } };
    expect(checkTargets(all, good, money).every((x) => x.met === true && x.gap === null)).toBe(true);
    const empty = checkTargets(all, { firstYear: 2027, y1: null, debtorDays: null, loanTermMonths: null, lowestCash: null }, money);
    expect(empty.every((x) => x.met === null)).toBe(true);
    expect(empty.find((x) => x.kind === "loanTermMonths")!.plan).toBe("The plan cannot work out the loan payments until the interest rate is in");
  });

  it("shows each step only its own targets", () => {
    expect(checkTargets(all, facts, money, "cogs").map((x) => x.kind)).toEqual(["grossMargin"]);
    expect(checkTargets(all, facts, money, "assumptions").map((x) => x.kind).sort()).toEqual(["cashFloor", "debtorDays"]);
    expect(checkTargets(null, facts, money)).toEqual([]);
  });
});
