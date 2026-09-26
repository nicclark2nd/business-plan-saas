import { describe, expect, it } from "vitest";
import {
  annualRepayment, borrowingCapacity, over, score, statusOf,
  type CapabilityInput, type Metric,
} from "./model";
import { growMetrics, GROW_WEIGHTS } from "./grow";
import { borrowMetrics, stressedCash, BORROW_WEIGHTS, CAPACITY_TERM_YEARS } from "./borrow";
import { sellMetrics, SELL_WEIGHTS } from "./sell";
import { panels, series, withTrends } from "./series";
import { buyerQuestions, verdict } from "./verdict";
import { ageingView, concentration, earningsBridge, executionLines, lenderChecklist, type ExtraFacts } from "./extras";
import {
  LENDER_MIN_DSCR, TRANSFER_FACTORS, readCollateral, readGrowth, readSale, readStress, readUndrawn,
  type TransferFactor,
} from "./judgements";

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
  /*
   * NOTHING IS DEFAULTED (§6.129). `empty` used to carry DEFAULT_GROWTH and DEFAULT_STRESS, which meant the
   * "empty plan" tests below were run against a plan that had silently been given a cost of capital and a
   * downside case. A test fixture that is more complete than a real new plan cannot catch what a real new
   * plan does.
   */
  growth: { cashBuffer: null, costOfCapital: null },
  stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
  sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null },
  transfer: [], collateral: null, undrawn: 0,
  recurringShare: null, largestProductShare: null, leadershipPay: null,
};

/** The six judgements, as rows, the way Leadership Team stores them. */
const rate = (...scores: number[]): { factor: TransferFactor; score: number; note: string | null }[] =>
  scores.map((n, idx) => ({ factor: TRANSFER_FACTORS[idx].key, score: n, note: null }));

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
  growth: { cashBuffer: 100_000, costOfCapital: 11 },
  stress: { salesPct: 10, marginPts: 1.5, debtorDaysAdded: 10 },
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

  /*
   * ALL THREE OR NONE (§6.89, §6.129). A downside with two of the three answered is not a milder downside,
   * it is an incomplete one — and a stressed cover figure built on it would be quoted to a lender as though
   * the whole test had been run.
   */
  it("refuses a half-described bad year rather than testing a milder one", () => {
    const half = full({ stress: { salesPct: 10, marginPts: null, debtorDaysAdded: 10 } });
    expect(stressedCash(half)).toBeNull();
    const b = borrowMetrics(half).find((x) => x.key === "dscrStressed")!;
    expect(b.value).toBeNull();
    expect(b.fix?.to).toBe("assumptions?area=downside");
  });
});

describe("an empty plan", () => {
  /*
   * A CLIENT WHO HAS ENTERED NOTHING MUST BE TOLD WHAT TO ENTER, not shown a wall of zeros. Every metric
   * that cannot answer carries the sentence that would make it answerable.
   */
  it("answers nothing, and says what is wanted for each", () => {
    for (const metric of [...growMetrics(empty), ...borrowMetrics(empty), ...sellMetrics(empty)]) {
      expect(metric.value, `${metric.key} invented a value`).toBeNull();
      expect(metric.display).toBe("—");
      expect(metric.missing, `${metric.key} has no sentence saying what is missing`).toBeTruthy();
    }
  });

  it("produces no score at all rather than a bad one", () => {
    expect(score(growMetrics(empty), GROW_WEIGHTS).value).toBeNull();
    expect(score(borrowMetrics(empty), BORROW_WEIGHTS).value).toBeNull();
    expect(score(sellMetrics(empty), SELL_WEIGHTS).value).toBeNull();
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
    const fine = growMetrics(full({ growth: { cashBuffer: 20_000, costOfCapital: 11 } }));
    expect(statusOf(fine.find((x) => x.key === "lowestCash")!.value, fine.find((x) => x.key === "lowestCash")!.bands)).toBe("good");
  });

  /*
   * WITHOUT A FLOOR THE ONLY LINE IS ZERO (§6.129), and the card has to say so rather than let a plan whose
   * worst month holds sixty thousand dollars pass a test nobody set.
   */
  it("still reports the worst month with no floor set, judged only against zero", () => {
    const g2 = growMetrics(full({ growth: { cashBuffer: null, costOfCapital: 11 } }));
    const low = g2.find((x) => x.key === "lowestCash")!;
    expect(low.value).toBe(60_000);
    expect(statusOf(low.value, low.bands)).toBe("good");
    expect(low.bench).toContain("No floor set");
    expect(low.fix?.to).toContain("assumptions");
  });

  /*
   * A RETURN WITH NO BAR IS NOT A PASS. The percentage is computable without a cost of capital and is printed
   * in the sentence, but scoring it would hand a plan a good mark against a bar nobody set.
   */
  it("withholds the return on the growth plan until the cost of capital is set", () => {
    const g2 = growMetrics(full({ growth: { cashBuffer: 100_000, costOfCapital: null } }));
    const r = g2.find((x) => x.key === "returnOnPlan")!;
    expect(r.value).toBeNull();
    expect(r.missing).toContain("money costs");
    expect(r.note).toMatch(/%/);                         // the figure is still told to the client
    expect(r.fix?.to).toBe("assumptions?area=cash");
    expect(score(g2, GROW_WEIGHTS).covered).toBe(score(g2.filter((x) => x.key !== "returnOnPlan"), GROW_WEIGHTS).covered);
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

describe("borrowing, on the debt the plan already carries", () => {
  /*
   * THE PROPOSED LOAN IS GONE (§6.129), and these tests are the record of what replaced it. The old suite
   * asserted that every cover figure waited for a loan to be TYPED into the dashboard — which is exactly the
   * behaviour Nic rejected, and which meant the tab could say nothing at all about a plan that already had
   * half a million dollars of borrowing in it.
   */
  it("reads cover off the repayments the plan actually makes", () => {
    const b = borrowMetrics(full());
    const dscr = b.find((x) => x.key === "dscr")!;
    /* 240,000 operating + 40,000 interest = 280,000, against the 120,000 the plan repays. */
    expect(dscr.value).toBeCloseTo(2.33, 2);
    expect(statusOf(dscr.value, dscr.bands)).toBe("good");
    expect(dscr.formula).toContain("the plan repays");
  });

  it("says a plan with no borrowing has nothing to cover, and points at Funding", () => {
    const b = borrowMetrics(full({ debtService: {} }));
    const dscr = b.find((x) => x.key === "dscr")!;
    expect(dscr.value).toBeNull();
    expect(dscr.missing).toContain("no borrowing");
    expect(dscr.fix?.to).toBe("funding");
  });

  it("still answers the balance-sheet questions, which need no judgement at all", () => {
    const b = borrowMetrics(full());
    expect(b.find((x) => x.key === "currentRatio")!.value).toBeCloseTo(1.62, 2);
    expect(b.find((x) => x.key === "quickRatio")!.value).toBeCloseTo(1.19, 2);
  });

  /*
   * LOAN TO VALUE IS NOW ABOUT SECURITY ALREADY SPOKEN FOR, from the figures on Fixed Assets — which is a
   * question the plan can answer, unlike "would a loan nobody has applied for be secured".
   */
  it("measures the debt against the security recorded on Fixed Assets", () => {
    const none = borrowMetrics(full()).find((x) => x.key === "lvr")!;
    expect(none.value).toBeNull();
    expect(none.fix?.to).toBe("assets");

    /* 90,000 current + 410,000 non-current = 500,000 of debt against 1,000,000 of security. */
    const some = borrowMetrics(full({ collateral: 1_000_000 })).find((x) => x.key === "lvr")!;
    expect(some.value).toBe(50);
    expect(statusOf(some.value, some.bands)).toBe("good");
  });

  it("counts an undrawn facility towards runway without being asked for it twice", () => {
    const without = borrowMetrics(full()).find((x) => x.key === "runway")!.value!;
    const withFacility = borrowMetrics(full({ undrawn: 240_000 })).find((x) => x.key === "runway")!.value!;
    expect(withFacility).toBeGreaterThan(without);
    expect(borrowMetrics(full({ undrawn: 240_000 })).find((x) => x.key === "runway")!.sub).toContain("undrawn");
  });

  /*
   * HEADROOM, NOT A VERDICT. The old capacity metric was pass/fail against a typed loan and carried weight
   * for it. As "how much more would this carry" it has no failing band, and must therefore carry no weight —
   * otherwise it adds the same points to every plan and tells the score nothing.
   */
  it("prices the headroom at the client's own cost of capital, and stays out of the score", () => {
    const b = borrowMetrics(full());
    const cap = b.find((x) => x.key === "capacity")!;
    expect(cap.value).not.toBeNull();
    expect(cap.formula).toContain(String(CAPACITY_TERM_YEARS));
    expect(statusOf(cap.value, cap.bands)).toBe("good");
    expect(BORROW_WEIGHTS.capacity).toBeUndefined();
  });

  it("cannot price the headroom with no cost of capital, and points at the box", () => {
    const cap = borrowMetrics(full({ growth: { cashBuffer: 100_000, costOfCapital: null } }))
      .find((x) => x.key === "capacity")!;
    expect(cap.value).toBeNull();
    expect(cap.fix?.to).toBe("assumptions?area=cash");
  });

  /*
   * WHAT THE FIXTURE ITSELF SAYS, and it is worth an assertion of its own: this plan's bad year leaves cover
   * at 1.16× on the debt it already has, which is below the minimum — so there is no room for a dollar more.
   * "Nothing further" is a reading, not a failure to read (§6.89).
   */
  it("reports no headroom at all when the bad year already uses the cover up", () => {
    const cap = borrowMetrics(full()).find((x) => x.key === "capacity")!;
    expect(cap.value).toBe(0);
    expect(cap.note).toContain("no room");
  });

  /* The round trip §6.41 asks for: the headroom figure, borrowed, lands on the cover it promised. */
  it("leaves cover exactly on the minimum once the headroom is borrowed", () => {
    const i = full({ cashFlow: { 1: cf(600_000), 2: cf(620_000) } });
    const stressed = stressedCash(i)!;
    const service = i.debtService[1]!;
    const cap = borrowMetrics(i).find((x) => x.key === "capacity")!.value!;
    expect(cap).toBeGreaterThan(0);
    const cover = stressed / (service + annualRepayment(cap, 11, CAPACITY_TERM_YEARS)!);
    expect(cover).toBeCloseTo(LENDER_MIN_DSCR, 4);
  });
});


describe("selling", () => {
  const priced = (over_ = {}) => full({
    recurringShare: 0.62,
    sale: { askingPrice: 3_000_000, addBacks: 80_000, multipleLow: 3.5, multipleHigh: 4.8, exitYear: null, ...over_ },
  });

  it("waits for a price before judging one, and says where the price is entered", () => {
    const m = sellMetrics(full({ recurringShare: 0.62 })).find((x) => x.key === "priceMultiple")!;
    expect(m.value).toBeNull();
    expect(m.missing).toContain("asking price");
    expect(m.fix?.to).toBe("settings?area=exit");
  });

  /*
   * THE DECISIVE MEASURE MUST NOT BE JUDGED ON HALF ITS INPUTS (§6.129). A price with no comparable range has
   * nothing to be too high against — and because this metric is weighted 3, inventing a range would cap a
   * perfectly sound plan at 49 on a number the app made up.
   */
  it("will not call a price high with no comparable range to call it high against", () => {
    const m = sellMetrics(priced({ multipleLow: null, multipleHigh: null }))
      .find((x) => x.key === "priceMultiple")!;
    expect(m.value).toBeNull();
    expect(m.display).not.toBe("—");                     // the multiple is still shown
    expect(m.missing).toContain("comparable");
    expect(m.fix?.to).toBe("settings?area=exit");
  });

  it("still answers what the forecast knows without a price", () => {
    const m = sellMetrics(full({ recurringShare: 0.62 }));
    expect(m.find((x) => x.key === "recurringShare")!.value).toBe(62);
    expect(m.find((x) => x.key === "cashConversion")!.value).not.toBeNull();
    expect(m.find((x) => x.key === "roic")!.value).not.toBeNull();
  });

  /*
   * A PRICE ABOVE EVERY COMPARABLE IS THE ONE THING THAT STOPS A SALE, so it is weighted decisively and
   * must hold the whole tab in the at-risk band however good the business is underneath it (§6.128.1).
   */
  it("caps the score when the price is above every comparable deal", () => {
    const m = sellMetrics(priced({ askingPrice: 40_000_000 }));
    const mult = m.find((x) => x.key === "priceMultiple")!;
    expect(statusOf(mult.value, mult.bands)).toBe("bad");
    expect(mult.note).toContain("Above the top of the similar-sales range");
    const s = score(m, SELL_WEIGHTS);
    expect(s.capped).toContain("priceMultiple");
    expect(s.value!).toBeLessThan(50);
  });

  it("adds the add-backs to the earnings the multiple is struck on", () => {
    const without = sellMetrics(priced({ addBacks: 0 })).find((x) => x.key === "priceMultiple")!.value!;
    const withBacks = sellMetrics(priced({ addBacks: 200_000 })).find((x) => x.key === "priceMultiple")!.value!;
    /* More add-backs, bigger earnings, so the same price is a LOWER multiple. */
    expect(withBacks).toBeLessThan(without);
  });

  /*
   * THE SIX JUDGEMENTS ARE READ, NOT ASKED FOR (§6.129) — they are scored on Leadership Team → Risk &
   * Succession, where they are also the key-person risk a lender asks about. A partial assessment stays
   * unanswered, because the two factors somebody skipped are the two they were least comfortable scoring.
   */
  it("reads the six judgements from the People step and will not average a partial set", () => {
    const partial = sellMetrics({ ...priced(), transfer: rate(4, 5, 3) }).find((x) => x.key === "transferability")!;
    expect(partial.value).toBeNull();
    expect(partial.sub).toBe(`3 of ${TRANSFER_FACTORS.length} scored`);
    expect(partial.missing).toContain("Risk & Succession");
    expect(partial.fix?.to).toBe("people?area=risk");

    const whole = sellMetrics({ ...priced(), transfer: rate(4, 4, 4, 4, 4, 4) })
      .find((x) => x.key === "transferability")!;
    expect(whole.value).toBe(4);
  });

  /* The note is the half that survives into a report, so the card has to be able to quote it back. */
  it("quotes the client's own note back when the assessment is middling", () => {
    const withNote = [
      { factor: "owner" as const, score: 2, note: "every quote still goes through Dave" },
      ...rate(3, 3, 3, 3, 3, 3).slice(1),
    ];
    const m = sellMetrics({ ...priced(), transfer: withNote }).find((x) => x.key === "transferability")!;
    expect(m.value).toBeCloseTo(2.8, 1);
    expect(m.note).toContain("Dave");
  });

  /**
   * THE CARD THAT REPLACED THE ONE THAT COULD NEVER ANSWER (§6.128.4).
   *
   * §6.128.2 put an unanswerable customer-concentration card on this tab on the reasoning that naming a
   * gap beats hiding it. On a real screen it was one of four grey cards where the eye lands first. Product
   * concentration is the question the plan can actually answer — and because it is NOT the question a
   * buyer asks, the card has to say so itself, or it is a worse lie than the blank one was.
   */
  it("answers product concentration and refuses to be mistaken for customer concentration", () => {
    const m = sellMetrics(full({ largestProductShare: 0.71 })).find((x) => x.key === "largestProduct")!;
    expect(m.value).toBe(71);
    expect(statusOf(m.value, m.bands)).toBe("bad");
    expect(m.confidence).toContain("NOT customer concentration");
    expect(sellMetrics(full()).find((x) => x.key === "largestCustomer")).toBeUndefined();
  });

  it("reads the leadership wage bill against the earnings a buyer inherits", () => {
    const m = sellMetrics(full({ leadershipPay: 400_000 })).find((x) => x.key === "leadershipPay")!;
    expect(m.value).not.toBeNull();
    expect(m.formula).toContain("leadership salaries");
  });
});

/**
 * THE READERS (§6.129).
 *
 * Every figure on this screen now comes out of a stored row, and the one thing that must not be lost on the
 * way is the difference between a nought and a silence. `Number(null)` is 0 in JavaScript, which is how a
 * client who has never been asked about their cash floor would end up being told they run to zero.
 */
describe("reading the stored judgements", () => {
  it("keeps a nought and a silence apart", () => {
    expect(readGrowth({ cash_floor: 0, cost_of_capital: 11 })).toEqual({ cashBuffer: 0, costOfCapital: 11 });
    expect(readGrowth({ cash_floor: null, cost_of_capital: null })).toEqual({ cashBuffer: null, costOfCapital: null });
    expect(readGrowth(null)).toEqual({ cashBuffer: null, costOfCapital: null });
    expect(readGrowth({ cash_floor: "" }).cashBuffer).toBeNull();
  });

  it("reads the downside and the sale figures the same way", () => {
    expect(readStress({ stress_sales_pct: 10, stress_margin_pts: 0, stress_debtor_days: null }))
      .toEqual({ salesPct: 10, marginPts: 0, debtorDaysAdded: null });
    expect(readSale({ asking_price: 3_000_000, multiple_low: 3.5 }))
      .toEqual({ askingPrice: 3_000_000, addBacks: null, multipleLow: 3.5, multipleHigh: null, multipleFound: null, exitYear: null });
  });

  /* A searched range carries its provenance to the tab (§6.130); half a provenance is none. */
  it("says where a searched range came from, and only when both halves are there", () => {
    const src = [{ title: "A", url: "https://a.com", low: 3, high: 4 }, { title: "B", url: "https://b.com", low: 3, high: 4 }];
    expect(readSale({ multiple_low: 3, multiple_high: 4, multiple_sources: src, multiple_found_on: "2026-09-26" }).multipleFound)
      .toEqual({ sources: 2, on: "2026-09-26" });
    expect(readSale({ multiple_low: 3, multiple_high: 4, multiple_sources: src }).multipleFound).toBeNull();
  });

  /*
   * A TOTAL OF NOUGHT ACROSS A SHED FULL OF MACHINERY IS A WORSE ANSWER THAN NO ANSWER, so the collateral
   * total is null until at least one asset has been valued — and sums only the ones that have.
   */
  it("totals only the assets somebody has actually valued", () => {
    expect(readCollateral([{ security_value: null }, { security_value: null }])).toBeNull();
    expect(readCollateral([])).toBeNull();
    expect(readCollateral([{ security_value: 400_000 }, { security_value: null }, { security_value: 150_000 }])).toBe(550_000);
    /* Valued at nothing IS an answer — a fit-out a bank would not lend a dollar against. */
    expect(readCollateral([{ security_value: 0 }])).toBe(0);
  });

  /*
   * THE UNDRAWN FACILITY WAS THE CLEAREST CASE OF A FACT WRITTEN TWICE (§6.41): Funding already records the
   * facility total and how much has been drawn, and the dashboard asked for the difference in its own box.
   */
  it("works the undrawn facility out of the funding rows rather than asking for it", () => {
    const loan = (facility: number, drawn: number) => ({
      id: "x", kind: "debt" as const, name: "Bank", amount: drawn, start_year: 1, start_month: 1,
      loan: { total_facility_amount: facility, amount_drawn: drawn } as never,
      rbf: null, grant: null, equity_percent: null,
    });
    expect(readUndrawn([loan(250_000, 100_000)])).toBe(150_000);
    /* Fully drawn is not headroom, and neither is a term loan repaid below its original limit. */
    expect(readUndrawn([loan(250_000, 250_000)])).toBe(0);
    expect(readUndrawn([])).toBe(0);
  });
});

/**
 * RATIOS ON A BUSINESS THAT LOSES MONEY (§6.129.1).
 *
 * Every one of these was found by putting the rebuilt screen in front of SEQ Concreting, which forecasts a
 * loss — and every one printed a CHEERFUL answer. This is the §6.128.1 argument in its third costume: a
 * ratio whose denominator has gone negative does not become a small ratio, it stops being a ratio, and a
 * dial that does not know the difference tells a bank the opposite of the truth.
 */
describe("a plan that loses money cannot be flattered by its own ratios", () => {
  const losing = (o: Partial<CapabilityInput> = {}) => full({
    pnl: { 1: pnl(2_000_000, { operatingProfit: -140_000 }), 2: pnl(2_200_000, { operatingProfit: -120_000 }) },
    ...o,
  });

  /* SEQ read "−1.85× · Healthy" on net debt ÷ EBITDA, which sailed under the "under 2.5× is good" band. */
  it("will not call negative leverage healthy", () => {
    const lev = borrowMetrics(losing()).find((x) => x.key === "leverage")!;
    expect(lev.value).toBeNull();
    expect(statusOf(lev.value, lev.bands)).toBeNull();
    /* And §6.115.1: the loss is said in words, never left to a minus sign in front of a dollar figure. */
    expect(lev.missing).toContain("no earnings for the debt to be measured against");
    expect(lev.missing).toContain("loses $80,000");
    expect(lev.missing).not.toContain("$-");
  });

  /* And "13.18× · profit is growing faster than sales" on a plan whose loss merely got smaller. */
  it("will not call a shrinking loss operating leverage", () => {
    const lev = growMetrics(losing()).find((x) => x.key === "operatingLeverage")!;
    expect(lev.value).toBeNull();
    expect(lev.missing).toContain("no leverage on a loss");
  });

  /* A cover of −10.38× is read as a small number by anyone scanning a column of multiples. */
  it("reports nil cover, not negative cover, when operations consume cash", () => {
    const b = borrowMetrics(losing({ cashFlow: { 1: cf(-180_000), 2: cf(-160_000) } }));
    const dscr = b.find((x) => x.key === "dscr")!;
    expect(dscr.value).toBe(0);
    expect(statusOf(dscr.value, dscr.bands)).toBe("bad");
    expect(dscr.note).toContain("consume");
  });

  it("says the interest is being paid out of a loss rather than 'barely covered'", () => {
    const ic = borrowMetrics(losing()).find((x) => x.key === "interestCover")!;
    expect(statusOf(ic.value, ic.bands)).toBe("bad");
    expect(ic.note).toContain("out of a loss");
  });

  /*
   * THE ONE THAT MATTERS MOST HERE. SEQ scored 58 on the selling tab and read "Saleable, with work to do
   * first" while losing 76,000 a year — because the decisive measure, price against comparables, was
   * unanswerable for want of an asking price, and eight tidy measures carried the rest.
   */
  it("cannot score a loss-making business as saleable, priced or not", () => {
    const m = sellMetrics(losing({ recurringShare: 0.62 }));
    const margin = m.find((x) => x.key === "normalisedMargin")!;
    expect(statusOf(margin.value, margin.bands)).toBe("bad");
    expect(margin.note).toContain("multiple of a loss");

    const s2 = score(m, SELL_WEIGHTS);
    expect(s2.capped).toContain("normalisedMargin");
    expect(s2.value!, "a business losing money reached the saleable band").toBeLessThan(50);
  });

  /* A share of a negative number is not a comparison, so the card does not print one. */
  it("does not print leadership pay against negative earnings as though it were a ratio", () => {
    const m = sellMetrics(losing({ leadershipPay: 141_400 })).find((x) => x.key === "leadershipPay")!;
    expect(m.value).toBeNull();
    expect(m.sub).toBeUndefined();
    expect(m.missing).toContain("not positive");
  });
});

/**
 * FIVE YEARS ON EVERY CARD (§6.129.2).
 *
 * The dial reads one year; the sparkline beside it reads all five, and it is computed separately. Two
 * computations of one measure is the §6.41 fault waiting to happen, so every card's dial is held against
 * the point its own line marks. If the two formulas ever part company this is where it shows — not on a
 * client's screen, as a dial saying 1.4× beside a line whose marked point says 1.1×.
 */
describe("the five-year line on each card", () => {
  const losing = (o: Partial<CapabilityInput> = {}) => full({
    pnl: { 1: pnl(2_000_000, { operatingProfit: -140_000 }), 2: pnl(2_200_000) },
    ...o,
  });

  for (const [kind, of] of [["grow", growMetrics], ["borrow", borrowMetrics], ["sell", sellMetrics]] as const) {
    it(`never lets a ${kind} dial and its own line disagree`, () => {
      const i = full({ collateral: 1_000_000, sale: { ...empty.sale, addBacks: 50_000 } });
      const withLines = withTrends(kind, of(i), i);
      const drawn = withLines.filter((m) => m.trend && m.trendAt !== undefined);
      expect(drawn.length, `${kind} drew no trend lines at all`).toBeGreaterThan(0);
      for (const m of drawn) {
        const marked = m.trend![m.trendAt!];
        if (m.value === null) { expect(marked, `${m.key}: the dial is blank but the line has a value`).toBeNull(); continue; }
        expect(marked, `${m.key}: the dial has a value the line does not`).not.toBeNull();
        expect(marked!, `${m.key}: dial ${m.value} vs line ${marked}`).toBeCloseTo(m.value, 1);
      }
    });
  }

  /* The §6.129.1 guards travel with the formulas: a loss year is a hole in the line, not a cheerful point. */
  it("leaves a loss year as a gap, never as a point", () => {
    const lev = series.leverage(losing());
    expect(lev[0]).toBeNull();
    expect(lev[1]).not.toBeNull();
    const conv = series.conversion(losing());
    expect(conv[0]).toBeNull();
  });

  it("does not draw a line with fewer than two real points", () => {
    const one = full({ pnl: { 1: pnl(2_000_000) }, cashFlow: { 1: cf(240_000) }, balanceSheet: { 1: bs() }, days: { 1: { debtorDays: 52, inventoryDays: 48, creditorDays: 34 } } });
    for (const m of withTrends("borrow", borrowMetrics(one), one)) expect(m.trend, `${m.key} drew a one-point line`).toBeUndefined();
  });

  it("stresses any year, not only the first", () => {
    const i = full();
    expect(stressedCash(i, 2)).not.toBeNull();
    expect(stressedCash(i, 2)!).toBeLessThan(i.cashFlow[2]!.netOperating + i.cashFlow[2]!.interestPaid);
    expect(stressedCash(i, 3)).toBeNull();                 // no Year 3 in the fixture — nothing invented
  });

  /* The sixth costume (§6.129.1): two negatives made a positive, and SEQ read 186.8% · Healthy. */
  it("will not call a loss converting into a loss 'cash conversion'", () => {
    const g = growMetrics(full({
      pnl: { 1: pnl(2_000_000, { operatingProfit: -140_000 }), 2: pnl(2_200_000) },
      cashFlow: { 1: cf(-137_633), 2: cf(100_000) },
    }));
    const c = g.find((x) => x.key === "cashConversion")!;
    expect(c.value).toBeNull();
    expect(c.missing).toContain("A loss has no share");
  });
});

describe("the panels under the cards", () => {
  const products = [
    { name: "Slabs", years: [{ revenue: 1_200_000, grossProfit: 480_000 }, { revenue: 1_400_000, grossProfit: 560_000 }] },
    { name: "Driveways", years: [{ revenue: 800_000, grossProfit: 160_000 }, { revenue: 760_000, grossProfit: 150_000 }] },
  ];

  it("reads growth and margin per product from the same projection COGS uses", () => {
    const P = panels(full(), products);
    const slabs = P.byProduct.find((p) => p.name === "Slabs")!;
    expect(slabs.change).toBe(200_000);
    expect(slabs.margin).toBe(40);
    expect(slabs.share).toBe(60);
    expect(P.avgMargin).toBe(32);                            // 640,000 on 2,000,000
    expect(P.byProduct.find((p) => p.name === "Driveways")!.change).toBe(-40_000);
  });

  /* Spending less than depreciation is running the assets down, and the panel has to say so. */
  it("names the years the assets are being run down rather than kept", () => {
    const P = panels(full({ capex: { 1: 40_000, 2: 300_000 } }), products);
    expect(P.capex.runDown).toEqual([1]);                   // 40,000 against 60,000 of depreciation
    expect(P.capex.growth[1]).toBe(240_000);
  });

  it("marks loss years on the revenue panel", () => {
    const P = panels(full({ pnl: { 1: pnl(2_000_000, { operatingProfit: -10 }), 2: pnl(2_200_000) } }), products);
    expect(P.revenue.lossYears).toEqual([1]);
  });

  it("keeps an unscored factor unscored — never a bar of nothing", () => {
    const P = panels({ ...full(), transfer: rate(4, 2) }, products);
    expect(P.transfer.map((t) => t.score)).toEqual([4, 2, null, null, null, null]);
  });
});

describe("the questions a buyer will ask", () => {
  const money = (v: number) => `$${Math.round(v).toLocaleString("en-AU")}`;
  const unscored = TRANSFER_FACTORS.map((f) => ({ key: f.key, label: f.label, score: null as number | null }));

  it("opens on the loss when there is one", () => {
    const m = sellMetrics(full({ pnl: { 1: pnl(2_000_000, { operatingProfit: -140_000 }), 2: pnl(2_200_000) } }));
    const q = buyerQuestions(m, { money, addBacks: null, transfer: unscored, knowsCustomers: false });
    expect(q[0]).toContain("lose money");
  });

  it("turns each weak judgement into its own question", () => {
    const transfer = unscored.map((t) => ({ ...t, score: t.key === "owner" ? 1 : 4 }));
    const q = buyerQuestions(sellMetrics(full()), { money, addBacks: 80_000, transfer, knowsCustomers: true });
    expect(q.some((x) => x.includes("owner leaves"))).toBe(true);
    expect(q.some((x) => x.includes("$80,000"))).toBe(true);
    expect(q.some((x) => x.includes("largest customers"))).toBe(false);
  });

  /* Until the plan records customers, the first thing a buyer asks is asked every time. */
  it("asks about customers until the plan can answer it", () => {
    const q = buyerQuestions(sellMetrics(full()), { money, addBacks: null, transfer: unscored, knowsCustomers: false });
    expect(q.some((x) => x.includes("largest customers"))).toBe(true);
    expect(q.some((x) => x.includes("not been assessed"))).toBe(true);
  });

  it("stops at six — a list of fifteen is a list nobody prepares for", () => {
    const m = sellMetrics(full({
      pnl: { 1: pnl(2_000_000, { operatingProfit: -140_000 }), 2: pnl(1_800_000) },
      cashFlow: { 1: cf(-200_000), 2: cf(-100_000) }, recurringShare: 0.1, largestProductShare: 0.9,
    }));
    const transfer = unscored.map((t) => ({ ...t, score: 1 }));
    expect(buyerQuestions(m, { money, addBacks: 80_000, transfer, knowsCustomers: false }).length).toBe(6);
  });
});

describe("the actions follow the reading, not just the measure", () => {
  /* Found on SEQ: add-backs lifted a loss to +0.4%, and the action still said there were no earnings. */
  it("tells a thin margin and a loss apart", () => {
    /* Operating loss 100,000 with 60,000 of depreciation: EBITDA −40,000. Add back 60,000 and it is +20,000. */
    const thin = sellMetrics(full({ pnl: { 1: pnl(2_000_000, { operatingProfit: -100_000 }), 2: pnl(2_200_000) } }));
    const thinWithBacks = sellMetrics({ ...full({ pnl: { 1: pnl(2_000_000, { operatingProfit: -100_000 }), 2: pnl(2_200_000) } }), sale: { ...empty.sale, addBacks: 60_000 } });
    const loss = verdict("sell", thin, SELL_WEIGHTS, 30).actions.join(" ");
    const positive = verdict("sell", thinWithBacks, SELL_WEIGHTS, 30).actions.join(" ");
    expect(loss).toContain("no earnings figure");
    expect(positive).not.toContain("no earnings figure");
    expect(positive).toContain("thin for a sale");
  });
});

/**
 * THE FOUR PANELS THAT HAD NO DATA (§6.129.3).
 *
 * The rule under test is the same one as the dials: an unanswered line is NOT a status. It carries a pencil
 * to the box that answers it and nothing else. A checklist that drew "not said" as a pass, or as a fail,
 * would be telling a lender something nobody told it.
 */
describe("the panels that read the new fields", () => {
  const blank: ExtraFacts = {
    capacity: [], hires: { inPlace: 0, planned: 0 }, pipeline: null, retention: null, customers: [],
    ageing: { current: null, d30: null, d60: null, d90: null }, receivables: null, newBusiness: false,
    lender: { onTime: null, covenants: null, guarantee: null, guaranteeBy: null },
    addBackLines: [], yearsTrading: null, leadership: { count: 0, avgTenureYears: null }, lastRevenue: null,
  };

  it("never gives an unanswered line a status — only a pencil", () => {
    for (const l of [...executionLines(blank, full()), ...lenderChecklist(blank, full(), borrowMetrics(full()))]) {
      if (l.status === null) expect(l.fix, `${l.label} is unanswered and points nowhere`).toBeDefined();
    }
    const unanswered = executionLines(blank, full()).filter((l) => l.status === null);
    expect(unanswered.map((l) => l.fix!.to)).toEqual(expect.arrayContaining(["operations?area=capacity", "marketing?area=sales", "marketing?area=market", "people"]));
  });

  it("judges capacity by how close to the limit it is", () => {
    const x = { ...blank, capacity: [{ name: "Pump", pctUsed: 95 }, { name: "Yard", pctUsed: 60 }, { name: "Crew", pctUsed: null }] };
    const lines = executionLines(x, full());
    expect(lines.find((l) => l.label === "Pump")!.status).toBe("bad");
    expect(lines.find((l) => l.label === "Yard")!.status).toBe("good");
    expect(lines.find((l) => l.label === "Crew")!.status).toBeNull();
  });

  /* Worked out from People, never asked: a start date still to come is a planned hire. */
  it("reads key hires from the leadership team's start dates", () => {
    const l = executionLines({ ...blank, hires: { inPlace: 4, planned: 2 } }, full()).find((x) => x.label === "Key people in place")!;
    expect(l.display).toBe("4 of 6");
    expect(l.status).toBe("watch");
  });

  it("measures the pipeline against next year's planned growth", () => {
    /* The fixture grows 200,000 from Year 1 to Year 2. */
    const l = executionLines({ ...blank, pipeline: 400_000 }, full()).find((x) => x.label.startsWith("Quoted work"))!;
    expect(l.display).toBe("2×");
    expect(l.status).toBe("good");
  });

  it("tells a new business, an un-aged ledger and an aged one apart", () => {
    expect(ageingView({ ...blank, newBusiness: true }).state).toBe("new");
    const missing = ageingView(blank);
    expect(missing.state).toBe("missing");
    const ready = ageingView({ ...blank, receivables: 300_000, ageing: { current: 200_000, d30: 60_000, d60: 20_000, d90: 10_000 } });
    expect(ready.state).toBe("ready");
    if (ready.state === "ready") {
      expect(ready.overduePct).toBe(31);
      expect(ready.gap).toBe(10_000);                        // the split is 10,000 short of the debtors figure
    }
  });

  it("reads the lender's checklist from the plan, and only asks what the plan cannot answer", () => {
    const x: ExtraFacts = {
      ...blank, yearsTrading: 14, leadership: { count: 3, avgTenureYears: 6 }, lastRevenue: 1_400_000,
      customers: [{ name: "Metricon", share: 32, endsOn: null, assignable: null }],
      lender: { onTime: true, covenants: "None.", guarantee: false, guaranteeBy: null },
    };
    const L = lenderChecklist(x, full({ collateral: 1_000_000 }), borrowMetrics(full({ collateral: 1_000_000 })));
    const at = (k: string) => L.find((l) => l.label === k)!;
    expect(at("Years trading").status).toBe("good");
    expect(at("Forecast against last year").status).toBe("bad");      // 2.0M against 1.4M actual: +42.9%
    expect(at("Customer concentration").display).toContain("Metricon");
    expect(at("Customer concentration").status).toBe("bad");
    expect(at("Covenant breaches").status).toBe("good");
    expect(at("Guarantee").status).toBe("watch");
    expect(at("Security").status).toBe("good");
    expect(L.filter((l) => l.status === null)).toHaveLength(0);
  });

  it("flags a contract ending within the year, from a fixed today", () => {
    const c = concentration({ ...blank, customers: [
      { name: "Small", share: 5, endsOn: null, assignable: true },
      { name: "Big", share: 30, endsOn: "2026-12-01", assignable: false },
    ] }, new Date("2026-09-26"));
    expect(c.rows[0].name).toBe("Big");
    expect(c.rows[0].endsWithinYear).toBe(true);
    expect(c.topShare).toBe(30);
    expect(c.notAssignable).toBe(1);
  });

  /* The bridge on screen and the sum on the price card must be one reading of one list (§6.41). */
  it("bridges reported to normalised earnings one add-back at a time, and agrees with the price card", () => {
    const x = { ...blank, addBackLines: [{ label: "Owner salary above market", amount: 60_000 }, { label: "Family car", amount: 25_000 }] };
    const b = earningsBridge(x, full())!;
    expect(b.adds).toHaveLength(2);
    expect(b.normalised).toBe(b.reported + 85_000);
    const sale = readSale({}, x.addBackLines);
    expect(sale.addBacks).toBe(85_000);
    expect(readSale({}, []).addBacks).toBeNull();            // no lines is "not said", not nought
  });

  it("names the customer in the buyer's question once the customer is known", () => {
    const money = (v: number) => `$${Math.round(v).toLocaleString("en-AU")}`;
    const q = buyerQuestions(sellMetrics(full()), {
      money, addBacks: null, knowsCustomers: true,
      transfer: TRANSFER_FACTORS.map((f) => ({ key: f.key, label: f.label, score: 4 })),
      customers: [{ name: "Metricon", share: 32, assignable: false, endsWithinYear: true }],
    });
    expect(q.some((x) => x.includes("Metricon — 32% of sales"))).toBe(true);
    expect(q.some((x) => x.includes("change of ownership"))).toBe(true);
    expect(q.some((x) => x.includes("largest customers, what share"))).toBe(false);
  });
});
