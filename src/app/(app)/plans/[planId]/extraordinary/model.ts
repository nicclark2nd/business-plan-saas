import type { ExtraordinaryCategory } from "@/engine/extraordinary/items";

/** One-off income & costs — two areas (SaaS §6.23): One-offs · Monthly projections. */
export type ExtraordinaryRow = {
  id: string;
  description: string;
  category: ExtraordinaryCategory;
  amount: number;
  year: number;                 // plan year 1–5
  month: number;                // 1–12, a slot in the plan year
  source_asset_id: string | null;
  notes: string | null;
  sort_order: number;
};

export const CATEGORIES: { value: ExtraordinaryCategory; label: string }[] = [
  { value: "income", label: "Money in" },
  { value: "expense", label: "Money out" },
];

/**
 * Prompts, because "extraordinary item" is the one phrase on this screen a business owner will not
 * recognise, and a blank box with no examples is how a plan ends up missing the 25,000 fit-out.
 */
export const EXAMPLES = [
  "Insurance settlement",
  "Sold a vehicle or machine",
  "Office or premises fit-out",
  "Legal and registration for a new site",
  "Feasibility study",
  "Restructure or share sale costs",
  "Redundancy payout",
  "Grant clawback",
];
