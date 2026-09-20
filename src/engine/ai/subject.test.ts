import { describe, expect, it } from "vitest";
import type { ReportInput } from "@/engine/report/build";
import { SUBJECT_KINDS, subjectFor } from "./subject";

/**
 * THE SUBJECT BLOCK KEEPS THE SAME PROMISE THE SLICES DO (§6.113).
 *
 * `slices.test.ts` seeds every excluded field with a poison string and asserts no slice can emit it. A row
 * subject is a second door into the same plan, so it gets the same test — otherwise the redaction rule
 * would hold everywhere except the place that was added last, which is how these things actually fail.
 */
const POISON = {
  price: "POISON-PRICE-16800",
  units: "POISON-UNITS-36",
  revenue: "POISON-REVENUE-604800",
  person: "POISON-PERSON-Dave-Rowley",
  rationale: "POISON-PRICE-RATIONALE",
};

const input = (): ReportInput => ({
  noun: { one: "job", many: "Jobs", head: "Job", aOne: "a job" },
  productLines: [{
    name: "House Slab", description: "Reinforced slabs for new homes.", whyTheyBuy: "Turnaround.",
    soldAs: "one_off", lifecycle: "growth", startYear: 1,
    /* Numbers as strings so a leak is findable as text rather than as a coincidence of formatting. */
    averagePrice: POISON.price, units: POISON.units, revenue: POISON.revenue,
    pricingRationale: POISON.rationale,
  }],
  competitors: [{
    name: "James West", kind: "direct", reach: "regional", pricing: "lower", threat: "medium",
    strengths: "Cheap and quick.", weaknesses: "Misses dates.", howWeWin: "We never miss a pour.",
  }],
  operations: { premises: [], suppliers: [], capacity: {}, steps: [{
    title: "Site visit", detail: "Measure up and check access.", duration: "1 hour",
    /* The step's owner is a person, and a person never leaves the building. */
    owner: POISON.person,
  }] },
} as unknown as ReportInput);

describe("a row subject", () => {
  it("never emits a price, a volume, a revenue or a pricing rationale", () => {
    const out = subjectFor(input(), "product", "House Slab");
    expect(out).toBeTruthy();
    for (const [what, mark] of Object.entries(POISON)) {
      expect(out, `product subject leaked ${what}`).not.toContain(mark);
    }
  });

  it("never emits a person", () => {
    const out = subjectFor(input(), "step", "Site visit");
    expect(out).toBeTruthy();
    expect(out, "step subject leaked its owner").not.toContain(POISON.person);
  });

  it("says what the row IS, or there would be no point sending it", () => {
    expect(subjectFor(input(), "product", "House Slab")).toContain("Reinforced slabs for new homes.");
    expect(subjectFor(input(), "competitor", "James West")).toContain("We never miss a pour.");
    expect(subjectFor(input(), "step", "Site visit")).toContain("Measure up and check access.");
  });

  /* §6.109 again: the box being filled is left out of its own subject. */
  it("leaves out the field being drafted", () => {
    expect(subjectFor(input(), "product", "House Slab", "description")).not.toContain("Reinforced slabs");
    expect(subjectFor(input(), "product", "House Slab", "notes")).not.toContain("Turnaround.");
    expect(subjectFor(input(), "competitor", "James West", "how_we_win")).not.toContain("We never miss a pour.");
  });

  /*
   * A ROW THAT IS NOT IN THE PLAN GETS NOTHING.
   *
   * This is the rule that keeps the request from authoring its own context. The browser sends a name; if no
   * row matches it, the answer is null and the route refuses — it does not fall back to writing a block out
   * of the string it was handed.
   */
  it("returns nothing for a name the plan does not hold", () => {
    for (const kind of SUBJECT_KINDS) {
      expect(subjectFor(input(), kind, "Something Nobody Entered"), kind).toBeNull();
      expect(subjectFor(input(), kind, "   "), `${kind} with a blank name`).toBeNull();
    }
  });

  it("matches a name the client typed with different case or spacing", () => {
    expect(subjectFor(input(), "product", "  house slab ")).toBeTruthy();
  });
});
