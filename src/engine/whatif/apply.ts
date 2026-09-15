/**
 * What a scenario would actually change (§6.45).
 *
 * The levers move figures; the plan stores ROWS. Between the two sits a translation nobody should have to
 * trust blindly, so this module writes it down: every row, every field, what it holds now and what it would
 * hold. The client reads that list before anything is written, and the same list is what gets written.
 *
 * **It rounds to what the column can hold, and then re-runs from the rounded figures.** A price of 997 at
 * +7.5% is 1,071.775, and `numeric(14,2)` keeps 1,071.78 — so a forecast built from the ideal figure is not
 * the forecast the client will have tomorrow. Small, but it is the difference between a screen that predicts
 * and a screen that promises, and this project has paid for that difference before. `applyChanges` turns the
 * list back into plan sources so the confirmation can run the REAL post-apply forecast.
 *
 * **Units keep the shape the client typed.** Somebody who entered 12 driveways should not open Sales to find
 * 13.44 of them; somebody who entered 12.5 tonnes keeps the halves. So a whole number stays whole.
 *
 * **It writes the change where the module keeps changes.** An overhead's `current_value` is what the business
 * spends THIS year, with its own column on the screen and five plan years beside it — so a plan to cut
 * overheads by a tenth does not belong there. It belongs in Year 1's % change box, which the engine already
 * honours, combined with whatever the client has typed. Rewriting `current_value` restated what they spend
 * today, which is a fact about the business and not the plan's to change.
 *
 * A product is the other shape: its price and units ARE its Year 1 figures — the growth dialog says so and
 * gives Year 1 no box — so for a product the base IS where a Year 1 change lives.
 *
 * **What it cannot reach, it says.** The overheads lever moves the rows in `plan_overheads`, and a plan's
 * overheads are not only those rows: the People line is each person's salary in the Leadership Team and
 * Marketing is its own module. Cutting overheads by a tenth cannot mean cutting every salary by a tenth —
 * that is a decision, not a slider — so those are reported as untouched rather than quietly scaled.
 */
import type { PlanSources } from "../forecast/assemble";
import { overheadByYear, planOverheadLines } from "../overheads/expenses";
import { compoundPct, landsIn, type Levers, type StartYear } from "./levers";
import type { AnyProduct } from "../sales/product";
import type { CostProduct } from "../cogs/direct";
import type { Growth } from "../sales/projection";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
/**
 * To the scale the column holds. A tie — 997 at +7.5% is exactly 1,071.775 — can land a cent below what a
 * calculator says, because the binary value is a hair under the decimal one. That is acceptable precisely
 * because this figure is the one WRITTEN: the list, the row and the recomputed forecast all use it, so
 * nothing downstream ever disagrees with anything else.
 */
const round = (v: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f + 0;
};
/** A count the client typed as a whole number stays whole; one they typed with a fraction keeps it. */
const likeTyped = (from: number, to: number) => (Number.isInteger(from) ? Math.round(to) : round(to, 2));

export type ChangeTable = "plan_products" | "plan_overheads";

/** How a figure reads: money in the plan's currency, a count of things, or a percentage change. */
export type ChangeUnit = "money" | "count" | "percent";

export type Change = {
  table: ChangeTable;
  id: string;
  /** The row's own name, so the list reads as the client's plan rather than as a database. */
  row: string;
  field: string;
  /** What the column is called on the screen that owns it. */
  label: string;
  unit: ChangeUnit;
  from: number;
  to: number;
};

/** Overheads the lever moved, and overheads it could not — with the money in each, so the gap is sized. */
export type OverheadReach = {
  /** Year 1 value of the rows this can write. */
  reached: number;
  /** Year 1 value of the synced lines it cannot: salaries, marketing, and the on-costs that follow wages. */
  untouched: number;
  /** Names of the lines left alone, for the sentence that explains why. */
  untouchedNames: string[];
};

export type Planned = {
  changes: Change[];
  overheads: OverheadReach;
  /** Whether the working-capital days moved, which are written to settings rather than to a row. */
  daysMoved: boolean;
};

const factor = (pct: unknown) => 1 + n(pct) / 100;

/**
 * Every row a scenario would rewrite (§6.45). Ordered as the client reads their plan: products first,
 * because that is where price, volume and cost live, then the overhead lines.
 */
export function plannedChanges(sources: PlanSources, levers: Levers, at: Levers, from: StartYear = 1): Planned {
  const price = factor(levers.price), volume = factor(levers.volume);
  const cogs = factor(levers.cogs), overheads = factor(levers.overheads);
  const changes: Change[] = [];

  const push = (c: Change) => { if (round(c.from, 4) !== round(c.to, 4)) changes.push(c); };

  for (const p of sources.products as (AnyProduct & CostProduct & { name?: string })[]) {
    const id = String(p.id ?? "");
    const row = p.name || "Unnamed line";
    const at = landsIn(p.start_selling_year, from);
    const g = (p.yearly_growth ?? {}) as Growth;
    const thisYear = g[String(at.year)] ?? {};

    if (price !== 1) {
      if (at.isBase) {
        push({ table: "plan_products", id, row, field: "average_price", label: "Price", unit: "money", from: n(p.average_price), to: round(n(p.average_price) * price, 2) });
      } else if (thisYear.priceValue == null) {
        // A typed figure for that year is handled below; a rate compounds with what is already typed.
        push({ table: "plan_products", id, row, field: `yearly_growth.${at.year}.price`, label: `Year ${at.year} price change`, unit: "percent", from: round(n(thisYear.price), 2), to: round(compoundPct(thisYear.price, price), 2) });
      }
    }
    if (volume !== 1) {
      if (at.isBase) {
        push({ table: "plan_products", id, row, field: "units_sold", label: "Units", unit: "count", from: n(p.units_sold), to: likeTyped(n(p.units_sold), n(p.units_sold) * volume) });
      } else if (thisYear.unitsValue == null) {
        push({ table: "plan_products", id, row, field: `yearly_growth.${at.year}.units`, label: `Year ${at.year} units change`, unit: "percent", from: round(n(thisYear.units), 2), to: round(compoundPct(thisYear.units, volume), 2) });
      }
    }
    if (cogs !== 1 && p.cost_per_unit != null) {
      if (at.isBase) {
        push({ table: "plan_products", id, row, field: "cost_per_unit", label: "Cost per unit", unit: "money", from: n(p.cost_per_unit), to: round(n(p.cost_per_unit) * cogs, 4) });
      } else {
        const existing = (p.yearly_cost_increase as Record<string, number> | null | undefined)?.[String(at.year)];
        push({ table: "plan_products", id, row, field: `yearly_cost_increase.${at.year}`, label: `Year ${at.year} cost change`, unit: "percent", from: round(n(existing), 2), to: round(compoundPct(existing, cogs), 2) });
      }
    }
    /**
     * A later year the client typed outright is a figure, not a growth rate, so it moves too — otherwise a
     * plan that typed "Year 2: 140 units" would answer the lever in Year 1 and ignore it for the other four
     * (§6.41).
     */
    for (const [year, y] of Object.entries(g)) {
      if (Number(year) < at.year) continue;          // a change starting later leaves earlier years alone
      if (price !== 1 && y?.priceValue != null) {
        push({ table: "plan_products", id, row, field: `yearly_growth.${year}.priceValue`, label: `Year ${year} price`, unit: "money", from: n(y.priceValue), to: round(n(y.priceValue) * price, 2) });
      }
      if (volume !== 1 && y?.unitsValue != null) {
        push({ table: "plan_products", id, row, field: `yearly_growth.${year}.unitsValue`, label: `Year ${year} units`, unit: "count", from: n(y.unitsValue), to: likeTyped(n(y.unitsValue), n(y.unitsValue) * volume) });
      }
    }
    // Clients won month by month belong to Year 1, so they follow only a Year 1 change (§6.21.1).
    if (volume !== 1 && p.monthly_new_clients && at.isBase && at.year === 1) {
      for (const [m, v] of Object.entries(p.monthly_new_clients)) {
        push({ table: "plan_products", id, row, field: `monthly_new_clients.${m}`, label: `Month ${m} clients won`, unit: "count", from: n(v), to: likeTyped(n(v), n(v) * volume) });
      }
    }
  }

  if (overheads !== 1) {
    for (const o of sources.overheads) {
      // A synced line has no figure of its own to write: it is read from People or Marketing.
      if (o.source && o.source !== "entered") continue;
      const id = String(o.id ?? "");
      const row = o.name || "Unnamed cost";
      const at = landsIn(o.start_year, from);
      if (!(at.isBase && at.year > 1)) {
        /**
         * Year 1 has its own % change box on the Overheads screen and the engine honours it, so that is
         * where a Year 1 change belongs — combined with whatever is already typed there. `current_value` is
         * the column headed "This year": what the business spends NOW, which is a fact about the business
         * and not the plan's to rewrite.
         *
         * Compounded, not added: 2 % already there and a 5 % cut is 0.98 × 0.95, not 3 % off.
         */
        const existing = n((o.yearly_change as Record<string, number> | null | undefined)?.[String(at.year)]);
        push({
          table: "plan_overheads", id, row, field: `yearly_change.${at.year}`, label: `Year ${at.year} change`, unit: "percent",
          from: round(existing, 2), to: round(compoundPct(existing, overheads), 2),
        });
      } else {
        // A line that starts later has no working box for its own first year: that year IS `current_value`,
        // the same shape a product has.
        push({ table: "plan_overheads", id, row, field: "current_value", label: "Cost a year", unit: "money", from: n(o.current_value), to: round(n(o.current_value) * overheads, 2) });
      }
    }
  }

  /** How much of the plan's overheads the lever can actually move, and how much it cannot. */
  const lines = planOverheadLines(sources.overheads, sources.salaries, sources.marketing);
  let reached = 0, untouched = 0;
  const untouchedNames: string[] = [];
  const pct = Math.max(0, n(sources.onCostPct)) / 100;
  for (const { o, synced } of lines) {
    const value = n(overheadByYear(o, synced)[0]) * (o.on_cost || o.source === "people" ? 1 + pct : 1);
    if (o.source && o.source !== "entered") { untouched += value; untouchedNames.push(o.name); }
    else reached += value;
  }

  const daysMoved = (["debtorDays", "stockDays", "creditorDays"] as const)
    .some((k) => Math.round(Number(levers[k] ?? at[k])) !== Math.round(Number(at[k])));

  return {
    changes,
    overheads: { reached: round(reached, 2), untouched: round(untouched, 2), untouchedNames },
    daysMoved,
  };
}

/**
 * The plan as those rows would leave it (§6.45).
 *
 * Deliberately built from the CHANGE LIST rather than from the levers: the confirmation must run the
 * forecast the client will actually have, rounding and unreachable overheads included, not the one the
 * sliders drew. Where the two differ the screen says so rather than quietly promising the better number.
 */
export function applyChanges(sources: PlanSources, changes: Change[]): PlanSources {
  if (!changes.length) return sources;
  const byRow = new Map<string, Change[]>();
  for (const c of changes) {
    const key = `${c.table}:${c.id}`;
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key)!.push(c);
  }

  const write = <T extends Record<string, unknown>>(row: T, list: Change[]): T => {
    const out: Record<string, unknown> = { ...row };
    for (const c of list) {
      const [head, year, leaf] = c.field.split(".");
      if (!year) { out[head] = c.to; continue; }
      const parent = { ...(out[head] as Record<string, unknown> | null ?? {}) };
      if (leaf) parent[year] = { ...(parent[year] as Record<string, unknown> | null ?? {}), [leaf]: c.to };
      else parent[year] = c.to;
      out[head] = parent;
    }
    return out as T;
  };

  const products = sources.products.map((p) => {
    const list = byRow.get(`plan_products:${String(p.id ?? "")}`);
    return list ? write(p as unknown as Record<string, unknown>, list) as unknown as typeof p : p;
  });

  return {
    ...sources,
    products,
    // The Forecast page passes one array as both, and the cost side finds a linked line by id (§6.41).
    costProducts: (sources.costProducts === (sources.products as unknown as CostProduct[])
      ? products
      : sources.costProducts) as unknown as CostProduct[],
    overheads: sources.overheads.map((o) => {
      const list = byRow.get(`plan_overheads:${String(o.id ?? "")}`);
      return list ? write(o as unknown as Record<string, unknown>, list) as unknown as typeof o : o;
    }),
  };
}
