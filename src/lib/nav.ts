/** Left-menu model. Guided mode shows the numbered 15-step path plus tools; Advanced shows every module. */
export type NavItem = { id: string; label: string; step?: number; advancedLabel?: string; tag?: string; tool?: boolean; href?: string /* deep link into another module's area */ };
export type NavGroup = { group: string; items: NavItem[] };

/**
 * ORDER (§6.80). The numbered path runs straight down the page, 1 to 15, and everything without a number
 * sits below it.
 *
 * Nic, in front of a client: "13 is six menu items away from 12 ... What-If Planner is stuck in the middle
 * of everything ... 15 is Business plan and I can't see a 14."
 *
 * All three are one fault. The sidebar was doing two jobs that had quietly stopped agreeing: a TOPIC MAP
 * (Market, Financials, Forecasts) and a NUMBERED JOURNEY. They used to roughly coincide. §6.76 to §6.78
 * put three new modules into the Forecasts group and finished off what was left — 13 ended up six items
 * below 12, and 14 sat ABOVE 6, because Goals is filed next to SWOT for topical reasons while being the
 * last thing the plan drafts.
 *
 * A number is only a guide if the next one is the next thing down. So the journey wins the ordering, and
 * the topics keep the grouping WITHIN it. Nothing is renumbered: every step keeps the number it had, and
 * only its position moves, so the Save-and-continue chain is untouched.
 *
 * Below the path, in their own groups: the statements the plan produces, the tools, the unbuilt, the
 * settings. An unnumbered item can then never appear between two numbered ones, which is what made
 * Assumptions and What-If read as steps somebody had skipped.
 */
export const NAV: NavGroup[] = [
  { group: "", items: [{ id: "dashboard", label: "Dashboard", tool: true }] },

  // ---- the guided path, 1 to 15, in order -------------------------------
  { group: "Strategy & Direction", items: [{ id: "vision", label: "Vision & Purpose", step: 1 }] },
  { group: "People", items: [{ id: "people", label: "Leadership Team", step: 2 }] },
  { group: "Market", items: [{ id: "marketing", label: "Marketing", step: 3 }, { id: "competitors", label: "Competitors", step: 4 }] },
  /**
   * SWOT on its own, under its own name. It shared a "Goals" heading with Goals, and the two are at
   * opposite ends of the journey — 5 and 14. One heading holding the fifth step and the fourteenth was
   * the single place where the topic order and the step order tore.
   */
  { group: "Strengths & Risks", items: [{ id: "swot", label: "SWOT", step: 5 }] },
  { group: "Financials", items: [
    { id: "historic", label: "Historic", step: 6 }, { id: "sales", label: "Sales", step: 7 }, { id: "cogs", label: "COGS", step: 8 },
    { id: "overheads", label: "Overheads", step: 9 }, { id: "funding", label: "Funding", step: 10 },
    { id: "assets", label: "Fixed Assets", step: 11 },
    { id: "extraordinary", label: "One-off income & costs", step: 12 },
    /**
     * An input, filed with the inputs (§6.43.1, §6.79), and it stays where Nic asked for it: directly under
     * item 12. It carries no number, but it is the LAST item in its group rather than a gap in the middle
     * of a run — 13 starts a new heading underneath. An unnumbered item at the end of a group reads as
     * "and also this"; the same item between 12 and 13 reads as a step you have somehow missed.
     *
     * That the guided path never forces a client through it is a real gap, and a separate one.
     */
    { id: "assumptions", label: "Assumptions", tool: true },
  ] },
  { group: "Review", items: [{ id: "forecast", label: "Review forecast", step: 13 }] },
  { group: "Goals", items: [{ id: "goals", label: "Goals", step: 14, tag: "AI-drafted" }] },
  { group: "Reports", items: [{ id: "reports", label: "Business plan", step: 15, tool: true }] },

  // ---- what the plan produces, and what you do with it -------------------
  /**
   * Five outputs, and nothing else (§6.43.1) — each now a module of its own (§6.76, §6.77, §6.78) rather
   * than a tab on step 13. They sit BELOW the path because they have no number, which is the cost of the
   * rule and worth paying: these are the screens a client opens again and again, and burying them slightly
   * is cheaper than putting four unnumbered items back in the middle of the journey.
   */
  { group: "Forecasts", items: [
    { id: "profit-loss", label: "Profit & Loss", tool: true },
    { id: "balance-sheet", label: "Balance Sheet", tool: true },
    { id: "cash-flow", label: "Cash Flow", tool: true },
    /**
     * A TOOL, not a step (§6.68). Guided mode renders an item only if it carries a step number or is
     * flagged a tool, so Break-Even — which had neither — was invisible in the mode every client starts in.
     */
    { id: "break-even", label: "Break-Even", tool: true },
  ] },
  /**
   * An ACTIVITY, not a step and not an output (§6.80). Nic: "the What-If planner seems to be an activity
   * and not a report but it has no number." It sat in Financials, the group where a client TYPES things,
   * while being the one screen you can only use once a forecast already exists to bend.
   */
  { group: "Tools", items: [{ id: "what-if", label: "What-If Planner", tool: true }] },

  // ---- not built yet, and the settings -----------------------------------
  { group: "Assets", items: [
    { id: "outlets", label: "Outlets" }, { id: "social", label: "Social Media" }, { id: "memberships", label: "Membership" },
    { id: "ip", label: "Intellectual Property" },
  ] },
  { group: "Strategy (AI)", items: [{ id: "strategy", label: "Recommendations", tag: "soon" }] },
  { group: "Plan", items: [{ id: "settings", label: "Plan settings", tool: true }] },
];

export const GUIDED_STEPS = NAV.flatMap((g) => g.items).filter((i) => i.step).sort((a, b) => a.step! - b.step!);
export function navLabel(id: string) { return NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id; }

/**
 * THE GUIDED PATH, DEFINED ONCE (§6.81).
 *
 * The order lived in two places: these step numbers, and a hard-coded redirect inside each module's "Save
 * and continue". Twelve of them, each a string literal naming the next module, and nothing compared the
 * two. They had already drifted — Marketing (step 3) sent a client straight to SWOT (step 5), skipping
 * Competitors entirely, and had been doing it silently.
 *
 * That is the fault this project keeps finding in new costumes (§6.41): one fact written down twice. So the
 * number is the fact and everything else asks it.
 */
const STEP_IDS = GUIDED_STEPS.map((i) => i.id);

/** The module a client reaches by finishing this one, or null at the end of the path. */
export function stepAfter(id: string): string | null {
  const at = STEP_IDS.indexOf(id);
  return at === -1 || at === STEP_IDS.length - 1 ? null : STEP_IDS[at + 1];
}

/** The module behind this one. Null before the first step — the caller sends those back to the dashboard. */
export function stepBefore(id: string): string | null {
  const at = STEP_IDS.indexOf(id);
  return at <= 0 ? null : STEP_IDS[at - 1];
}

/** Where "Save and continue" goes. The end of the path returns to the dashboard rather than nowhere. */
export const nextHref = (planId: string, id: string) => `/plans/${planId}/${stepAfter(id) ?? "dashboard"}`;
/** Where "Back" goes, with the same rule at the other end. */
export const backHref = (planId: string, id: string) => `/plans/${planId}/${stepBefore(id) ?? "dashboard"}`;
