import { describe, expect, it } from "vitest";
import {
  DEFAULT_STRESS, LENDER_MIN_DSCR, annualRepayment, borrowingCapacity, over, score, statusOf,
  type CapabilityInput, type Metric,
} from "./model";
import { growMetrics, GROW_WEIGHTS } from "./grow";
import { borrowMetrics, stressedCash, BORROW_WEIGHTS } from "./borrow";

/**
 * WHAT THESE TESTS ARE FOR (§6.128).
 *
 * A dial is the most confident thing a screen can show. It has a needle, a colour and a verdict, and a
 * client reads it in one second without checking anything — which makes a wrong one worse than a wrong
 * table. So the arithmetic is tested away from the screen, and the two behaviours that protect the client
 * from a confident wrong answer are tested hardest: an unanswerable metric must stay unanswerable, and it
 * must not quietly drag the score down.
 */

const empty: CapabilityInput = {
  money: (v) => `$${Math.round(v).toLocaleString("en-AU")}`,
  pnl: {}, cashFlow: {}, balanceSheet: {}, days: {},
  monthlyCash: [], monthlyProfit: [], debtService: {}, capex: {},
  cashBuffer: null, proposal: null, stress: DEFAULT_STRESS,
};

const pnl = (revenue: number, over_: Partial<Record<string, number>> = {}) => ({
  revenue, variableCogs: 0, fixedCogs: 0, cogs: revenue * 0.68, grossProfit: revenue * 0.32,
  grossMargin: 32, overheads: revenue * 0.19, depreciation: 60_000,
  operatingProfit: revenue * 0.13 - 60_000, interest: 40_000, profitBeforeTax: 0,
  taxableProfit: 0, tax: 0, netProfit: 0, lossesCarriedForward: 0, dividends: 0, retainedProfit: 0,
  ...over_,
}) as unknown as NonNullable<CapabilityInput["pnl"][number]>;

const cf = (netOperating: number) => ({
  openingCash: 0, receiptsFromCustomers: 0, grantsReceived: 0, extraordinaryReceipts: 0,
  paidToSuppliersAndEmployees: -1_200_000, extraordinaryPayments: 0, taxPaid: 0,
  netOperating, gstRemitted: 0, capex: 0, disposalProceeds: 0, netInvesting: 0,
  debtProceeds: 0, equityRaised: 0, debtRepaid: 0, interestPaid: 40_000, dividendsPaid: 0,
  netFinancing: 0, netMovement: 0, closingCash: 200_000,
}) as unknown as NonNullable<CapabilityInput["cashFlow"][number]>;

const bs = (o: Partial<Record<string, number>> = {}) => ({
  cash: 200_000, accountsReceivable: 300_000, inventory: 180_000, prepaid: 0, gstReceivable: 0,
  otherCurrentAssets: 0, currentAssets: 680_000, fixedAssets: 900_000, otherNonCurrentAssets: 0,
  nonCurrentAssets: 900_000, totalAssets: 1_580_000, accountsPayable: 220_000, accrued: 0,
  taxPayable: 0, gstPayable: 0, debtCurrent: 90_000, deferredIncomeCurrent: 0,
  otherCurrentLiabilities: 0, currentLiabilities: 420_000, debtNonCurrent: 410_000,
  deferredIncomeNonCurrent: 0, otherNonCurrentLiabilities: 0, nonCurrentLiabilities: 410_000,
  totalLiabilities: 830_000, equity: 750_000, totalLiabilitiesAndEquity: 1_580_000, check: 0,
  ...o,
}) as unknown as NonNullable<CapabilityInput["balanceSheet"][number]>;

const full = (o: Partial<CapabilityInput> = {}): CapabilityInput => ({
  ...empty,
  pnl: { 1: pnl(2_000_000), 2: pnl(2_200_000) },
  cashFlow: { 1: cf(240_000), 2: cf(260_000) },
  balanceSheet: { 1: bs(), 2: bs({ accountsReceivable: 340_000, inventory: 200_000 }) },
  days: { 1: { debtorDays: 52, inventoryDays: 48, creditorDays: 34 }, 2: { debtorDays: 52, inventoryDays: 48, creditorDays: 34 } },
  monthlyCash: [200, 180, 150, 120, 90, 60, 80, 110, 140, 170, 190, 210].map((v) => v * 1000),
  monthlyProfit: new Array(12).fill(20_000),
  debtService: { 1: 120_000 }, capex: { 1: 40_000, 2: 300_000 },
  cashBuffer: 100_000,
  ...o,
});

describe("bands and scoring", () => {
  const bands = [{ to: 1, s: "bad" as const }, { to: 2, s: "watch" as const }, { to: 9, s: "good" as const }];

  it("puts a value in the first band it does not exceed", () => {
    expect(statusOf(0.5, bands)).toBe("bad");
    expect(statusOf(1, bands)).toBe("bad");      // the edge belongs to the band it closes
    expect(statusOf(1.01, bands)).toBe("watch");
    expect(statusOf(50, bands)).toBe("good");    // above every band, the last one catches it
  });

  it("has no opinion about a value that could not be computed", () => {
    expect(statusOf(null, bands)).toBeNull();
    expect(statusOf(NaN, bands)).toBeNull();
  });

  const m = (key: string, value: number | null): Metric => ({
    key, name: key, value, display: "", min: 0, max: 10, bands, unit: "plain",
    note: "", bench: "", formula: "", reveals: "", confidence: "",
  });

  /*
   * THE ONE THAT MATTERS MOST. A new plan has almost nothing in it. If a blank field scored zero, every
   * client would open their first capability screen on a red dial reading 20 out of 100 — a verdict on a
   * business nobody has described yet (§6.89).
   */
  it("leaves an unanswerable metric out of the score entirely, rather than scoring it nought", () => {
    const withGap = score([m("a", 5), m("b", null)]);
    const without = score([m("a", 5)]);
    expect(withGap.value).toBe(without.value);
    expect(withGap.value).toBe(100);
  });

  it("says how much of itself the score was built from", () => {
    const s = score([m("a", 5), m("b", null), m("c", 0.5)]);
    expect(s.covered).toBe(2);
    expect(s.total).toBe(3);
  });

  it("is null when nothing at all could be computed", () => {
    expect(score([m("a", null), m("b", null)]).value).toBeNull();
  });

  it("weights the metrics that matter more", () => {
    const flat = score([m("a", 5), m("b", 0.5)]);                 // one good, one bad
    const tilted = score([m("a", 5), m("b", 0.5)], { b: 3 });     // the bad one counted three times
    expect(flat.value).toBeGreaterThan(tilted.value!);
  });
});

describe("loan arithmetic", () => {
  it("amortises a loan the way a bank does", () => {
    /* $1.5M over 7 years at 8.5% — the worked example on the dashboard this was modelled on. */
    expect(annualRepayment(1_500_000, 8.5, 7)).toBeCloseTo(293_000, -3);
  });

  it("handles a nil rate without dividing by zero", () => {
    expect(annualRepayment(700_000, 0, 7)).toBe(100_000);
  });

  it("refuses a loan with no amount or no term", () => {
    expect(annualRepayment(0, 8.5, 7)).toBeNull();
    expect(annualRepayment(500_000, 8.5, 0)).toBeNull();
  });

  /**
   * THE ROUND TRIP, which is the only honest way to test a capacity figure: borrow exactly what the
   * calculator says is supportable, and the cover it produces must land on the minimum it promised.
   * Anything else means the two halves of the screen disagree about the same loan (§6.41).
   */
  it("returns a loan that lands exactly on the minimum cover", () => {
    const cash = 665_000, existing = 210_000, rate = 8.5, term = 7;
    const cap = borrowingCapacity(cash, existing, rate, term, LENDER_MIN_DSCR)!;
    const cover = cash / (existing + annualRepayment(cap, rate, term)!);
    expect(cover).toBeCloseTo(LENDER_MIN_DSCR, 4);
  });

  it("supports nothing when existing repayments already use the cash up", () => {
    expect(borrowingCapacity(200_000, 200_000, 8.5, 7, LENDER_MIN_DSCR)).toBe(0);
  });

  it("refuses to divide by nothing", () => {
    expect(over(10, 0)).toBeNull();
    expect(over(null, 5)).toBeNull();
  });
});

describe("the downside", () => {
  it("leaves less cash than the base case", () => {
    const i = full();
    const base = i.cashFlow[1]!.netOperating + i.cashFlow[1]!.interestPaid;
    expect(stressedCash(i)!).toBeLessThan(base);
  });

  it("does nothing when every stress setting is nil, which is the proof it is doing the right arithmetic", () => {
    const i = full({ stress: { salesPct: 0, marginPts: 0, debtorDaysAdded: 0 } });
    const base = i.cashFlow[1]!.netOperating + i.cashFlow[1]!.interestPaid;
    expect(stressedCash(i)).toBeCloseTo(base, 2);
  });

  it("cannot be computed without a forecast", () => {
    expect(stressedCash(empty)).toBeNull();
  });
});

describe("an empty plan", () => {
  /*
   * A CLIENT WHO HAS ENTERED NOTHING MUST BE TOLD WHAT TO ENTER, not shown a wall of zeros. Every metric
   * that cannot answer carries the sentence that would make it answerable.
   */
  it("answers nothing, and says what is wanted for each", () => {
    for (const metric of [...growMetrics(empty), ...borrowMetrics(empty)]) {
      expect(metric.value, `${metric.key} invented a value`).toBeNull();
      expect(metric.display).toBe("—");
      expect(metric.missing, `${metric.key} has no sentence saying what is missing`).toBeTruthy();
    }
  });

  it("produces no score at all rather than a bad one", () => {
    expect(score(growMetrics(empty), GROW_WEIGHTS).value).toBeNull();
    expect(score(borrowMetrics(empty), BORROW_WEIGHTS).value).toBeNull();
  });
});

describe("growth, on a plan that has a forecast", () => {
  const g = growMetrics(full());
  const by = (k: string) => g.find((x) => x.key === k)!;

  it("reads growth out of the forecast's own two years", () => {
    expect(by("revenueGrowth").value).toBe(10);       // 2.0M → 2.2M
  });

  it("works out the cash cycle from the same days the forecast runs on", () => {
    expect(by("cashCycle").value).toBe(66);            // 48 + 52 − 34
  });

  it("finds the worst month, not the worst year", () => {
    expect(by("lowestCash").value).toBe(60_000);
    expect(by("lowestCash").sub).toBe("Month 6 of Year 1");
  });

  /* A dip below the buffer the client set is a warning, not a failure — and not a pass either. */
  it("grades the lowest month against the buffer the client chose", () => {
    expect(statusOf(by("lowestCash").value, by("lowestCash").bands)).toBe("watch");
    const fine = growMetrics(full({ cashBuffer: 20_000 }));
    expect(statusOf(fine.find((x) => x.key === "lowestCash")!.value, fine.find((x) => x.key === "lowestCash")!.bands)).toBe("good");
  });

  it("says a plan that runs out of money runs out of money", () => {
    const broke = growMetrics(full({ monthlyCash: [100_000, -40_000, 20_000] }));
    const low = broke.find((x) => x.key === "lowestCash")!;
    expect(statusOf(low.value, low.bands)).toBe("bad");
    expect(low.note).toContain("runs out of money");
  });

  /**
   * THE ONE THIS SCREEN FAILED ON ITS FIRST REAL PLAN (§6.128.1).
   *
   * SEQ Concreting scored 100 out of 100 for growth while its Year 1 forecast lost $137,000. Every
   * measure was individually true and the conclusion was nonsense, because nothing asked whether there
   * was a profit to grow. A loss-making plan must not be able to reach a healthy score on this tab, no
   * matter how well its cash cycle and margins behave.
   */
  it("cannot score a loss-making plan as healthy, however well everything else reads", () => {
    const losing = full({
      pnl: { 1: pnl(2_000_000), 2: pnl(2_200_000, { operatingProfit: -140_000 }) },
    });
    const metrics = growMetrics(losing);
    const margin = metrics.find((x) => x.key === "operatingMargin")!;
    expect(statusOf(margin.value, margin.bands)).toBe("bad");
    expect(margin.note).toContain("makes the loss bigger");

    const s = score(metrics, GROW_WEIGHTS).value!;
    expect(s, "a plan that loses money reached the healthy band").toBeLessThan(70);
  });

  it("every metric carries the three lines the expander shows", () => {
    for (const x of g) {
      expect(x.formula, `${x.key} has no formula`).toBeTruthy();
      expect(x.reveals, `${x.key} does not say what it shows`).toBeTruthy();
      expect(x.confidence, `${x.key} does not state its confidence`).toBeTruthy();
    }
  });
});

describe("borrowing, with and without a loan in mind", () => {
  it("waits for the loan rather than assuming there is none", () => {
    const b = borrowMetrics(full());
    const dscr = b.find((x) => x.key === "dscr")!;
    expect(dscr.value).toBeNull();
    expect(dscr.missing).toContain("loan you are considering");
  });

  it("still answers the balance-sheet questions, which do not need a loan", () => {
    const b = borrowMetrics(full());
    expect(b.find((x) => x.key === "currentRatio")!.value).toBeCloseTo(1.62, 2);
    expect(b.find((x) => x.key === "quickRatio")!.value).toBeCloseTo(1.19, 2);
  });

  it("tests the loan once one is entered", () => {
    const b = borrowMetrics(full({ proposal: { amount: 400_000, ratePct: 8.5, termYears: 7, undrawn: 0, collateral: 800_000 } }));
    const dscr = b.find((x) => x.key === "dscr")!;
    expect(dscr.value).not.toBeNull();
    expect(b.find((x) => x.key === "lvr")!.value).toBe(50);
  });

  /* The sentence a client acts on has to be the one the arithmetic supports. */
  it("names the shortfall when the loan is bigger than the cash flow carries", () => {
    const b = borrowMetrics(full({ proposal: { amount: 5_000_000, ratePct: 8.5, termYears: 7, undrawn: 0, collateral: null } }));
    const cap = b.find((x) => x.key === "capacity")!;
    expect(statusOf(cap.value, cap.bands)).toBe("bad");
    expect(cap.note).toContain("larger than");
  });
});
