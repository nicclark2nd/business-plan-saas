import { describe, it, expect } from "vitest";
import { recurringProjection, activeByMonth, activeByMonthFixed, bookValue } from "./recurring";

const NONE = [0, 0, 0, 0, 0];

describe("recurring products", () => {
  it("a coach winning ten clients through the year bills far less than the run rate", () => {
    // Nic's example: $24,000 a client a year ($2,000 a month), ten clients won Feb–Dec, each staying 12 months.
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 0,
      newByMonth: [0, 1, 0, 3, 1, 1, 2, 0, 0, 1, 0, 1], newByYear: NONE, averageLifeMonths: 12,
    });
    expect(p.years[0].newClients).toBe(10);
    expect(p.years[0].revenue).toBeLessThan(240000);           // NOT price × units
    expect(p.years[0].revenue).toBeGreaterThan(100000);
  });

  it("with no leavers the arithmetic is exactly the client-months", () => {
    // A very long life ≈ nobody leaves: 69 client-months × $2,000 = $138,000.
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 0,
      newByMonth: [0, 1, 0, 3, 1, 1, 2, 0, 0, 1, 0, 1], newByYear: NONE, averageLifeMonths: 1e6,
    });
    expect(Math.round(p.years[0].revenue)).toBe(138000);
    expect(p.years[0].runRateAtEnd).toBeCloseTo(240000, -2);     // ten clients on the books at December
  });

  it("a business that wins nothing in year two goes backwards as clients roll off", () => {
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 0,
      newByMonth: [0, 1, 0, 3, 1, 1, 2, 0, 0, 1, 0, 1], newByYear: NONE, averageLifeMonths: 12,
    });
    expect(p.years[1].revenue).toBeLessThan(p.years[0].revenue);
  });

  it("a new coach losing clients at three months keeps very little", () => {
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 0,
      newByMonth: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], newByYear: NONE, averageLifeMonths: 3,
    });
    expect(p.years[0].revenue).toBeLessThan(3 * 3 * 2000);      // three clients × three months is the ceiling
    expect(p.years[0].activeAtEnd).toBeLessThan(1.5);
  });

  it("an established firm bills its opening book from month one", () => {
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 12,
      newByMonth: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0], newByYear: NONE, averageLifeMonths: 60,
    });
    expect(bookValue(12, 2000)).toBe(288000);
    expect(p.months[0].revenue).toBe(24000);                    // twelve clients billing in January
    expect(p.years[0].revenue).toBeGreaterThan(288000);          // three more won through the year
  });

  it("the opening book needs no age — remaining life is the same for everyone", () => {
    const a = activeByMonth(10, Array(12).fill(0), 12);
    expect(a[0]).toBe(10);
    expect(a[11]).toBeLessThan(10);
    expect(a[11]).toBeGreaterThan(0);
  });

  it("a fixed programme bills every month of its term — the client-months exactly", () => {
    // Ten clients won Feb–Dec on a served-out 12-month programme: 69 client-months × $2,000.
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 0, lifeMode: "fixed",
      newByMonth: [0, 1, 0, 3, 1, 1, 2, 0, 0, 1, 0, 1], newByYear: NONE, averageLifeMonths: 12,
    });
    expect(p.years[0].revenue).toBe(138000);
    expect(p.years[0].runRateAtEnd).toBe(240000);
  });

  it("a fixed programme reads higher than the same life as a drift rate", () => {
    const base = { monthlyPrice: 2000, openingClients: 0, newByMonth: [0, 1, 0, 3, 1, 1, 2, 0, 0, 1, 0, 1], newByYear: NONE, averageLifeMonths: 12 };
    const fixed = recurringProjection({ ...base, lifeMode: "fixed" }).years[0].revenue;
    const drift = recurringProjection({ ...base, lifeMode: "average" }).years[0].revenue;
    expect(fixed).toBeGreaterThan(drift);
  });

  it("a fixed opening book runs off over the term", () => {
    const a = activeByMonthFixed(12, Array(24).fill(0), 12);
    expect(a[0]).toBe(12);
    expect(a[6]).toBe(6);
    expect(a[12]).toBe(0);
  });

  it("a one-month life means each client pays once", () => {
    const p = recurringProjection({ monthlyPrice: 1000, openingClients: 0, newByMonth: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], newByYear: NONE, averageLifeMonths: 1 });
    expect(p.years[0].revenue).toBe(2000);
  });

  it("later years spread their new clients evenly and carry the book forward", () => {
    const p = recurringProjection({
      monthlyPrice: 2000, openingClients: 0,
      newByMonth: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], newByYear: [0, 6, 6, 6, 6], averageLifeMonths: 60,
    });
    expect(p.years[1].newClients).toBe(6);
    expect(p.years[4].revenue).toBeGreaterThan(p.years[0].revenue);
  });
});
