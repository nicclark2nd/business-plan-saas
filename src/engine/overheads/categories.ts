/**
 * What kind of overhead a line is (§6.93) — the eight groups a lender reads an expense schedule in.
 *
 * ONE LIST. The database holds the key and checks it (0041); this file holds the words, the order they
 * print in, and which ones the two synced lines take. A second copy of "the categories" anywhere else is
 * the fault this project keeps relearning (§6.19), and it would show up as a plan whose group headings
 * disagreed with the screen that set them.
 *
 * WHY A FIXED LIST RATHER THAN FREE TEXT. The column has been free `text` since 0003. Left that way, three
 * clients type "Rent", "rent" and "Premises" and the plan prints three groups of one — a grouped table whose
 * groups are typos, which is worse for the reader than the flat table it replaced.
 *
 * WHY NOTHING IS DEFAULTED. A line with no category is uncategorised, prints under Other, and says so on
 * the screen. Guessing one from the line's name ("Rent" → Premises) would be the app inventing structure in
 * the client's name — §6.89 with better manners, and still wrong.
 */
import type { OverheadSource } from "./expenses";

export const OVERHEAD_CATEGORIES = [
  { value: "premises", label: "Premises", hint: "Rent, rates, power, water, cleaning, security" },
  { value: "people_admin", label: "People & admin", hint: "Admin wages, recruitment, training, uniforms" },
  { value: "sales_marketing", label: "Sales & marketing", hint: "Advertising, sponsorship, print, events" },
  { value: "vehicles_travel", label: "Vehicles & travel", hint: "Fuel, registration, servicing, travel, accommodation" },
  { value: "technology", label: "Technology & communications", hint: "Software, phones, internet, IT support" },
  { value: "professional_insurance", label: "Professional & insurance", hint: "Accounting, legal, consulting, insurance, bank charges" },
  { value: "operating_equipment", label: "Operating & equipment", hint: "Repairs, maintenance, consumables, plant hire" },
  { value: "other", label: "Other", hint: "Anything the seven above do not describe" },
] as const;

export type OverheadCategory = (typeof OVERHEAD_CATEGORIES)[number]["value"];

const KEYS = OVERHEAD_CATEGORIES.map((c) => c.value) as readonly string[];
export const CATEGORY_LABEL: Record<string, string> =
  Object.fromEntries(OVERHEAD_CATEGORIES.map((c) => [c.value, c.label]));

/** The order group headings print in — the order of the list above, with Other last because it already is. */
export const CATEGORY_ORDER: Record<string, number> =
  Object.fromEntries(OVERHEAD_CATEGORIES.map((c, i) => [c.value, i]));

/** Anything that is not one of the eight is not a category. A stored typo reads as uncategorised, never as a group. */
export const normalizeCategory = (v: unknown): OverheadCategory | null => {
  const s = String(v ?? "").trim();
  return (KEYS.includes(s) ? s : null) as OverheadCategory | null;
};

/**
 * The two synced lines take their category from what they ARE, and it cannot be typed over — the same rule
 * their figures follow. Salaries are people; the marketing budget is marketing. Asking a client to categorise
 * a line they cannot edit would be a field that is not a promise (§6.87 inverted).
 */
export const categoryForSource = (source: OverheadSource): OverheadCategory | null =>
  source === "people" ? "people_admin" : source === "marketing" ? "sales_marketing" : null;

/** The label a row prints under, uncategorised included. Only ever one answer for a row (§6.41). */
export const categoryLabelFor = (category: string | null | undefined, source: OverheadSource = "entered"): string => {
  const key = categoryForSource(source) ?? normalizeCategory(category);
  return key ? CATEGORY_LABEL[key] : CATEGORY_LABEL.other;
};

/**
 * Group a set of lines for printing. Returns groups in list order, each with its rows and total.
 *
 * `grouped` is false until a client has categorised something, and then the caller must print the flat table
 * it printed before. That is the §6.89 rule kept: no client sees structure until a client has made some.
 *
 * WHAT COUNTS AS "A CLIENT HAS CATEGORISED SOMETHING" IS THE ENTERED LINES ONLY. The two synced lines get
 * their category automatically, so counting them would mean every plan in the product groups — and a plan
 * where nobody has touched a category prints People & admin, Sales & marketing, and twelve lines under
 * Other. That is not a grouped table, it is a flat table with three headings in it, and it is §6.89 again
 * in better clothes: structure the client did not ask for. It was visible the moment a real plan was on
 * the screen and invisible in every unit test, which is the argument for verifying on real data (§6.89).
 */
export function groupByCategory<T extends { category?: string | null; source?: OverheadSource; amount: number }>(rows: T[]) {
  const keyOf = (r: T) => categoryForSource(r.source ?? "entered") ?? normalizeCategory(r.category) ?? "other";
  const grouped = rows.some((r) => (r.source ?? "entered") === "entered" && normalizeCategory(r.category) !== null);
  const seen = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    seen.set(k, [...(seen.get(k) ?? []), r]);
  }
  const groups = [...seen.entries()]
    .sort((a, b) => (CATEGORY_ORDER[a[0]] ?? 99) - (CATEGORY_ORDER[b[0]] ?? 99))
    .map(([key, items]) => ({
      key, label: CATEGORY_LABEL[key] ?? CATEGORY_LABEL.other, rows: items,
      total: Number(items.reduce((t, r) => t + (Number(r.amount) || 0), 0).toFixed(2)),
    }));
  return { grouped, groups };
}
