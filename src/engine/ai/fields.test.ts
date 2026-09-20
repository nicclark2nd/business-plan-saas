import { describe, expect, it } from "vitest";
import { DRAFTABLE, DRAFTABLE_FIELDS } from "./fields";
import { SLICE_KEYS } from "./slices";
import { MAX_QUESTIONS } from "./draft";

/**
 * THE REGISTRY (§6.108). Small assertions about a list, which is what a list is for.
 */
describe("every draftable field", () => {
  it("has a key of its own", () => {
    const keys = DRAFTABLE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size, `duplicate key: ${keys.filter((k, i) => keys.indexOf(k) !== i)}`).toBe(keys.length);
    expect(Object.keys(DRAFTABLE)).toHaveLength(keys.length);
  });

  it("wants only slices that exist", () => {
    for (const f of DRAFTABLE_FIELDS) {
      for (const w of f.wants) expect(SLICE_KEYS, `${f.key} wants "${w}"`).toContain(w);
    }
  });

  /* Three is the cap; a field that always asks three has no room for a gap in the plan. */
  it("never hard-asks more than two questions", () => {
    for (const f of DRAFTABLE_FIELDS) {
      expect((f.asks ?? []).length, f.key).toBeLessThan(MAX_QUESTIONS);
    }
  });

  it("carries the screen's own words, so the popup can be headed with them", () => {
    for (const f of DRAFTABLE_FIELDS) {
      expect(f.label, f.key).toBeTruthy();
      expect(f.hint ?? f.placeholder, `${f.key} has neither a hint nor a placeholder`).toBeTruthy();
    }
  });

  /* A field must not ask for the slice that reads it: that is the field being handed its own answer. */
  it("does not want the slice that reads it", () => {
    expect(DRAFTABLE.products_services_statement.wants).not.toContain("overview");
  });
});
