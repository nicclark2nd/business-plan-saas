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
import { assembleGst, type GstPlanSources } from "./gst_assemble";
import { NOT_REGISTERED, type GstSettings } from "../plan/gst";
import { planRevenueByYear, planRevenueMonths, sourceOf, type AnyProduct } from "../sales/product";
import { planCogsByYear, planCogsMonths, type CostProduct, type FixedCost } from "../cogs/direct";
import { overheadsByYear, overheadsMonths, planOverheadLines, type Overhead } from "../overheads/expenses";
import { debtByYear, interestByYear, loanByYear, loanMonths, rbfByYear, rbfSplitMonths, type FundingSource } from "../funding/sources";
import { assetsByYear, assetsMonths, capexMonths, withDisposals, type FixedAsset } from "../assets/depreciation";
import { grantsByYear, grantsMonths, type Grant } from "../funding/grants";
import { disposalBookValueByYear, extraordinaryByYear, extraordinaryCashMonths, isDisposal, soldMonthByAsset, type ExtraordinaryItem } from "../extraordinary/items";

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
    /**
     * The money arrives when the SCHEDULE says it does, not when the row says (§6.40). The two are written from
     * the same field today, so they agree — but they are two places holding one date, and if they ever
     * drift the balance sheet carries a liability with no cash behind it, out by the whole loan. Reading
     * the schedule's own draw date means they cannot drift.
     */
    const year = Math.min(5, Math.max(1, Math.trunc(n(s.loan?.start_year ?? s.rbf?.start_year ?? s.start_year)) || 1));
    const amount = n(s.amount);
    // A grant is neither borrowed nor subscribed: it is income, and it has its own path (§6.50).
    if (s.kind === "grant") continue;
    const borrowed = s.kind === "debt" || s.kind === "revenue_linked" || (s.kind === "owner" && !!s.loan);
    const bucket = borrowed ? debt : equity;          // owner capital and investor money are not repayable
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
  /**
   * Every asset carrying the month it was sold, if it was (§6.56). Attached once, here, so the depreciation
   * in the P&L, the book value the gain is measured against and the balance sheet's own roll-forward are
   * all reading the same asset.
   */
  const assets0 = withDisposals(p.assets, soldMonthByAsset(p.extraordinary));
  const assets = assetsByYear(assets0);
  const extra = extraordinaryByYear(p.extraordinary);
  const { current, nonCurrent } = debtSplitByYear(p.funding, revenueMonths);
  const principal = principalByYear(p.funding, revenueMonths);
  const raised = raisedByYear(p.funding);
  const grants = grantsByYear(p.funding.map((f) => f.grant).filter((g): g is Grant => !!g));

  /**
   * A disposal is an extraordinary line pointed at an asset (§6.23): the proceeds are investing cash, and
   * what turns them into a gain or a loss is the asset's own book value at the point it leaves. That book
   * value is NOT stored on the item — it is read from `bookValueAtDisposal` on the asset the item names,
   * which is the purchase price less the depreciation actually charged up to the month of the sale. Storing
   * it would be a second copy of a number the assets module already owns, and it would go stale the moment
   * the asset's life or price changed.
   *
   * It was read at the close of the year BEFORE the sale until §6.56, which was right only because the
   * asset went on depreciating after it had been sold. Now that it stops, the two have to be the same
   * series or the balance sheet would carry the difference forever.
   */
  const bookValues = disposalBookValueByYear(p.extraordinary, p.assets);
  const disposals = FORECAST_YEARS.map((year) => {
    const rows = p.extraordinary.filter((i) => isDisposal(i) && (Math.trunc(n(i.year)) || 1) === year);
    return { proceeds: r2(rows.reduce((a, i) => a + n(i.amount), 0)), bookValue: bookValues[year - 1] };
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
      assetAdditions: r2(n(assets[i]?.additions)),
      interest: r2(n(interest[i])),
      debtProceeds: r2(n(raised.debt[i])),
      debtRepaid: r2(n(principal[i])),
      debtCurrent: r2(n(current[i])),
      debtNonCurrent: r2(n(nonCurrent[i])),
      equityRaised: r2(n(raised.equity[i])),
      grantsReceived: r2(n(grants[i]?.received)),
      grantIncome: r2(n(grants[i]?.income)),
      deferredIncomeCurrent: r2(n(grants[i]?.deferredCurrent)),
      deferredIncomeNonCurrent: r2(n(grants[i]?.deferredNonCurrent)),
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
export function assembleMonths(
  p: PlanSources, components: GstSettings[] = [NOT_REGISTERED], openingGstPayable = 0, year = 1,
): MonthlyShapes {
  /**
   * The same assembly the year uses, sliced to ONE year — not a second reading (§6.38).
   *
   * `year` is last and defaults to 1 on purpose (§6.71): every existing caller keeps working untouched, and
   * the twelve months this returns are the twelve months of whichever year is asked for. The sixty-month
   * series underneath were already there for revenue, depreciation, loans, revenue-based finance and
   * grants — the Year 1 wrappers simply threw four fifths of them away.
   */
  const y = Math.min(5, Math.max(1, Math.trunc(year) || 1));
  const from = (y - 1) * 12;
  const win = (a: number[]) => a.slice(from, from + 12);
  const gst = assembleGst(p as unknown as GstPlanSources, components, openingGstPayable);
  const revenueMonths = planRevenueMonths(p.products);
  const debtProceeds = Array(12).fill(0) as number[];
  const equityRaised = Array(12).fill(0) as number[];
  const debtRepaid = Array(12).fill(0) as number[];
  const interest = Array(12).fill(0) as number[];

  for (const s of p.funding) {
    // The same rule as the year: the schedule's own draw date, so the month and the year cannot disagree.
    const drawYear = Math.trunc(n(s.loan?.start_year ?? s.rbf?.start_year ?? s.start_year)) || 1;
    if (drawYear === y) {
      const m = Math.min(12, Math.max(1, Math.trunc(n(s.loan?.start_month ?? s.rbf?.start_month ?? s.start_month)) || 1));
      // A grant is placed by its own schedule below, not here: it is operating cash, never money raised.
      if (s.kind !== "grant") {
        const borrowed = s.kind === "debt" || s.kind === "revenue_linked" || (s.kind === "owner" && !!s.loan);
        const bucket = borrowed ? debtProceeds : equityRaised;
        bucket[m - 1] = r2(bucket[m - 1] + n(s.amount));
      }
    }
    if (s.loan) {
      const months = loanMonths(s.loan);
      for (let i = 0; i < 12; i++) {
        debtRepaid[i] = r2(debtRepaid[i] + n(months[from + i]?.principal));
        interest[i] = r2(interest[i] + n(months[from + i]?.interest) + n(months[from + i]?.fees));
      }
    } else if (s.rbf) {
      const months = rbfSplitMonths(s.rbf, revenueMonths);
      for (let i = 0; i < 12; i++) {
        debtRepaid[i] = r2(debtRepaid[i] + n(months[from + i]?.principal));
        interest[i] = r2(interest[i] + n(months[from + i]?.cost));
      }
    }
  }

  const cash = extraordinaryCashMonths(p.extraordinary, y);
  const grants = grantsMonths(p.funding.map((f) => f.grant).filter((g): g is Grant => !!g), y);
  const gstM = gst.monthsByYear[y];
  return {
    revenue: win(revenueMonths),
    cogs: planCogsMonths(p.costProducts, p.fixedCogs, (c) => sourceOf(c, p.products), y),
    overheads: overheadsMonths(planOverheadLines(p.overheads, p.salaries, p.marketing), p.onCostPct, y),
    capex: capexMonths(p.assets, y),
    depreciation: assetsMonths(withDisposals(p.assets, soldMonthByAsset(p.extraordinary)), y),
    debtProceeds, equityRaised, debtRepaid, interest,
    grantsReceived: grants.received,
    grantIncome: grants.earned,
    extraordinaryReceipts: cash.receipts,
    extraordinaryPayments: cash.payments,
    disposalProceeds: cash.disposals,
    gstOnSales: gstM.onSales,
    gstOnCogs: gstM.onCogs,
    gstOnOverheads: gstM.onOverheads,
    gstOnCapex: gstM.onCapex,
    gstRemitted: gstM.remitted,
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
    // The two balances the forecast used to start from zero (§6.66). Without them Year 1 pays a second
    // time for cover the business bought last year, and the accrual hands it money it does not have.
    prepaid: h("prepayments"),
    accrued: h("accruals"),
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
