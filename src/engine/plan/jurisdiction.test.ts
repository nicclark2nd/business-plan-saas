import { describe, expect, it } from "vitest";
import { governingLaw, governingLawNote } from "./jurisdiction";
import { COUNTRIES } from "@/app/(app)/plans/[planId]/settings/model";

describe("governing law", () => {
  it("names the country a client chose", () => {
    expect(governingLaw("Australia")).toBe("the laws of Australia");
    expect(governingLaw("New Zealand")).toBe("the laws of New Zealand");
  });

  it("adds the state or province where one is on record", () => {
    expect(governingLaw("United States", "Texas")).toBe("the laws of Texas, United States");
    expect(governingLaw("Canada", "British Columbia")).toBe("the laws of British Columbia, Canada");
  });

  /**
   * "Other" is what a client picks when the list does not have their country. It is an absence, not a place,
   * and a legal notice claiming to be governed by "the laws of Other" would be worse than the vague wording
   * it replaced.
   */
  it("treats Other as no answer at all", () => {
    expect(governingLaw("Other")).toBe("local laws");
    expect(governingLaw("other")).toBe("local laws");
    expect(governingLaw("Other", "Somewhere")).toBe("local laws");
  });

  it("falls back to the wording as supplied when no country is set", () => {
    expect(governingLaw(null)).toBe("local laws");
    expect(governingLaw("")).toBe("local laws");
    expect(governingLaw("   ")).toBe("local laws");
  });

  it("ignores an empty region rather than printing a stray comma", () => {
    expect(governingLaw("Australia", "")).toBe("the laws of Australia");
    expect(governingLaw("Australia", null)).toBe("the laws of Australia");
    expect(governingLaw("Australia", "  ")).toBe("the laws of Australia");
  });

  it("is a phrase, not a sentence — the notice owns its full stop", () => {
    for (const c of COUNTRIES) {
      const phrase = governingLaw(c);
      expect(phrase.endsWith(".")).toBe(false);
      expect(phrase[0]).toBe(phrase[0].toLowerCase());
    }
  });

  it("answers for every country the settings screen offers", () => {
    for (const c of COUNTRIES) expect(governingLaw(c).length).toBeGreaterThan(0);
  });

  it("tells the screen when there is nothing worth saying", () => {
    expect(governingLawNote("Australia")).toBe("the laws of Australia");
    expect(governingLawNote("Other")).toBeNull();
    expect(governingLawNote(null)).toBeNull();
  });
});
