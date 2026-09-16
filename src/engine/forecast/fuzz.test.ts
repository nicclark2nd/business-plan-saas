import { describe, expect, it } from "vitest";
import { assembleBase, assembleMonths, assembleOpening } from "./assemble";
import { assembleGst } from "./gst_assemble";
import { buildForecast, FORECAST_YEARS } from "./model";
import { buildMonthlyCashFlow, monthlyInvariants } from "./monthly";
import { settingsFor } from "../plan/gst";
import { regimeFor } from "../plan/taxRegimes";
import { planRevenueByYear, planYear1Months } from "../sales/product";
import { planCogsByYear, planCogsMonths } from "../cogs/direct";
import { overheadsByYear, overheadsMonths, planOverheadLines } from "../overheads/expenses";
import { assetsByYear, capexMonths, capexByYear, withDisposals } from "../assets/depreciation";
import { soldMonthByAsset } from "../extraordinary/items";
import { makePlan } from "./plans.fixture";

function runPlan(p: ReturnType<typeof makePlan>) {
  const components = p.place[0] ? regimeFor(p.place[0], p.place[1]).components.map((c) => settingsFor(c)) : [];
  const gst = assembleGst(p.sources, components);
  const base = assembleBase(p.sources);
  for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];

  const f = buildForecast({
    base,
    opening: assembleOpening(null, p.openingCash, 0),
    workingCapital: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.days])),
    cashTiming: Object.fromEntries(FORECAST_YEARS.map((y) => [y, p.timing])),
    taxRate: p.taxRate, dividendRate: p.dividendRate,
    openingTaxLosses: p.openingTaxLosses, openingRetainedEarnings: p.openingRetainedEarnings,
  });
  const monthly = buildMonthlyCashFlow({
    openingCash: f.cashFlow[1].openingCash,
    opening: { accountsReceivable: 0, inventory: 0, accountsPayable: 0, prepaid: 0, accrued: 0 },
    closing: {
      accountsReceivable: f.workingCapital[1].accountsReceivable, inventory: f.workingCapital[1].inventory,
      accountsPayable: f.workingCapital[1].accountsPayable, prepaid: f.workingCapital[1].prepaid, accrued: f.workingCapital[1].accrued,
    },
    taxPaid: f.cashFlow[1].taxPaid, dividends: f.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(p.sources, components),
  });
  return { f, gst, monthly, components };
}

const CASES = 2000;
const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

/**
 * A thousand plans nobody would have thought to type (§6.40).
 *
 * Every hand-written test asserts something someone already suspected. This one generates plans at random —
 * seasonal and flat, recurring and one-off, linked lines, lines starting in Year 4, financed assets,
 * balloon loans, revenue-linked finance, disposals, exempt lines, nine tax regimes — and holds every one of
 * them to the same rules the app claims are always true. It is deterministic: the seed is the case number,
 * so a failure names a plan that can be rebuilt exactly.
 */
describe("a thousand plans nobody would have typed (§6.40)", () => {
  const failures: string[] = [];

  for (let seed = 0; seed < CASES; seed++) {
    const p = makePlan(seed);
    const where = `${p.place[0] ?? "unregistered"}${p.place[1] ? `/${p.place[1]}` : ""}`;
    let r: ReturnType<typeof runPlan>;
    try { r = runPlan(p); } catch (e) { failures.push(`#${seed} ${where}: threw ${(e as Error).message}`); continue; }

    const note = (what: string, v: number, tol = 0.5) => {
      if (!Number.isFinite(v)) failures.push(`#${seed} ${where}: ${what} is not a number`);
      else if (Math.abs(v) > tol) failures.push(`#${seed} ${where}: ${what} out by ${Math.round(v * 100) / 100}`);
    };

    for (const y of FORECAST_YEARS) {
      note(`balance sheet Y${y}`, r.f.balanceSheet[y].balanceCheck);
    }
    for (const i of r.f.invariants) if (!i.passed) note(`${i.label} Y${i.year}`, i.difference);
    for (const i of monthlyInvariants(r.monthly, r.f.cashFlow[1])) if (!i.passed) note(i.label, i.difference);

    // Every module's year must equal its own twelve months (§6.21.1).
    note("Year 1 revenue vs its months",
      sum(planYear1Months(p.sources.products)) - planRevenueByYear(p.sources.products)[0].value);
    note("Year 1 cost of sales vs its months",
      sum(planCogsMonths(p.sources.costProducts, p.sources.fixedCogs, (c) => p.sources.products.find((x) => x.id === c.clients_from_product_id) ?? null))
      - planCogsByYear(p.sources.costProducts, p.sources.fixedCogs, (c) => p.sources.products.find((x) => x.id === c.clients_from_product_id) ?? null)[0].total);
    const lines = planOverheadLines(p.sources.overheads, p.sources.salaries, p.sources.marketing);
    note("Year 1 overheads vs its months",
      sum(overheadsMonths(lines, p.sources.onCostPct)) - overheadsByYear(lines, p.sources.onCostPct)[0].total);
    note("Year 1 capex vs its months",
      sum(capexMonths(p.sources.assets)) - sum(p.sources.assets.map((a) => capexByYear(a)[0])));

    // The forecast must read the same figures the screens display (§6.32.1).
    for (const y of FORECAST_YEARS) {
      note(`forecast revenue Y${y} vs Sales`, r.f.pnl[y].revenue - planRevenueByYear(p.sources.products)[y - 1].value);
      // The Assets screen reads its assets with their disposals attached, so this must too (§6.56).
      const shown = assetsByYear(withDisposals(p.sources.assets, soldMonthByAsset(p.sources.extraordinary)));
      note(`forecast depreciation Y${y} vs Assets`, r.f.pnl[y].depreciation - shown[y - 1].depreciation);
    }

    // Tax can never be charged on a loss, nor a dividend paid out of one.
    for (const y of FORECAST_YEARS) {
      if (r.f.pnl[y].taxableProfit < 0) failures.push(`#${seed} ${where}: negative taxable profit Y${y}`);
      if (r.f.pnl[y].tax < 0) failures.push(`#${seed} ${where}: negative tax Y${y}`);
      if (r.f.pnl[y].dividends < 0) failures.push(`#${seed} ${where}: negative dividend Y${y}`);
      if (r.f.pnl[y].lossesCarriedForward < 0) failures.push(`#${seed} ${where}: negative loss pool Y${y}`);
    }

    // The tax parts must add to the whole, in every regime.
    for (const y of FORECAST_YEARS) {
      const parts = r.gst.byComponent[y] ?? [];
      if (parts.length) {
        note(`tax parts vs whole Y${y}`,
          Math.round(parts.reduce((a, x) => a + x.schedule.closingPayable, 0) * 100) / 100 - r.gst.schedules[y].closingPayable);
      }
      // A non-reclaimable regime must never produce a credit.
      if (r.components.length && r.components.every((c) => !c.reclaimable)) {
        if (r.gst.byYear[y].onCogs !== 0) failures.push(`#${seed} ${where}: claimed a credit it cannot claim, Y${y}`);
      }
    }
  }

  it.skip("dumps the first failing plan — unskip to diagnose", () => {
    for (let seed = 0; seed < CASES; seed++) {
      const p = makePlan(seed);
      const r = runPlan(p);
      const bad = FORECAST_YEARS.find((y) => Math.abs(r.f.balanceSheet[y].balanceCheck) > 0.5);
      if (!bad) continue;
      const bs = r.f.balanceSheet[bad];
      console.log("seed", seed, p.place, "year", bad, "out by", bs.balanceCheck);
      console.log("assets:", JSON.stringify({ cash: bs.cash, ar: bs.accountsReceivable, inv: bs.inventory, prepaid: bs.prepaid, gstRec: bs.gstReceivable, other: bs.otherCurrentAssets, fixed: bs.fixedAssets, total: bs.totalAssets }));
      console.log("liabs :", JSON.stringify({ ap: bs.accountsPayable, accrued: bs.accrued, tax: bs.taxPayable, gst: bs.gstPayable, debtCur: bs.debtCurrent, debtNon: bs.debtNonCurrent, total: bs.totalLiabilities, equity: bs.equity }));
      console.log("assets:", JSON.stringify(p.sources.assets));
      console.log("funding:", JSON.stringify(p.sources.funding));
      console.log("extraordinary:", JSON.stringify(p.sources.extraordinary));
      break;
    }
  });

  it(`holds every rule across ${CASES} generated plans`, () => {
    expect(failures.slice(0, 25)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});
