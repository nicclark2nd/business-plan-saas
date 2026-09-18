import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, planDraft, type DraftableField } from "./draft";
import type { ReportInput } from "@/engine/report/build";

/**
 * THE SAME BUTTON AT STEP 1 AND AT STEP 12 (§6.105).
 *
 * These tests are about one claim: that grounded-versus-ask-first is not a property of a field. The same
 * field object is passed to every case below; only the plan changes.
 */

const full = (over: Partial<ReportInput> = {}): ReportInput => ({
  businessName: "BNE Concreting",
  productsServices: "We pour and finish residential concrete for builders across the South Coast.",
  noun: { one: "service", many: "Services", head: "Service", aOne: "a service" },
  currency: "AUD",
  money: (v: number) => String(v),
  profile: {
    established: "June 1998", industry: "Commercial concreting", country: "Australia",
    legalStructure: "Pty Ltd", customerType: "Customer", productType: "Services",
    taxRegion: "Queensland", tagline: null, contactEmail: null, website: null,
  },
  framework: { vision: null, mission: null, purpose: null, brandPromise: null, fieldOfPlay: null },
  productLines: [{
    name: "House Slab", averagePrice: 16800, units: 36, revenue: 604800,
    description: "Reinforced slabs for new homes.", whyTheyBuy: null, pricingRationale: null,
    lifecycle: null, soldAs: "one_off", startYear: 1,
  }],
  segments: [{ name: "Builders", profile: "Local residential builders.", caresAbout: null, share: 60 }],
  market: { size: null, trends: null, positioning: "The premium option.", brandValues: null, brandPersonality: null, visualIdentity: null, salesProcess: null, salesTeam: null },
  competitors: [], position: { ourAdvantage: "Own crew, own pump.", barriers: null, futureThreats: null },
  operations: { premises: [], suppliers: [], steps: [], capacity: { operatingHours: null, capacityNow: null, capacityConstraint: null, capacityPlan: null, qualityApproach: null } },
  keyPeople: [], people: [], capabilities: [], owners: [], overheads: [], historic: null, capital: [],
  ...over,
} as unknown as ReportInput);

/** A plan at step 1: Plan settings is done, because it precedes Vision. Nothing else is. */
const atStepOne = () => full({ productLines: [], segments: [], market: { size: null, trends: null, positioning: null, brandValues: null, brandPersonality: null, visualIdentity: null, salesProcess: null, salesTeam: null } as ReportInput["market"], position: { ourAdvantage: null, barriers: null, futureThreats: null } });

const mission: DraftableField = {
  key: "mission", label: "Mission", sub: "what you do, for whom, every day",
  wants: ["profile", "overview", "whatYouSell", "customers"],
};

describe("the same field, at two ends of the path", () => {
  it("drafts from the plan once the later steps are done", () => {
    const p = planDraft(full(), mission);
    expect(p.present).toEqual(["profile", "overview", "whatYouSell", "customers"]);
    expect(p.questions).toHaveLength(0);
    expect(p.context).toContain("Commercial concreting");
    expect(p.context).toContain("House Slab");
  });

  it("asks at step 1 for exactly what the plan has not reached yet", () => {
    const p = planDraft(atStepOne(), mission);
    expect(p.present).toEqual(["profile", "overview"]);
    expect(p.questions.map((q) => q.slice)).toEqual(["whatYouSell", "customers"]);
  });

  it("asks nothing it can already answer", () => {
    const p = planDraft(full(), mission);
    expect(p.questions).toHaveLength(0);
  });
});

describe("the caption cannot promise what the plan does not hold", () => {
  it("names only the slices that are actually there", () => {
    const p = planDraft(atStepOne(), mission);
    expect(p.caption).toBe("Will use business profile and what you sell");
    expect(p.caption).not.toContain("products");
    expect(p.caption).not.toContain("customers");
  });

  it("names everything once the plan is full", () => {
    expect(planDraft(full(), mission).caption)
      .toBe("Will use business profile, what you sell, your products and your customers");
  });

  /* The §6.87 fault this replaces: a stub captioned "Will use your industry, products and goals" seven
     steps before products exist. */
  it("says it will ask, rather than naming data, when the plan is empty", () => {
    const empty = full({
      profile: { established: null, industry: null, country: null, legalStructure: null, customerType: null, productType: null, taxRegion: null, tagline: null, contactEmail: null, website: null } as ReportInput["profile"],
      businessName: "", productsServices: null, productLines: [], segments: [],
    });
    const p = planDraft(empty, mission);
    expect(p.present).toHaveLength(0);
    expect(p.caption).toBe("Will ask you a couple of questions first");
  });
});

describe("how many questions, and which", () => {
  it("never asks more than three", () => {
    const greedy: DraftableField = { ...mission, wants: ["overview", "whatYouSell", "customers", "market", "competition", "operations"] };
    const p = planDraft(atStepOne(), { ...greedy, wants: greedy.wants });
    expect(p.questions.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it("asks in the order the field declared, so the most useful comes first", () => {
    const f: DraftableField = { ...mission, wants: ["customers", "whatYouSell"] };
    expect(planDraft(atStepOne(), f).questions.map((q) => q.slice)).toEqual(["customers", "whatYouSell"]);
  });

  /* Asking "what is your vision?" in order to draft the vision is a circle. */
  it("never asks for a context-only slice", () => {
    const f: DraftableField = { ...mission, wants: ["framework", "profile"] };
    const p = planDraft(atStepOne(), f);
    expect(p.questions).toHaveLength(0);
    expect(p.present).toEqual(["profile"]);
  });
});
