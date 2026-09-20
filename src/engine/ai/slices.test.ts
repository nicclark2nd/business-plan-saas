import { describe, expect, it } from "vitest";
import { SLICE_KEYS, contextFor, hasSlice, slice } from "./slices";
import type { ReportInput } from "@/engine/report/build";

/**
 * THE POISON FIXTURE (§6.105).
 *
 * Every field a slice must never read is seeded with a string that appears nowhere else. If any slice can
 * reach a person, a wage or a source of money, one of these words comes out and the test names which.
 *
 * This is the whole reason the redaction rule is code rather than a sentence in a consent dialog: a
 * paragraph promising "we never send salaries" is checked by nobody, and this is checked on every commit.
 */
const POISON = {
  person: "POISONPERSONNAME",
  wage: "POISONWAGE",
  money: "POISONFUNDER",
  history: "POISONHISTORIC",
  overhead: "POISONOVERHEAD",
  /* §6.115 added ONE slice that reads money. These are the parts of the forecast it still may not touch. */
  forecastDetail: "POISONFORECASTDETAIL",
} as const;

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  businessName: "BNE Concreting",
  productsServices: "We pour and finish residential concrete for builders across the South Coast.",
  noun: { one: "service", many: "Services", head: "Service", aOne: "a service" },
  currency: "AUD",
  money: (v: number) => String(v),
  profile: {
    established: "June 1998", industry: "Commercial concreting", country: "Australia",
    legalStructure: "Pty Ltd", customerType: "Customer", productType: "Services",
    taxRegion: "Queensland", tagline: "Quality work, honest value.",
    contactEmail: "frank@example.com", website: "example.com",
  },
  framework: { vision: "To be the coast's first choice.", mission: null, purpose: null, brandPromise: null, fieldOfPlay: null },
  productLines: [{
    name: "House Slab", averagePrice: 16800, units: 36, revenue: 604800,
    description: "Reinforced slabs for new homes.", whyTheyBuy: "Turnaround.",
    pricingRationale: "Priced on volume.", lifecycle: null, soldAs: "one_off", startYear: 1,
  }],
  segments: [{ name: "Builders", profile: "Local residential builders.", caresAbout: "Hitting the pour date.", share: 60 }],
  market: { size: "About 40m a year locally.", trends: null, positioning: "The premium option.", brandValues: null, brandPersonality: null, visualIdentity: null, salesProcess: null, salesTeam: null },
  competitors: [{ name: "Two-man crews", kind: "direct", reach: null, pricing: null, threat: "medium", strengths: null, weaknesses: null, howWeWin: "We never miss a pour date." }],
  position: { ourAdvantage: "Own crew, own pump.", barriers: null, futureThreats: null },
  operations: {
    premises: [], suppliers: [], steps: [],
    capacity: { operatingHours: "6am to 4pm", capacityNow: "Three pours a week", capacityConstraint: "One pump", capacityPlan: null, qualityApproach: "Every pour signed off." },
  },

  /* ---- everything below is what must never come out ---- */
  keyPeople: [{ name: POISON.person, position: "Operations Manager", role: "ops", startYear: 1, salaries: [180000, 180000, 180000, 180000, 180000] }],
  people: [{ id: "p1", name: POISON.person, position: POISON.wage, role: null, share: 100 }],
  capabilities: [{ personId: "p1", kind: "development", description: POISON.wage }],
  owners: [{ name: POISON.person, share: 100, role: POISON.wage }],
  overheads: [{ name: POISON.overhead, amount: 936574, category: null, source: "entered" }],
  historic: { label: POISON.history, pnl: [{ label: POISON.history, value: 1 }], balance: [] },
  capital: [{ name: POISON.money, amount: 1, year: 1, category: null, usefulLifeMonths: null, residual: 0, financed: true }],
  /*
   * The `finance` slice takes revenue, gross margin, net profit and closing cash from here and NOTHING
   * ELSE (§6.115). Every other figure in a forecast year is poisoned, so a slice that widened to "just
   * send the P&L" fails here and names the line it leaked.
   */
  forecast: {
    pnl: {
      1: {
        revenue: 604800, grossMargin: 42, netProfit: 88000,
        overheads: POISON.forecastDetail, cogs: POISON.forecastDetail, depreciation: POISON.forecastDetail,
        interest: POISON.forecastDetail, tax: POISON.forecastDetail, dividends: POISON.forecastDetail,
        operatingProfit: POISON.forecastDetail, profitBeforeTax: POISON.forecastDetail,
      },
      2: { revenue: 712000, grossMargin: 44, netProfit: 121000, overheads: POISON.forecastDetail },
    },
    cashFlow: {
      1: { closingCash: 51000, debtProceeds: POISON.forecastDetail, equityRaised: POISON.forecastDetail, dividendsPaid: POISON.forecastDetail },
      2: { closingCash: 96000, debtRepaid: POISON.forecastDetail },
    },
    balanceSheet: { 1: { debtCurrent: POISON.forecastDetail, cash: POISON.forecastDetail } },
  },
  ...over,
} as unknown as ReportInput);

describe("what a slice may never reach", () => {
  const all = () => {
    const i = input();
    return SLICE_KEYS.map((k) => `${k}::${slice(i, k) ?? ""}`).join("\n");
  };

  for (const [what, word] of Object.entries(POISON)) {
    it(`never emits a ${what}`, () => {
      const text = all();
      const offender = SLICE_KEYS.find((k) => (slice(input(), k) ?? "").includes(word));
      expect(offender, `slice "${offender}" leaked the ${what}`).toBeUndefined();
      expect(text).not.toContain(word);
    });
  }

  it("leaks nothing when every slice is asked for at once", () => {
    const text = contextFor(input(), SLICE_KEYS);
    for (const word of Object.values(POISON)) expect(text).not.toContain(word);
  });
});

describe("present becomes context, absent becomes a question", () => {
  it("reports a slice as absent when the plan has not reached that step", () => {
    /* A plan at step 1: settings are filled, nothing else is. */
    const early = input({ productLines: [], segments: [], competitors: [] });
    expect(hasSlice(early, "profile")).toBe(true);
    expect(hasSlice(early, "overview")).toBe(true);
    expect(hasSlice(early, "whatYouSell")).toBe(false);
    expect(hasSlice(early, "customers")).toBe(false);
  });

  it("treats whitespace as nothing written", () => {
    expect(hasSlice(input({ productsServices: "   " }), "overview")).toBe(false);
  });

  it("leaves an absent slice out entirely rather than saying it is empty", () => {
    const text = contextFor(input({ segments: [] }), ["profile", "customers"]);
    expect(text).toContain("Commercial concreting");
    expect(text.toLowerCase()).not.toContain("customer groups");
    expect(text.toLowerCase()).not.toContain("none");
  });

  it("keeps the order the field asked for", () => {
    const text = contextFor(input(), ["overview", "profile"]);
    expect(text.indexOf("owner's words")).toBeLessThan(text.indexOf("Industry"));
  });
});


/**
 * A BLANK ROW IS NOT DATA (§6.106.3).
 *
 * Found on a real plan. The Marketing grid keeps an empty row at the bottom for the next entry; the slice
 * counted it, so a plan with NO customers reported customers as present. The button promised "your
 * customers", the model was handed a heading with nothing under it, and it invented some — which is how a
 * concreter who sells to homeowners acquired a vision about being the default choice for builders.
 */
describe("a row nobody has filled in", () => {
  it("does not make customers present", () => {
    const blank = input({ segments: [{ name: "", profile: null, caresAbout: null, share: null }] as ReportInput["segments"] });
    expect(hasSlice(blank, "customers")).toBe(false);
  });

  it("does not make products present", () => {
    const blank = input({ productLines: [{ name: "  ", averagePrice: 0, units: 0, revenue: 0, description: null, whyTheyBuy: null, pricingRationale: null, lifecycle: null, soldAs: null, startYear: 1 }] as ReportInput["productLines"] });
    expect(hasSlice(blank, "whatYouSell")).toBe(false);
  });

  it("keeps the named rows and drops the blank ones", () => {
    const mixed = input({ segments: [
      { name: "Homeowners", profile: "Owner-occupiers in the suburbs.", caresAbout: null, share: null },
      { name: "", profile: null, caresAbout: null, share: null },
    ] as ReportInput["segments"] });
    const text = slice(mixed, "customers")!;
    expect(text).toContain("Homeowners");
    expect(text.split("- ")).toHaveLength(2);
  });

  it("never emits a bare dash for a nameless competitor", () => {
    const blank = input({ competitors: [{ name: "", kind: null, reach: null, pricing: null, threat: null, strengths: null, weaknesses: null, howWeWin: null }] as ReportInput["competitors"] });
    expect(slice(blank, "competition") ?? "").not.toContain("Competitors:");
  });
});

/**
 * A REDACTION TEST THAT PASSES BECAUSE THE SLICE RETURNED NOTHING PROVES NOTHING (§6.92.1).
 *
 * So the poison run above is paired with this: the `finance` slice really does emit all four figures for
 * both years from the same fixture. If it ever silently stops producing output, this fails and the clean
 * poison result stops being reassuring.
 */
describe("the finance slice", () => {
  it("emits the four headline figures, both years", () => {
    const text = slice(input(), "finance");
    /* The fixture's `money` is String(), so these are the figures as the slice would print them. */
    for (const want of ["604800", "42%", "88000", "51000", "712000", "44%", "121000", "96000"]) {
      expect(text, `finance did not emit ${want}`).toContain(want);
    }
  });

  /*
   * A LOSS IS SAID IN WORDS (§6.115.1).
   *
   * Caught live, not here: the slice sent net profit through `money`, which prints a loss as (23,324), and
   * the draft came back "we will achieve a net profit of 23,324" for a year the forecast shows losing it.
   * Brackets mean negative to an accountant and nothing reliable to a model. This is the test that keeps
   * the word in, and it asserts the MAGNITUDE is still there so the fix cannot degrade into silence.
   */
  it("says the word LOSS when a year loses money, and never calls it a profit", () => {
    const text = slice(input({
      forecast: {
        pnl: { 1: { revenue: 2182240, grossMargin: 39, netProfit: -136681 } },
        cashFlow: { 1: { closingCash: -4200 } },
      } as unknown as ReportInput["forecast"],
    }), "finance");
    expect(text).toContain("LOSS");
    expect(text).toContain("136681");
    expect(text, "a loss was described as a profit").not.toContain("a profit of");
    /* And an overdrawn bank balance is said too, for exactly the same reason. */
    expect(text).toContain("OVERDRAWN");
    expect(text).toContain("4200");
  });

  it("still calls a profit a profit", () => {
    expect(slice(input(), "finance")).toContain("a profit of");
  });

  it("says nothing at all when there is no forecast to quote", () => {
    expect(hasSlice(input({ forecast: undefined as unknown as ReportInput["forecast"] }), "finance")).toBe(false);
    expect(hasSlice(input({ forecast: { pnl: {}, cashFlow: {} } as unknown as ReportInput["forecast"] }), "finance")).toBe(false);
  });
});
