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
