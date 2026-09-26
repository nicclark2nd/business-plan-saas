/** Left-menu model. Guided mode shows the numbered path plus tools; Advanced shows every module. */
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

  /**
   * FIRST, not last (§6.82). Nic: "Plan settings is critical, and being right at the bottom it is sure to
   * never be seen. Most people start at the top. They can do all the numbers and then print the plan and
   * never see it."
   *
   * It carries no number and should not — it is not a step in the story a plan tells. But it sits UPSTREAM
   * of every step: the country decides the sales tax and what it is called, the financial year end decides
   * every month column in the product, and the customer and product words change the labels on Sales, COGS,
   * Break-Even and the profit and loss. Four of its fields are the ones a report cannot open without.
   *
   * At the bottom it read as an afterthought for somebody tidying up. Directly under Dashboard and above
   * step 1, it reads as the thing you set before you start — which is what it is. The §6.80 rule still
   * holds: it is unnumbered, and it is in a group of its own with no numbers in it.
   */
  { group: "Set up", items: [{ id: "settings", label: "Plan settings", tool: true }] },

  // ---- the guided path, 1 to 17, in order -------------------------------
  { group: "Strategy & Direction", items: [{ id: "vision", label: "Vision & Purpose", step: 1 }] },
  { group: "People", items: [{ id: "people", label: "Leadership Team", step: 2 }] },
  { group: "Market", items: [{ id: "marketing", label: "Marketing", step: 3 }, { id: "competitors", label: "Competitors", step: 4 }] },
  /**
   * SWOT on its own, under its own name. It shared a "Goals" heading with Goals, and the two are at
   * opposite ends of the journey — 5 and 14. One heading holding the fifth step and the fourteenth was
   * the single place where the topic order and the step order tore.
   */
  { group: "Strengths & Risks", items: [{ id: "swot", label: "SWOT", step: 5 }] },
  /**
   * Operations (§6.84) — the section every standard business-plan outline asks for and the app could not
   * fill a line of. It sits after the strategy and before the money because that is the order the work
   * happens in: what the business does, then where and how it does it, then what that comes to.
   *
   * Inserting a step renumbered everything after it, and that cost one edit to this file. Before §6.81 it
   * would have meant thirteen hand-written redirects as well, and the odds of getting all thirteen right.
   */
  { group: "Operations", items: [{ id: "operations", label: "Operations", step: 6 }] },
  { group: "Financials", items: [
    { id: "historic", label: "Historic", step: 7 }, { id: "sales", label: "Sales", step: 8 }, { id: "cogs", label: "COGS", step: 9 },
    { id: "overheads", label: "Overheads", step: 10 }, { id: "funding", label: "Funding", step: 11 },
    { id: "assets", label: "Fixed Assets", step: 12 },
    { id: "extraordinary", label: "One-off income & costs", step: 13 },
    /**
     * A NUMBERED STEP (§6.94), which it was not until now.
     *
     * §6.79 filed it with the inputs and left it unnumbered, and named the consequence in this comment
     * without fixing it: "the guided path never forces a client through it is a real gap". It was worse
     * than a gap. A client walking 1 → 16 went 13 One-off costs → 14 Review forecast and never saw this
     * screen, so debtor, stock and creditor days fell back to thirty in, thirty out, nothing in stock —
     * or to whatever last year's accounts implied. Reasonable figures. Nobody agreed to them, and they
     * went into a document a bank reads.
     *
     * Numbering it costs nothing structurally: it was already the last item in Financials, so 14 here and
     * Review at 15 leaves the whole menu still running top to bottom (§6.80).
     */
    { id: "assumptions", label: "Assumptions", step: 14 },
  ] },
  { group: "Review", items: [{ id: "forecast", label: "Review forecast", step: 15 }] },
  { group: "Goals", items: [{ id: "goals", label: "Goals", step: 16, tag: "AI-drafted" }] },
  { group: "Reports", items: [{ id: "reports", label: "Business plan", step: 17, tool: true }] },

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
  { group: "Tools", items: [
    { id: "what-if", label: "What-If Planner", tool: true },
    /*
     * FINANCIAL CAPABILITIES (§6.128) — beside What-If, and for the same reason it is here rather than in
     * the numbered path: it asks the client for nothing the plan does not already hold, and nothing it
     * shows is saved. A tool reads the plan; a step builds it.
     */
    { id: "capabilities", label: "Financial Capabilities", tool: true },
  ] },

  // ---- not built yet, and the settings -----------------------------------
  /**
   * TAGGED, AND ONE OF THEM DELETED (§6.94).
   *
   * These four rendered as ordinary menu items with nothing to mark them, and every one of them landed on
   * "Not built yet". Four things that look available and are not, in a menu whose whole job is telling a
   * client where to go next. Strategy below has always carried a `soon` tag; these did not, and there was
   * no reason for the difference beyond nobody having looked.
   *
   * OUTLETS IS GONE ALTOGETHER, because it was not unbuilt — it was BUILT SOMEWHERE ELSE. `plan_outlets`
   * has a full editor on Operations (§6.84, "Where the work happens") and prints in section 8.1 of the
   * plan. A client who clicked Outlets was sent to a coming-soon page for a screen they had already
   * filled in. A second door to a furnished room is worse than no door: it makes a client doubt the room.
   */
  { group: "Assets", items: [
    { id: "social", label: "Social Media", tag: "soon" }, { id: "memberships", label: "Membership", tag: "soon" },
    { id: "ip", label: "Intellectual Property", tag: "soon" },
  ] },
  { group: "Strategy (AI)", items: [{ id: "strategy", label: "Recommendations", tag: "soon" }] },
];

export const GUIDED_STEPS = NAV.flatMap((g) => g.items).filter((i) => i.step).sort((a, b) => a.step! - b.step!);
/**
 * The group heading a module sits under, DERIVED (§6.85).
 *
 * Every module typed its own group as a string literal, and §6.80 renamed two of them: SWOT moved to
 * "Strengths & Risks" and Review forecast to "Review", while both modules kept printing the old name at the
 * top of the screen. A client reading "STEP 5 OF 16 · GOALS" over a menu item filed under STRENGTHS & RISKS
 * is being told two different things about where they are.
 *
 * Same fault as §6.79 and §6.81, a third time and in a third costume: one fact written down twice. The nav
 * is the fact.
 */
export function navGroup(id: string) {
  return NAV.find((g) => g.items.some((i) => i.id === id))?.group ?? "";
}

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
