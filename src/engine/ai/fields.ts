import type { DraftableField } from "./draft";
import { VISION_FIELDS } from "@/app/(app)/plans/[planId]/vision/fields";
import { POSITION_ONE_LINER, BRAND_FIELDS } from "@/app/(app)/plans/[planId]/marketing/model";

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
export const DRAFTABLE_FIELDS: DraftableField[] = [...SETTINGS_FIELDS, ...fromVision(), ...fromMarketing()];

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
