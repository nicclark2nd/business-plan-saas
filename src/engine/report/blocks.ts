/**
 * What a business plan is made of (§6.83).
 *
 * The old system was a document with tokens merged into it, and the sample Nic sent shows the failure mode
 * in print: `[customers]`, `<<Products.Or.Services_Proper>>`, "My Goal Number 1" and four paragraphs of
 * lorem ipsum, in a FINISHED plan. In a merge pipeline an unresolved token ships, and what ships is the
 * document a client hands to a bank.
 *
 * So the plan is a data structure, not a file with holes in it. A section is a function of the plan and the
 * forecast that returns blocks, and two things follow that a template cannot do:
 *
 *   1. A section with nothing to say RETURNS NOTHING, and says why. A template prints the heading and an
 *      empty table — §6.57, in the one artefact a client actually hands over. Here the section is dropped
 *      and its reason is collected, so the plan can tell its reader what was left out and why rather than
 *      pretending or going quiet.
 *   2. The numbering is DERIVED. Drop Funding and the section after it becomes 9.5. Nothing is typed twice.
 *
 * And every figure comes from the one forecast run the statements come from (§6.67). A merge pipeline
 * re-derives its numbers; the first time the report and the Cash Flow screen disagree, neither is worth
 * reading.
 */

/** A cell's alignment follows its CONTENT, so no caller has to remember that money goes right. */
export type Cell = { text: string; numeric?: boolean; bold?: boolean; muted?: boolean };

export type Block =
  | { kind: "para"; text: string }
  /** Small caps, for the sentence that introduces a table. Never a heading — it has no number. */
  | { kind: "lead"; text: string }
  | { kind: "table"; columns: { label: string; numeric?: boolean; width?: number }[]; rows: Cell[][] }
  /** Two columns, no header: the Company Snapshot shape. Its own kind because it reads as facts, not data. */
  | { kind: "facts"; rows: [string, string][] }
  | { kind: "list"; items: string[] }
  | { kind: "quote"; text: string }
  /** Said in the plan, in the plan's voice: a caveat a reader is entitled to. Not an app warning. */
  | { kind: "note"; text: string };

export type Section = {
  /** Filled in by `numberSections`, never written by a section builder. */
  number: string;
  title: string;
  blocks: Block[];
  children: Section[];
};

/** What a builder returns before numbering. `null` means "nothing to say", and the caller says why. */
export type Draft = { title: string; blocks?: Block[]; children?: (Draft | null)[] } | null;

export type Omission = { title: string; why: string };

export type ReportDoc = {
  businessName: string;
  subtitle: string;
  date: string;
  sections: Section[];
  /** Sections left out, and the reason for each. Printed at the end rather than silently dropped. */
  omitted: Omission[];
};

export const cell = (text: string, over: Partial<Cell> = {}): Cell => ({ text, ...over });
export const num = (text: string, over: Partial<Cell> = {}): Cell => ({ text, numeric: true, ...over });

/**
 * Depth-first numbering, assigned after the tree is built.
 *
 * This is the whole reason the report is a structure. A section that had nothing to say is already gone by
 * the time this runs, so the numbers close over the gap — no 9.5 missing, no heading left behind to explain
 * it. A template renumbers by hand or not at all, and "not at all" is what the samples do.
 */
export function numberSections(drafts: (Draft | null)[], prefix = ""): Section[] {
  return drafts.filter((d): d is NonNullable<Draft> => d !== null).map((d, i) => {
    const number = prefix ? `${prefix}.${i + 1}` : `${i + 1}.0`;
    const childPrefix = prefix ? number : String(i + 1);
    return {
      number,
      title: d.title,
      blocks: d.blocks ?? [],
      children: numberSections(d.children ?? [], childPrefix),
    };
  });
}

/** Every section in reading order, flattened — what a renderer and a contents page both walk. */
export function walk(sections: Section[]): Section[] {
  return sections.flatMap((s) => [s, ...walk(s.children)]);
}
