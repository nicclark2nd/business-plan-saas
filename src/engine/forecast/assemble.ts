/**
 * The plan, assembled into what the forecast eats (§6.32.1).
 *
 * This file is deliberately thin and deliberately dull. **It computes nothing.** Every figure it hands the
 * forecast comes from the function the matching screen already displays from:
 *
 *   revenue        planRevenueByYear      — Sales, annual projections
 *   cost of sales  planCogsByYear         — COGS, by line and fixed
 *   overheads      planOverheadLines      — Overheads, including the two synced lines
 *   interest, debt interestByYear/debtByYear, loanByYear  — Funding
 *   depreciation   assetsByYear           — Fixed Assets
 *   one-offs       extraordinaryByYear    — One-off income & costs
 *
 * That is the entire point of the module. Four separate faults in the last fortnight were one fact with two
 * computations that quietly disagreed — Year 1 units 10 % light, 140,490 of salaries missing from Funding, a
 * header that would not match its own row, months that did not add to their year. A forecast that recomputed
 * revenue "just for the P&L" would be the same fault on the statement a bank reads first, so it does not get
 * to. If a figure here is wrong, it is wrong on the screen it came from too, and both move together when it
 * is fixed.
 *
 * **The one thing it does decide is the debt split**, because no existing function answers it: what is
 * repayable within twelve months is current, the rest is not. That needs the repayment schedule, which
 * `loanByYear` already produces, so it is read rather than modelled.
 */
import { FORECAST_YEARS, type OpeningBalance, type YearBase } from "./model";
import { planRevenueByYear, type AnyProduct } from "../sales/product";
import { planCogsByYear, type CostProduct, type FixedCost } from "../cogs/direct";
import { overheadsByYear, planOverheadLines, type Overhead } from "../overheads/expenses";
import { debtByYear, interestByYear, loanByYear, type FundingSource } from "../funding/sources";
import { assetsByYear, bookValueByYear, type FixedAsset } from "../assets/depreciation";
import { extraordinaryByYear, isDisposal, type ExtraordinaryItem } from "../extraordinary/items";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type PlanSources = {
  products: AnyProduct[];
  costProducts: CostProduct[];
  fixedCogs: FixedCost[];
  overheads: Overhead[];
  /** Salaries and marketing arrive already totalled by their own modules — the synced lines (§6.19). */
  salaries: number[];
  marketing: number[];
  onCostPct: number;
  funding: FundingSource[];
  assets: FixedAsset[];
  extraordinary: ExtraordinaryItem[];
};

/**
 * Debt owed at each year end, split by when it falls due. Current is what the schedule repays in the
 * following twelve months; whatever is left is non-current. Year 5 has no year 6 to look at, so its closing
 * balance is treated as current — a balance still outstanding at the end of the plan is due, not deferred.
 */
export function debtSplitByYear(funding: FundingSource[]): { current: number[]; nonCurrent: number[] } {
  const closing = debtByYear(funding);
  const principalNextYear = FORECAST_YEARS.map(() => 0);
  for (const s of funding) {
    if (!s.loan) continue;
    const y = loanByYear(s.loan);
    for (let i = 0; i < 5; i++) principalNextYear[i] += i < 4 ? n(y[i + 1]?.principal) : 0;
  }
  const current = closing.map((c, i) => r2(Math.min(c, i === 4 ? c : principalNextYear[i])));
  return { current, nonCurrent: closing.map((c, i) => r2(Math.max(0, c - current[i]))) };
}

/** Principal repaid in each year — cash out, and never a P&L cost. */
export function principalByYear(funding: FundingSource[]): number[] {
  const out = FORECAST_YEARS.map(() => 0);
  for (const s of funding) {
    if (!s.loan) continue;
    const y = loanByYear(s.loan);
    for (let i = 0; i < 5; i++) out[i] = r2(out[i] + n(y[i].principal));
  }
  return out;
}

/** Money raised in each year, split the way the cash flow needs it: borrowed, or put in as equity. */
export function raisedByYear(funding: FundingSource[]): { debt: number[]; equity: number[] } {
  const debt = FORECAST_YEARS.map(() => 0), equity = FORECAST_YEARS.map(() => 0);
  for (const s of funding) {
    const year = Math.min(5, Math.max(1, Math.trunc(n(s.start_year)) || 1));
    const amount = n(s.amount);
    const borrowed = s.kind === "debt" || s.kind === "revenue_linked" || (s.kind === "owner" && !!s.loan);
    const bucket = borrowed ? debt : equity;          // grants and owner capital are not repayable
    bucket[year - 1] = r2(bucket[year - 1] + amount);
  }
  return { debt, equity };
}

export function assembleBase(p: PlanSources): Record<number, YearBase> {
  const revenue = planRevenueByYear(p.products);
  const cogs = planCogsByYear(p.costProducts, p.fixedCogs, () => null);
  const overheads = overheadsByYear(planOverheadLines(p.overheads, p.salaries, p.marketing), p.onCostPct);
  const interest = interestByYear(p.funding);
  const assets = assetsByYear(p.assets);
  const extra = extraordinaryByYear(p.extraordinary);
  const { current, nonCurrent } = debtSplitByYear(p.funding);
  const principal = principalByYear(p.funding);
  const raised = raisedByYear(p.funding);

  /**
   * A disposal is an extraordinary line pointed at an asset (§6.23): the proceeds are investing cash, and
   * what turns them into a gain or a loss is the asset's own book value at the point it leaves. That book
   * value is NOT stored on the item — it is read from `bookValueByYear` on the asset the item names, at the
   * close of the year before the sale. Storing it would be a second copy of a number the assets module
   * already owns, and it would go stale the moment the asset's life or price changed.
   */
  const disposals = FORECAST_YEARS.map((year) => {
    const rows = p.extraordinary.filter((i) => isDisposal(i) && (Math.trunc(n(i.year)) || 1) === year);
    let bookValue = 0;
    for (const row of rows) {
      const asset = p.assets.find((a) => a.id && a.id === row.source_asset_id);
      if (!asset) continue;
      const book = bookValueByYear(asset);
      // Sold during year N, so what leaves the books is what was still there at the end of year N-1.
      bookValue += year === 1 ? n(asset.purchase_price) : n(book[year - 2]);
    }
    return { proceeds: r2(rows.reduce((a, i) => a + n(i.amount), 0)), bookValue: r2(bookValue) };
  });

  return Object.fromEntries(FORECAST_YEARS.map((year) => {
    const i = year - 1;
    const d = disposals[i];
    return [year, {
      revenue: r2(n(revenue[i]?.value)),
      variableCogs: r2(n(cogs[i]?.variable)),
      fixedCogs: r2(n(cogs[i]?.fixed)),
      overheads: r2(n(overheads[i]?.total)),
      depreciation: r2(n(assets[i]?.depreciation)),
      capex: r2(n(assets[i]?.capex)),
      interest: r2(n(interest[i])),
      debtProceeds: r2(n(raised.debt[i])),
      debtRepaid: r2(n(principal[i])),
      debtCurrent: r2(n(current[i])),
      debtNonCurrent: r2(n(nonCurrent[i])),
      equityRaised: r2(n(raised.equity[i])),
      // The disposal's own proceeds are investing cash, so they must not be counted as income as well.
      extraordinaryIncome: r2(Math.max(0, n(extra[i]?.income) - d.proceeds)),
      extraordinaryExpense: r2(n(extra[i]?.expense)),
      disposalProceeds: d.proceeds,
      disposedBookValue: d.bookValue,
    } satisfies YearBase];
  }));
}

/**
 * The opening position, from the last historic period. A plan with no history opens flat except for whatever
 * cash the client says they are starting with — a startup's balance sheet is its funding, and that arrives
 * through the forecast's own Year 1 rather than being assumed here.
 */
export function assembleOpening(
  historic: Partial<Record<string, number | null>> | null | undefined,
  openingCash: number,
  openingTaxPayable: number,
): OpeningBalance {
  const h = (k: string) => n(historic?.[k]);
  return {
    cash: historic ? h("cash") : n(openingCash),
    accountsReceivable: h("accounts_receivable"),
    inventory: h("inventory_wip"),
    otherCurrentAssets: h("other_current_assets"),
    fixedAssets: h("fixed_assets"),
    otherNonCurrentAssets: h("other_non_current_assets"),
    accountsPayable: h("accounts_payable"),
    otherCurrentLiabilities: h("other_current_liabilities"),
    otherNonCurrentLiabilities: h("other_non_current_liabilities"),
    equity: historic ? h("equity") : n(openingCash),
    taxPayable: n(openingTaxPayable),
  };
}
