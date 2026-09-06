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

export type SwotItem = { id: string; quadrant: Quadrant; text: string; source: string | null; sort_order: number };
/** A line drawn from elsewhere in the plan. `key` is stable so a used suggestion is not offered again. */
export type Suggestion = { key: string; quadrant: Quadrant; text: string; from: string };
