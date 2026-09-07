import { describe, it, expect } from "vitest";
import { planYear1Months, planRevenueByYear, type AnyProduct } from "./sales/product";
import { planCogsByYear, planCogsMonths, type CostProduct } from "./cogs/direct";
import { overheadsByYear, overheadsMonths, planOverheadLines, type Overhead } from "./overheads/expenses";
import { depreciationByYear, depreciationMonths, type FixedAsset } from "./assets/depreciation";
import { loanByYear, loanMonths, type Loan } from "./funding/sources";

/**
 * Year 1 must equal its own twelve months — in every module, for every kind of line.
 *
 * Four separate faults this session were the same shape: one fact with two computations that quietly
 * disagreed (Year 1 units, the lost salaries, the Funding header, the monthly depreciation rounding). Each
 * was invisible while a module was read on its own and obvious the moment two views sat on one screen.
 * These are the invariants that make the disagreement fail a test instead of reaching a client's plan.
 */
const oneOff: CostProduct = {
  id: "a", name: "Carports", sold_as: "one_off", average_price: 12000, units_sold: 30, cost_per_unit: 1600,
  start_selling_year: 1, yearly_growth: { "1": { price: 0, units: 10 }, "2": { price: 3, units: 8 } },
  monthly_distribution: null,
} as unknown as CostProduct;

const ongoing: CostProduct = {
  id: "b", name: "Coaching", sold_as: "recurring", average_price: 24000, opening_clients: 4,
  client_life_months: 12, life_mode: "fixed", monthly_new_clients: { "2": 1, "4": 3, "7": 2 },
  cost_per_unit: 8400, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
} as unknown as CostProduct;

const linked: CostProduct = {
  id: "c", name: "Royalties", sold_as: "recurring", average_price: 6000, opening_clients: 0,
  client_life_months: 120, life_mode: "fixed", clients_from_product_id: "a",
  cost_per_unit: 0, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
} as unknown as CostProduct;

const products = [oneOff, ongoing, linked];
const sourceFor = (p: AnyProduct) => products.find((x) => x.id === p.clients_from_product_id) ?? null;
const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

describe("Year 1 equals its own twelve months", () => {
  it("sales — one-off, ongoing and linked lines together", () => {
    expect(sum(planYear1Months(products))).toBeCloseTo(planRevenueByYear(products)[0].value, 1);
  });

  it("cost of sales, including a fixed cost with its own split", () => {
    const fixed = [{ annual_cost: 123600, yearly_growth_rates: null, monthly_distribution: null }];
    expect(sum(planCogsMonths(products, fixed, sourceFor))).toBeCloseTo(planCogsByYear(products, fixed, sourceFor)[0].total, 1);
  });

  it("overheads, on-costs included, with synced lines that have no row of their own", () => {
    const rent: Overhead = { name: "Rent", source: "entered", current_value: 125000, yearly_change: null, monthly_distribution: { "1": 20, "2": 5, "3": 5, "4": 5, "5": 5, "6": 5, "7": 5, "8": 5, "9": 5, "10": 5, "11": 5, "12": 30 }, start_year: 1 };
    const wages: Overhead = { name: "Wages", source: "entered", current_value: 320000, yearly_change: null, monthly_distribution: null, on_cost: true };
    const lines = planOverheadLines([rent, wages], [126000, 129780, 136269, 143082, 150237], Array(5).fill(14000));
    expect(sum(overheadsMonths(lines, 11.5))).toBeCloseTo(overheadsByYear(lines, 11.5)[0].total, 1);
  });

  it("depreciation, straight line and diminishing, mid-year starts included", () => {
    const assets: FixedAsset[] = [
      { name: "Ute", purchase_price: 60000, residual_value: 0, useful_life_months: 60, method: "straight_line", start_year: 1, start_month: 1 },
      { name: "Laptop", purchase_price: 6000, residual_value: 0, useful_life_months: 36, method: "straight_line", start_year: 1, start_month: 4 },
      { name: "Plant", purchase_price: 90000, residual_value: 10000, useful_life_months: 84, method: "diminishing", start_year: 1, start_month: 1 },
    ];
    for (const a of assets) {
      expect(sum(depreciationMonths(a).slice(0, 12))).toBeCloseTo(depreciationByYear(a)[0], 1);
    }
  });

  it("loan repayments, at every frequency", () => {
    const base: Loan = { amount_drawn: 200000, interest_rate: 5, term_months: 60, repayment_type: "amortised", payment_frequency: "monthly", start_year: 1, start_month: 1 };
    for (const frequency of ["weekly", "fortnightly", "monthly", "quarterly"] as const) {
      const loan = { ...base, payment_frequency: frequency };
      const months = loanMonths(loan).slice(0, 12);
      const year = loanByYear(loan)[0];
      expect(sum(months.map((m) => m.payment))).toBeCloseTo(year.payments, 1);
      expect(sum(months.map((m) => m.interest))).toBeCloseTo(year.interest, 1);
      expect(sum(months.map((m) => m.principal))).toBeCloseTo(year.principal, 1);
    }
  });
});
