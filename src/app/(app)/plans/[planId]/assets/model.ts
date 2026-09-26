import type { AssetSource, DepreciationMethod } from "@/engine/assets/depreciation";

/** Fixed Assets — one list, one dialog (SaaS §6.20). */

export type AssetRow = {
  id: string; name: string; source: AssetSource;
  funding_debt_id: string | null;
  category: string | null;
  purchase_price: number; residual_value: number;
  useful_life_months: number; method: DepreciationMethod;
  start_year: number; start_month: number;
  /** Owned before the plan began (§6.55): worth, not cost; life left, not life; and no cash moves. */
  already_owned: boolean;
  /** The month it was sold, 0-based across the five plan years, from the one-off that names it (§6.56). */
  sold_in_month?: number | null;
  /**
   * What a lender would actually advance against it (§6.129) — NOT its book value, which the balance sheet
   * already holds and which is the wrong number: a bank lends a fraction of what plant is worth and nothing
   * at all against a fit-out. Null means nobody has said, and loan-to-value stays unanswerable rather than
   * reading zero across a shed full of machinery (§6.89).
   */
  security_value: number | null;
  notes: string | null; gst_applies: boolean; sort_order: number;
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
