/** Plan settings — three small areas (SaaS §6.12): Business profile · Financial year & tax · Branding. */
export const LEGAL_STRUCTURES = ["Sole trader", "Partnership", "Company", "Trust", "Not-for-profit", "LLC", "Corporation", "Other"];
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
