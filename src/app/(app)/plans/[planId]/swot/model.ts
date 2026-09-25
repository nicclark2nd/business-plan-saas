/** SWOT — one 2×2 area (SaaS §6.14). Items are one line each; suggestions are drawn from the plan itself. */
export const QUADRANTS = ["strength", "weakness", "opportunity", "threat"] as const;
export type Quadrant = (typeof QUADRANTS)[number];
export const QUADRANT_LABEL: Record<Quadrant, string> = { strength: "Strengths", weakness: "Weaknesses", opportunity: "Opportunities", threat: "Threats" };
export const QUADRANT_HINT: Record<Quadrant, string> = {
  strength: "What you do better than the rows in Competitors — and can prove.",
  weakness: "What a lender would find if they looked: gaps in the team, dependence on one person, no track record.",
  opportunity: "Changes in the market or gaps left by competitors you could take.",
  threat: "What could hurt you that you don't control: new entrants, regulation, a key client leaving.",
};

/**
 * What the business will DO about a line (§6.59) — one verb per quadrant, because "what you'll do about"
 * a strength reads like something has gone wrong with it. Generating these from the labels gives
 * "How you'll respond to Opportunities", which is a sentence nobody would write on purpose.
 */
export const RESPONSE_PROMPT: Record<Quadrant, string> = {
  strength: "How you'll build on it",
  weakness: "How you'll fix it",
  opportunity: "How you'll take it",
  threat: "How you'll guard against it",
};

/** The two quadrants a lender reads first, and the two where a blank response is worth naming out loud. */
export const RISK_QUADRANTS: Quadrant[] = ["weakness", "threat"];

/** Singular and plural, written out. Deriving them from the labels gives "1 weaknesse". */
export const QUADRANT_NOUN: Record<Quadrant, [string, string]> = {
  strength: ["strength", "strengths"],
  weakness: ["weakness", "weaknesses"],
  opportunity: ["opportunity", "opportunities"],
  threat: ["threat", "threats"],
};

export type SwotItem = {
  id: string; quadrant: Quadrant; text: string; source: string | null; sort_order: number;
  /** Null or empty means nothing is planned yet — which the screen says rather than hides (§6.59). */
  response: string | null;
};

/** A goal that answers a SWOT line (§6.59.1): the commitment the response turned into. */
export type LinkedGoal = { id: string; swot_item_id: string; title: string; milestone_date: string | null; status: string };
/** A line drawn from elsewhere in the plan. `key` is stable so a used suggestion is not offered again. */
export type Suggestion = { key: string; quadrant: Quadrant; text: string; from: string };
