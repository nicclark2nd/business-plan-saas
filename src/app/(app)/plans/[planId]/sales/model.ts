import type { Growth, MonthlyDistribution } from "@/engine/sales/projection";

/** Sales — three areas (SaaS §6.16): Products · Annual projections · Monthly projections. */
/**
 * The standard product life cycle, and only the standard one (0018). Saturation was offered and is not a
 * stage a lender, grant assessor or accountant recognises - where the term appears at all it is the late
 * plateau of maturity, so carrying both asked the client to split a hair for no gain.
 */
export const LIFECYCLE = [
  { value: "development", label: "Development" }, { value: "introduction", label: "Introduction" }, { value: "growth", label: "Growth" },
  { value: "maturity", label: "Maturity" }, { value: "decline", label: "Decline" },
];

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
  /** Why this price: what it costs to deliver, what the market pays, why it sits there (§6.62). */
  pricing_rationale?: string | null;
  yearly_growth: Growth | null; monthly_distribution: MonthlyDistribution | null; sort_order: number;
  /** Ongoing lines (§6.17): revenue comes from active clients, not from clients won. */
  sold_as: "one_off" | "recurring"; opening_clients: number; client_life_months: number;
  life_mode: "average" | "fixed"; monthly_new_clients: Record<string, number> | null;
  /** Ongoing lines: every unit this product sells becomes a client here (a royalty following licence sales). */
  clients_from_product_id: string | null;
  /** Whether GST/VAT is charged on this line's sales (§6.38). */
  gst_applies: boolean;
};
export const isRecurring = (p: Pick<Product, "sold_as">) => p.sold_as === "recurring";

/**
 * THE TWO PROSE BOXES ON A PRODUCT (\u00a76.113).
 *
 * Lifted out of the dialog's JSX so the drafter can be built from the client's own wording rather than a
 * second copy of it (\u00a76.41) \u2014 the same arrangement Vision and Marketing already have.
 *
 * "Why this price" is NOT here, and that is a decision rather than an oversight: it is the one box on this
 * screen that cannot be written without the figure beside it, and a price is not something the drafter
 * sends (`engine/ai/subject.ts`). It keeps its own markup below, and no button.
 */
export const PRODUCT_PROSE = [
  {
    key: "description", label: "What it is",
    placeholder: "One or two plain sentences \u2014 e.g. Reinforced concrete slabs for new homes, poured and finished by our own crew",
  },
  {
    key: "notes", label: "Why they buy it, margin, weaknesses",
    placeholder: "e.g. Builders choose us on turnaround; margin is thin \u2014 shifting effort to decorative work",
  },
] as const;
export type ProductProseKey = (typeof PRODUCT_PROSE)[number]["key"];
