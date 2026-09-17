import { describe, expect, it } from "vitest";
import { deriveFromTotals, deriveFromComponents, periodRatios, periodsFromTemplate } from "./derive";

// DesignOne_Financial_Loading_20232026.xlsx, Period 1 (2026) — the APeX Input Form shows these derived figures.
const designOne2026 = {
  revenue: 1997000, gross_margin: 767473, net_profit: -71000, depreciation_amortisation: 0, interest_paid: 18638, tax_paid: 0,
  extraordinary_income_expenses: 0, dividends_paid: 0,
  total_assets: 417690, cash: 21315, accounts_receivable: 253938, inventory_wip: 5095, current_assets: 287496, fixed_assets: 129294,
  total_liabilities: 344365, accounts_payable: 19508, current_liabilities: 253756, bank_loans_current: 98849, bank_loans_non_current: 89974,
};

describe("historic derivation — totals → components (APeX parity)", () => {
  const d = deriveFromTotals(designOne2026);
  it("reproduces the APeX Input Form for DesignOne 2026", () => {
    expect(d.cogs).toBe(1229527);
    expect(d.overheads).toBe(819835);
    expect(d.operating_profit).toBe(-52362);
    expect(d.net_profit_before_tax).toBe(-71000);
    expect(d.retained_profit).toBe(-71000);
  });
  it("derives the balance-sheet residuals and equity", () => {
    expect(d.other_current_assets).toBe(7148);
    expect(d.non_current_assets).toBe(130194);
    expect(d.other_non_current_assets).toBe(900);
    expect(d.other_current_liabilities).toBe(135399);
    expect(d.non_current_liabilities).toBe(90609);
    expect(d.other_non_current_liabilities).toBe(635);
    expect(d.equity).toBe(73325);
  });
  it("round-trips: the derived components rebuild the same totals", () => {
    const back = deriveFromComponents(d);
    expect(back.gross_margin).toBe(767473);
    expect(back.net_profit).toBe(-71000);
    expect(back.total_assets).toBe(417690);
    expect(back.total_liabilities).toBe(344365);
    expect(back.equity).toBe(73325);
  });
  it("reads the days a lender would compute", () => {
    const r = periodRatios(d, 12);
    expect(r.grossMarginPct).toBeCloseTo(38.43, 1);
    expect(r.debtorDays).toBe(46);        // APeX Plan Settings shows "Historical 46 days"
    expect(r.inventoryDays).toBe(2);      // "2 days"
    expect(r.creditorDays).toBe(6);       // "6 days"
  });
});

describe("template import", () => {
  it("maps the four columns, newest first, and skips empty ones", () => {
    const sheet = {
      periodEnd: [2026, 2025, null, null], periodLength: [12, 12, null, null],
      rows: { "Revenue": [1997000, 1890000, null, null], "Gross Margin": [767473, 793800, null, null], "Net Profit After Tax": [-71000, 75000, null, null] },
    };
    const p = periodsFromTemplate(sheet);
    expect(p.map((x) => x.present)).toEqual([true, true, false, false]);
    expect(p[1].values.cogs).toBe(1096200);
    expect(p[0].period_end).toBe(2026);
  });
});

/**
 * Prepayments and accruals (§6.66) — the two working-capital balances the forecast could not inherit,
 * because the historic balance sheet had nowhere to put them.
 */
describe("prepayments and accruals", () => {
  it("adds them to the right subtotal on the components path", () => {
    const d = deriveFromComponents({
      cash: 100, accounts_receivable: 200, inventory_wip: 50, prepayments: 30, other_current_assets: 20,
      accounts_payable: 90, bank_loans_current: 40, accruals: 25, other_current_liabilities: 10,
    });
    expect(d.current_assets).toBe(400);            // 100 + 200 + 50 + 30 + 20
    expect(d.current_liabilities).toBe(165);       // 90 + 40 + 25 + 10
    expect(d.equity).toBe(235);
    expect(d.total_assets - d.total_liabilities).toBe(d.equity);
  });

  it("MOVES a prepayment out of other current assets on the totals path, never adds to it", () => {
    // Total current assets is the figure off the statements. Naming part of it must not change it.
    const without = deriveFromTotals({ cash: 100, accounts_receivable: 200, inventory_wip: 50, current_assets: 400, total_assets: 400 });
    const with_ = deriveFromTotals({ cash: 100, accounts_receivable: 200, inventory_wip: 50, prepayments: 30, current_assets: 400, total_assets: 400 });
    expect(without.other_current_assets).toBe(50);
    expect(with_.other_current_assets).toBe(20);   // the same 50, with 30 of it now named
    expect(with_.current_assets).toBe(400);
    expect(with_.total_assets).toBe(without.total_assets);
    expect(with_.equity).toBe(without.equity);
  });

  it("does the same for accruals inside current liabilities", () => {
    const d = deriveFromTotals({
      accounts_payable: 90, bank_loans_current: 40, accruals: 25, current_liabilities: 200, total_liabilities: 300, total_assets: 500,
    });
    expect(d.other_current_liabilities).toBe(45);  // 200 - 90 - 40 - 25
    expect(d.current_liabilities).toBe(200);
    expect(d.equity).toBe(200);
  });

  it("defaults both to zero, so every period entered before they existed is unchanged", () => {
    const d = deriveFromComponents({ cash: 100, accounts_receivable: 200, inventory_wip: 50, other_current_assets: 20 });
    expect(d.prepayments).toBe(0);
    expect(d.accruals).toBe(0);
    expect(d.current_assets).toBe(370);
  });
});
