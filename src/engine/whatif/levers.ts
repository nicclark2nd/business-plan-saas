/**
 * The What-If planner's engine (§6.41).
 *
 * Seven levers, and the real forecast underneath them.
 *
 * The mockup's headline number was a fudge: `low = B.low + dWC + dE * 0.75 / 6` — the profit change spread
 * over six months to approximate "lowest cash in Year 1". APeX's scenario engine cannot do better, because
 * it is annual only: it has no February to be lowest in. This one approximates nothing. It applies the
 * levers to the plan's own rows and re-runs the same pipeline the Forecast screen runs — assemble, forecast,
 * twelve months — so "lowest cash 8,412, in March" is the arithmetic the cash flow already shows rather than
 * a curve fitted through it. If the two ever disagreed, one of them would be lying, and the client would
 * find that out from their bank.
 *
 * **It computes no business figure of its own.** The levers change plan rows; everything after that is the
 * engine that was already there, invariants included — a scenario that does not reconcile says so. That is
 * also what makes "apply this scenario" possible later: a scenario is a set of edits to the plan, and the
 * plan already knows how to be a forecast.
 *
 * Three decisions worth stating, because a client will ask:
 *
 *   - **Per-lever contribution is measured, not derived.** Each lever's effect is a full re-run with that one
 *     lever moved from the plan's own position. Levers interact — a price rise on more units is worth more
 *     than either alone — so the seven do not add to the total, and the remainder is shown on its own line
 *     rather than quietly folded into whichever lever happened to be calculated last.
 *   - **The days levers move Year 1 only.** Debtor, stock and creditor days are what a client can change this
 *     year by chasing invoices or renegotiating terms. Later years keep the plan's own assumptions, which is
 *     also what the apply exit would write: Settings → Year 1 debtor days.
 *   - **Volume wins more work; it does not invent an existing book.** On an ongoing line the lever scales the
 *     clients won — the annual figure and the twelve monthly counts together, or the months would stop adding
 *     to their year (§6.21.1) — and leaves `opening_clients` alone. Clients already on the books were not won
 *     by a decision taken today.
 */
import { assembleBase, assembleMonths, type PlanSources } from "../forecast/assemble";
import { assembleGst, type GstPlanSources } from "../forecast/gst_assemble";
import {
  FORECAST_YEARS, buildForecast,
  type CashTiming, type Forecast, type Invariant, type OpeningBalance, type WorkingCapitalDays,
} from "../forecast/model";
import { buildMonthlyCashFlow, monthlyInvariants, type MonthlyCashFlow } from "../forecast/monthly";
import { NOT_REGISTERED, type GstSettings } from "../plan/gst";
import { unitsByYear, type AnyProduct } from "../sales/product";
import type { CostProduct } from "../cogs/direct";
import type { Growth } from "../sales/projection";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

/* ------------------------------------------------------------------ *
 * The levers                                                          *
 * ------------------------------------------------------------------ */

export type LeverKey = "price" | "volume" | "cogs" | "overheads" | "debtorDays" | "stockDays" | "creditorDays";

export const LEVER_KEYS: readonly LeverKey[] = [
  "price", "volume", "cogs", "overheads", "debtorDays", "stockDays", "creditorDays",
] as const;

/**
 * Where each lever sits. The first four are a percentage change on what the plan says; the last three are a
 * number of days outright, because that is how a client thinks about them — "pay in 30" is a term, not a
 * 28.6 % improvement. A null day figure means the plan's own, whatever it is.
 */
export type Levers = {
  price: number;
  volume: number;
  cogs: number;
  overheads: number;
  debtorDays: number | null;
  stockDays: number | null;
  creditorDays: number | null;
};

/** Every lever at rest. A run from here must reproduce the Forecast screen exactly. */
export const NEUTRAL: Levers = {
  price: 0, volume: 0, cogs: 0, overheads: 0, debtorDays: null, stockDays: null, creditorDays: null,
};

const NO_DAYS: WorkingCapitalDays = { debtorDays: 0, inventoryDays: 0, creditorDays: 0 };

/** Where the sliders start: nothing changed, and the days the plan actually assumes for Year 1. */
export function planLevers(year1: WorkingCapitalDays | undefined): Levers {
  const d = year1 ?? NO_DAYS;
  return { ...NEUTRAL, debtorDays: n(d.debtorDays), stockDays: n(d.inventoryDays), creditorDays: n(d.creditorDays) };
}

/** The same levers with every null resolved against the plan, so two positions can be compared as numbers. */
export function settleLevers(levers: Levers, year1: WorkingCapitalDays | undefined): Levers {
  const base = planLevers(year1);
  return {
    price: n(levers.price), volume: n(levers.volume), cogs: n(levers.cogs), overheads: n(levers.overheads),
    debtorDays: levers.debtorDays == null ? base.debtorDays : n(levers.debtorDays),
    stockDays: levers.stockDays == null ? base.stockDays : n(levers.stockDays),
    creditorDays: levers.creditorDays == null ? base.creditorDays : n(levers.creditorDays),
  };
}

/** Which levers the client has actually moved. Everything else costs nothing to answer. */
export const moved = (levers: Levers, base: Levers): LeverKey[] =>
  LEVER_KEYS.filter((k) => n(levers[k]) !== n(base[k]));

/* ------------------------------------------------------------------ *
 * Applying them to the plan                                           *
 * ------------------------------------------------------------------ */

const factor = (pct: unknown) => 1 + n(pct) / 100;

/**
 * The plan, as it would be if the levers were true (§6.41).
 *
 * Nothing is recomputed here: rows are rewritten and handed back, so every function downstream reads a plan
 * exactly as it reads the real one. A lever that has not moved returns the caller's own objects untouched,
 * which is both faster and one less chance to alter something by copying it.
 */
export function applyLevers(sources: PlanSources, levers: Levers, from: StartYear = 1): PlanSources {
  const price = factor(levers.price), volume = factor(levers.volume);
  const cogs = factor(levers.cogs), overheads = factor(levers.overheads);
  if (price === 1 && volume === 1 && cogs === 1 && overheads === 1) return sources;

  const lands = (start: unknown) => landsIn(start, from);
  const compound = compoundPct;

  /**
   * A later year whose figure was typed outright (§6.26) is a number, not a growth rate, so a percentage
   * lever has to move it too. Leave it alone and a plan that typed "Year 2: 140 units" would answer the
   * volume lever in Year 1 and ignore it for the other four.
   */
  const grown = (g: Growth | null | undefined, at: { year: number; isBase: boolean }): Growth | null => {
    if (price === 1 && volume === 1) return g ?? null;
    const out: Growth = Object.fromEntries(Object.entries(g ?? {}).map(([year, y]) => [year, {
      ...y,
      // A figure typed outright is a number, not a rate, so it moves with the lever too (§6.26) — but only
      // from the year the change takes effect.
      priceValue: y?.priceValue == null || Number(year) < at.year ? y?.priceValue : n(y.priceValue) * price,
      unitsValue: y?.unitsValue == null || Number(year) < at.year ? y?.unitsValue : n(y.unitsValue) * volume,
    }]));
    if (!at.isBase) {
      const y = out[String(at.year)] ?? {};
      out[String(at.year)] = {
        ...y,
        price: y.priceValue != null ? y.price : compound(y.price, price),
        units: y.unitsValue != null ? y.units : compound(y.units, volume),
      };
    }
    return out;
  };

  /** Clients won each month — counts the client typed, scaled with the year so the twelve still add to it. */
  const won = (m: Record<string, number> | null | undefined) =>
    !m || volume === 1 ? m ?? null
      : Object.fromEntries(Object.entries(m).map(([k, v]) => [k, n(v) * volume]));

  const adjust = <T extends AnyProduct & { cost_per_unit?: number | null; yearly_cost_increase?: Record<string, number> | null }>(p: T): T => {
    const at = lands(p.start_selling_year);
    const out: T = {
      ...p,
      average_price: at.isBase ? n(p.average_price) * price : n(p.average_price),
      units_sold: at.isBase ? n(p.units_sold) * volume : n(p.units_sold),
      // The twelve monthly counts belong to Year 1, so they follow only a Year 1 change (§6.21.1).
      monthly_new_clients: at.isBase && at.year === 1 ? won(p.monthly_new_clients) : p.monthly_new_clients ?? null,
      yearly_growth: grown(p.yearly_growth, at),
    };
    // Fixed cost of sales is a yard and a production wage: it does not move with the price of a widget,
    // which is the same split the mockup makes — vc × (1 + v) × (1 + c), fc untouched.
    if (out.cost_per_unit != null && cogs !== 1) {
      if (at.isBase) out.cost_per_unit = n(out.cost_per_unit) * cogs;
      else {
        out.yearly_cost_increase = { ...(out.yearly_cost_increase ?? {}), [String(at.year)]: compound(out.yearly_cost_increase?.[String(at.year)], cogs) };
      }
    }
    return out;
  };

  const products = sources.products.map(adjust);
  /**
   * The Forecast page passes ONE array as both `products` and `costProducts`, and the cost side finds a
   * linked line by id in the sales side. Mapping twice would hand the engine two adjusted copies of the same
   * row; sharing the array when the caller shared it keeps that impossible.
   */
  const costProducts = (sources.costProducts === (sources.products as unknown as CostProduct[])
    ? products
    : sources.costProducts.map(adjust)) as unknown as CostProduct[];

  /**
   * Overheads. A typed row carries its figure in `current_value`; the People and Marketing lines are synced
   * and carry theirs in the arrays beside them (§6.19). Each line reads exactly one of the two, so scaling
   * both moves every line once and none of them twice. On-costs are a percentage of wages, so they follow.
   */
  const scale = (a: number[]) => (overheads === 1 ? a : a.map((v) => n(v) * overheads));

  return {
    ...sources,
    products,
    costProducts,
    /** An overhead's amount is its first plan year, the same shape a product has (§6.47). */
    overheads: overheads === 1 ? sources.overheads : sources.overheads.map((o) => {
      const at = lands(o.start_year);
      return at.isBase
        ? { ...o, current_value: n(o.current_value) * overheads }
        : { ...o, yearly_change: { ...(o.yearly_change ?? {}), [String(at.year)]: compound(o.yearly_change?.[String(at.year)], overheads) } };
    }),
    salaries: scale(sources.salaries),
    marketing: scale(sources.marketing),
  };
}

/**
 * How far the days levers reach (§6.43). The sliders model Year 1, which is what the screen shows and what
 * "apply" writes by default. `all` is for answering the other question the client is asked when they save:
 * a change in terms is usually permanent, and they should see the five-year consequence before choosing it.
 */
export type DayScope = "year1" | "all";

/**
 * The year a scenario takes effect (§6.46).
 *
 * Every lever used to mean "from Year 1, day one". A business planning to raise prices NEXT financial year
 * means something different, and the plan can hold both: a change that starts in Year 1 moves the figure a
 * line opens with, and one that starts later compounds into that year's own % change box — which is where
 * the modules already keep changes, and which the client can then see and edit.
 *
 * One rule covers both, and every line whatever year it starts selling in: a change takes effect in
 * `max(from, the line's own first year)`. Where that IS the line's first year it moves the base, because a
 * first year has nothing before it to grow from; otherwise it compounds into that year's change.
 */
export type StartYear = 1 | 2 | 3 | 4 | 5;

/**
 * Where a change lands for a line that begins in `start`, given a scenario starting in `from`.
 *
 * `isBase` means the year it lands in is the line's own first year, which has nothing before it to grow
 * from — so the change moves the figure the line opens with. Otherwise it belongs in that year's own %
 * change box. Exported because `plannedChanges` has to make exactly the same decision about exactly the same
 * row, and two copies of this rule would be two answers.
 */
export function landsIn(start: unknown, from: StartYear): { year: number; isBase: boolean } {
  const first = Math.min(5, Math.max(1, Math.trunc(n(start)) || 1));
  const year = Math.max(from, first);
  return { year, isBase: year === first };
}

/** A further change on top of one already typed. Compounded: 2 % then 4 % is 6.08 %, not 6 %. */
export const compoundPct = (existing: unknown, factorOf: number) =>
  ((1 + n(existing) / 100) * factorOf - 1) * 100;

/** The working-capital schedule with the levers' days written into Year 1, or into every year. */
export function applyDays(
  schedule: Record<number, WorkingCapitalDays>, levers: Levers, scope: DayScope = "year1",
): Record<number, WorkingCapitalDays> {
  const y1 = schedule[1] ?? NO_DAYS;
  const debtorDays = levers.debtorDays == null ? n(y1.debtorDays) : Math.max(0, n(levers.debtorDays));
  const inventoryDays = levers.stockDays == null ? n(y1.inventoryDays) : Math.max(0, n(levers.stockDays));
  const creditorDays = levers.creditorDays == null ? n(y1.creditorDays) : Math.max(0, n(levers.creditorDays));
  const days = { debtorDays, inventoryDays, creditorDays };
  if (scope === "all") {
    return Object.fromEntries(FORECAST_YEARS.map((y) => [y, days]));
  }
  if (debtorDays === n(y1.debtorDays) && inventoryDays === n(y1.inventoryDays) && creditorDays === n(y1.creditorDays)) {
    return schedule;
  }
  return { ...schedule, 1: days };
}

/* ------------------------------------------------------------------ *
 * Running it                                                          *
 * ------------------------------------------------------------------ */

/**
 * Everything the Forecast page feeds the engine, in one object. The What-If screen is handed this once and
 * re-runs it on the client as the sliders move — which the engine can do because it imports no app, no
 * React and no Supabase, and always could.
 */
export type WhatIfPlan = {
  sources: PlanSources;
  opening: OpeningBalance;
  workingCapital: Record<number, WorkingCapitalDays>;
  cashTiming: Record<number, CashTiming>;
  taxRate: number;
  dividendRate: number;
  openingTaxLosses?: number;
  openingRetainedEarnings?: number;
  openingGstPayable?: number;
  /** The plan's tax components (§6.39). Absent or empty means not registered. */
  components?: GstSettings[];
};

/** The figures a lever is judged by. Every one of them is Year 1, and every one is read, never derived. */
export type Measures = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  overheads: number;
  operatingProfit: number;
  netProfit: number;
  netCashFlow: number;
  closingCash: number;
  /** The tightest month-end balance of the twelve — the real one, not a curve through the year. */
  lowestCash: number;
  /**
   * Where Year 1 closes on the three things the days levers move. They are here rather than derived on the
   * screen so that "customers paying 20 days sooner is worth 34,800" is the balance sheet's own figure.
   */
  accountsReceivable: number;
  inventory: number;
  accountsPayable: number;
};

export type Outcome = Measures & {
  grossMargin: number | null;
  /** Which month the tightest balance falls in, 1–12. */
  lowestMonth: number;
  /** Months that close below zero. Empty is the answer the client wants. */
  negativeMonths: number[];
  /** Units won in Year 1 across every line — jobs for a one-off line, clients for an ongoing one. */
  unitsYear1: number;
  /** Whether the scenario's own statements still hold together. A scenario that does not reconcile is not one. */
  reconciled: boolean;
};

export type Run = {
  levers: Levers;
  forecast: Forecast;
  monthly: MonthlyCashFlow;
  invariants: Invariant[];
  outcome: Outcome;
};

const MEASURE_KEYS = [
  "revenue", "cogs", "grossProfit", "overheads", "operatingProfit", "netProfit", "netCashFlow",
  "closingCash", "lowestCash", "accountsReceivable", "inventory", "accountsPayable",
] as const;

const ZERO_MEASURES = (): Measures =>
  Object.fromEntries(MEASURE_KEYS.map((k) => [k, 0])) as unknown as Measures;

const subtract = (a: Measures, b: Measures): Measures =>
  Object.fromEntries(MEASURE_KEYS.map((k) => [k, r2(a[k] - b[k])])) as unknown as Measures;

const addInto = (a: Measures, b: Measures): Measures =>
  Object.fromEntries(MEASURE_KEYS.map((k) => [k, r2(a[k] + b[k])])) as unknown as Measures;

/**
 * One position of the levers, run through the real pipeline (§6.41).
 *
 * This is deliberately the same five calls the Forecast page makes, in the same order, from the same
 * functions. Nothing is short-circuited for speed: a What-If that took a cheaper path would be a second
 * computation of the plan's own figures, which is the fault that has cost this project more than any other.
 */
export function runPlan(plan: WhatIfPlan, levers: Levers, dayScope: DayScope = "year1", from: StartYear = 1): Run {
  const sources = applyLevers(plan.sources, levers, from);
  const workingCapital = applyDays(plan.workingCapital, levers, dayScope);
  const components = plan.components?.length ? plan.components : [NOT_REGISTERED];
  const openingGstPayable = n(plan.openingGstPayable);

  const gst = assembleGst(sources as unknown as GstPlanSources, components, openingGstPayable);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gst.byYear[y];

  const forecast = buildForecast({
    base,
    opening: plan.opening,
    workingCapital,
    cashTiming: plan.cashTiming,
    taxRate: plan.taxRate,
    dividendRate: plan.dividendRate,
    openingTaxLosses: plan.openingTaxLosses,
    openingRetainedEarnings: plan.openingRetainedEarnings,
    openingGstPayable,
  });

  const monthly = buildMonthlyCashFlow({
    openingCash: forecast.cashFlow[1].openingCash,
    opening: {
      accountsReceivable: plan.opening.accountsReceivable, inventory: plan.opening.inventory,
      accountsPayable: plan.opening.accountsPayable, prepaid: plan.opening.prepaid, accrued: plan.opening.accrued,
    },
    closing: {
      accountsReceivable: forecast.workingCapital[1].accountsReceivable,
      inventory: forecast.workingCapital[1].inventory,
      accountsPayable: forecast.workingCapital[1].accountsPayable,
      prepaid: forecast.workingCapital[1].prepaid,
      accrued: forecast.workingCapital[1].accrued,
    },
    taxPaid: forecast.cashFlow[1].taxPaid,
    dividends: forecast.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(sources, components, openingGstPayable),
  });

  const invariants = [...forecast.invariants, ...monthlyInvariants(monthly, forecast.cashFlow[1])];
  const p = forecast.pnl[1], c = forecast.cashFlow[1], w = forecast.workingCapital[1];
  const outcome: Outcome = {
    revenue: p.revenue,
    cogs: p.cogs,
    grossProfit: p.grossProfit,
    overheads: p.overheads,
    operatingProfit: p.operatingProfit,
    netProfit: p.netProfit,
    netCashFlow: c.netMovement,
    closingCash: c.closingCash,
    lowestCash: monthly.low.closingCash,
    accountsReceivable: w.accountsReceivable,
    inventory: w.inventory,
    accountsPayable: w.accountsPayable,
    grossMargin: p.grossMargin,
    lowestMonth: monthly.low.month,
    negativeMonths: monthly.negative,
    unitsYear1: r2(sources.products.reduce((t, x) => t + n(unitsByYear(x)[0]), 0)),
    reconciled: invariants.every((i) => i.passed),
  };

  return { levers, forecast, monthly, invariants, outcome };
}

/* ------------------------------------------------------------------ *
 * What each lever is worth                                            *
 * ------------------------------------------------------------------ */

export type Contribution = { lever: LeverKey; moved: boolean; effect: Measures };

/**
 * The tightest month, and what each lever does to the bank balance IN IT (§6.41).
 *
 * The lowest of twelve balances is a minimum, and a minimum does not add up. Move one lever and the tightest
 * month moves with it, so "what the price rise is worth to the lowest cash" would be comparing the balance in
 * July against the balance in June — two different questions, and on a real plan the parts then missed the
 * total by four hundred thousand, which reads as a broken screen because it is a meaningless sum.
 *
 * Fixing the month first makes the parts comparable: every figure here is the balance in the same month, the
 * one the scenario on screen is tightest in. What is left over is a genuine interaction, and small.
 */
export type Tightest = {
  month: number;
  base: number;
  adjusted: number;
  change: number;
  contributions: { lever: LeverKey; moved: boolean; effect: number }[];
  interaction: number;
};

export type WhatIf = {
  /** Where the plan stands today. Identical to the Forecast screen, to the cent. */
  base: Run;
  /** Where it stands with the levers as set. */
  adjusted: Run;
  /** The whole change, base to adjusted. */
  total: Measures;
  /** What each lever is worth on its own, measured by re-running the plan with only that one moved. */
  contributions: Contribution[];
  /**
   * What the levers are worth together and separately cannot account for. A price rise on more units earns
   * more than the two apart, so the seven contributions do not add to the total; the difference is real and
   * belongs on the screen under its own name rather than hidden inside one of them.
   */
  interaction: Measures;
  /** The tightest month of the scenario, and what each lever is worth inside it. */
  tightest: Tightest;
};

/**
 * Every lever's worth, and the plan they add up to (§6.41).
 *
 * Cost is one run for the plan as it stands, one for the levers as set, and one for each lever the client has
 * actually moved — so an untouched screen is one run and a fully worked scenario is nine. Each run is the
 * whole forecast, which is the point: the contribution of "creditor days 15 → 45" is the difference two real
 * forecasts make, interactions and rounding and the December remainder included, not a formula for it.
 */
export function runWhatIf(plan: WhatIfPlan, levers: Levers, from: StartYear = 1): WhatIf {
  const baseline = planLevers(plan.workingCapital[1]);
  const set = settleLevers(levers, plan.workingCapital[1]);
  const changed = moved(set, baseline);

  // The plan as it stands is the plan as it stands, whichever year a change would have started in.
  const base = runPlan(plan, baseline);
  const runs = new Map<LeverKey, Run>();
  for (const key of changed) runs.set(key, runPlan(plan, { ...baseline, [key]: set[key] }, "year1", from));

  // One lever moved and the single-lever run IS the scenario; no reason to compute it twice.
  const adjusted = changed.length === 0 ? base
    : changed.length === 1 ? runs.get(changed[0])!
      : runPlan(plan, set, "year1", from);

  const total = subtract(adjusted.outcome, base.outcome);
  const contributions: Contribution[] = LEVER_KEYS.map((lever) => {
    const run = runs.get(lever);
    return {
      lever,
      moved: !!run,
      effect: run ? subtract(run.outcome, base.outcome) : ZERO_MEASURES(),
    };
  });

  const explained = contributions.reduce((a, c) => addInto(a, c.effect), ZERO_MEASURES());

  // Every lever measured in the one month the scenario is tightest in, so the parts are comparable.
  const month = adjusted.outcome.lowestMonth;
  const cashIn = (run: Run) => n(run.monthly.months[month - 1]?.closingCash);
  const opening = cashIn(base);
  const inMonth = LEVER_KEYS.map((lever) => {
    const run = runs.get(lever);
    return { lever, moved: !!run, effect: run ? r2(cashIn(run) - opening) : 0 };
  });
  const change = r2(cashIn(adjusted) - opening);
  const tightest: Tightest = {
    month, base: opening, adjusted: cashIn(adjusted), change,
    contributions: inMonth,
    interaction: r2(change - inMonth.reduce((a, c) => a + c.effect, 0)),
  };

  return { base, adjusted, total, contributions, interaction: subtract(total, explained), tightest };
}
