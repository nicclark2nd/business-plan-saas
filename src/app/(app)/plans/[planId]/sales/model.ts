import type { Growth, MonthlyDistribution } from "@/engine/sales/projection";

/** Sales — three areas (SaaS §6.16): Products · Growth · Seasonality. */
export const LIFECYCLE = [
  { value: "development", label: "Development" }, { value: "introduction", label: "Introduction" }, { value: "growth", label: "Growth" },
  { value: "maturity", label: "Maturity" }, { value: "saturation", label: "Saturation" }, { value: "decline", label: "Decline" },
];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Product = {
  id: string; name: string; description: string | null; notes: string | null; lifecycle: string | null;
  average_price: number; units_sold: number; start_selling_year: number;
  yearly_growth: Growth | null; monthly_distribution: MonthlyDistribution | null; sort_order: number;
};
