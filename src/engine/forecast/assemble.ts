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
import type { MonthlyShapes } from "./monthly";
import { planRevenueByYear, planRevenueMonths, planYear1Months, sourceOf, type AnyProduct } from "../sales/product";
import { planCogsByYear, planCogsMonths, type CostProduct, type FixedCost } from "../cogs/direct";
import { overheadsByYear, overheadsMonths, planOverheadLines, type Overhead } from "../overheads/expenses";
import { debtByYear, interestByYear, loanByYear, loanMonths, rbfByYear, rbfSplitMonths, type FundingSource } from "../funding/sources";
import { assetsByYear, assetsMonths, bookValueByYear, capexMonths, type FixedAsset } from "../assets/depreciation";
import { extraordinaryByYear, extraordinaryCashMonths, isDisposal, type ExtraordinaryItem } from "../extraordinary/items";

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
export function debtSplitByYear(funding: FundingSource[], revenueMonths: number[]): { current: number[]; nonCurrent: number[] } {
  const closing = debtByYear(funding, revenueMonths);
  const principalNextYear = FORECAST_YEARS.map(() => 0);
  for (const s of funding) {
    const y = s.loan ? loanByYear(s.loan) : s.rbf ? rbfByYear(s.rbf, revenueMonths) : null;
    if (!y) continue;
    for (let i = 0; i < 5; i++) principalNextYear[i] += i < 4 ? n(y[i + 1]?.principal) : 0;
  }
  const current = closing.map((c, i) => r2(Math.min(c, i === 4 ? c : principalNextYear[i])));
  return { current, nonCurrent: closing.map((c, i) => r2(Math.max(0, c - current[i]))) };
}

/** Principal repaid in each year — cash out, and never a P&L cost. */
export function principalByYear(funding: FundingSource[], revenueMonths: number[]): number[] {
  const out = FORECAST_YEARS.map(() => 0);
  for (const s of funding) {
    const y = s.loan ? loanByYear(s.loan) : s.rbf ? rbfByYear(s.rbf, revenueMonths) : null;
    if (!y) continue;
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
  // Revenue-linked finance repays out of sales, so the funding functions need the sales, all sixty months
  // of them — not a second reading of the plan, the same series the Sales screen draws from (§6.37).
  const revenueMonths = planRevenueMonths(p.products);
  // An ongoing line whose clients come from another line costs what THAT line wins (§6.36). Passing
  // `() => null` here silently unlinked them, so the forecast costed a book of clients it never counted:
  // 28,800 against the COGS screen's 42,247 on the same plan, with all three statements still agreeing
  // perfectly with each other. Reconciliation proves the statements agree, never that they agree with the
  // plan — which is why this reads the link exactly as Sales and COGS already do.
  const cogs = planCogsByYear(p.costProducts, p.fixedCogs, (c) => sourceOf(c, p.products));
  const overheads = overheadsByYear(planOverheadLines(p.overheads, p.salaries, p.marketing), p.onCostPct);
  const interest = interestByYear(p.funding, revenueMonths);
  const assets = assetsByYear(p.assets);
  const extra = extraordinaryByYear(p.extraordinary);
  const { current, nonCurrent } = debtSplitByYear(p.funding, revenueMonths);
  const principal = principalByYear(p.funding, revenueMonths);
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
 * The same assembly, for the twelve months of Year 1 (§6.36). Every line is the month series its own module
 * publishes, sliced to Year 1 and not touched: if any of them stops adding to the year above it, the
 * forecast's own reconciliation strip says so rather than the plan quietly drifting.
 *
 * The one thing decided here is the same one decided for the year — whether a source is borrowed or put in —
 * using the identical test, so a source cannot be equity by the year and debt by the month.
 */
export function assembleMonths(p: PlanSources): MonthlyShapes {
  const revenueMonths = planRevenueMonths(p.products);
  const debtProceeds = Array(12).fill(0) as number[];
  const equityRaised = Array(12).fill(0) as number[];
  const debtRepaid = Array(12).fill(0) as number[];
  const interest = Array(12).fill(0) as number[];

  for (const s of p.funding) {
    if ((Math.trunc(n(s.start_year)) || 1) === 1) {
      const m = Math.min(12, Math.max(1, Math.trunc(n(s.start_month)) || 1));
      const borrowed = s.kind === "debt" || s.kind === "revenue_linked" || (s.kind === "owner" && !!s.loan);
      const bucket = borrowed ? debtProceeds : equityRaised;
      bucket[m - 1] = r2(bucket[m - 1] + n(s.amount));
    }
    if (s.loan) {
      const months = loanMonths(s.loan);
      for (let i = 0; i < 12; i++) {
        debtRepaid[i] = r2(debtRepaid[i] + n(months[i]?.principal));
        interest[i] = r2(interest[i] + n(months[i]?.interest) + n(months[i]?.fees));
      }
    } else if (s.rbf) {
      const months = rbfSplitMonths(s.rbf, revenueMonths);
      for (let i = 0; i < 12; i++) {
        debtRepaid[i] = r2(debtRepaid[i] + n(months[i]?.principal));
        interest[i] = r2(interest[i] + n(months[i]?.cost));
      }
    }
  }

  const cash = extraordinaryCashMonths(p.extraordinary, 1);
  return {
    revenue: planYear1Months(p.products),
    cogs: planCogsMonths(p.costProducts, p.fixedCogs, (c) => sourceOf(c, p.products)),
    overheads: overheadsMonths(planOverheadLines(p.overheads, p.salaries, p.marketing), p.onCostPct),
    capex: capexMonths(p.assets),
    depreciation: assetsMonths(p.assets),
    debtProceeds, equityRaised, debtRepaid, interest,
    extraordinaryReceipts: cash.receipts,
    extraordinaryPayments: cash.payments,
    disposalProceeds: cash.disposals,
  };
}

/**
 * The cash the plan opens with (§6.37).
 *
 * A trading business already told the app this on its historic balance sheet; only a business with no
 * history has to state it. Funding asked for it a second time and read only the stated figure, so a plan
 * with 21,315 in the bank ran its whole funding check from nil — one fact, two homes, and the two screens
 * disagreeing about the most basic number in the plan. This is the rule, and both screens use it.
 */
export const openingCashFor = (
  historic: { cash?: number | null } | null | undefined, stated: number | null | undefined,
) => (historic ? n(historic.cash) : n(stated));

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
    cash: openingCashFor(historic as { cash?: number | null } | null, openingCash),
    accountsReceivable: h("accounts_receivable"),
    inventory: h("inventory_wip"),
    otherCurrentAssets: h("other_current_assets"),
    fixedAssets: h("fixed_assets"),
    otherNonCurrentAssets: h("other_non_current_assets"),
    accountsPayable: h("accounts_payable"),
    // The business's existing bank debt. It was missing here, and a balance sheet is short by exactly what
    // you forget to put on it (§6.32.4).
    bankLoansCurrent: h("bank_loans_current"),
    bankLoansNonCurrent: h("bank_loans_non_current"),
    otherCurrentLiabilities: h("other_current_liabilities"),
    otherNonCurrentLiabilities: h("other_non_current_liabilities"),
    equity: historic ? h("equity") : n(openingCash),
    taxPayable: n(openingTaxPayable),
  };
}
