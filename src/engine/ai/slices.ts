import type { ReportInput } from "@/engine/report/build";

/**
 * WHAT THE MODEL IS ALLOWED TO SEE (§6.105).
 *
 * A draft request sends a slice of the plan, never the plan. Each field on a screen declares the slices it
 * wants; this module is the only thing that turns a slice name into text, so it is the only place that
 * decides what can leave the building.
 *
 * TWO RULES, AND THE SECOND IS THE POINT OF THE FILE.
 *
 * 1. Every slice is a projection of `ReportInput` — the same structure the report is built from, assembled
 *    by the same loader every screen uses (§6.41, §6.67). There is no second query and no "fetch the plan
 *    for AI" path, because a second reading of one plan is how every expensive fault here has started.
 *
 * 2. NO SLICE READS A PERSON, A WAGE, OR A SOURCE OF MONEY. Not `keyPeople`, `people`, `capabilities`,
 *    `owners`, `funding`, `overheads`, `historic` or `forecast`. Drafting a vision statement needs to know
 *    the business pours concrete for builders. It does not need to know what the operations manager is paid
 *    or which bank holds the loan.
 *
 * > That is a promise the code keeps rather than one a consent paragraph makes, and `slices.test.ts` proves
 * > it by seeding every excluded field with a poison string and asserting no slice can emit it.
 *
 * Slices return plain text or null. Null means the plan has nothing to say yet — which is not a gap to
 * apologise for, it is the signal that this becomes a QUESTION instead of context.
 */

/**
 * A BLANK ROW IS NOT DATA (§6.106.3, and §6.89 again).
 *
 * A grid in this app keeps an empty row at the bottom for the next entry. Counting it made `customers`
 * report itself present on a plan with no customers at all — so the button promised "your customers", the
 * model was handed "Customer groups:" and nothing underneath, and it filled the silence by inventing some.
 *
 * Every slice below therefore counts only rows a client has actually named.
 */
export const SLICE_KEYS = [
  "profile", "overview", "whatYouSell", "customers", "market", "competition", "framework", "operations",
] as const;
export type SliceKey = (typeof SLICE_KEYS)[number];

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const line = (label: string, v: unknown) => (has(v) ? `${label}: ${v.trim()}` : null);

/**
 * A LINE THAT BELONGS TO A DRAFTABLE FIELD, SO THE FIELD BEING DRAFTED IS LEFT OUT OF ITS OWN CONTEXT
 * (\u00a76.109).
 *
 * A model handed the text already in the box returns a polish of it \u2014 so a client presses a button
 * captioned "Suggest a draft" and is shown what they already wrote. \u00a76.108 avoided this on one field by
 * leaving a slice out of its `wants` list, and a test written for Marketing then found three more that had
 * shipped with it: Purpose, Brand promise and Field of play all wanted `framework`, and `framework` quotes
 * all three.
 *
 * Careful list-keeping was the wrong answer. The drafter knows which field it is drafting, so the slice can
 * simply omit it, and no future field can be added wrong. `wants` is back to meaning only "would this help".
 */
const own = (key: string, label: string, v: unknown, except?: string) => (key === except ? null : line(label, v));
const block = (lines: (string | null)[]) => {
  const kept = lines.filter((l): l is string => l !== null);
  return kept.length ? kept.join("\n") : null;
};

/**
 * Each slice is deliberately written as prose-ish lines rather than JSON. A model reads "Industry:
 * Commercial concreting" as a fact about a business; it reads a JSON blob as a document to summarise.
 */
const SLICES: Record<SliceKey, (i: ReportInput, except?: string) => string | null> = {
  /** Who and where the business is. The only slice that is almost always present, because Plan settings precedes step 1. */
  profile: (i) => block([
    line("Business name", i.businessName),
    line("Industry", i.profile.industry),
    line("Country", i.profile.country),
    line("State or region", i.profile.taxRegion),
    line("Legal structure", i.profile.legalStructure),
    line("Sells", i.profile.productType),
    line("Sells to", i.profile.customerType),
    line("Trading since", i.profile.established),
    line("Tagline", i.profile.tagline),
  ]),

  /** The client's own elevator pitch, from Plan settings (§6.103). The single most useful sentence in the app. */
  overview: (i, except) => (except !== "products_services_statement" && has(i.productsServices)
    ? `What the business sells, in the owner's words: ${i.productsServices.trim()}` : null),

  /**
   * The lines themselves — NAMES AND WORDS, NOT PRICES. What something sells for is not secret, but it is
   * also not needed to write a sentence about what a business does, and the smallest context that answers
   * the question is the right one.
   */
  whatYouSell: (i) => {
    const named = i.productLines.filter((l) => has(l.name));
    if (!named.length) return null;
    const rows = named.map((l) => block([
      `- ${l.name}`,
      line("  what it is", l.description),
      line("  why they buy it", l.whyTheyBuy),
    ]));
    return block([`The ${String(i.noun.many).toLowerCase()} offered:`, ...rows]);
  },

  customers: (i) => {
    const named = i.segments.filter((s) => has(s.name));
    if (!named.length) return null;
    return block([
      "Customer groups:",
      ...named.map((s) => block([`- ${s.name}`, line("  who they are", s.profile), line("  what they care about", s.caresAbout)])),
    ]);
  },

  market: (i, except) => block([
    own("market_size", "Market size", i.market.size, except),
    own("market_trends", "Market trends", i.market.trends, except),
    own("positioning", "How the business wants to be seen", i.market.positioning, except),
    own("brand_values", "Brand values", i.market.brandValues, except),
  ]),

  competition: (i, except) => block([
    own("our_advantage", "Our advantage", i.position.ourAdvantage, except),
    own("barriers_to_entry", "Barriers to entry", i.position.barriers, except),
    ...(() => {
      const named = i.competitors.filter((c) => has(c.name));
      /*
       * `own` here strips how-we-win from EVERY competitor, not only the one being drafted (§6.114). That
       * loses a little sibling context and buys a guarantee, which is the right trade: this slice cannot
       * tell which row the field is on, and a field handed its own answer is the fault being prevented.
       */
      return named.length ? ["Competitors:", ...named.map((c) => block([`- ${c.name}`, own("how_we_win", "  how we win", c.howWeWin, except)]))] : [];
    })(),
  ]),

  /** What the client has already written about direction, so a draft agrees with it rather than contradicting it. */
  framework: (i, except) => block([
    own("vision", "Vision", i.framework.vision, except),
    own("mission", "Mission", i.framework.mission, except),
    own("purpose", "Purpose", i.framework.purpose, except),
    own("brand_promise", "Brand promise", i.framework.brandPromise, except),
    own("field_of_play", "Field of play", i.framework.fieldOfPlay, except),
  ]),

  operations: (i, except) => block([
    own("operating_hours", "Operating hours", i.operations.capacity.operatingHours, except),
    own("capacity_now", "Capacity today", i.operations.capacity.capacityNow, except),
    own("capacity_constraint", "What limits capacity", i.operations.capacity.capacityConstraint, except),
    own("quality_approach", "How quality is managed", i.operations.capacity.qualityApproach, except),
  ]),
};

/**
 * One slice, or null where the plan has nothing to say yet.
 *
 * `except` is the key of the field being drafted, and it is threaded all the way through rather than
 * applied at the end on purpose: a slice emptied by removing that field must report itself ABSENT, so the
 * missing context becomes a question instead of an empty heading the model fills in for itself (§6.106.3).
 */
export const slice = (i: ReportInput, key: SliceKey, except?: string): string | null => SLICES[key](i, except);

/** Whether a slice has anything in it — the check that decides context from questions, and the caption from both. */
export const hasSlice = (i: ReportInput, key: SliceKey, except?: string): boolean => slice(i, key, except) !== null;

/**
 * The context for one draft: every slice the field asked for that the plan can actually answer, in the
 * order the field asked. Absent slices are simply not mentioned — a model told "Customer groups: none"
 * will write about the absence.
 */
export function contextFor(i: ReportInput, wants: readonly SliceKey[], except?: string): string {
  return wants.map((k) => slice(i, k, except)).filter((s): s is string => s !== null).join("\n\n");
}
