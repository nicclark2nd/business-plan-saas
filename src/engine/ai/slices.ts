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
const block = (lines: (string | null)[]) => {
  const kept = lines.filter((l): l is string => l !== null);
  return kept.length ? kept.join("\n") : null;
};

/**
 * Each slice is deliberately written as prose-ish lines rather than JSON. A model reads "Industry:
 * Commercial concreting" as a fact about a business; it reads a JSON blob as a document to summarise.
 */
const SLICES: Record<SliceKey, (i: ReportInput) => string | null> = {
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
  overview: (i) => (has(i.productsServices) ? `What the business sells, in the owner's words: ${i.productsServices.trim()}` : null),

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

  market: (i) => block([
    line("Market size", i.market.size),
    line("Market trends", i.market.trends),
    line("How the business wants to be seen", i.market.positioning),
    line("Brand values", i.market.brandValues),
  ]),

  competition: (i) => block([
    line("Our advantage", i.position.ourAdvantage),
    line("Barriers to entry", i.position.barriers),
    ...(() => {
      const named = i.competitors.filter((c) => has(c.name));
      return named.length ? ["Competitors:", ...named.map((c) => block([`- ${c.name}`, line("  how we win", c.howWeWin)]))] : [];
    })(),
  ]),

  /** What the client has already written about direction, so a draft agrees with it rather than contradicting it. */
  framework: (i) => block([
    line("Vision", i.framework.vision),
    line("Mission", i.framework.mission),
    line("Purpose", i.framework.purpose),
    line("Brand promise", i.framework.brandPromise),
    line("Field of play", i.framework.fieldOfPlay),
  ]),

  operations: (i) => block([
    line("Operating hours", i.operations.capacity.operatingHours),
    line("Capacity today", i.operations.capacity.capacityNow),
    line("What limits capacity", i.operations.capacity.capacityConstraint),
    line("How quality is managed", i.operations.capacity.qualityApproach),
  ]),
};

/** One slice, or null where the plan has nothing to say yet. */
export const slice = (i: ReportInput, key: SliceKey): string | null => SLICES[key](i);

/** Whether a slice has anything in it — the check that decides context from questions, and the caption from both. */
export const hasSlice = (i: ReportInput, key: SliceKey): boolean => slice(i, key) !== null;

/**
 * The context for one draft: every slice the field asked for that the plan can actually answer, in the
 * order the field asked. Absent slices are simply not mentioned — a model told "Customer groups: none"
 * will write about the absence.
 */
export function contextFor(i: ReportInput, wants: readonly SliceKey[]): string {
  return wants.map((k) => slice(i, k)).filter((s): s is string => s !== null).join("\n\n");
}
