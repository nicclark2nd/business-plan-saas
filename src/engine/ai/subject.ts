import type { ReportInput } from "@/engine/report/build";

/**
 * THE ROW BEING WRITTEN ABOUT (§6.113).
 *
 * Five fields across four screens are not about the business, they are about ONE LINE of it: why they buy
 * this product, how we win against this competitor, what happens at this step. The per-field drafter had no
 * way to carry that, so those fields had no button and the sweep stopped (§6.112).
 *
 * THE ROW IS RESOLVED HERE, FROM THE PLAN, AND NEVER TAKEN FROM THE REQUEST.
 *
 * The browser sends a NAME. This module finds the row that matches it inside `ReportInput` — the same
 * assembly every other slice projects (§6.41, §6.67) — and writes the block from what it found. A request
 * naming a row that is not in the plan gets nothing, rather than a block built out of whatever the browser
 * said. That is the same rule as `slices.ts`: the server is the only author of what leaves the building,
 * and a string that arrived over the wire is not a fact about a business.
 *
 * WHAT A SUBJECT MAY NOT CONTAIN, AND THE TWO ARE DELIBERATE.
 *
 * 1. NO PRICE, NO UNITS, NO REVENUE. A product row carries all three and none of them is sent. Nic's
 *    decision, taken as a decision: "Why this price" is therefore the one field on the Sales screen with
 *    no button, because it is the one that cannot be written without the figure. The rest — what it is,
 *    why they buy it — never needed it.
 * 2. NO PERSON. A process step carries an owner's name and it is not sent, for the same reason no slice
 *    reads `people` (`slices.ts`, rule 2). "Dave runs this step" is not needed to describe the step.
 *
 * `subject.test.ts` seeds every excluded field with a poison string and asserts no subject can emit it,
 * exactly as `slices.test.ts` does for the plan-wide slices — because a promise about redaction is code and
 * a test, not a sentence in a prompt (§6.105).
 */

export const SUBJECT_KINDS = ["product", "competitor", "step"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

/** What the caption calls it, in a sentence: "Will use this product, then …". */
export const SUBJECT_LABEL: Record<SubjectKind, string> = {
  product: "this line",
  competitor: "this competitor",
  step: "this step",
};

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const line = (label: string, v: unknown) => (has(v) ? `${label}: ${v.trim()}` : null);
/** A line belonging to a draftable field, so the box being filled is left out of its own subject (§6.109). */
const own = (key: string, label: string, v: unknown, except?: string) => (key === except ? null : line(label, v));
const block = (lines: (string | null)[]) => {
  const kept = lines.filter((l): l is string => l !== null);
  return kept.length ? kept.join("\n") : null;
};

/** Case- and space-insensitive, because a client typing a name twice does not type it identically. */
const same = (a: string | null | undefined, b: string) =>
  (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The block describing one row, or null when the plan holds no such row.
 *
 * Null is not an error to apologise for at this level — the caller decides what it means. The route turns
 * it into a refusal, because a field that is ABOUT a row must not be drafted without knowing which one.
 */
export function subjectFor(
  i: ReportInput, kind: SubjectKind, name: string, except?: string,
): string | null {
  if (!has(name)) return null;

  if (kind === "product") {
    const l = i.productLines.find((x) => same(x.name, name));
    if (!l) return null;
    return block([
      `The ${String(i.noun.one).toLowerCase()} being written about: ${l.name.trim()}`,
      own("description", "  what it is", l.description, except),
      own("notes", "  why they buy it", l.whyTheyBuy, except),
      line("  sold as", l.soldAs === "recurring" ? "an ongoing client who pays every month" : l.soldAs === "one_off" ? "a one-off job, invoiced on delivery" : null),
      line("  lifecycle", l.lifecycle),
    ]);
  }

  if (kind === "competitor") {
    const c = i.competitors.find((x) => same(x.name, name));
    if (!c) return null;
    return block([
      `The competitor being written about: ${c.name.trim()}`,
      line("  kind", c.kind === "indirect" ? "indirect — solves the same problem a different way" : c.kind),
      line("  reach", c.reach),
      /* A relative word, not a figure. "A little lower" says nothing about what anybody charges. */
      line("  their pricing against ours", c.pricing?.replace(/_/g, " ")),
      line("  threat", c.threat),
      own("strengths", "  their strengths", c.strengths, except),
      own("weaknesses", "  their weaknesses", c.weaknesses, except),
      own("how_we_win", "  how we win", c.howWeWin, except),
    ]);
  }

  const s = i.operations.steps.find((x) => same(x.title, name));
  if (!s) return null;
  /* `owner` is a person and is not here. The step is describable without saying whose job it is. */
  return block([
    `The step being written about: ${s.title.trim()}`,
    own("detail", "  what happens", s.detail, except),
    line("  how long it takes", s.duration),
  ]);
}
