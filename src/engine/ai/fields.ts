import type { DraftableField } from "./draft";
import { VISION_FIELDS } from "@/app/(app)/plans/[planId]/vision/fields";

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

const fromVision = (): DraftableField[] =>
  VISION_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    sub: f.sub,
    hint: "hint" in f ? f.hint : undefined,
    placeholder: f.placeholder,
    wants: VISION_WANTS[f.key] ?? ["profile", "overview"],
  }));

/** Keyed by the field's own key, so a route can look one up from a request without a second list. */
export const DRAFTABLE: Record<string, DraftableField> =
  Object.fromEntries(fromVision().map((f) => [f.key, f]));

export const isDraftable = (key: string): boolean => key in DRAFTABLE;
