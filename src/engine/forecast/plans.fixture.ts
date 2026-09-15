/**
 * Plans nobody would have thought to type (§6.40).
 *
 * The generator behind the fuzz suites. It is deterministic — the seed is the case number — so a failure
 * names a plan that can be rebuilt exactly, and it lives here rather than inside one test file because two
 * suites now hold plans to their invariants: the forecast's own (`fuzz.test.ts`) and the What-If planner's
 * (`../whatif/levers.test.ts`), which moves every lever on every one of them. Two generators would drift,
 * and the second one would quietly stop covering what the first had learned to cover.
 *
 * Not a test file: vitest only collects `*.test.ts`, and nothing in the app imports this.
 */
import { FORECAST_YEARS } from "./model";
import type { PlanSources } from "./assemble";
import type { GstPlanSources } from "./gst_assemble";

export function rng(seed: number) {
  let x = seed * 2654435761 % 2147483647;
  return () => { x = (x * 48271) % 2147483647; return x / 2147483647; };
}

export function makePlan(seed: number) {
  const r = rng(seed + 1);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const money = (max: number) => Math.round(r() * max);
  const maybe = (p: number) => r() < p;

  const dist = () => {
    if (maybe(0.5)) return null;                       // even
    const w: Record<string, number> = {};
    // Deliberately NOT summing to 100 half the time: a split is weights (§6.17).
    for (let m = 1; m <= 12; m++) w[String(m)] = Math.round(r() * 20);
    return w;
  };
  const growth = () => Object.fromEntries(["2", "3", "4", "5"].map((y) => [y, {
    price: Math.round((r() * 20 - 5) * 10) / 10,
    units: maybe(0.2) ? null : Math.round((r() * 30 - 10) * 10) / 10,
    unitsValue: maybe(0.2) ? money(200) : null,
  }]));

  const count = 1 + Math.floor(r() * 3);
  const products: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const recurring = maybe(0.35);
    products.push({
      id: `p${i}`, name: `Line ${i}`,
      sold_as: recurring ? "recurring" : "one_off",
      average_price: 100 + money(20000), units_sold: 1 + money(80),
      start_selling_year: pick([1, 1, 1, 2, 3, 4]),
      yearly_growth: growth(), monthly_distribution: recurring ? null : dist(),
      opening_clients: recurring ? money(40) : 0,
      client_life_months: 6 + Math.floor(r() * 40),
      life_mode: pick(["average", "fixed"]),
      monthly_new_clients: null,
      // A linked line takes its clients from the line before it.
      clients_from_product_id: recurring && i > 0 && maybe(0.4) ? `p${i - 1}` : null,
      cost_per_unit: money(8000), yearly_cost_increase: { "2": 3, "3": 3 },
      gst_applies: !maybe(0.25),
    });
  }

  const assets = maybe(0.6) ? [{
    id: "as1", name: "Plant", source: pick(["entered", "entered", "finance"]),
    purchase_price: 5000 + money(200000), residual_value: money(5000),
    useful_life_months: pick([36, 60, 84, 120]), method: pick(["straight_line", "diminishing"]),
    start_year: pick([1, 1, 2, 3]), start_month: 1 + Math.floor(r() * 12),
    gst_applies: !maybe(0.2),
  }] : [];

  const funding: Record<string, unknown>[] = [];

  /**
   * A financed asset is owned by its loan — the database enforces it, so the harness does too. Without the
   * matching debt row the asset appears on the balance sheet out of nowhere, which is a fault in the plan,
   * not in the engine.
   */
  if (assets.length && assets[0].source === "finance") {
    const amount = assets[0].purchase_price as number;
    funding.push({
      id: "fa", kind: "debt", name: "Equipment finance", amount,
      start_year: assets[0].start_year, start_month: assets[0].start_month,
      loan: {
        amount_drawn: amount, interest_rate: 6, term_months: 60, repayment_type: "amortised",
        payment_frequency: "monthly", start_year: assets[0].start_year, start_month: assets[0].start_month,
      },
    });
  }

  if (maybe(0.6)) {
    const amount = 10000 + money(400000);
    // The app writes both dates from one field (`loanOf`), so the harness does too.
    const sy = pick([1, 1, 2]), sm = 1 + Math.floor(r() * 12);
    funding.push({
      id: "f1", kind: "debt", name: "Lender", amount,
      start_year: sy, start_month: sm,
      loan: {
        amount_drawn: amount, interest_rate: Math.round(r() * 15 * 10) / 10,
        term_months: pick([24, 36, 60, 84]),
        repayment_type: pick(["amortised", "interest_only", "amortised"]),
        payment_frequency: pick(["monthly", "fortnightly", "quarterly"]),
        start_year: sy, start_month: sm,
      },
    });
  }
  if (maybe(0.3)) funding.push({ id: "f2", kind: "equity", name: "Investor", amount: money(300000), start_year: pick([1, 2]), start_month: 1 + Math.floor(r() * 12) });
  if (maybe(0.25)) {
    const amt = 20000 + money(150000);
    const rbfMonth = 1 + Math.floor(r() * 6);
    funding.push({
      id: "f3", kind: "revenue_linked", name: "RBF", amount: amt, start_year: 1, start_month: rbfMonth,
      rbf: { amount_received: amt, repayment_percent: 3 + Math.round(r() * 12), cap_multiple: 1.1 + Math.round(r() * 60) / 100, min_monthly_payment: maybe(0.3) ? money(2000) : 0, start_year: 1, start_month: rbfMonth },
    });
  }

  const extraordinary: Record<string, unknown>[] = [];
  if (maybe(0.4)) extraordinary.push({ id: "e1", description: "Grant", category: "income", amount: money(80000), year: pick([1, 2, 3]), month: 1 + Math.floor(r() * 12), source_asset_id: null });
  if (maybe(0.3)) extraordinary.push({ id: "e2", description: "Claim", category: "expense", amount: money(60000), year: pick([1, 2, 3, 4]), month: 1 + Math.floor(r() * 12), source_asset_id: null });
  if (assets.length && assets[0].source !== "finance" && maybe(0.25)) {
    extraordinary.push({ id: "e3", description: "Sell the plant", category: "income", amount: money(120000), year: pick([2, 3, 4]), month: 1 + Math.floor(r() * 12), source_asset_id: "as1" });
  }

  const overheads = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => ({
    id: `o${i}`, name: `Cost ${i}`, current_value: money(180000),
    yearly_change: { "2": Math.round(r() * 8), "3": Math.round(r() * 8) },
    start_year: pick([1, 1, 2]), on_cost: maybe(0.15), monthly_distribution: dist(),
    gst_applies: !maybe(0.25),
  }));

  return {
    sources: {
      products, costProducts: products,
      fixedCogs: maybe(0.4) ? [{ annual_cost: money(90000), yearly_growth_rates: { "2": 4 }, monthly_distribution: dist(), gst_applies: !maybe(0.2) }] : [],
      overheads,
      salaries: FORECAST_YEARS.map(() => money(250000)),
      marketing: FORECAST_YEARS.map(() => money(60000)),
      onCostPct: Math.round(r() * 15 * 10) / 10,
      funding, assets, extraordinary,
    } as unknown as PlanSources & GstPlanSources,
    openingCash: money(300000),
    taxRate: Math.round(r() * 35),
    dividendRate: pick([0, 0, 20, 50, 100]),
    days: { debtorDays: Math.floor(r() * 90), inventoryDays: Math.floor(r() * 60), creditorDays: Math.floor(r() * 75) },
    timing: { taxPaidPct: Math.round(r() * 100), prepaidClosing: money(20000), accruedClosing: money(20000) },
    place: pick([
      ["Australia", null], ["United Kingdom", null], ["Canada", "Ontario"],
      ["Canada", "British Columbia"], ["Canada", "Quebec"], ["United States", "California"],
      ["United States", "Oregon"], ["New Zealand", null], [null, null],   // null = not registered
    ] as [string | null, string | null][]),
    openingTaxLosses: maybe(0.3) ? money(200000) : 0,
    openingRetainedEarnings: maybe(0.4) ? money(400000) - 200000 : 0,
  };
}
export type GeneratedPlan = ReturnType<typeof makePlan>;
