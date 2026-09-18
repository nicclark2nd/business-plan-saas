import type { ReportInput } from "@/engine/report/build";
import { SLICE_KEYS, contextFor, hasSlice, type SliceKey } from "./slices";

/**
 * WHAT TO SEND, WHAT TO ASK, AND WHAT THE BUTTON MAY CLAIM (§6.105).
 *
 * An earlier design had each field declare itself GROUNDED (the plan can answer it) or ASK-FIRST (only the
 * owner knows). That was wrong, and the objection that corrected it was Nic's: the same field is grounded at
 * step 12 and ungrounded at step 1. Vision is step 1 and products are step 8, so a client who does
 * everything in perfect order still has no products when they first press a draft button.
 *
 * > **IT IS NOT A PROPERTY OF THE FIELD. IT IS A PROPERTY OF THE FIELD PLUS WHAT THE PLAN HOLDS RIGHT NOW.**
 *
 * So a field declares what it would LIKE. At the moment the button is pressed, whatever is present becomes
 * context and whatever is missing becomes the questions. One button, one code path, correct at both ends of
 * the path, and no static classification for anyone to maintain or get wrong.
 *
 * The caption comes from the same check, which is why it can no longer lie: the stub it replaces read
 * "Will use your industry, products and goals" on a screen seven steps before products exist (§6.87).
 */

/** Three. A fourth question is a form, and a form is what the draft button exists to avoid. */
export const MAX_QUESTIONS = 3;

/**
 * ONE QUESTION PER SLICE, NOT PER FIELD (§6.41).
 *
 * "What are the main things you sell?" is the same question whether Mission or Field of play is missing it.
 * Written per field, it would be written eleven times and drift.
 *
 * Null means CONTEXT-ONLY: the slice helps when it is there and is not worth asking for. `framework` is the
 * clearest case — asking "what is your vision?" in order to draft the vision is a circle, and the other
 * fields in that group are genuinely optional background.
 */
export const SLICE_QUESTION: Record<SliceKey, string | null> = {
  profile: null,
  overview: "In two or three sentences, what does the business sell, and who buys it?",
  whatYouSell: "What are the main things you sell?",
  customers: "Who are your main customers?",
  market: "How do you want the business to be seen against others in your market?",
  competition: "Why does a customer pick you rather than someone else?",
  framework: null,
  operations: "How does the work actually get done?",
};

/** Short names, for the line under the button. Lower case: they read inside a sentence. */
export const SLICE_LABEL: Record<SliceKey, string> = {
  profile: "business profile",
  overview: "what you sell",
  whatYouSell: "your products",
  customers: "your customers",
  market: "your market",
  competition: "your competitors",
  framework: "your vision and mission",
  operations: "your operations",
};

/** What a screen's field tells the drafter about itself. Every part of it is already on the screen. */
export type DraftableField = {
  key: string;
  /** The heading the popup carries, so there is never a question which box is being filled. */
  label: string;
  sub?: string;
  /** The guidance already shown under the field. It is better than a hand-written prompt would be. */
  hint?: string;
  placeholder?: string;
  /** In order of how much each would change the draft — the first missing ones become the questions. */
  wants: readonly SliceKey[];
  /**
   * QUESTIONS THAT ARE ALWAYS ASKED, BECAUSE THE ANSWER IS NEVER IN THE PLAN (§6.106.2).
   *
   * `wants` covers a gap the plan has not filled YET. This covers what the plan will never hold however
   * complete it is. No amount of knowing that a business pours driveways tells anyone where its owner wants
   * to be in ten years, or what they would want left behind if it closed.
   *
   * The first build had only `wants`, so a full plan asked nothing and wrote a vision out of a products
   * table — which is the exact fault this feature was designed to avoid, shipped.
   */
  asks?: readonly string[];
};

export type DraftPlan = {
  /** The slices the plan can answer, as text, in the order the field asked. */
  context: string;
  present: SliceKey[];
  /** At most three, for what is missing and worth asking. */
  questions: { slice: string; question: string }[];
  /** The line under the button. Never names something the plan does not have. */
  caption: string;
};

const sentence = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/**
 * Everything a draft request needs, decided at the moment of the press.
 *
 * Nothing here talks to a model or a database: given a plan and a field it is the same answer every time,
 * which is what makes the button's promise testable rather than hopeful.
 */
export function planDraft(i: ReportInput, field: DraftableField): DraftPlan {
  const wants = field.wants.filter((k) => SLICE_KEYS.includes(k));
  const present = wants.filter((k) => hasSlice(i, k));
  const missing = wants.filter((k) => !hasSlice(i, k));

  /*
   * The owner's own questions come FIRST and are never dropped for a plan gap: a missing product list is
   * something the app can work around, and a missing ambition is not.
   */
  const owner = (field.asks ?? []).map((question, i) => ({ slice: `ask:${i}`, question }));
  const gaps = missing
    .map((slice) => ({ slice: slice as string, question: SLICE_QUESTION[slice] }))
    .filter((q): q is { slice: string; question: string } => q.question !== null);
  const questions = [...owner, ...gaps].slice(0, MAX_QUESTIONS);

  /*
   * The caption states what will be used, and says plainly when that is nothing rather than dressing it up.
   * A client at step 1 who is told the app will use products it has never been given learns that the app's
   * sentences are decoration.
   */
  /*
   * The caption says BOTH halves, and says the asking first, because that is what happens first. A button
   * captioned only "Will use your products" on a field that is about to ask two questions has misdescribed
   * itself before it is even pressed.
   */
  const asking = questions.length
    ? `Will ask you ${questions.length === 1 ? "one question" : `${questions.length} short questions`}`
    : null;
  const using = present.length ? `use ${sentence(present.map((k) => SLICE_LABEL[k]))}` : null;
  const caption = asking && using ? `${asking}, then ${using}`
    : asking ? asking
      : using ? `Will ${using}`
        : "Will draft from what you have written so far";

  return { context: contextFor(i, present), present, questions, caption };
}
