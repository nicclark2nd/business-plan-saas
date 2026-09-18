import type { DraftableField, DraftPlan } from "./draft";

/**
 * WHAT THE MODEL IS ASKED (§6.105.2).
 *
 * Built from the field's own definition — its label, its sub-line, its hint and its placeholder — and never
 * hand-written per field.
 *
 * > **FORTY HAND-WRITTEN PROMPTS ARE FORTY COPIES OF GUIDANCE THAT IS ALREADY ON THE SCREEN, AND THEY WILL
 * > DRIFT FROM IT (§6.41).**
 *
 * The guidance is also better than a prompt would be. Brand promise already tells a client *"A commitment
 * you would honour at your own cost. Not what makes you better than the competition — that is Our
 * advantage, on the Competitors step."* Nobody writing a prompt from scratch would produce that, and if the
 * hint is edited on the screen the model is told the new thing in the same commit.
 *
 * Pure: a field, a plan and a set of answers give the same messages every time, so what leaves the building
 * is testable rather than hopeful.
 */

export type Message = { role: "system" | "user"; content: string };

/**
 * The house rules. Two of them are about honesty rather than style, and they are the reason this is a
 * system message and not a suffix on the user one.
 */
const SYSTEM = [
  "You write single passages of a small business's own business plan, in the owner's voice.",
  "",
  "Rules:",
  "- Write ONLY the passage. No preamble, no heading, no quotation marks, no 'Here is a draft'.",
  "- Use ONLY the facts given. If something is not stated, leave it out — never invent a figure, a place, a date, a customer, an award or a claim about the business.",
  "- Plain, concrete English. No marketing superlatives, no 'leverage', 'synergy', 'passionate', 'cutting-edge', 'world-class'.",
  "- Match the length the field asks for. A field that asks for one sentence gets one sentence.",
  "- Write as the business ('We pour and finish...'), never about it in the third person, and never address the reader as 'you'.",
].join("\n");

const section = (title: string, body: string | null) => (body && body.trim() ? `${title}\n${body.trim()}` : null);

/**
 * `answers` are what the client typed into the questions the plan could not answer. They are facts from the
 * owner and are given the same standing as facts from the plan — but they are labelled separately, because
 * something typed into a popup thirty seconds ago has not been saved anywhere and should not be presented
 * to the model as though the plan already held it.
 */
export function buildMessages(
  field: DraftableField,
  plan: DraftPlan,
  answers: { question: string; answer: string }[] = [],
): Message[] {
  const asked = answers.filter((a) => a.answer.trim());

  const brief = [
    section("THE FIELD BEING WRITTEN", [
      `Name: ${field.label}${field.sub ? ` — ${field.sub}` : ""}`,
      field.hint ? `What it must be: ${field.hint}` : null,
      field.placeholder ? `An example of the right shape (do not copy it): ${field.placeholder.replace(/^e\.g\.\s*/i, "")}` : null,
    ].filter(Boolean).join("\n")),

    section("WHAT THE PLAN ALREADY SAYS", plan.context),

    section("WHAT THE OWNER HAS JUST TOLD US", asked.map((a) => `${a.question}\n${a.answer.trim()}`).join("\n\n")),

    "Write the passage now.",
  ].filter((s): s is string => s !== null).join("\n\n");

  return [{ role: "system", content: SYSTEM }, { role: "user", content: brief }];
}

/**
 * A model that has been told not to add a preamble will sometimes add one anyway, and a client should not
 * have to delete `"Here is a draft:"` from their own business plan. Cheap to strip, and stripping it is
 * honest in a way that pretending it never happens is not.
 */
export function tidyDraft(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(here(?:'s| is)[^:\n]*:|draft:|suggested draft:)\s*/i, "").trim();
  /* Whole-passage quoting only — a quotation inside the text is the client's and stays. */
  if (/^["“](.|\n)*["”]$/.test(s) && !/["“]/.test(s.slice(1, -1))) s = s.slice(1, -1).trim();
  return s;
}
