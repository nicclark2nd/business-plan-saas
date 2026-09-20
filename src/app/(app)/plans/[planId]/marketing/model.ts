/** Marketing — three data areas (SaaS §6.13): Market · Channels & spend · Evidence. Competitors is its own module (step 4). */
/**
 * The market itself — the size and the direction of travel. Who buys is a SEGMENT now (§6.62), because one
 * box could not hold a business with a commercial arm and a residential one, and three boxes asking the
 * same question in different words held it worse.
 */
export const MARKET_FIELDS = [
  { key: "market_size", label: "Market size", hint: "How many buyers there are, and roughly what they spend a year. A sourced estimate beats a precise guess.", placeholder: "e.g. ~1,400 residential slab approvals a year in the Illawarra; ~$28M of concreting work." },
  { key: "market_trends", label: "Market trends", hint: "Where demand is heading across the whole market, and why. What one competitor might do belongs in What could change, on the Competitors step.", placeholder: "e.g. Knock-down-rebuild growing 12% a year; new slab insulation rules from 2027 favour licensed contractors." },
] as const;

/** Where the business sits in its market (§6.61). Not the same question as Our advantage on Competitors. */
export const POSITION_ONE_LINER = {
  key: "positioning", label: "How you want to be seen",
  hint: "Premium, mid, no-frills, specialist. Where you sit against the whole market \u2014 why a customer picks you over one NAMED competitor is Our advantage, on the Competitors step.",
  placeholder: "e.g. The premium option: more expensive than the two-man crews, and the one builders use when the pour cannot go wrong.",
} as const;

/** The brand platform, less its purpose \u2014 that is Vision & Purpose at step 1 (\u00a76.61). */
export const BRAND_FIELDS = [
  { key: "brand_values", label: "What the business stands for", hint: "Three or four things that are true even when they cost you money. A value nobody could disagree with is not a value.", placeholder: "e.g. We quote the final price. We turn up when we said. We fix our own mistakes before anyone asks." },
  { key: "brand_personality", label: "How it sounds", hint: "How the business talks to a customer \u2014 in an ad, on the phone, in a quote.", placeholder: "e.g. Plain, direct, no sales talk. We answer the question that was asked and we do not oversell." },
  { key: "visual_identity", label: "How it looks", hint: "Colours, logo, vehicles, signage, workwear \u2014 what a customer recognises before they read anything.", placeholder: "e.g. Charcoal and safety orange; logo on both truck doors and every crew shirt; photo of the finished pour on every invoice." },
] as const;

/**
 * Marketing brings them to the door; this is what happens next (\u00a76.61). The first label carries the plan's
 * own noun (\u00a76.31.1): a clinic does not win "jobs" and neither does a software business.
 */
export const salesFields = (one: string) => [
  { key: "sales_process", label: `How ${/^[aeiou]/i.test(one) ? "an" : "a"} ${one} is won`, hint: `Step by step, from the first contact to a signed ${one}. The steps, who does each, and how long each takes.`, placeholder: "e.g. Call back within 2 hours \u2192 site visit inside 3 days \u2192 fixed-price quote within 24 hours of the visit \u2192 follow-up call on day 3 \u2192 deposit and booked date." },
  { key: "sales_team", label: "Who sells, and what they need", hint: "Who handles enquiries and quotes, and what they need to do it \u2014 training, a quoting tool, a price book.", placeholder: "e.g. Nic quotes everything today. Mary takes first calls from Q2 and needs the estimating template and two days with Nic." },
] as const;
export const SALES_KEYS = ["sales_process", "sales_team"] as const;

/**
 * One row per kind of buyer (\u00a76.62). A sole trader writes one and it reads like the old single box; a
 * business with two arms writes two and stops describing both in one paragraph.
 */
export type Segment = { id: string; name: string; profile: string | null; cares_about: string | null; revenue_share: number | null; sort_order: number };

export const NARRATIVE_FIELDS = [POSITION_ONE_LINER, ...BRAND_FIELDS, ...salesFields("job")] as const;
export type NarrativeKey = (typeof NARRATIVE_FIELDS)[number]["key"];

export type MarketKey = (typeof MARKET_FIELDS)[number]["key"] | NarrativeKey;
export type Market = Record<MarketKey, string>;

/** Every field stored on plan_marketing that this module writes. */
export const ALL_MARKET_KEYS = [...MARKET_FIELDS.map((f) => f.key), ...NARRATIVE_FIELDS.map((f) => f.key)] as MarketKey[];

/**
 * WHICH OF THESE BOXES A MODEL MAY DRAFT (\u00a76.109).
 *
 * The five statements of intent about THIS business. The three left out are left out on purpose:
 * `market_size` and `market_trends` are facts about the world, which a model will supply confidently and
 * without a source \u2014 the one thing an assessor reading this section is checking for; and `sales_team`
 * names people, which no slice of the plan is allowed to read (`engine/ai/slices.ts`).
 *
 * Kept here, next to the fields themselves, so the decision is read alongside what it applies to. What
 * each of the five wants to know, and what it always asks, is in `engine/ai/fields.ts`.
 */
export const DRAFTABLE_MARKET_KEYS: readonly MarketKey[] = [
  POSITION_ONE_LINER.key, ...BRAND_FIELDS.map((f) => f.key), "sales_process",
];

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
export type Evidence = {
  id: string; source: string; finding: string | null; occurred_on: string | null; sort_order: number;
  /** How the question was answered, and what the business will DO about the answer (§6.61). */
  method: string | null; decision: string | null;
};
export type MarketingData = { market: Market; spend: Spend[]; evidence: Evidence[]; segments: Segment[] };
