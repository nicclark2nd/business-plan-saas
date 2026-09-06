/** Left-menu model. Guided mode shows the numbered 12-step path plus tools; Advanced shows every module. */
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
  { group: "Market", items: [{ id: "marketing", label: "Marketing", step: 3 }, { id: "competitors", label: "Competitors", href: "marketing?area=competitors" }] },
  { group: "Goals", items: [{ id: "swot", label: "SWOT", step: 4 }, { id: "goals", label: "Goals", step: 11, tag: "AI-drafted" }] },
  { group: "Financials", items: [
    { id: "historic", label: "Historic", step: 5 }, { id: "sales", label: "Sales", step: 6 }, { id: "cogs", label: "COGS", step: 7 },
    { id: "overheads", label: "Overheads", step: 8 }, { id: "funding", label: "Funding", step: 9 },
    { id: "extraordinary", label: "Extraordinary" }, { id: "what-if", label: "What-If Planner", tool: true },
  ] },
  { group: "Forecasts", items: [
    { id: "forecast", label: "Review forecast", step: 10, advancedLabel: "Profit & Loss" },
    { id: "break-even", label: "Break-Even" }, { id: "balance-sheet", label: "Balance Sheet" },
    { id: "cash-flow", label: "Cash Flow" }, { id: "unit-economics", label: "Unit Economics" },
  ] },
  { group: "Strategy (AI)", items: [{ id: "strategy", label: "Recommendations", tag: "soon" }] },
  { group: "Reports", items: [{ id: "reports", label: "Business plan", step: 12, tool: true }] },
  { group: "Plan", items: [{ id: "settings", label: "Plan settings", tool: true }] },
];

export const GUIDED_STEPS = NAV.flatMap((g) => g.items).filter((i) => i.step).sort((a, b) => a.step! - b.step!);
export function navLabel(id: string) { return NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id; }
