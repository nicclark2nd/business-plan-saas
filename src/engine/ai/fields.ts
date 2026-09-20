import type { DraftableField } from "./draft";
import { VISION_FIELDS } from "@/app/(app)/plans/[planId]/vision/fields";
import { POSITION_ONE_LINER, BRAND_FIELDS, POSITION_FIELDS } from "@/app/(app)/plans/[planId]/marketing/model";
import { CAPACITY_FIELDS } from "@/app/(app)/plans/[planId]/operations/model";

/**
 * WHICH FIELDS CAN BE DRAFTED, AND WHAT EACH ONE WANTS TO KNOW (§6.106.1).
 *
 * The descriptors are BUILT from the screen's own field definitions rather than written again here — label,
 * sub-line, hint and placeholder all come from `vision/fields.ts`, which is what the client is reading while
 * they press the button. Editing a hint on the screen changes what the model is told in the same commit
 * (§6.41).
 *
 * The only thing added here is `wants`: which slices of the plan would improve this particular passage, in
 * order of how much each would change it. Order matters twice over — it is the order the context is written
 * in, and the first missing ones become the questions.
 */

/**
 * WHAT ONLY THE OWNER CAN ANSWER (§6.106.2).
 *
 * These are asked every time, however complete the plan is, because no table in this app holds the answer.
 * A products list says what a business does today; it says nothing about where its owner wants to be in ten
 * years, or what they would want left behind.
 *
 * Kept short and concrete, in the second person, and answerable in a sentence. Two at most, so there is room
 * inside the cap of three for a genuine gap in the plan.
 */
const VISION_ASKS: Record<string, readonly string[]> = {
  vision: [
    "Where do you want this business to be in five to ten years? Be as ambitious as you actually are.",
    "Is there a mark you want to leave — on your area, your industry, or the people who work for you?",
  ],
  mission: [
    "What do you want this business to be known for doing better than anyone else nearby?",
  ],
  purpose: [
    "Beyond making money, why does this business exist?",
    "If it closed tomorrow, what would be lost that nobody else would replace?",
  ],
  brand_promise: [
    "What would you put right at your own cost rather than let a customer down?",
  ],
  ai_direction: [
    "Where would you most want software or AI to take work off your hands? \"Nowhere yet, and here is why\" is a real answer.",
  ],
  field_of_play: [
    "What work will you never take on, however good the money?",
  ],
};

/** What each Vision field would like to know. Nothing else about these fields is duplicated. */
const VISION_WANTS: Record<string, DraftableField["wants"]> = {
  /* Where the business is going. Needs to know what it does today and who for; the rest is noise. */
  vision: ["profile", "overview", "whatYouSell", "customers"],
  mission: ["profile", "overview", "whatYouSell", "customers"],
  /* Why it exists beyond profit is the owner's, not the plan's — but what they already wrote steers it. */
  purpose: ["profile", "overview", "framework"],
  /* A promise is made against what the competition does not do, and against how the work is actually done. */
  brand_promise: ["profile", "overview", "competition", "operations", "framework"],
  ai_direction: ["profile", "overview", "operations"],
  /* What you will and will not do: the lines you sell and the customers you sell them to. */
  field_of_play: ["profile", "overview", "whatYouSell", "customers", "competition"],
};

/**
 * PLAN SETTINGS — the elevator pitch that everything else grounds on (§6.108).
 *
 * `wants` deliberately EXCLUDES the `overview` slice, which reads this very field: handing a field its own
 * current value back is not context, it is an echo. The other three are what the pitch is made of — what
 * the business is, what it sells, who buys it — and `competition` carries why they choose it.
 *
 * NO `asks`. Every question this field would want to put is one the plan can hold once the later steps are
 * done, so each one arrives through the gap mechanism instead of being asked when the answer is already on
 * file. And the obvious question — "what do you sell?" — would be the field asking for itself.
 */
const SETTINGS_FIELDS: DraftableField[] = [{
  key: "products_services_statement",
  label: "About what you sell",
  sub: "an elevator pitch",
  hint: "Two or three sentences: what you sell, who buys it, and what it is worth to them. Not why the business exists — that is Mission, at step 1.",
  placeholder: "We pour, finish and guarantee residential and light-commercial concrete for builders and homeowners across the South Coast. Quoted price is the final price.",
  wants: ["profile", "whatYouSell", "customers", "competition"],
}];

/**
 * MARKETING, STEP 3 (§6.109).
 *
 * Eight narrative boxes on that module; five get a button and three do not, and the three are refused for
 * two different reasons worth keeping straight.
 *
 * - **Market size** and **Market trends** are facts about the world, not about this business. Nothing in
 *   the plan can ground them and nothing the owner types in a two-line answer box makes them sourced. A
 *   model asked for them writes a confident number with no source, which is the one thing a grant assessor
 *   is checking for. They stay typed, with the hint that already asks for a source.
 * - **Who sells, and what they need** names people and what they are paid to do. No slice reads a person
 *   (`slices.ts`, rule 2), so a draft there would either invent staff or be handed the very thing the
 *   redaction promise says never leaves. The refusal is the promise holding, not a gap.
 *
 * The five that qualify are all statements of intent about the business itself, which is what this button
 * is for.
 */
const MARKETING_WANTS: Record<string, DraftableField["wants"]> = {
  /*
   * NEITHER OF THE FIRST TWO ASKS FOR `market`, AND THAT IS DELIBERATE.
   *
   * The `market` slice carries market size, trends, positioning AND brand values — so handing it to
   * positioning or to brand values feeds each field its own current text back. That is an echo, not
   * context, and a model given its own draft returns a polish of it (the same reason Plan settings
   * excludes `overview`). Where you sit against others is grounded by `competition`, which is the
   * comparison that actually means something.
   */
  positioning: ["profile", "overview", "customers", "competition"],
  brand_values: ["profile", "overview", "framework", "operations"],
  /* These two are not in the slice, so `market` is real context: how you want to be seen shapes both. */
  brand_personality: ["profile", "overview", "customers", "market", "framework"],
  visual_identity: ["profile", "overview", "customers", "market"],
  sales_process: ["profile", "overview", "whatYouSell", "customers", "operations"],
};

/** What no table in this app holds, however complete the plan is (§6.106.2). One each: the gaps need room. */
const MARKETING_ASKS: Record<string, readonly string[]> = {
  positioning: [
    "Are you the premium option in your area, the middle, or the cheapest \u2014 and is that on purpose?",
  ],
  brand_values: [
    "Name one thing you would do for a customer even when it costs you money.",
  ],
  brand_personality: [
    "How do you want a customer to feel after they have spoken to you \u2014 reassured, impressed, or just left alone to get on with it?",
  ],
  visual_identity: [
    "What does a customer actually see \u2014 colours, logo, vehicles, signage, workwear? \u201cNothing consistent yet\u201d is a real answer.",
  ],
  sales_process: [
    "Walk it through: what happens from the first enquiry to a signed job, and roughly how long does each step take?",
  ],
};

/**
 * THE ONE DESCRIPTOR IN THIS FILE THAT IS WRITTEN RATHER THAN BORROWED, AND WHY.
 *
 * `salesFields()` on the marketing module builds its label and hint around the plan's OWN word for one sale
 * (§6.31.1) \u2014 "How a treatment is won" in a clinic, "How a job is won" for a concreter. This map is static
 * and shared by every plan, so borrowing it would freeze one business's noun into every other business's
 * prompt. It is written noun-free instead; the plan's real word reaches the model anyway, through the
 * `profile` slice's "Sells" and "Sells to" lines. The screen keeps its own wording.
 */
const SALES_PROCESS: DraftableField = {
  key: "sales_process",
  label: "How a sale is won",
  hint: "Step by step, from the first contact to a signed sale \u2014 the steps, who does each, and how long each takes.",
  placeholder: "e.g. Call back within 2 hours \u2192 site visit inside 3 days \u2192 fixed-price quote within 24 hours of the visit \u2192 follow-up call on day 3 \u2192 deposit and booked date.",
  wants: MARKETING_WANTS.sales_process,
  asks: MARKETING_ASKS.sales_process,
};

const fromMarketing = (): DraftableField[] => [
  ...[POSITION_ONE_LINER, ...BRAND_FIELDS].map((f) => ({
    key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder,
    wants: MARKETING_WANTS[f.key], asks: MARKETING_ASKS[f.key],
  })),
  SALES_PROCESS,
];

/**
 * COMPETITORS, STEP 4 (§6.110).
 *
 * Two shapes on that step, and only one of them gets buttons.
 *
 * THE POSITION TAB — three plan-level boxes, all three drafted. This is the section a lender reads
 * hardest, it is about THIS business, and by step 4 the plan holds the competitors to say it against.
 *
 * THE COMPETITOR GRID — `strengths`, `weaknesses` and `how_we_win`, per row. NO BUTTON, and the reason is
 * not the mechanism.
 *
 * > A competitor's strengths and weaknesses are claims about a NAMED REAL BUSINESS. Nothing in this plan
 * > knows anything about them. A model asked what James West is bad at will answer, fluently, and the
 * > client will paste it into a document that goes to a bank.
 *
 * Market size at least fails towards a number somebody can check. This fails towards defamation. The grid
 * stays typed from what the client actually knows. (`how_we_win` is about this business rather than the
 * rival and could be grounded — but it needs that row's name and notes as context, which is a per-row
 * drafter and a separate decision, not something to half-build here.)
 */
const COMPETITORS_WANTS: Record<string, DraftableField["wants"]> = {
  /* Said against the rows, or it means nothing — so `competition` leads, and `except` keeps this box out of it. */
  our_advantage: ["profile", "overview", "competition", "whatYouSell", "customers", "operations"],
  barriers_to_entry: ["profile", "overview", "competition", "whatYouSell", "operations"],
  /* What would let one of them beat you: your rivals, and how the work actually gets done today. */
  future_threats: ["profile", "overview", "competition", "operations", "market"],
};

/**
 * `competition` asks "why does a customer pick you rather than someone else?" — which is Our advantage
 * word for word. Taken as context, never asked for (§6.110). The other two are safe: nobody confuses
 * "why do they pick you" with "what stops someone copying you".
 */
const COMPETITORS_CONTEXT_ONLY: Record<string, readonly ("competition")[]> = {
  our_advantage: ["competition"],
};

/** What no table holds (§6.106.2). Each one pushes for a real example rather than a general claim. */
const COMPETITORS_ASKS: Record<string, readonly string[]> = {
  our_advantage: [
    "Think of the last job you won that someone else was also quoting. Why did you get it?",
  ],
  barriers_to_entry: [
    "What do you have that someone starting next week could not get quickly \u2014 a licence, a contract, a relationship, a piece of gear?",
  ],
  /*
   * THIS ONE CARRIES MORE WEIGHT THAN THE OTHERS. Asked to invent a threat, a model writes "a national
   * franchise opening a depot nearby" \u2014 fluent, specific, and about a company that does not exist. The
   * question makes the client name the real worry first, so the draft has something true to build on.
   */
  future_threats: [
    "What actually worries you about the next two years \u2014 a customer you could lose, a licence, a person leaving, a rival getting bigger?",
  ],
};

const fromCompetitors = (): DraftableField[] =>
  POSITION_FIELDS.map((f) => ({
    key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder,
    wants: COMPETITORS_WANTS[f.key],
    contextOnly: COMPETITORS_CONTEXT_ONLY[f.key],
    asks: COMPETITORS_ASKS[f.key],
  }));

/**
 * OPERATIONS, STEP 6 (§6.111). Three of the five capacity boxes.
 *
 * THE TWO REFUSED ARE REFUSED FOR DIFFERENT REASONS, AND THE SECOND IS THE INTERESTING ONE.
 *
 * `operating_hours` is a bare fact — days, hours, the shutdown over Christmas. No slice holds it, nothing
 * shapes it, and a model asked for it invents a plausible roster that a lender then reads as true. The
 * question would be the whole answer, which makes the button a typing aid with a fabrication risk attached.
 *
 * `capacity_now` looks draftable and is not. The plan DOES hold volumes — the sales lines carry units — but
 * those are the FORECAST: what the business intends to sell. Capacity is what it could deliver if the work
 * were there. Handing a model 36 slabs a year gets back "we can deliver about 36 slabs a year", which
 * quietly states that the business is running at exactly 100% and has been all along. That is a claim no
 * client meant to make, in the section a lender reads to find out whether the forecast is even possible.
 *
 * > A number the plan holds for one purpose is not evidence for a different question.
 *
 * The three that qualify are judgements about the business: what runs out first, what a step up would take,
 * and what keeps the work right. Each has an `ask` that makes the owner supply the substance.
 */
const OPERATIONS_WANTS: Record<string, DraftableField["wants"]> = {
  capacity_constraint: ["profile", "overview", "whatYouSell", "operations", "customers"],
  /* Not in the `operations` slice at all, so nothing to leave out \u2014 but it needs the rest of it badly. */
  capacity_plan: ["profile", "overview", "whatYouSell", "operations", "customers"],
  /* `framework` carries the brand promise, which is the quality promise written down at step 1. */
  quality_approach: ["profile", "overview", "whatYouSell", "framework", "operations"],
};

const OPERATIONS_ASKS: Record<string, readonly string[]> = {
  capacity_constraint: [
    "When you get busy, what runs out first \u2014 people, gear, hours, cash? And how long does it take to get more of it?",
  ],
  /*
   * THIS ONE ASKS FOR THE MONEY, because the field asks for it and a model will otherwise supply a figure.
   * "About 180,000 a year and a 65,000 asset" is the placeholder; invented, it is a number that walks into
   * a conversation about the forecast as though somebody had worked it out.
   */
  capacity_plan: [
    "What would the next step up actually need \u2014 who, what gear \u2014 and roughly what would it cost a year?",
  ],
  quality_approach: [
    "What gets checked before a job is signed off, and what happens when something does go wrong?",
  ],
};

const fromOperations = (): DraftableField[] =>
  CAPACITY_FIELDS.filter((f) => f.key in OPERATIONS_WANTS).map((f) => ({
    key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder,
    wants: OPERATIONS_WANTS[f.key], asks: OPERATIONS_ASKS[f.key],
  }));

const fromVision = (): DraftableField[] =>
  VISION_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    sub: f.sub,
    hint: "hint" in f ? f.hint : undefined,
    placeholder: f.placeholder,
    wants: VISION_WANTS[f.key] ?? ["profile", "overview"],
    asks: VISION_ASKS[f.key] ?? [],
  }));

/** Every draftable field in the app, in the order a client meets them. */
export const DRAFTABLE_FIELDS: DraftableField[] = [...SETTINGS_FIELDS, ...fromVision(), ...fromMarketing(), ...fromCompetitors(), ...fromOperations()];

/**
 * Keyed by the field's own key, so a route can look one up from a request without a second list.
 *
 * The keys are flat rather than namespaced by module, which is fine and is checked: `fields.test.ts`
 * asserts they are unique, because a second field quietly answering to `positioning` would draft the wrong
 * thing and nothing else would notice.
 */
export const DRAFTABLE: Record<string, DraftableField> =
  Object.fromEntries(DRAFTABLE_FIELDS.map((f) => [f.key, f]));

export const isDraftable = (key: string): boolean => key in DRAFTABLE;
