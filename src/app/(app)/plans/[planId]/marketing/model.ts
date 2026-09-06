/** Marketing — four data areas (SaaS §6.13): Market · Competitors · Channels & spend · Evidence. */
export const MARKET_FIELDS = [
  { key: "target_market", label: "Target market", hint: "Who buys, where, and what they have in common. Name the customer and the area.", placeholder: "e.g. Residential builders and owner-builders within 90 minutes of Wollongong pouring 20–200 m² slabs." },
  { key: "market_size", label: "Market size", hint: "How many of them, and roughly what they spend a year. A sourced estimate beats a precise guess.", placeholder: "e.g. ~1,400 residential slab approvals a year in the Illawarra; ~$28M of concreting work." },
  { key: "market_trends", label: "Market trends", hint: "What is changing that helps or hurts — demand, regulation, technology, costs.", placeholder: "e.g. Knock-down-rebuild growing 12% a year; new slab insulation rules from 2027 favour licensed contractors." },
  { key: "customer_needs", label: "Customer needs", hint: "What they are actually buying: speed, certainty, price, finish. What they complain about now.", placeholder: "e.g. Turn up when booked; pour within 10 days of site-ready; a quote that is the final price." },
  { key: "positioning", label: "Positioning (optional)", hint: "How you want to be seen against the others — one line.", placeholder: "e.g. The dependable one: quoted price, quoted date, every time." },
] as const;
export type MarketKey = (typeof MARKET_FIELDS)[number]["key"];
export type Market = Record<MarketKey, string>;

export const SPEND_KINDS = ["distribution", "advertising", "content", "sales_promotion", "public_relations", "partnerships", "retention"] as const;
export type SpendKind = (typeof SPEND_KINDS)[number];
export const SPEND_LABEL: Record<SpendKind, string> = {
  distribution: "Distribution channel", advertising: "Advertising", content: "Content marketing", sales_promotion: "Sales promotion",
  public_relations: "Public relations", partnerships: "Partnerships & referrals", retention: "Customer retention & loyalty",
};

export type Competitor = { id: string; name: string; strengths: string | null; weaknesses: string | null; how_we_win: string | null; sort_order: number };
export type Spend = { id: string; kind: SpendKind; approach: string; annual_budget: number; sort_order: number };
export type Evidence = { id: string; source: string; finding: string | null; occurred_on: string | null; sort_order: number };
export type MarketingData = { market: Market; competitors: Competitor[]; spend: Spend[]; evidence: Evidence[] };
