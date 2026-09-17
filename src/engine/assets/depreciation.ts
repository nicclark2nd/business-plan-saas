/**
 * Fixed assets — what the business owns, and what it writes off each year (§6.20).
 *
 * Three kinds of asset, and only one of them has its figures typed elsewhere:
 *   already owned — the business had it before the plan began (§6.55). Its "price" is what it is WORTH now
 *              and its "life" is what is LEFT of one. No cash moves for it and it adds nothing to the
 *              balance sheet, because the opening figure from Historic already contains it — but it
 *              depreciates from Year 1, which the single opening lump never did, and it can be sold.
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
  /** Owned before the plan began (§6.55): no cash, no addition, but it wears out from Year 1 like anything else. */
  already_owned?: boolean | null;
  /**
   * The month it was SOLD, 0-based across the five plan years, or null while the business still has it
   * (§6.56). Not a stored column: the disposal lives on the one-off that names this asset, and the loader
   * attaches it here with `withDisposals` so there is one answer to "when did it go" rather than two.
   */
  sold_in_month?: number | null;
  /** False where no tax is charged on the purchase — a private sale, an exempt import (§6.38). */
  gst_applies?: boolean | null;
};

export const LIFE_PRESETS = [
  { label: "3 years", months: 36 }, { label: "5 years", months: 60 },
  { label: "7 years", months: 84 }, { label: "10 years", months: 120 }, { label: "20 years", months: 240 },
];

const life = (a: FixedAsset) => Math.max(1, Math.trunc(num(a.useful_life_months)) || 60);
const startYear = (a: FixedAsset) => Math.min(5, Math.max(1, Math.trunc(num(a.start_year)) || 1));
const startMonth = (a: FixedAsset) => Math.min(12, Math.max(1, Math.trunc(num(a.start_month)) || 1));

/** The month index (0-based, across the five plan years) the asset arrives and starts depreciating. */
export const owned = (a: FixedAsset) => a.already_owned === true;

/** Something already owned is already here: it starts wearing out in the plan's first month, not when bought. */
export const firstMonth = (a: FixedAsset) => (owned(a) ? 0 : (startYear(a) - 1) * 12 + (startMonth(a) - 1));

/**
 * The month the asset leaves, or 60 if it never does (§6.56).
 *
 * A sold machine stops wearing out. The engine used to depreciate every asset for its whole life whatever
 * else the plan said, so a lathe sold in Year 1 went on costing the profit 5,000 a year through Years 2, 3
 * and 4 — depreciation on a machine that was not in the shed. Worse, the three statements still agreed with
 * each other, because the same false charge came off the balance sheet as came off the profit: internally
 * consistent and factually wrong, which is the hardest kind of fault to see.
 *
 * Depreciation runs up to the START of the month of the sale and no further, so what the disposal takes off
 * the books is what was still on them the day it went.
 */
export const soldMonth = (a: FixedAsset) => {
  const m = a.sold_in_month;
  if (typeof m !== "number" || !Number.isFinite(m)) return 60;
  return Math.min(60, Math.max(0, Math.trunc(m)));
};

/** Attach each asset's disposal month, from the map the one-offs publish (`soldMonthByAsset`). */
export function withDisposals<A extends FixedAsset>(assets: A[], sold: Record<string, number>): A[] {
  return assets.map((a) => (a.id && sold[a.id] !== undefined ? { ...a, sold_in_month: sold[a.id] } : a));
}

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
  const until = soldMonth(a);                       // it stops wearing out the month it is sold (§6.56)
  if (from >= 60 || from >= until) return out;

  if ((a.method ?? "straight_line") === "diminishing") {
    const years = L / 12;
    const monthlyRate = 2 / years / 12;               // 200 % declining balance, spread monthly
    let book = price;
    for (let m = from; m < until; m++) {
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
  for (let m = from, k = 1; m < until && k <= L; m++, k++) {
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
  const goneAfter = Math.floor(soldMonth(a) / 12);   // the plan year the sale happens in, 0-based
  let written = 0;
  return YEARS.map((year, i) => {
    written = r2(written + yearly[i]);
    if (i >= goneAfter) return 0;                    // sold: it is not on the books at the end of this year
    return year < startYear(a) ? 0 : r2(price - written);
  });
}

/**
 * What the asset is worth on the books the day it leaves — cost less everything written off up to the month
 * of the sale (§6.56). This is the figure the disposal is measured against: proceeds above it are a gain,
 * proceeds below it a loss. It is computed here, from the same monthly series the P&L charges, so the gain
 * and the depreciation can never be two readings of one asset.
 */
export function bookValueAtDisposal(a: FixedAsset): number {
  const m = soldMonth(a);
  if (m >= 60) return 0;
  const charged = depreciationMonths(a).slice(0, m).reduce((x, y) => x + y, 0);
  return r2(num(a.purchase_price) - charged);
}

/**
 * What leaves the bank the year the asset is bought (§6.40).
 *
 * This used to return nil for a financed asset, reasoning that the lender paid so no cash moved. But the
 * loan's own proceeds are already counted as money IN, by Funding and by the forecast alike — so the money
 * arrived and never left, and the plan gained the asset for free. On the balance sheet that was 86,949 of
 * assets against 86,949 of debt AND 86,949 of cash; on the Funding cash check it was a business that looked
 * flush with money it had already spent on an excavator.
 *
 * Both flows are real and both are shown: borrowed in, paid to the supplier straight back out, net nil. It
 * is also what a lender expects to read — a plan that hides the borrowing and the spending because they
 * cancel is a plan that does not mention its own capital investment.
 */
export function capexByYear(a: FixedAsset): number[] {
  const out = YEARS.map(() => 0);
  // Something already owned was paid for before the plan started. Charging it again would invent a purchase.
  if (owned(a)) return out;
  out[startYear(a) - 1] = r2(num(a.purchase_price));
  return out;
}

/**
 * What the asset adds to the balance sheet. The same figure as the cash it costs, now that a financed asset
 * pays its supplier out of the money it borrowed (§6.40) — kept as its own name because the balance sheet
 * is asking a different question from the cash flow, and one of them may change again.
 */
export const additionsByYear = (a: FixedAsset) => capexByYear(a);
// — and an already-owned asset adds nothing either: the opening balance sheet is already carrying it.

/**
 * What leaves the bank month by month in Year 1 — every asset in its own purchase month, financed or not
 * (§6.40): a financed one is paid to its supplier out of what the lender advanced the same day, and both
 * flows are shown rather than netted away.
 * The Funding page carried this loop inline; the moment the forecast needed the same twelve months it
 * became a fact with two computations, so it lives here with the year it has to agree with.
 */
export function capexMonths(assets: FixedAsset[], year = 1): number[] {
  const y = Math.min(5, Math.max(1, Math.trunc(year) || 1));
  const out = Array(12).fill(0) as number[];
  for (const a of assets) {
    const cash = capexByYear(a)[y - 1];             // nil unless this asset is bought in that year at all
    if (!cash) continue;
    const m = Math.min(12, Math.max(1, Math.trunc(num(a.start_month)) || 1));
    out[m - 1] = r2(out[m - 1] + cash);
  }
  return out;
}

export type AssetYear = { year: number; depreciation: number; bookValue: number; capex: number; additions: number };

/** Every asset in the plan, added up. */
export function assetsByYear(assets: FixedAsset[]): AssetYear[] {
  const dep = YEARS.map(() => 0), book = YEARS.map(() => 0), cap = YEARS.map(() => 0), add = YEARS.map(() => 0);
  for (const a of assets) {
    const d = depreciationByYear(a), b = bookValueByYear(a), c = capexByYear(a), n2 = additionsByYear(a);
    for (let i = 0; i < 5; i++) { dep[i] += d[i]; book[i] += b[i]; cap[i] += c[i]; add[i] += n2[i]; }
  }
  return YEARS.map((year, i) => ({ year, depreciation: r2(dep[i]), bookValue: r2(book[i]), capex: r2(cap[i]), additions: r2(add[i]) }));
}

/** Year 1 depreciation month by month, for the twelve-month cash flow and P&L. */
export function assetsMonths(assets: FixedAsset[], year = 1): number[] {
  const y = Math.min(5, Math.max(1, Math.trunc(year) || 1));
  const out = Array(12).fill(0);
  for (const a of assets) {
    const m = depreciationMonths(a).slice((y - 1) * 12, y * 12);
    for (let i = 0; i < 12; i++) out[i] = r2(out[i] + num(m[i]));
  }
  return out;
}
