import type { MonthlyDistribution } from "@/engine/sales/projection";
import type { Product } from "../sales/model";

/** COGS — two areas (SaaS §6.18): By product · Fixed costs. */

/** A product carries its own direct cost; `cost_per_unit` is per job, or per client per year for an ongoing line. */
export type CostedProduct = Product & { cost_per_unit: number; yearly_cost_increase: Record<string, number> | null };

export type FixedCogs = {
  id: string; item_name: string; annual_cost: number;
  yearly_growth_rates: Record<string, number> | null;
  monthly_distribution: MonthlyDistribution | null;
  sort_order: number;
};
