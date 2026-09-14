/**
 * The plan's own nouns (§6.31).
 *
 * A concreter sells jobs, a physio sells treatments, a grazier sells livestock. Calling all of them
 * "products" is not a cosmetic problem: the words go into a document a lender reads, and a plan that calls
 * a physiotherapist's patients "customers" and her treatments "products" reads as a template she filled in
 * rather than a business she runs.
 *
 * Settings has held `product_type` and `customer_type` since the beginning, and both were stored as a single
 * word. **A word the app has to inflect cannot be stored as one word.** "Services" needs "service" for a
 * column header, "10 services" for a count, and "a service" mid-sentence; "Produce" has none of those, and
 * "Products and services" has no singular at all. Substituting the stored string straight into the UI gives
 * "+ Produce", "10 produce" and "Open a produce to describe it".
 *
 * So each type carries three words. Where a type has no natural singular — a mass noun, or a compound —
 * the singular is **"line"**, which is already this app's word for a row that carries figures, and the
 * header follows it. Nothing has to be dropped from the list to keep the grammar honest.
 *
 * British spelling throughout: programme, licence. The market is Australia, the UK, New Zealand, Singapore,
 * South Africa and India.
 */

export type Noun = {
  /** As it appears in Settings, and as a tab or a plural count: "10 treatments". */
  many: string;
  /** One of them, mid-sentence with an article: "Open a treatment to describe it". */
  one: string;
  /** A dense column header. Usually `one`; "line" where the type has no singular. */
  head: string;
};

/**
 * The three general types first — most plans are one of them — then the trades alphabetically, because a
 * client hunting for their own word scans rather than reads.
 */
export const PRODUCT_NOUNS: Noun[] = [
  { many: "Products", one: "product", head: "Product" },
  { many: "Services", one: "service", head: "Service" },
  { many: "Products and services", one: "line", head: "Line" },
  { many: "Contracts", one: "contract", head: "Contract" },
  { many: "Courses", one: "course", head: "Course" },
  { many: "Crops", one: "crop", head: "Crop" },
  { many: "Goods", one: "line", head: "Line" },
  { many: "Licences", one: "licence", head: "Licence" },
  { many: "Livestock", one: "line", head: "Line" },
  { many: "Memberships", one: "membership", head: "Membership" },
  { many: "Programmes", one: "programme", head: "Programme" },
  { many: "Projects", one: "project", head: "Project" },
  { many: "Subscriptions", one: "subscription", head: "Subscription" },
  { many: "Treatments", one: "treatment", head: "Treatment" },
];

/**
 * Values offered before §6.31, and where a plan holding one now reads.
 *
 * Dropped because none of them inflect and each had a better-spoken twin: nobody plans in "access", an
 * "application" reads as a form before it reads as software, "intellectual property" is a mass noun too wide
 * for a column, and "produce" has no singular. `product_type` is free text, so there is no migration and no
 * enum to rebuild — but a plan saved under an old value must not open with a blank Settings field, so it is
 * mapped on the way in (the §6.29 rule: the reader bridges the deploy).
 */
const RETIRED: Record<string, string> = {
  "Access": "Memberships",
  "Applications": "Subscriptions",
  "Intellectual Property": "Licences",
  "Produce": "Crops",
  // Offered for a day and withdrawn: "job" names one SALE, not one line. A concreter's row is "Driveways"
  // with 30 in the units column — thirty jobs of one job. It also collides with employment, which is exactly
  // how a lender or a grant assessor reads the word, in the document this vocabulary exists to improve.
  "Jobs": "Services",
};

const DEFAULT_PRODUCT = PRODUCT_NOUNS[0];

/** What the client picked, as three usable words. Unknown, retired, missing or misspelt all land somewhere sane. */
export function productNoun(productType: string | null | undefined): Noun {
  const raw = String(productType ?? "").trim();
  if (!raw) return DEFAULT_PRODUCT;
  const value = RETIRED[raw] ?? raw;
  const hit = PRODUCT_NOUNS.find((n) => n.many.toLowerCase() === value.toLowerCase());
  return hit ?? DEFAULT_PRODUCT;
}

/**
 * Every customer type is a singular count noun — Agent, Client, Patient, Subscriber — so unlike the product
 * types these need no table, only agreement. Kept here so there is one pluraliser rather than a copy of it
 * in whichever module happened to need it first.
 */
export const CUSTOMER_NOUNS = [
  "Agent", "Client", "Customer", "Distributor", "Franchisee",
  "Licensee", "Member", "Patient", "Patron", "Reseller", "Subscriber",
];

export function customerNoun(customerType: string | null | undefined): Noun {
  const raw = String(customerType ?? "").trim();
  const hit = CUSTOMER_NOUNS.find((n) => n.toLowerCase() === raw.toLowerCase()) ?? "Customer";
  const one = hit.toLowerCase();
  return { many: `${hit}s`, one, head: hit };
}
