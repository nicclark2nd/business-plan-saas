/** Marketing — three data areas (SaaS §6.13): Market · Channels & spend · Evidence. Competitors is its own module (step 4). */
export const MARKET_FIELDS = [
  { key: "target_market", label: "Target market", hint: "Who buys, where, and what they have in common. Name the customer and the area.", placeholder: "e.g. Residential builders and owner-builders within 90 minutes of Wollongong pouring 20–200 m² slabs." },
  { key: "market_size", label: "Market size", hint: "How many of them, and roughly what they spend a year. A sourced estimate beats a precise guess.", placeholder: "e.g. ~1,400 residential slab approvals a year in the Illawarra; ~$28M of concreting work." },
  { key: "market_trends", label: "Market trends", hint: "Where demand is heading across the whole market, and why. What one competitor might do belongs in What could change, on the Competitors step.", placeholder: "e.g. Knock-down-rebuild growing 12% a year; new slab insulation rules from 2027 favour licensed contractors." },
  { key: "customer_needs", label: "Customer needs", hint: "What they are actually buying: speed, certainty, price, finish. What they complain about now.", placeholder: "e.g. Turn up when booked; pour within 10 days of site-ready; a quote that is the final price." },
] as const;
export type MarketKey = (typeof MARKET_FIELDS)[number]["key"];
export type Market = Record<MarketKey, string>;

export const SPEND_KINDS = ["distribution", "advertising", "content", "sales_promotion", "public_relations", "partnerships", "retention"] as const;
export type SpendKind = (typeof SPEND_KINDS)[number];
export const SPEND_LABEL: Record<SpendKind, string> = {
  distribution: "Distribution channel", advertising: "Advertising", content: "Content marketing", sales_promotion: "Sales promotion",
  public_relations: "Public relations", partnerships: "Partnerships & referrals", retention: "Customer retention & loyalty",
};

/** Plan-level: the moat and the horizon (SBA competitive analysis §4–5). Stored on plan_marketing. */
export const POSITION_FIELDS = [
  { key: "our_advantage", label: "Our advantage", hint: "Why a customer picks you rather than one of the rows below. It only means something said against them. What you guarantee everyone, competitor or not, is your Brand promise on step 1; what stops them copying you is Barriers to entry, below.", placeholder: "e.g. Builders pick us over Costa because we pour after hours, so their trades are not held up a day." },
  { key: "barriers_to_entry", label: "Barriers to entry", hint: "What stops a competitor copying you next week — licences, relationships, skills, contracts, location.", placeholder: "e.g. QBCC open licence; 11-year builder relationships; exclusive supply deal with Boral for after-hours pours." },
  { key: "future_threats", label: "What could change", hint: "What would let one of the rows above beat you — a new entrant, a licence you lack, a deal you could lose. Where the market as a whole is heading is Market trends, on the Marketing step. Seeds the Threats in SWOT.", placeholder: "e.g. A national franchise opening a Wollongong depot; losing the after-hours supply deal." },
] as const;
export type PositionKey = (typeof POSITION_FIELDS)[number]["key"];
export type Position = Record<PositionKey, string>;

export const COMPETITOR_KIND = [{ value: "direct", label: "Direct" }, { value: "indirect", label: "Indirect" }];
export const COMPETITOR_REACH = [{ value: "local", label: "Local" }, { value: "regional", label: "Regional" }, { value: "national", label: "National" }, { value: "online", label: "Online" }];
export const COMPETITOR_PRICING = [{ value: "much_lower", label: "Much lower" }, { value: "lower", label: "A little lower" }, { value: "same", label: "About the same" }, { value: "higher", label: "A little higher" }, { value: "much_higher", label: "Much higher" }];
export const COMPETITOR_THREAT = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }];
export type Competitor = {
  id: string; name: string; kind: "direct" | "indirect"; reach: string | null; pricing: string | null; threat: "low" | "medium" | "high" | "critical";
  strengths: string | null; weaknesses: string | null; how_we_win: string | null; sort_order: number;
};
export type Spend = { id: string; kind: SpendKind; approach: string; annual_budget: number; sort_order: number };
export type Evidence = { id: string; source: string; finding: string | null; occurred_on: string | null; sort_order: number };
export type MarketingData = { market: Market; spend: Spend[]; evidence: Evidence[] };
