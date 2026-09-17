import { describe, expect, it } from "vitest";
import { pnlMonths, serviceProfit } from "./lines";
import { assembleMonths, assembleBase, type PlanSources } from "../forecast/assemble";
import { planCogsByYear, type CostProduct } from "../cogs/direct";
import { planRevenueByYear, sourceOf, type AnyProduct } from "../sales/product";
import { FORECAST_YEARS } from "../forecast/model";
import { makePlan } from "../forecast/plans.fixture";

const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

describe("the profit and loss month by month", () => {
  /**
   * The same discipline the cash flow is held to: twelve months that do not add to their own year are
   * twelve months nobody can trust. Run across generated plans, in every year, since §6.71.
   */
  it("adds to its own year, every line, every year, across 30 plans", () => {
    const broken: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const p = makePlan(seed);
      const src = p.sources as unknown as PlanSources;
      const base = assembleBase(src);
      for (const y of FORECAST_YEARS) {
        const m = pnlMonths(assembleMonths(src, undefined, 0, y));
        const b = base[y];
        const gap = (what: string, months: number, year: number) => {
          if (Math.abs(months - year) > 0.5) broken.push(`seed ${seed} Y${y} ${what}: ${months} vs ${year}`);
        };
        gap("revenue", sum(m.map((x) => x.revenue)), b.revenue);
        gap("cogs", sum(m.map((x) => x.cogs)), b.variableCogs + b.fixedCogs);
        gap("overheads", sum(m.map((x) => x.overheads)), b.overheads);
        gap("depreciation", sum(m.map((x) => x.depreciation)), b.depreciation);
      }
    }
    expect(broken.slice(0, 8)).toEqual([]);
  });

  it("stops at operating profit, because everything below it belongs to a year", () => {
    const p = makePlan(3);
    const m = pnlMonths(assembleMonths(p.sources as unknown as PlanSources, undefined, 0, 1));
    expect(m).toHaveLength(12);
    expect(Object.keys(m[0]).sort()).toEqual(
      ["cogs", "depreciation", "grossProfit", "month", "operatingProfit", "overheads", "revenue"]);
    for (const x of m) expect(x.grossProfit).toBeCloseTo(x.revenue - x.cogs, 2);
  });
});

describe("what each line contributes", () => {
  const plan = makePlan(4);
  const products = plan.sources.products as unknown as (CostProduct & { id?: string; name?: string | null })[];
  const rows = serviceProfit(products, (c) => sourceOf(c as unknown as AnyProduct, plan.sources.products as unknown as AnyProduct[]));

  it("adds to the plan's own revenue and cost of sales", () => {
    const cogs = planCogsByYear(products, plan.sources.fixedCogs as never[], (c) => sourceOf(c as unknown as AnyProduct, plan.sources.products as unknown as AnyProduct[]));
    expect(sum(rows.map((r) => r.revenue))).toBeCloseTo(planRevenueByYear(plan.sources.products as unknown as AnyProduct[])[0].value, 0);
    // Only the VARIABLE cost sits on a line. Fixed cost of sales belongs to no single line, and saying it
    // did would be the allocation this table refuses to invent.
    expect(sum(rows.map((r) => r.cogs))).toBeCloseTo(cogs[0].variable, 0);
  });

  it("shares out the gross profit the lines actually earned, to a hundred", () => {
    const earning = rows.filter((r) => r.grossProfit > 0);
    if (!earning.length) return;
    expect(sum(earning.map((r) => r.shareOfGross ?? 0))).toBeCloseTo(100, 0);
    // A line losing money earns no share of the total rather than a negative one.
    for (const r of rows.filter((x) => x.grossProfit <= 0)) expect(r.shareOfGross).toBe(0);
  });

  it("is ordered by what each line earns, most first", () => {
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].grossProfit).toBeGreaterThanOrEqual(rows[i].grossProfit);
  });

  it("has no net profit per line, and will not have one", () => {
    for (const r of rows) expect("netProfit" in r).toBe(false);
  });
});
