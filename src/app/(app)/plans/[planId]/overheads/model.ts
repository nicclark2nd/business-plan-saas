import type { MonthlyDistribution } from "@/engine/sales/projection";
import type { OverheadSource } from "@/engine/overheads/expenses";

/** Overheads — one list (SaaS §6.19). Two lines are synced from the module that owns them. */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type OverheadRow = {
  id: string; name: string; source: OverheadSource; current_value: number;
  yearly_change: Record<string, number> | null;
  monthly_distribution: MonthlyDistribution | null;
  start_year: number; on_cost: boolean; sort_order: number;
};

export const SOURCE_LABEL: Record<OverheadSource, string> = {
  entered: "", people: "Leadership Team", marketing: "Marketing",
};
/** Where a synced line's number is set, and where the chain takes you. */
export const SOURCE_STEP: Record<OverheadSource, string> = {
  entered: "", people: "people", marketing: "marketing",
};
