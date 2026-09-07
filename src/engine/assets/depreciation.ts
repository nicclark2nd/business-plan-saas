/**
 * Fixed assets — what the business owns, and what it writes off each year (§6.20).
 *
 * Two kinds of asset, and only one of them is typed here:
 *   entered  — bought with cash the business already has, or out of an owner injection.
 *   finance  — bought with an equipment or vehicle loan. The purchase price, deposit, life and residual
 *              belong to that Funding row; this module shows the asset and depreciates it, but never
 *              edits it. Same rule as a synced Overheads line (§6.19): the figure belongs to whoever set it.
 *
 * Depreciation is an expense that never moves cash. It reduces profit and it reduces the asset's book value;
 * the cash left the business when the asset was bought (or leaves monthly as loan repayments). Keeping those
 * two apart is the single thing plans get wrong, so the engine returns them separately and never nets them.
 */
import { YEARS } from "../sales/projection";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type AssetSource = "entered" | "finance";
export type DepreciationMethod = "straight_line" | "diminishing";

export type FixedAsset = {
  id?: string;
  name: string;
  source?: AssetSource | null;
  purchase_price: number | null;
  residual_value?: number | null;      // what it is still worth at the end of its life
  useful_life_months?: number | null;
  method?: DepreciationMethod | null;
  start_year?: number | null;          // 1–5; the plan year it is bought
  start_month?: number | null;         // 1–12 within that year; depreciation runs from the month it arrives
};

export const LIFE_PRESETS = [
  { label: "3 years", months: 36 }, { label: "5 years", months: 60 },
  { label: "7 years", months: 84 }, { label: "10 years", months: 120 }, { label: "20 years", months: 240 },
];

const life = (a: FixedAsset) => Math.max(1, Math.trunc(num(a.useful_life_months)) || 60);
const startYear = (a: FixedAsset) => Math.min(5, Math.max(1, Math.trunc(num(a.start_year)) || 1));
const startMonth = (a: FixedAsset) => Math.min(12, Math.max(1, Math.trunc(num(a.start_month)) || 1));

/** The month index (0-based, across the five plan years) the asset arrives and starts depreciating. */
export const firstMonth = (a: FixedAsset) => (startYear(a) - 1) * 12 + (startMonth(a) - 1);

/**
 * Depreciation month by month across the five plan years (60 months).
 *
 * Straight line writes the same amount off every month until the asset reaches its residual — the method
 * every lender and every SBA reviewer expects to see, and the default.
 * Diminishing value writes off a fixed percentage of what is *left*, so the early years carry more. The rate
 * is 200 % / life in years, the standard doubling convention, and it stops at the residual rather than
 * chasing zero forever.
 */
export function depreciationMonths(a: FixedAsset): number[] {
  const out = Array(60).fill(0);
  const price = num(a.purchase_price);
  const residual = Math.min(Math.max(0, num(a.residual_value)), price);
  const depreciable = price - residual;
  if (depreciable <= 0) return out;

  const L = life(a);
  const from = firstMonth(a);
  if (from >= 60) return out;

  if ((a.method ?? "straight_line") === "diminishing") {
    const years = L / 12;
    const monthlyRate = 2 / years / 12;               // 200 % declining balance, spread monthly
    let book = price;
    for (let m = from; m < 60; m++) {
      const charge = Math.min(r2(book * monthlyRate), r2(book - residual));
      if (charge <= 0) break;
      out[m] = charge; book = book - charge;
    }
    return out;
  }

  // The monthly rate is never rounded and then multiplied — that is how 6,000 over 36 months becomes 6,000.12.
  // Each month charges the difference between two running totals, so the write-off lands on the cent exactly.
  const perMonth = depreciable / L;
  let charged = 0;
  for (let m = from, k = 1; m < 60 && k <= L; m++, k++) {
    const target = r2(Math.min(depreciable, perMonth * k));
    const charge = r2(target - charged);
    if (charge <= 0) break;
    out[m] = charge; charged = target;
  }
  return out;
}

/** Depreciation charged in each of the five plan years. */
export function depreciationByYear(a: FixedAsset): number[] {
  const m = depreciationMonths(a);
  return YEARS.map((_, i) => r2(m.slice(i * 12, i * 12 + 12).reduce((x, y) => x + y, 0)));
}

/** What the asset is worth on the books at the end of each plan year — cost less everything written off. */
export function bookValueByYear(a: FixedAsset): number[] {
  const price = num(a.purchase_price);
  const yearly = depreciationByYear(a);
  let written = 0;
  return YEARS.map((year, i) => {
    written = r2(written + yearly[i]);
    return year < startYear(a) ? 0 : r2(price - written);
  });
}

/** What leaves the bank the year the asset is bought — nil for a financed asset, whose cash is the loan. */
export function capexByYear(a: FixedAsset): number[] {
  const out = YEARS.map(() => 0);
  if (a.source === "finance") return out;             // the lender paid; repayments are the cash, not this
  const y = startYear(a);
  out[y - 1] = r2(num(a.purchase_price));
  return out;
}

export type AssetYear = { year: number; depreciation: number; bookValue: number; capex: number };

/** Every asset in the plan, added up. */
export function assetsByYear(assets: FixedAsset[]): AssetYear[] {
  const dep = YEARS.map(() => 0), book = YEARS.map(() => 0), cap = YEARS.map(() => 0);
  for (const a of assets) {
    const d = depreciationByYear(a), b = bookValueByYear(a), c = capexByYear(a);
    for (let i = 0; i < 5; i++) { dep[i] += d[i]; book[i] += b[i]; cap[i] += c[i]; }
  }
  return YEARS.map((year, i) => ({ year, depreciation: r2(dep[i]), bookValue: r2(book[i]), capex: r2(cap[i]) }));
}

/** Year 1 depreciation month by month, for the twelve-month cash flow and P&L. */
export function assetsMonths(assets: FixedAsset[]): number[] {
  const out = Array(12).fill(0);
  for (const a of assets) {
    const m = depreciationMonths(a);
    for (let i = 0; i < 12; i++) out[i] = r2(out[i] + m[i]);
  }
  return out;
}
