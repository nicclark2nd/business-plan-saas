/** Left-menu model. Guided mode shows the numbered 15-step path plus tools; Advanced shows every module. */
export type NavItem = { id: string; label: string; step?: number; advancedLabel?: string; tag?: string; tool?: boolean; href?: string /* deep link into another module's area */ };
export type NavGroup = { group: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { group: "", items: [{ id: "dashboard", label: "Dashboard", tool: true }] },
  { group: "Strategy & Direction", items: [{ id: "vision", label: "Vision & Purpose", step: 1 }] },
  { group: "Assets", items: [
    { id: "outlets", label: "Outlets" }, { id: "social", label: "Social Media" }, { id: "memberships", label: "Membership" },
    { id: "ip", label: "Intellectual Property" },
  ] },
  { group: "People", items: [{ id: "people", label: "Leadership Team", step: 2 }] },
  { group: "Market", items: [{ id: "marketing", label: "Marketing", step: 3 }, { id: "competitors", label: "Competitors", step: 4 }] },
  { group: "Goals", items: [{ id: "swot", label: "SWOT", step: 5 }, { id: "goals", label: "Goals", step: 14, tag: "AI-drafted" }] },
  { group: "Financials", items: [
    { id: "historic", label: "Historic", step: 6 }, { id: "sales", label: "Sales", step: 7 }, { id: "cogs", label: "COGS", step: 8 },
    { id: "overheads", label: "Overheads", step: 9 }, { id: "funding", label: "Funding", step: 10 },
    { id: "assets", label: "Fixed Assets", step: 11 },
    { id: "extraordinary", label: "One-off income & costs", step: 12 },
    /**
     * An input, filed with the inputs (§6.43.1). Debtor, stock and creditor days sat in the Forecasts group,
     * which is a list of things the plan PRODUCES — and they are a thing the client TYPES. It was the only
     * input in that group, which is exactly why it read as not belonging.
     *
     * It lands on the forecast module's fourth tab, because that is where the grid lives and three
     * statements that must agree still belong on one screen. The client does not know or care which module
     * owns it; they know that what they type lives under Financials.
     *
     * A tool rather than a step: the guided path already walks through these at step 13, so this is the
     * door for somebody who wants to change them again afterwards and would never think to look behind a
     * menu item called Profit & Loss.
     */
    { id: "assumptions", label: "Assumptions", href: "forecast?area=assumptions", tool: true },
    { id: "what-if", label: "What-If Planner", tool: true },
  ] },
  /**
   * Five outputs, and nothing else (§6.43.1). Everything in this group is something the plan PRODUCES, which
   * is what makes it a group — the assumptions behind the cash flow are an input and have moved up to
   * Financials with the rest of the inputs.
   *
   * The profit and loss and the balance sheet now have modules of their own (§6.76, §6.77); the cash flow
   * is still a tab on Review forecast, and `href` deep-links its name to the tab it opens. §6.32.3 put all
   * three on one module bar because "three statements that must agree belong on one screen" — what that
   * was protecting was never the adjacency, it was the CHECK, and the reconciliation strip travels to each
   * module that leaves.
   *
   * `href` deep-links each name to the tab it opens. The module bar stays: it switches instantly, with no
   * round trip, which is what somebody comparing two statements is doing all afternoon.
   */
  { group: "Forecasts", items: [
    /**
     * Profit & Loss has its own module now (§6.76), so this no longer answers to that name in Advanced.
     * Step 13 stays here: "whether the plan holds together" is the question the reconciliation strip and
     * three statements side by side answer, and it is not the same question as "what did we earn".
     */
    { id: "profit-loss", label: "Profit & Loss", tool: true },
    /**
     * And the balance sheet, for the same reasons and by the same move (§6.77). It was a tab with a
     * one-line toolbar and a table on it — the statement that says whether the business owns more than it
     * owes, with no tiles, no chart and no reading of the year it actually describes.
     */
    { id: "balance-sheet", label: "Balance Sheet", tool: true },
    { id: "forecast", label: "Review forecast", step: 13 },
    { id: "cash-flow", label: "Cash Flow", href: "forecast?area=cash" },
    /**
     * A TOOL, not a step (§6.68). Guided mode renders an item only if it carries a step number or is
     * flagged a tool, so Break-Even — which had neither — was invisible in the mode every client starts
     * in. It is the only screen in the product with charts on it and the only one with no other door:
     * Cash Flow and Balance Sheet at least survive as tabs on Review forecast. A client would have had to
     * find the Advanced toggle to reach it, which means they would never have reached it.
     *
     * Unit Economics is gone rather than flagged: there is no module behind it. A menu item pointing at a
     * route that does not exist is the §6.43.1 fault, and it survived here because nobody could see it.
     */
    { id: "break-even", label: "Break-Even", tool: true },
  ] },
  { group: "Strategy (AI)", items: [{ id: "strategy", label: "Recommendations", tag: "soon" }] },
  { group: "Reports", items: [{ id: "reports", label: "Business plan", step: 15, tool: true }] },
  { group: "Plan", items: [{ id: "settings", label: "Plan settings", tool: true }] },
];

export const GUIDED_STEPS = NAV.flatMap((g) => g.items).filter((i) => i.step).sort((a, b) => a.step! - b.step!);
export function navLabel(id: string) { return NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id; }
