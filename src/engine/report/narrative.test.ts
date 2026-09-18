import { describe, expect, it } from "vitest";
import { whatWeSell } from "./narrative";
import type { ReportInput } from "./build";

/**
 * WHAT OPENS "WHAT WE SELL" (§6.104).
 *
 * The products & services statement was collected on a screen that promised it "opens the products section
 * of the report", saved to `plan_settings`, and read by nothing. 663 tests were green throughout, because
 * the narrative layer had no test file at all — this is the first one.
 *
 * THE FIXTURE IS PARTIAL AND CAST, deliberately. `ReportInput` carries the whole plan; `whatWeSell` reads
 * six fields of it. Building the other seventy to test six would make the test about the fixture.
 */
const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  businessName: "BNE Concreting",
  productsServices: null,
  currency: "AUD",
  money: (v: number) => v.toFixed(0),
  noun: { one: "service", many: "Services", head: "Service", aOne: "a service" },
  services: [],
  productLines: [{
    name: "House Slab", averagePrice: 16800, units: 36, revenue: 604800,
    description: null, whyTheyBuy: null, pricingRationale: null,
    lifecycle: null, soldAs: "one_off", startYear: 1,
  }],
  ...over,
} as unknown as ReportInput);

/** The section's opening paragraph — the first block, before the table of lines. */
const opener = (i: ReportInput) => {
  const s = whatWeSell(i);
  const b = s?.blocks?.[0];
  return b && b.kind === "para" ? b.text : null;
};

describe("what opens the What We Sell section", () => {
  it("uses the client's own words when they have written them", () => {
    const pitch = "We pour, finish and guarantee residential concrete across South East Queensland.";
    expect(opener(input({ productsServices: pitch }))).toBe(pitch);
  });

  it("falls back to the app's sentence when they have not", () => {
    const text = opener(input());
    expect(text).toContain("BNE Concreting");
    expect(text).toContain("services");
  });

  /* A field a client cleared is a field with no answer, not an answer made of spaces. */
  it("treats whitespace as nothing written", () => {
    expect(opener(input({ productsServices: "   \n  " }))).toBe(opener(input()));
  });

  /* The statement does not conjure a section out of a plan that sells nothing. */
  it("prints no section at all when there are no lines", () => {
    expect(whatWeSell(input({ productLines: [], productsServices: "Anything at all." }))).toBeNull();
  });
});
