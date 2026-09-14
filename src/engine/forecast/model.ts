/**
 * The forecast (§6.32) — profit and loss, cash flow and balance sheet, from one set of numbers.
 *
 * Every module before this one answers a question about the business. This one answers the only question a
 * lender asks: *does it hold together?* Three statements, five years, and each one has to agree with the
 * other two — the profit has to explain the cash, the cash has to land in the balance sheet, and the balance
 * sheet has to balance. When they disagree, the plan is wrong somewhere upstream and nobody can see where.
 *
 * **It takes an assembled base and never reads a plan row.** Revenue comes from `planRevenueByYear`, cost
 * from `planCogsByYear`, overheads from `planOverheadLines`, interest and debt from `loanByYear`,
 * depreciation from `depreciationByYear`, one-offs from `extraordinaryByYear` — the same functions the
 * screens display from. That is the whole discipline: four faults in the last fortnight were one fact with
 * two computations that quietly disagreed, and the forecast is where a second computation would cost most.
 *
 * Three placements worth stating, because they are what a bank checks first:
 *   - **Extraordinary items sit below operating profit and above tax.** A one-off sale is not trading, so it
 *     must not flatter the operating line, but it is taxable, so it must not sit below the tax line either.
 *   - **Disposal proceeds are investing, not operating.** Selling the ute is not revenue. Only the gain or
 *     loss against book value touches the profit and loss.
 *   - **Interest is financing in the cash flow, and a cost in the profit and loss.** It appears in both, once
 *     each, and the bridge between them reclassifies it explicitly rather than hoping it cancels.
 */

export const FORECAST_YEARS = [1, 2, 3, 4, 5] as const;
export type ForecastYear = (typeof FORECAST_YEARS)[number];

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** What the plan's own modules produce, per year. Nothing here is computed twice. */
export type YearBase = {
  revenue: number;
  variableCogs: number;
  fixedCogs: number;
  overheads: number;
  depreciation: number;
  capex: number;
  interest: number;
  /** Debt drawn and repaid this year, and what is still owed at year end. */
  debtProceeds: number;
  debtRepaid: number;
  debtCurrent: number;
  debtNonCurrent: number;
  equityRaised: number;
  extraordinaryIncome: number;
  extraordinaryExpense: number;
  disposalProceeds: number;
  disposedBookValue: number;
};

export type OpeningBalance = {
  cash: number;
  accountsReceivable: number;
  inventory: number;
  otherCurrentAssets: number;
  fixedAssets: number;
  otherNonCurrentAssets: number;
  accountsPayable: number;
  otherCurrentLiabilities: number;
  otherNonCurrentLiabilities: number;
  equity: number;
  taxPayable: number;
};

export type WorkingCapitalDays = { debtorDays: number; inventoryDays: number; creditorDays: number };
/** `taxPaidPct` is how much of the year's tax charge is actually paid in that year; the rest is a liability. */
export type CashTiming = { taxPaidPct: number; prepaidClosing: number; accruedClosing: number };

export type ForecastInput = {
  base: Record<number, YearBase>;
  opening: OpeningBalance;
  workingCapital: Record<number, WorkingCapitalDays>;
  cashTiming: Record<number, CashTiming>;
  taxRate: number;
  dividendRate: number;
};

export type PnlYear = {
  revenue: number; variableCogs: number; fixedCogs: number; cogs: number; grossProfit: number;
  grossMargin: number | null; overheads: number; depreciation: number; operatingProfit: number;
  extraordinaryIncome: number; extraordinaryExpense: number; disposalGainLoss: number;
  interest: number; profitBeforeTax: number; tax: number; netProfit: number;
  dividends: number; retainedProfit: number;
};

export type WorkingCapitalYear = {
  accountsReceivable: number; inventory: number; accountsPayable: number;
  prepaid: number; accrued: number; taxPayable: number; taxPaid: number;
};

export type CashFlowYear = {
  openingCash: number;
  receiptsFromCustomers: number; extraordinaryReceipts: number;
  paidToSuppliersAndEmployees: number; extraordinaryPayments: number; taxPaid: number;
  netOperating: number;
  capex: number; disposalProceeds: number; netInvesting: number;
  debtProceeds: number; equityRaised: number; debtRepaid: number; interestPaid: number; dividendsPaid: number;
  netFinancing: number;
  netMovement: number; closingCash: number;
};

/** The indirect bridge, computed independently so it can DISAGREE — which is the point of checking it. */
export type BridgeYear = {
  netProfit: number; depreciation: number; disposalGainLoss: number; interestReclassified: number;
  receivablesMovement: number; inventoryMovement: number; payablesMovement: number;
  prepaidMovement: number; accruedMovement: number; taxTimingMovement: number;
  operatingCashFlow: number;
};

export type BalanceSheetYear = {
  cash: number; accountsReceivable: number; inventory: number; prepaid: number; otherCurrentAssets: number;
  currentAssets: number; fixedAssets: number; otherNonCurrentAssets: number; nonCurrentAssets: number;
  totalAssets: number;
  accountsPayable: number; accrued: number; taxPayable: number; debtCurrent: number; otherCurrentLiabilities: number;
  currentLiabilities: number; debtNonCurrent: number; otherNonCurrentLiabilities: number; nonCurrentLiabilities: number;
  totalLiabilities: number; equity: number; totalLiabilitiesAndEquity: number;
  /** Assets less liabilities and equity. Zero, or the plan does not hold together. */
  balanceCheck: number;
};

export type Invariant = { key: string; label: string; year: ForecastYear; difference: number; passed: boolean };

export type Forecast = {
  pnl: Record<number, PnlYear>;
  workingCapital: Record<number, WorkingCapitalYear>;
  cashFlow: Record<number, CashFlowYear>;
  bridge: Record<number, BridgeYear>;
  balanceSheet: Record<number, BalanceSheetYear>;
  invariants: Invariant[];
  reconciled: boolean;
};

const emptyBase = (): YearBase => ({
  revenue: 0, variableCogs: 0, fixedCogs: 0, overheads: 0, depreciation: 0, capex: 0, interest: 0,
  debtProceeds: 0, debtRepaid: 0, debtCurrent: 0, debtNonCurrent: 0, equityRaised: 0,
  extraordinaryIncome: 0, extraordinaryExpense: 0, disposalProceeds: 0, disposedBookValue: 0,
});

export function buildForecast(input: ForecastInput): Forecast {
  const taxRate = Math.max(0, n(input.taxRate)) / 100;
  const dividendRate = Math.max(0, n(input.dividendRate)) / 100;
  const o = input.opening;

  const pnl: Record<number, PnlYear> = {};
  const wc: Record<number, WorkingCapitalYear> = {};
  const cf: Record<number, CashFlowYear> = {};
  const bridge: Record<number, BridgeYear> = {};
  const bs: Record<number, BalanceSheetYear> = {};

  let priorAR = n(o.accountsReceivable), priorInv = n(o.inventory), priorAP = n(o.accountsPayable);
  let priorPrepaid = 0, priorAccrued = 0, priorTaxPayable = n(o.taxPayable);
  let cash = n(o.cash), fixedAssets = n(o.fixedAssets), equity = n(o.equity);

  for (const year of FORECAST_YEARS) {
    const b = { ...emptyBase(), ...(input.base[year] ?? {}) };
    const days = input.workingCapital[year] ?? { debtorDays: 0, inventoryDays: 0, creditorDays: 0 };
    const timing = input.cashTiming[year] ?? { taxPaidPct: 100, prepaidClosing: 0, accruedClosing: 0 };

    // ---- profit and loss -------------------------------------------------
    const cogs = n(b.variableCogs) + n(b.fixedCogs);
    const grossProfit = n(b.revenue) - cogs;
    const operatingProfit = grossProfit - n(b.overheads) - n(b.depreciation);
    // Only the gain or loss against book value is profit; the proceeds themselves are investing cash.
    const disposalGainLoss = n(b.disposalProceeds) - n(b.disposedBookValue);
    const profitBeforeTax = operatingProfit + n(b.extraordinaryIncome) - n(b.extraordinaryExpense)
      + disposalGainLoss - n(b.interest);
    // A loss carries no charge. Carry-forward relief is a refinement this deliberately does not claim.
    const tax = profitBeforeTax > 0 ? profitBeforeTax * taxRate : 0;
    const netProfit = profitBeforeTax - tax;
    const dividends = netProfit > 0 ? netProfit * dividendRate : 0;

    pnl[year] = {
      revenue: r2(n(b.revenue)), variableCogs: r2(n(b.variableCogs)), fixedCogs: r2(n(b.fixedCogs)),
      cogs: r2(cogs), grossProfit: r2(grossProfit),
      grossMargin: n(b.revenue) ? r2((grossProfit / n(b.revenue)) * 100) : null,
      overheads: r2(n(b.overheads)), depreciation: r2(n(b.depreciation)), operatingProfit: r2(operatingProfit),
      extraordinaryIncome: r2(n(b.extraordinaryIncome)), extraordinaryExpense: r2(n(b.extraordinaryExpense)),
      disposalGainLoss: r2(disposalGainLoss), interest: r2(n(b.interest)),
      profitBeforeTax: r2(profitBeforeTax), tax: r2(tax), netProfit: r2(netProfit),
      dividends: r2(dividends), retainedProfit: r2(netProfit - dividends),
    };

    // ---- working capital -------------------------------------------------
    const ar = (n(b.revenue) * Math.max(0, n(days.debtorDays))) / 365;
    const inventory = (cogs * Math.max(0, n(days.inventoryDays))) / 365;
    const ap = (cogs * Math.max(0, n(days.creditorDays))) / 365;
    const prepaid = Math.max(0, n(timing.prepaidClosing));
    const accrued = Math.max(0, n(timing.accruedClosing));
    const taxPaid = (priorTaxPayable + tax) * Math.min(1, Math.max(0, n(timing.taxPaidPct) / 100));
    const taxPayable = priorTaxPayable + tax - taxPaid;

    wc[year] = {
      accountsReceivable: r2(ar), inventory: r2(inventory), accountsPayable: r2(ap),
      prepaid: r2(prepaid), accrued: r2(accrued), taxPayable: r2(taxPayable), taxPaid: r2(taxPaid),
    };

    // ---- cash flow -------------------------------------------------------
    const dAR = ar - priorAR, dInv = inventory - priorInv, dAP = ap - priorAP;
    const dPrepaid = prepaid - priorPrepaid, dAccrued = accrued - priorAccrued;

    const receipts = n(b.revenue) - dAR;
    const suppliers = n(b.overheads) + cogs + dInv - dAP + dPrepaid - dAccrued;
    const netOperating = receipts + n(b.extraordinaryIncome) - suppliers - n(b.extraordinaryExpense) - taxPaid;
    const netInvesting = n(b.disposalProceeds) - n(b.capex);
    const netFinancing = n(b.debtProceeds) + n(b.equityRaised) - n(b.debtRepaid) - n(b.interest) - dividends;
    const netMovement = netOperating + netInvesting + netFinancing;
    const openingCash = cash;
    const closingCash = openingCash + netMovement;

    cf[year] = {
      openingCash: r2(openingCash),
      receiptsFromCustomers: r2(receipts), extraordinaryReceipts: r2(n(b.extraordinaryIncome)),
      paidToSuppliersAndEmployees: r2(suppliers), extraordinaryPayments: r2(n(b.extraordinaryExpense)),
      taxPaid: r2(taxPaid), netOperating: r2(netOperating),
      capex: r2(n(b.capex)), disposalProceeds: r2(n(b.disposalProceeds)), netInvesting: r2(netInvesting),
      debtProceeds: r2(n(b.debtProceeds)), equityRaised: r2(n(b.equityRaised)), debtRepaid: r2(n(b.debtRepaid)),
      interestPaid: r2(n(b.interest)), dividendsPaid: r2(dividends), netFinancing: r2(netFinancing),
      netMovement: r2(netMovement), closingCash: r2(closingCash),
    };

    // The same number, reached the other way. It must land on netOperating or something upstream is wrong.
    bridge[year] = {
      netProfit: r2(netProfit), depreciation: r2(n(b.depreciation)), disposalGainLoss: r2(-disposalGainLoss),
      interestReclassified: r2(n(b.interest)),
      receivablesMovement: r2(-dAR), inventoryMovement: r2(-dInv), payablesMovement: r2(dAP),
      prepaidMovement: r2(-dPrepaid), accruedMovement: r2(dAccrued), taxTimingMovement: r2(tax - taxPaid),
      operatingCashFlow: r2(netProfit + n(b.depreciation) - disposalGainLoss + n(b.interest)
        - dAR - dInv + dAP - dPrepaid + dAccrued + (tax - taxPaid)),
    };

    // ---- balance sheet ---------------------------------------------------
    fixedAssets = fixedAssets + n(b.capex) - n(b.depreciation) - n(b.disposedBookValue);
    equity = equity + (netProfit - dividends) + n(b.equityRaised);

    const currentAssets = closingCash + ar + inventory + prepaid + n(o.otherCurrentAssets);
    const nonCurrentAssets = fixedAssets + n(o.otherNonCurrentAssets);
    const totalAssets = currentAssets + nonCurrentAssets;
    const currentLiabilities = ap + accrued + taxPayable + n(b.debtCurrent) + n(o.otherCurrentLiabilities);
    const nonCurrentLiabilities = n(b.debtNonCurrent) + n(o.otherNonCurrentLiabilities);
    const totalLiabilities = currentLiabilities + nonCurrentLiabilities;

    bs[year] = {
      cash: r2(closingCash), accountsReceivable: r2(ar), inventory: r2(inventory), prepaid: r2(prepaid),
      otherCurrentAssets: r2(n(o.otherCurrentAssets)), currentAssets: r2(currentAssets),
      fixedAssets: r2(fixedAssets), otherNonCurrentAssets: r2(n(o.otherNonCurrentAssets)),
      nonCurrentAssets: r2(nonCurrentAssets), totalAssets: r2(totalAssets),
      accountsPayable: r2(ap), accrued: r2(accrued), taxPayable: r2(taxPayable),
      debtCurrent: r2(n(b.debtCurrent)), otherCurrentLiabilities: r2(n(o.otherCurrentLiabilities)),
      currentLiabilities: r2(currentLiabilities), debtNonCurrent: r2(n(b.debtNonCurrent)),
      otherNonCurrentLiabilities: r2(n(o.otherNonCurrentLiabilities)),
      nonCurrentLiabilities: r2(nonCurrentLiabilities), totalLiabilities: r2(totalLiabilities),
      equity: r2(equity), totalLiabilitiesAndEquity: r2(totalLiabilities + equity),
      balanceCheck: r2(totalAssets - totalLiabilities - equity),
    };

    priorAR = ar; priorInv = inventory; priorAP = ap;
    priorPrepaid = prepaid; priorAccrued = accrued; priorTaxPayable = taxPayable;
    cash = closingCash;
  }

  return { pnl, workingCapital: wc, cashFlow: cf, bridge, balanceSheet: bs, ...checks(cf, bridge, bs, n(o.cash)) };
}

/**
 * Four things that must be true of every year. They are computed from the finished statements, not alongside
 * them, so a fault shows up as a failure here rather than as a number nobody questioned.
 */
function checks(
  cf: Record<number, CashFlowYear>, bridge: Record<number, BridgeYear>,
  bs: Record<number, BalanceSheetYear>, openingCash: number,
): { invariants: Invariant[]; reconciled: boolean } {
  const invariants: Invariant[] = [];
  const add = (key: string, label: string, year: ForecastYear, difference: number, tolerance = 0.5) =>
    invariants.push({ key, label, year, difference: r2(difference), passed: Math.abs(difference) <= tolerance });

  for (const year of FORECAST_YEARS) {
    add("balance-sheet-equation", "The balance sheet balances", year, bs[year].balanceCheck);
    add("profit-to-operating-cash", "Profit explains the cash", year,
      bridge[year].operatingCashFlow - cf[year].netOperating);
    add("cash-to-balance-sheet", "Cash flow agrees with the balance sheet", year,
      cf[year].closingCash - bs[year].cash);
    const priorClose = year === 1 ? openingCash : cf[year - 1].closingCash;
    add("cash-roll-forward", "Each year opens where the last one closed", year, cf[year].openingCash - priorClose);
  }
  return { invariants, reconciled: invariants.every((i) => i.passed) };
}
