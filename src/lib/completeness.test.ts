import { describe, expect, it } from "vitest";
import { GUIDED_STEPS } from "./nav";

/**
 * EVERY NUMBERED STEP IS MEASURED (§6.99).
 *
 * `getCompleteness` talks to Supabase, so this reads the section ids out of the source rather than running
 * it. That is deliberate and it is the assertion that would have caught the fault: Assumptions became step
 * 14 in §6.94 and no section was ever written for it, so its number could not turn green however much a
 * client entered — and `Review forecast` was measuring Assumptions' own work under its name.
 *
 * Reading the file is not elegant. It is the only way to state "every step has a measure" without a
 * database, and a rule nobody can check is the rule that drifts (§6.92.1).
 */
const source = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  return readFileSync(new URL("./plan.ts", import.meta.url), "utf8");
};

const sectionIds = () => [...source().matchAll(/\{ id: "([a-z-]+)", label:/g)].map((m) => m[1]);

describe("plan completeness", () => {
  it("has a section for every guided step that a client can fill in", () => {
    const ids = new Set(sectionIds());
    /* The business plan is an OUTPUT — there is nothing on it to complete, so it is the one exemption. */
    const missing = GUIDED_STEPS.map((s) => s.id).filter((id) => id !== "reports" && !ids.has(id));
    expect(missing).toEqual([]);
  });

  it("measures Assumptions and Review forecast as two different things", () => {
    const src = source();
    /* Assumptions is done when the days are set; Review forecast when the statements reconcile. */
    expect(src).toContain('{ id: "assumptions", label: "Assumptions", done: assumptionsSet ? 1 : 0, total: 1 }');
    expect(src).toContain('{ id: "forecast", label: "Review forecast", done: reconciled ? 1 : 0, total: 1 }');
  });

  /**
   * The other direction, with one exemption that is the point rather than an oversight: PLAN SETTINGS is
   * measured and carries no number (§6.82). It is upstream of the path — country, financial year, the four
   * fields a report cannot open without — so it belongs in the score while not being a step in the story.
   */
  it("measures nothing that is neither a step nor Plan settings", () => {
    const allowed = new Set([...GUIDED_STEPS.map((s) => s.id), "settings"]);
    for (const id of sectionIds()) expect(allowed.has(id), `${id} is neither a guided step nor Plan settings`).toBe(true);
  });
});
