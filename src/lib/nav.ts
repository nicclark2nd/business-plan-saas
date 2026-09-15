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
    { id: "what-if", label: "What-If Planner", tool: true },
  ] },
  /**
   * Four of these are one module (§6.43). Review forecast holds the profit and loss, the cash flow, the
   * balance sheet and the assumptions on one module bar, because three statements that must agree belong on
   * one screen. But the left menu listed Balance Sheet and Cash Flow as items of their own pointing at
   * routes that do not exist, so a client clicking either was told the module was "next in the build queue"
   * while the real thing sat behind an item labelled Profit & Loss. Assumptions was not listed at all —
   * the one place debtor, stock and creditor days can be edited for all five years, reachable only by
   * opening Profit & Loss and finding a fourth tab.
   *
   * `href` deep-links each name to the tab it actually opens. The menu now says what is there, and every
   * item lands on the thing it is named after.
   */
  { group: "Forecasts", items: [
    { id: "forecast", label: "Review forecast", step: 13, advancedLabel: "Profit & Loss" },
    { id: "cash-flow", label: "Cash Flow", href: "forecast?area=cash" },
    { id: "balance-sheet", label: "Balance Sheet", href: "forecast?area=balance" },
    { id: "assumptions", label: "Assumptions", href: "forecast?area=assumptions" },
    { id: "break-even", label: "Break-Even" }, { id: "unit-economics", label: "Unit Economics" },
  ] },
  { group: "Strategy (AI)", items: [{ id: "strategy", label: "Recommendations", tag: "soon" }] },
  { group: "Reports", items: [{ id: "reports", label: "Business plan", step: 15, tool: true }] },
  { group: "Plan", items: [{ id: "settings", label: "Plan settings", tool: true }] },
];

export const GUIDED_STEPS = NAV.flatMap((g) => g.items).filter((i) => i.step).sort((a, b) => a.step! - b.step!);
export function navLabel(id: string) { return NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id; }
