import type { ReportInput } from "@/engine/report/build";
import { RUNGS } from "@/app/(app)/plans/[planId]/goals/model";
import { contextFor, hasSlice, type SliceKey } from "./slices";
import type { Message } from "./prompt";

/** The three rungs the drafter writes for. The 90 days are not among them — see below. */
export type RungKey = (typeof RUNGS)[number]["key"];

/**
 * THE GOALS DRAFTER (§6.115, reshaped by §6.125).
 *
 * Every other draft button in this app fills ONE box. This one writes a whole ladder, and that is the
 * reason it is a separate module rather than entries in `fields.ts`.
 *
 * > **THE RUNGS ONLY MEAN ANYTHING AGAINST EACH OTHER.** A five-year picture written without sight of the
 * > one-year commitments is how a plan ends up promising to triple in five years while this year's goals
 * > describe standing still. So they are written in one pass, by one request, reading each other as they go.
 *
 * WHAT CHANGED WHEN THE SIX BOXES BECAME A LADDER. The drafter used to write one goal per AREA — six
 * paragraphs, one each for Financial, Marketing, Sales and the rest. Areas are a tag now, so it writes one
 * LIST per rung instead, and the client accepts a rung at a time.
 *
 * WHAT IT STILL WILL NOT PROPOSE, AND THIS IS NOT A LIMITATION OF THE MECHANISM.
 *
 * Nothing in the 90-day band. That rung carries a name and a date, which makes every line on it a
 * COMMITMENT — and a commitment is not a model's to invent (the same refusal §6.111 made for SWOT
 * responses). The screen says it better than this comment can: a goal nobody owns does not happen.
 * Deciding who does it, and by when, is the owner's job.
 */

/** What the ladder needs to see. `finance` is the point of the exercise (§6.115). */
const WANTS: readonly SliceKey[] = [
  "profile", "overview", "finance", "whatYouSell", "customers", "market", "competition", "framework", "operations",
];

/**
 * ONLY THE OWNER CAN SAY WHAT A GOOD YEAR LOOKS LIKE (§6.106.2).
 *
 * The plan holds the forecast, which is what the business EXPECTS. It holds nothing about what its owner
 * wants out of the year, and the second question matters as much as the first: a plan that commits to
 * everything commits to nothing, and the things a client has already ruled out are the cheapest way to
 * stop a ladder sprawling.
 */
export const GOAL_ASKS: readonly string[] = [
  "What would make this a good year for you? One or two things, in your own words.",
  "Is there anything you have already decided you will NOT take on this year?",
];

/**
 * THE MARKER (§6.115).
 *
 * Three passages come back in one stream and have to be told apart while they are still arriving, so each
 * is announced by its rung key on a line of its own. A marker rather than JSON because the text STREAMS: a
 * half-finished JSON document is not parseable and a half-finished marked list is, so the panel fills in
 * as the model writes rather than appearing all at once at the end.
 */
export const GOAL_MARK = (rung: string) => `[[${rung}]]`;
const MARK_RE = /^\[\[([a-z0-9]+)\]\]\s*$/;

const SYSTEM = [
  "You write the goals of a small business's own business plan, in the owner's voice.",
  "",
  "You are given the plan. You write THREE lists — one per rung named in the brief, in the order given.",
  "",
  "Rules:",
  "- Start each rung with its marker on a line of its own, exactly as the brief writes it.",
  "- Under a marker, write 3 to 5 lines. ONE goal per line. No bullets, no numbering, no heading, no preamble.",
  "- Use ONLY the facts given. Never invent a figure, a date, a place, a customer, a person or a claim.",
  "- Where the forecast gives a figure, USE IT rather than saying 'grow' or 'improve'. That is what makes a goal a goal.",
  "- EACH RUNG IS ITS OWN YEAR. Quote the figure for that rung's year and no other. Never carry year 3's revenue into the 1-year list.",
  "- If the forecast says a year makes a LOSS, say so. Never describe a loss as a profit, and never drop the word 'loss' to make a goal sound better.",
  "- The 1-year lines are COMMITMENTS and should be checkable. The 3- and 5-year lines DESCRIBE the business at that point — size, shape, what it is known for.",
  "- NEVER name a person, and never say who will do something. These goals carry no owner.",
  "- Never set a deadline or a date. The rung is the date.",
  "- The three must agree: what the business looks like in five years has to be reachable from what it commits to this year.",
  "- Write as the business ('We will...'), never about it in the third person.",
  "- Plain, concrete English. No 'leverage', 'synergy', 'world-class', 'passionate'.",
].join("\n");

const section = (title: string, body: string | null) => (body && body.trim() ? `${title}\n${body.trim()}` : null);

/** Whether this plan holds enough to be worth drafting from, and what to say when it does not. */
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
  /** What the client has already written at each rung, so a draft improves on it rather than ignoring it. */
  existing: Partial<Record<string, string>> = {},
  /** SWOT lines the client said they would act on (§6.59.1) — intent they have already committed to on paper. */
  swot: { quadrant: string; text: string; response: string }[] = [],
): Message[] {
  const present = WANTS.filter((k) => hasSlice(i, k));
  const asked = answers.filter((a) => a.answer.trim());

  const rungs = RUNGS.map(({ key, label, asks }) => {
    const already = existing[key]?.trim();
    return [
      `${GOAL_MARK(key)}  ${label}`,
      `  ${asks}`,
      already ? `  The owner has already written:\n${already.split("\n").map((l) => `    ${l}`).join("\n")}\n  Improve on this. Do not contradict it.` : null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const brief = [
    section("THE THREE RUNGS, AND THE MARKER EACH ONE MUST START WITH", rungs),
    section("WHAT THE PLAN SAYS", contextFor(i, present)),
    /*
     * The SWOT responses are the client's OWN words about what they intend to do. They are the strongest
     * input this drafter has and they are labelled as the client's, not as the plan's, because that is what
     * they are: something written down as intent, not something the business has done.
     */
    section("WHAT THE OWNER SAID THEY WOULD DO ABOUT THEIR SWOT",
      swot.map((s) => `- (${s.quadrant}) ${s.text.trim()} → ${s.response.trim()}`).join("\n")),
    section("WHAT THE OWNER HAS JUST TOLD US", asked.map((a) => `${a.question}\n${a.answer.trim()}`).join("\n\n")),
    "Write the three lists now, each behind its marker, in the order above.",
  ].filter((s): s is string => s !== null).join("\n\n");

  return [{ role: "system", content: SYSTEM }, { role: "user", content: brief }];
}

/**
 * Split a stream — finished or half-arrived — into the three lists.
 *
 * Tolerant on purpose. A model that drops a marker, invents a fourth rung or writes a preamble before the
 * first one should cost the client the list it fumbled, not the whole ladder: text before any marker is
 * discarded and an unknown rung is ignored. Anything not returned simply has no proposal, which the panel
 * shows as nothing rather than as a blank a client might accept by accident.
 *
 * Bullets and numbering are stripped here rather than only forbidden in the prompt. A rule in a system
 * message is a request; this is the thing that decides what a client actually sees, and one line becoming
 * one goal means a stray "- " would otherwise be saved into the plan as part of the goal's own wording.
 */
export function parseGoals(raw: string): Partial<Record<string, string>> {
  const known = new Set<string>(RUNGS.map((r) => r.key));
  const out: Partial<Record<string, string>> = {};
  let current: string | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (current) {
      const text = buf
        .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) out[current] = text;
    }
    buf.length = 0;
  };

  for (const rawLine of raw.split("\n")) {
    const m = MARK_RE.exec(rawLine.trim());
    if (m && known.has(m[1])) {
      flush();
      current = m[1];
      continue;
    }
    if (current) buf.push(rawLine);
  }
  flush();
  return out;
}
