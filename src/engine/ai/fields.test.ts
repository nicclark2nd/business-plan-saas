import { describe, expect, it } from "vitest";
import type { ReportInput } from "@/engine/report/build";
import { DRAFTABLE, DRAFTABLE_FIELDS } from "./fields";
import { SLICE_KEYS } from "./slices";
import { MAX_QUESTIONS, planDraft } from "./draft";

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

  /*
   * NO FIELD IS HANDED ITS OWN CURRENT VALUE BACK (§6.109).
   *
   * A model given the text already in the box returns a polish of it, and the client presses a button
   * captioned "Suggest a draft" to be shown what they already wrote. It is the easiest mistake to make
   * here, because the slice that would echo a field is almost always the slice full of its neighbours:
   * `market` carries market size and trends (worth having) in the same block as positioning and brand
   * values (the fields themselves).
   *
   * Asserted by seeding the field's own place in the plan with a marker and building the context the
   * button would actually send. A later edit that adds `market` back to `positioning` fails here rather
   * than shipping quietly.
   */
  const AT: Record<string, (v: string) => Partial<ReportInput>> = {
    products_services_statement: (v) => ({ productsServices: v }),
    vision: (v) => ({ framework: { vision: v } as ReportInput["framework"] }),
    mission: (v) => ({ framework: { mission: v } as ReportInput["framework"] }),
    purpose: (v) => ({ framework: { purpose: v } as ReportInput["framework"] }),
    brand_promise: (v) => ({ framework: { brandPromise: v } as ReportInput["framework"] }),
    field_of_play: (v) => ({ framework: { fieldOfPlay: v } as ReportInput["framework"] }),
    positioning: (v) => ({ market: { positioning: v } as ReportInput["market"] }),
    brand_values: (v) => ({ market: { brandValues: v } as ReportInput["market"] }),
    brand_personality: (v) => ({ market: { brandPersonality: v } as ReportInput["market"] }),
    visual_identity: (v) => ({ market: { visualIdentity: v } as ReportInput["market"] }),
    sales_process: (v) => ({ market: { salesProcess: v } as ReportInput["market"] }),
    /*
     * No slice reads this one, so it cannot echo. Kept in the list rather than skipped, because the check
     * below insists every draftable field appears here \u2014 the point being that adding a field forces
     * someone to answer "and where does this live?" rather than quietly opting out.
     */
    ai_direction: () => ({}),
  };
  const MARK = "ECHO-OF-THE-FIELD-ITSELF";

  /* An EMPTY plan, so the only thing any slice can possibly emit is the marker that was just seeded. */
  const empty = (): ReportInput => ({
    businessName: null, productsServices: null,
    noun: { one: "job", many: "Jobs", head: "Job", aOne: "a job" },
    profile: {}, framework: {}, market: {}, position: {},
    productLines: [], segments: [], competitors: [],
    operations: { premises: [], suppliers: [], steps: [], capacity: {} },
  } as unknown as ReportInput);

  it("is never sent its own current text as context", () => {
    for (const f of DRAFTABLE_FIELDS) {
      const at = AT[f.key];
      expect(at, `${f.key} is not in the echo check \u2014 add where it is stored`).toBeDefined();
      /* Through `planDraft`, not `contextFor` \u2014 the real path, including the caption it would claim. */
      const d = planDraft({ ...empty(), ...at(MARK) } as ReportInput, f);
      expect(d.context, `${f.key} is handed its own value back`).not.toContain(MARK);
      /* And it must not then CLAIM the slice it was just emptied of. */
      expect(d.caption, `${f.key} claims a slice holding only itself`).not.toBe("Will draft from what you have written so far");
    }
  });

  /* And the plainest statement of the same rule, on the two that were most tempting to get wrong. */
  it("keeps the marketing fields out of the slice that quotes them", () => {
    expect(DRAFTABLE.positioning.wants).not.toContain("market");
    expect(DRAFTABLE.brand_values.wants).not.toContain("market");
    expect(DRAFTABLE.products_services_statement.wants).not.toContain("overview");
  });

  /* The three Marketing boxes that are refused, and stay refused (§6.109). */
  it("will not draft a market size, a market trend, or who sells", () => {
    for (const k of ["market_size", "market_trends", "sales_team"]) expect(DRAFTABLE[k]).toBeUndefined();
    }
  );
});
