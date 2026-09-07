import type { AssetSource, DepreciationMethod } from "@/engine/assets/depreciation";

/** Fixed Assets — one list, one dialog (SaaS §6.20). */

export type AssetRow = {
  id: string; name: string; source: AssetSource;
  funding_debt_id: string | null;
  category: string | null;
  purchase_price: number; residual_value: number;
  useful_life_months: number; method: DepreciationMethod;
  start_year: number; start_month: number;
  notes: string | null; sort_order: number;
};

export const METHODS: { value: DepreciationMethod; label: string }[] = [
  { value: "straight_line", label: "Straight line" },
  { value: "diminishing", label: "Diminishing value" },
];

export const CATEGORIES = ["Vehicle", "Equipment", "Plant & machinery", "Computers & IT", "Furniture & fit-out", "Buildings", "Other"];

/** Sensible lives, so nobody has to guess in months. */
export const LIVES = [
  { months: 36, label: "3 years" }, { months: 48, label: "4 years" }, { months: 60, label: "5 years" },
  { months: 84, label: "7 years" }, { months: 120, label: "10 years" }, { months: 240, label: "20 years" },
];
export const lifeLabel = (m: number) => LIVES.find((l) => l.months === m)?.label ?? `${Math.round((m / 12) * 10) / 10} years`;
