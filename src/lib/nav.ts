/** Left-menu model. Guided mode shows the numbered 13-step path plus tools; Advanced shows every module. */
export type NavItem = { id: string; label: string; step?: number; advancedLabel?: string; tag?: string; tool?: boolean; href?: string /* deep link into another module's area */ };
export type NavGroup = { group: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { group: "", items: [{ id: "dashboard", label: "Dashboard", tool: true }] },
  { group: "Strategy & Direction", items: [{ id: "vision", label: "Vision & Purpose", step: 1 }] },
  { group: "Assets", items: [
    { id: "outlets", label: "Outlets" }, { id: "social", label: "Social Media" }, { id: "memberships", label: "Membership" },
    { id: "ip", label: "Intellectual Property" }, { id: "equipment", label: "Capital Equipment" },
  ] },
  { group: "People", items: [{ id: "people", label: "Leadership Team", step: 2 }] },
  { group: "Market", items: [{ id: "marketing", label: "Marketing", step: 3 }, { id: "competitors", label: "Competitors", step: 4 }] },
  { group: "Goals", items: [{ id: "swot", label: "SWOT", step: 5 }, { id: "goals", label: "Goals", step: 12, tag: "AI-drafted" }] },
  { group: "Financials", items: [
    { id: "historic", label: "Historic", step: 6 }, { id: "sales", label: "Sales", step: 7 }, { id: "cogs", label: "COGS", step: 8 },
    { id: "overheads", label: "Overheads", step: 9 }, { id: "funding", label: "Funding", step: 10 },
    { id: "extraordinary", label: "Extraordinary" }, { id: "what-if", label: "What-If Planner", tool: true },
  ] },
  { group: "Forecasts", items: [
    { id: "forecast", label: "Review forecast", step: 11, advancedLabel: "Profit & Loss" },
    { id: "break-even", label: "Break-Even" }, { id: "balance-sheet", label: "Balance Sheet" },
    { id: "cash-flow", label: "Cash Flow" }, { id: "unit-economics", label: "Unit Economics" },
  ] },
  { group: "Strategy (AI)", items: [{ id: "strategy", label: "Recommendations", tag: "soon" }] },
  { group: "Reports", items: [{ id: "reports", label: "Business plan", step: 13, tool: true }] },
  { group: "Plan", items: [{ id: "settings", label: "Plan settings", tool: true }] },
];

export const GUIDED_STEPS = NAV.flatMap((g) => g.items).filter((i) => i.step).sort((a, b) => a.step! - b.step!);
export function navLabel(id: string) { return NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id; }
