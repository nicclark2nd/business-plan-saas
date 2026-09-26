import { CUSTOMER_NOUNS, PRODUCT_NOUNS } from "@/engine/plan/vocabulary";
import type { TaxComponent } from "@/engine/plan/taxRegimes";
/** Plan settings — three small areas (SaaS §6.12): Business profile · Financial year & tax · Branding. */
/**
 * Legal structures, grouped the way a lender thinks about liability. Country-specific names are real options,
 * not variations of "Company", because the report prints the structure verbatim. No "Other": a plan names its entity.
 * `regions` puts the local names first for the plan's country.
 */
export type LegalStructure = { value: string; label: string; regions?: string[] };
export type LegalGroup = { group: string; note: string; items: LegalStructure[] };
export const LEGAL_STRUCTURE_GROUPS: LegalGroup[] = [
  { group: "Sole proprietorship", note: "Owner and business are the same legal person; unlimited personal liability", items: [
    { value: "Sole trader", label: "Sole trader", regions: ["Australia", "New Zealand", "United Kingdom", "Ireland", "South Africa"] },
    { value: "Sole proprietor", label: "Sole proprietor", regions: ["United States", "Canada", "Singapore", "India", "Philippines", "Thailand", "Malaysia", "Indonesia"] },
  ] },
  { group: "Partnership", note: "Two or more owners; professional firms", items: [
    { value: "General partnership", label: "General partnership (GP)" },
    { value: "Limited partnership", label: "Limited partnership (LP)" },
    { value: "Limited liability partnership", label: "Limited liability partnership (LLP)" },
  ] },
  { group: "Private company (limited liability)", note: "Owners' liability capped at their shares; shares not offered to the public", items: [
    { value: "Pty Ltd", label: "Pty Ltd — Proprietary limited", regions: ["Australia", "South Africa"] },
    { value: "Ltd (private)", label: "Ltd — Private limited company", regions: ["United Kingdom", "Ireland", "New Zealand", "India", "Singapore", "Malaysia", "Canada"] },
    { value: "LLC", label: "LLC — Limited liability company", regions: ["United States"] },
    { value: "GmbH", label: "GmbH — Gesellschaft mit beschränkter Haftung" },
    { value: "SARL", label: "SARL — Société à responsabilité limitée" },
    { value: "Private limited company", label: "Private limited company (other jurisdictions)", regions: ["Philippines", "Thailand", "Indonesia"] },
  ] },
  { group: "Corporation (public / large)", note: "Independent legal entity; can raise capital by issuing shares", items: [
    { value: "Ltd (public)", label: "Ltd — Public company", regions: ["Australia", "New Zealand"] },
    { value: "Plc", label: "Plc — Public limited company", regions: ["United Kingdom", "Ireland"] },
    { value: "C-Corporation", label: "Inc. / Corp. — C-Corporation", regions: ["United States"] },
    { value: "S-Corporation", label: "Inc. / Corp. — S-Corporation", regions: ["United States"] },
    { value: "AG", label: "AG — Aktiengesellschaft" },
    { value: "SA", label: "SA — Société anonyme / Sociedad anónima" },
    { value: "Joint-stock company", label: "JSC — Joint-stock company", regions: ["Thailand", "Indonesia"] },
  ] },
  { group: "Trusts and not-for-profits", note: "Common trading structures a bank will ask about", items: [
    { value: "Trust (corporate trustee)", label: "Trust with corporate trustee", regions: ["Australia", "New Zealand"] },
    { value: "Trust (individual trustee)", label: "Trust with individual trustee", regions: ["Australia", "New Zealand"] },
    { value: "Not-for-profit", label: "Not-for-profit / incorporated association" },
    { value: "Co-operative", label: "Co-operative" },
  ] },
];
/** Groups with the plan's country's local names first inside each group. */
export const legalStructuresFor = (country: string | null | undefined): LegalGroup[] =>
  LEGAL_STRUCTURE_GROUPS.map((g) => ({
    ...g,
    items: [...g.items].sort((a, b) => Number(!!b.regions?.includes(country ?? "")) - Number(!!a.regions?.includes(country ?? ""))),
  }));
/**
 * Both lists come from `engine/plan/vocabulary.ts` (§6.31), which holds each type's plural, singular and
 * column header rather than one word — the two fields decide what the whole app calls a line and a buyer, and
 * a word the app has to inflect cannot be stored as one word.
 */
export const CUSTOMER_TYPES = CUSTOMER_NOUNS;
export const PRODUCT_TYPES = PRODUCT_NOUNS.map((n) => ({ value: n.many, label: n.many }));
export const COUNTRIES = ["Australia", "New Zealand", "United States", "United Kingdom", "Canada", "Singapore", "Ireland", "South Africa", "India", "Philippines", "Thailand", "Malaysia", "Indonesia", "Other"];
export const CURRENCIES = ["AUD", "NZD", "USD", "GBP", "CAD", "SGD", "EUR", "ZAR", "INR", "PHP", "THB", "MYR", "IDR"];
/** Calendar order here on purpose: this picks *which* month the financial year ends in. */
export { MONTH_LONG as MONTHS } from "@/engine/plan/calendar";

/**
 * What the BUSINESS is licensed, registered or insured to do (§6.64) — not what a person holds, which
 * stays a `licence` row on that person in Roles & Capability. A contractor licence belongs to the entity:
 * it is what the entity is allowed to do, and when it lapses the business stops trading whoever is on the
 * payroll.
 */
export type Licence = {
  id: string;
  name: string;
  number: string | null;
  issuer: string | null;
  /** ISO date, or null — plenty of registrations never expire, and that is an answer rather than a blank. */
  expires_on: string | null;
  sort_order: number;
};

export type Profile = {
  business_name: string;
  date_established: string | null;      // ISO date, month precision
  industry: string | null;
  country: string | null;
  legal_structure: string | null;
  /** The year on the front cover of the report. Defaults to the year the plan was created; not the calendar. */
  plan_year: number;
  customer_type: string | null;
  product_type: string | null;
  products_services_statement: string | null;
  /**
   * What the cover says about the business (§6.96). All three optional, and each disappears from the cover
   * when it is empty rather than leaving a gap where a line should be.
   */
  tagline: string | null;
  contact_email: string | null;
  website: string | null;
};
export type Financial = {
  financial_year_end_month: number;
  first_projected_year: number | null;
  tax_rate: number;
  dividend_rate: number;
  /** What the business brings in with it (§6.37): unrelieved losses, and accumulated profit or deficit. */
  opening_tax_losses: number;
  opening_retained_earnings: number;
  /** GST / VAT (§6.38). Off by default; nothing in the forecast moves until it is on. */
  gst_registered: boolean;
  gst_rate: number;
  gst_frequency: "monthly" | "quarterly" | "annually";
  /** The state or province, where the tax depends on it — the United States and Canada (§6.39). */
  tax_region: string | null;
  /** The taxes themselves. Empty means "whatever this country and region ordinarily charge". */
  tax_components: TaxComponent[];
  currency: string;
};
/**
 * How the plan prints (§6.93). Two per-plan decisions, because the same consultant writes a bank copy and a
 * board copy in the same week and they are not the same document.
 */
export type Printing = {
  /**
   * Whether the Financial Plan prints each key person's salary against their NAME.
   *
   * It does NOT hide the money, and nothing on the screen may suggest it does: the Leadership Team salaries
   * line still prints in Overheads and the figure still sits in the profit and loss either way. What this
   * controls is attribution.
   */
  print_key_people_salaries: boolean;
  /** null means "whatever this plan's country uses" — the answer for almost every plan (§6.93). */
  page_size: "a4" | "letter" | null;
};
/**
 * Permission to send this plan's words to a model (§6.106).
 *
 * A CONSENT, NOT A PREFERENCE, which is why it is three fields rather than a boolean: `ai_enabled` alone
 * cannot answer "did this client agree, and when", and that is the only question anyone will ever ask.
 * The two records are read-only on the screen — the client sets the switch, the server writes the rest.
 */
export type Ai = {
  ai_enabled: boolean;
  ai_enabled_at: string | null;
  ai_enabled_by: string | null;
};

/**
 * EXIT & SALE (§6.129) — four numbers and a year, and not one of them is a fact about the forecast.
 *
 * An asking price is a POSITION IN A NEGOTIATION. A comparable multiple is somebody else's completed deal.
 * Owner add-backs are an argument a buyer's accountant will have with you line by line. The engine cannot
 * derive any of them and must not pretend to, so they are stored as what the client believes — but they ARE
 * stored, because a price nobody wrote down cannot be argued with, and because these were typed on the
 * Financial Capabilities dashboard and lost on every refresh.
 *
 * All nullable. A blank asking price means the business has not been priced, which is a different state from
 * a price of nothing (§6.89), and the dial that reads it stays grey rather than reporting a business worth $0.
 */
export type Exit = {
  /** Enterprise value being asked. */
  asking_price: number | null;
  /** What businesses like this one have actually changed hands for, as a multiple of normalised EBITDA. */
  multiple_low: number | null;
  multiple_high: number | null;
  /** Which forecast year a sale is aimed at, if the client has said. */
  intended_exit_year: number | null;
};

/**
 * ONE ADD-BACK (§6.129.3). The single "owner add-backs" figure became a list: a buyer's accountant tests
 * add-backs line by line, and a total gave them nothing to test and the profit bridge nothing to draw.
 */
export type AddBack = { id: string; label: string; amount: number; sort_order: number };

export type Settings = Profile & Financial & Printing & Ai & Exit & { logo_path: string | null };

/** The fields a report's business overview cannot do without. */
/** What a report cannot open without. The products & services statement moved to Sales (§6.34). */
export const PROFILE_REQUIRED: (keyof Profile)[] = ["business_name", "industry", "country", "legal_structure"];
export const profileMissing = (p: Partial<Profile>) => PROFILE_REQUIRED.filter((k) => !String(p[k] ?? "").trim());
