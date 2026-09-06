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
/** Same lists as APeX, so existing plans read across unchanged. */
export const CUSTOMER_TYPES = ["Agent", "Client", "Customer", "Distributor", "Franchisee", "Licensee", "Member", "Patient", "Patron", "Reseller", "Subscriber"];
export const PRODUCT_TYPES = ["Access", "Applications", "Goods", "Intellectual Property", "Livestock", "Memberships", "Produce", "Products", "Products and services", "Services"].map((x) => ({ value: x, label: x }));
export const COUNTRIES = ["Australia", "New Zealand", "United States", "United Kingdom", "Canada", "Singapore", "Ireland", "South Africa", "India", "Philippines", "Thailand", "Malaysia", "Indonesia", "Other"];
export const CURRENCIES = ["AUD", "NZD", "USD", "GBP", "CAD", "SGD", "EUR", "ZAR", "INR", "PHP", "THB", "MYR", "IDR"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type Profile = {
  business_name: string;
  date_established: string | null;      // ISO date, month precision
  industry: string | null;
  country: string | null;
  legal_structure: string | null;
  customer_type: string | null;
  product_type: string | null;
  products_services_statement: string | null;
};
export type Financial = {
  financial_year_end_month: number;
  first_projected_year: number | null;
  tax_rate: number;
  dividend_rate: number;
  currency: string;
};
export type Settings = Profile & Financial & { logo_path: string | null; plan_year: number };

/** The fields a report's business overview cannot do without. */
export const PROFILE_REQUIRED: (keyof Profile)[] = ["business_name", "industry", "country", "legal_structure", "products_services_statement"];
export const profileMissing = (p: Partial<Profile>) => PROFILE_REQUIRED.filter((k) => !String(p[k] ?? "").trim());
