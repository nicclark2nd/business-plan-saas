import type { Growth, MonthlyDistribution } from "@/engine/sales/projection";

/** Sales — three areas (SaaS §6.16): Products · Annual projections · Monthly projections. */
export const LIFECYCLE = [
  { value: "development", label: "Development" }, { value: "introduction", label: "Introduction" }, { value: "growth", label: "Growth" },
  { value: "maturity", label: "Maturity" }, { value: "saturation", label: "Saturation" }, { value: "decline", label: "Decline" },
];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** How a line is sold. A one-off job is invoiced when delivered; an ongoing client keeps paying. */
export const SOLD_AS = [
  { value: "one_off", label: "One-off job" },
  { value: "recurring", label: "Ongoing client" },
];
/** Default is "as a set programme": a client who signs stays the term, so the months add up the way a planner
 *  counts them by hand. Drift is one click away for a book that genuinely churns from the first month. */
export const LIFE_MODE = [
  { value: "fixed", label: "as a set programme" },
  { value: "average", label: "on average" },
];

export type Product = {
  id: string; name: string; description: string | null; notes: string | null; lifecycle: string | null;
  average_price: number; units_sold: number; start_selling_year: number;
  yearly_growth: Growth | null; monthly_distribution: MonthlyDistribution | null; sort_order: number;
  /** Ongoing lines (§6.17): revenue comes from active clients, not from clients won. */
  sold_as: "one_off" | "recurring"; opening_clients: number; client_life_months: number;
  life_mode: "average" | "fixed"; monthly_new_clients: Record<string, number> | null;
  /** Ongoing lines: every unit this product sells becomes a client here (a royalty following licence sales). */
  clients_from_product_id: string | null;
};
export const isRecurring = (p: Pick<Product, "sold_as">) => p.sold_as === "recurring";
