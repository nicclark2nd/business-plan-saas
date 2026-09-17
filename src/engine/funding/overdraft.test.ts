import { describe, expect, it } from "vitest";
import { sweepOverdraft, HORIZON, type Facility } from "./overdraft";

/** 12% a year is 1% a month, so every figure below can be checked on paper. */
const facility = (over: Partial<Facility> = {}): Facility =>
  ({ id: "f1", name: "Overdraft", limit: 50_000, interestRate: 12, ...over });

const moves = (...first: number[]) => {
  const a = Array(HORIZON).fill(0) as number[];
  first.forEach((v, i) => { a[i] = v; });
  return a;
};

describe("an overdraft is a limit, not a lump sum", () => {
  it("does nothing at all when there is no facility", () => {
    const r = sweepOverdraft({ openingCash: 1_000, netMovement: moves(-10_000), facilities: [] });
    expect(r.idle).toBe(true);
    expect(r.totalInterest).toBe(0);
    expect(r.months[0].closingCash).toBe(-9_000);      // the plan is left exactly as it was, overdrawn
    expect(r.months[0].drawn).toBe(0);
  });

  it("draws exactly what the month is short, and not a dollar more", () => {
    const r = sweepOverdraft({ openingCash: 0, netMovement: moves(-10_000), facilities: [facility()] });
    const m = r.months[0];
    expect(m.interest).toBe(0);                        // nothing was owed at the START of month 1
    expect(m.drawn).toBe(10_000);
    expect(m.closingCash).toBe(0);
    expect(m.closingDrawn).toBe(10_000);
  });

  it("charges interest on what was owed at the start of the month", () => {
    const r = sweepOverdraft({ openingCash: 0, netMovement: moves(-10_000, 0), facilities: [facility()] });
    const m2 = r.months[1];
    expect(m2.openingDrawn).toBe(10_000);
    expect(m2.interest).toBe(100);                     // 10,000 x 1%
    expect(m2.drawn).toBe(100);                        // the interest itself has to be funded
    expect(m2.closingDrawn).toBe(10_100);
    expect(m2.closingCash).toBe(0);
  });

  it("puts every spare dollar back against the balance", () => {
    const r = sweepOverdraft({ openingCash: 0, netMovement: moves(-10_000, 0, 5_000), facilities: [facility()] });
    const m3 = r.months[2];
    expect(m3.openingDrawn).toBe(10_100);
    expect(m3.interest).toBe(101);
    expect(m3.repaid).toBe(4_899);                     // 5,000 less the month's interest
    expect(m3.closingDrawn).toBe(5_201);
    expect(m3.closingCash).toBe(0);
  });

  it("stops charging once it is paid off, and keeps the rest of the cash", () => {
    const r = sweepOverdraft({ openingCash: 0, netMovement: moves(-10_000, 40_000, 0), facilities: [facility()] });
    expect(r.months[1].closingDrawn).toBe(0);
    expect(r.months[1].closingCash).toBe(29_900);      // 40,000 less 10,000 repaid less 100 interest
    expect(r.months[2].interest).toBe(0);
    expect(r.months[2].closingCash).toBe(29_900);
  });

  /**
   * The property zero-buffer sweeping gives us, and the one a reader can hold in their head: if anything is
   * owed, the account is at nil. Money sitting beside a drawn balance would mean the sweep had not swept.
   */
  it("never holds spare cash and a drawn balance in the same month", () => {
    const r = sweepOverdraft({
      openingCash: 5_000,
      netMovement: moves(-30_000, 2_000, -4_000, 18_000, -1_000, 9_000),
      facilities: [facility()],
    });
    for (const m of r.months) {
      if (m.closingDrawn > 0) expect(m.closingCash, `month ${m.month}`).toBe(0);
      if (m.closingCash > 0) expect(m.closingDrawn, `month ${m.month}`).toBe(0);
    }
  });

  it("reports the shortfall by how much, once the limit is reached — and it does not go away", () => {
    const r = sweepOverdraft({ openingCash: 0, netMovement: moves(-60_000), facilities: [facility({ limit: 50_000 })] });
    const m = r.months[0];
    expect(m.drawn).toBe(50_000);
    expect(m.shortfall).toBe(10_000);
    expect(m.closingCash).toBe(-10_000);               // the plan is still short, and says so
    /**
     * Nothing repays a deficit the facility could not cover, and the drawn balance keeps costing interest,
     * so the hole gets deeper every month. Month 2 owes the same 50,000 at 1% and is 500 worse off. Every
     * month after the first is short too, which is the truth and not a reporting fault — a screen can say
     * "from month 1" rather than listing forty-eight numbers.
     */
    expect(r.months[1].interest).toBe(500);
    expect(r.months[1].shortfall).toBe(10_500);
    expect(r.short[0]).toBe(1);
    expect(r.short).toHaveLength(HORIZON);
  });

  it("cannot rescue a month before the facility exists", () => {
    const r = sweepOverdraft({
      openingCash: 0, netMovement: moves(-10_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -10_000),
      facilities: [facility({ availableFrom: 13 })],
    });
    expect(r.months[0].drawn).toBe(0);
    expect(r.months[0].closingCash).toBe(-10_000);
    /**
     * And when it does arrive it covers the whole accumulated hole, not just that month's: the business was
     * already 10,000 down and goes 10,000 further, so month 13 draws 20,000 and closes at nil.
     */
    expect(r.months[12].drawn).toBe(20_000);
    expect(r.months[12].closingCash).toBe(0);
  });

  it("charges the line fee whether or not the facility is used", () => {
    const r = sweepOverdraft({ openingCash: 100_000, netMovement: moves(), facilities: [facility({ annualFee: 1_200 })] });
    expect(r.months[0].fee).toBe(100);
    expect(r.months[0].drawn).toBe(0);
    expect(r.totalFees).toBe(6_000);                   // 1,200 a year for five years
    expect(r.months[11].closingCash).toBe(98_800);     // an unused facility is not free
  });

  it("adds each year up for the annual model, and names the deepest month", () => {
    const r = sweepOverdraft({ openingCash: 0, netMovement: moves(-10_000, 0, 5_000), facilities: [facility()] });
    /**
     * 10,000 in month 1 and 100 in month 2, then the 5,201 left after the month 3 repayment keeps costing
     * 1% a month with nothing coming in to meet it — nine more months of drawing to pay its own interest,
     * which compounds 5,201 to 5,688.26. A balance left outstanding is not idle.
     */
    expect(r.byYear[1].drawn).toBe(10_587.26);
    expect(r.byYear[1].closingDrawn).toBe(5_688.26);
    expect(r.byYear[1].repaid).toBe(4_899);
    expect(r.byYear[1].peakDrawn).toBe(10_100);
    expect(r.peak).toEqual({ month: 2, drawn: 10_100 });
    expect(r.byYear[1].closingDrawn).toBe(r.months[11].closingDrawn);
  });

  it("spreads a facility drawn across two of them in the order they are listed", () => {
    const r = sweepOverdraft({
      openingCash: 0, netMovement: moves(-70_000),
      facilities: [facility({ id: "a", limit: 50_000 }), facility({ id: "b", limit: 40_000, interestRate: 24 })],
    });
    expect(r.months[0].drawn).toBe(70_000);
    expect(r.months[0].shortfall).toBe(0);
    // 50,000 on the first at 1% and 20,000 on the second at 2% = 500 + 400.
    expect(r.months[1].interest).toBe(900);
  });
});
