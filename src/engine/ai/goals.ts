import type { ReportInput } from "@/engine/report/build";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { AREA_HINT, AREA_PROMPT } from "@/app/(app)/plans/[planId]/goals/model";
import { contextFor, hasSlice, type SliceKey } from "./slices";
import type { Message } from "./prompt";

/**
 * THE GOALS DRAFTER (§6.115).
 *
 * Every other draft button in this app fills ONE box. This one proposes six, and that is the whole reason
 * it is a separate module rather than six entries in `fields.ts`.
 *
 * > **THE SIX ANNUAL GOALS ONLY MEAN ANYTHING AGAINST EACH OTHER.** A marketing goal written without
 * > sight of the sales goal is how a plan ends up with six paragraphs that do not add up — more leads,
 * > flat revenue, and a delivery goal that never mentions the extra work. So they are written in one
 * > pass, by one request, reading each other as they go.
 *
 * WHAT IT WILL NOT PROPOSE, AND THIS IS NOT A LIMITATION OF THE MECHANISM.
 *
 * No owner, no quarter, no date. A quarterly goal is a COMMITMENT — somebody's name against a deadline —
 * and that is not a model's to invent (the same refusal §6.111 made for SWOT responses, which reach this
 * screen for exactly that reason). The screen says it better than this comment can: "goals without an
 * owner do not happen." Deciding who does it is the owner's job. So the drafter writes the six sentences
 * of intent that head the report's sections, and the quarters keep coming from the client, from What-If
 * and from the SWOT tab.
 */

/** What every annual goal needs to see. `finance` is the point of the exercise (§6.115). */
const WANTS: readonly SliceKey[] = [
  "profile", "overview", "finance", "whatYouSell", "customers", "market", "competition", "framework", "operations",
];

/**
 * ONLY THE OWNER CAN SAY WHAT A GOOD YEAR LOOKS LIKE (§6.106.2).
 *
 * The plan holds the forecast, which is what the business EXPECTS. It holds nothing about what its owner
 * wants out of the year, and the second question matters as much as the first: a plan that commits to
 * everything commits to nothing, and the things a client has already ruled out are the cheapest way to
 * stop six goals sprawling.
 */
export const GOAL_ASKS: readonly string[] = [
  "What would make this a good year for you? One or two things, in your own words.",
  "Is there anything you have already decided you will NOT take on this year?",
];

/**
 * THE MARKER (§6.115).
 *
 * Six passages come back in one stream and have to be told apart while they are still arriving, so each is
 * announced by its area key on a line of its own. A marker rather than JSON because the text STREAMS: a
 * half-finished JSON document is not parseable and a half-finished marked list is, so the panel fills in
 * as the model writes rather than appearing all at once at the end.
 */
export const GOAL_MARK = (area: string) => `[[${area}]]`;
const MARK_RE = /^\[\[([a-z]+)\]\]\s*$/;

const SYSTEM = [
  "You write the annual goals of a small business's own business plan, in the owner's voice.",
  "",
  "You are given the plan. You write SIX goals, one for each area named in the brief, in the order given.",
  "",
  "Rules:",
  "- Start each goal with its marker on a line of its own, exactly as the brief writes it, then the goal below it.",
  "- One or two sentences per goal. No heading, no bullet, no preamble, no quotation marks.",
  "- Use ONLY the facts given. Never invent a figure, a date, a place, a customer, a person or a claim.",
  "- Where the forecast gives a figure, USE IT rather than saying 'grow' or 'improve'. That is what makes a goal a goal.",
  "- THESE GOALS ARE FOR YEAR 1. Year 2 is given only so the goals point somewhere; never quote a year-2 figure as this year's target.",
  "- If the forecast says a year makes a LOSS, say so. Never describe a loss as a profit, and never drop the word 'loss' to make a goal sound better.",
  "- NEVER name a person, and never say who will do something. These goals carry no owner.",
  "- Never set a quarter or a deadline. These are goals for the year.",
  "- The six must agree with each other: more selling means more delivering, and more marketing costs money.",
  "- Write as the business ('We will...'), never about it in the third person.",
  "- Plain, concrete English. No 'leverage', 'synergy', 'world-class', 'passionate'.",
].join("\n");

const section = (title: string, body: string | null) => (body && body.trim() ? `${title}\n${body.trim()}` : null);

/** Whether this plan holds enough to be worth drafting goals from, and what to say when it does not. */
export function goalsReadiness(i: ReportInput): { ready: boolean; reason?: string } {
  if (!hasSlice(i, "finance")) {
    return {
      ready: false,
      reason: "This plan has no forecast yet. Goals set before the numbers are wishes — fill in your sales lines and costs first, then come back.",
    };
  }
  return { ready: true };
}

export function buildGoalMessages(
  i: ReportInput,
  answers: { question: string; answer: string }[] = [],
  /** What the client has already written in the six boxes, so a draft improves on it rather than ignoring it. */
  existing: Partial<Record<GoalArea, string>> = {},
  /** SWOT lines the client said they would act on (§6.59.1) — intent they have already committed to on paper. */
  swot: { quadrant: string; text: string; response: string }[] = [],
): Message[] {
  const present = WANTS.filter((k) => hasSlice(i, k));
  const asked = answers.filter((a) => a.answer.trim());

  const areas = GOAL_AREAS.map(({ key, label }) => {
    const already = existing[key]?.trim();
    return [
      `${GOAL_MARK(key)}  ${label} — ${AREA_HINT[key]}`,
      `  ${AREA_PROMPT[key]}`,
      already ? `  The owner has already written: ${already}\n  Improve on this. Do not contradict it.` : null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const brief = [
    section("THE SIX AREAS, AND THE MARKER EACH ONE MUST START WITH", areas),
    section("WHAT THE PLAN SAYS", contextFor(i, present)),
    /*
     * The SWOT responses are the client's OWN words about what they intend to do. They are the strongest
     * input this drafter has and they are labelled as the client's, not as the plan's, because that is what
     * they are: something written down as intent, not something the business has done.
     */
    section("WHAT THE OWNER SAID THEY WOULD DO ABOUT THEIR SWOT",
      swot.map((s) => `- (${s.quadrant}) ${s.text.trim()} → ${s.response.trim()}`).join("\n")),
    section("WHAT THE OWNER HAS JUST TOLD US", asked.map((a) => `${a.question}\n${a.answer.trim()}`).join("\n\n")),
    "Write the six goals now, each behind its marker, in the order above.",
  ].filter((s): s is string => s !== null).join("\n\n");

  return [{ role: "system", content: SYSTEM }, { role: "user", content: brief }];
}

/**
 * Split a stream — finished or half-arrived — into the six goals.
 *
 * Tolerant on purpose. A model that drops a marker, adds a seventh area or writes a preamble before the
 * first one should cost the client the goal it fumbled, not the whole set: text before any marker is
 * discarded and an unknown area is ignored. Anything not returned simply has no proposal, which the panel
 * shows as nothing rather than as a blank a client might accept by accident.
 */
export function parseGoals(raw: string): Partial<Record<GoalArea, string>> {
  const known = new Set<string>(GOAL_AREAS.map((a) => a.key));
  const out: Partial<Record<GoalArea, string>> = {};
  let current: GoalArea | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (current) {
      const text = buf.join("\n").trim();
      if (text) out[current] = text;
    }
    buf.length = 0;
  };

  for (const rawLine of raw.split("\n")) {
    const m = MARK_RE.exec(rawLine.trim());
    if (m && known.has(m[1])) {
      flush();
      current = m[1] as GoalArea;
      continue;
    }
    if (current) buf.push(rawLine);
  }
  flush();
  return out;
}
