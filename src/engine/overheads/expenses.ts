/**
 * Overheads — what the business costs to run, whether or not it sells anything (§6.19).
 *
 * Three kinds of line, and only one of them is typed here:
 *   entered   — rent, fuel, insurance: a value this year, a % change each year, and its own monthly split.
 *   from People — the Leadership Team's salaries. All five years come from that module, which already models
 *                 each person's start year and yearly rises; nothing is grown a second time here.
 *   from Marketing — the Channels & spend budget. Also taken across all five years as set there.
 * A synced line is never grown by Overheads. The client set that figure on its own page and it is theirs; a
 * plan that quietly turns a deliberate 5,000 marketing budget into 7,500 is lying to the person who typed it.
 *
 * On-costs (super, payroll tax, workers' comp) are a single percentage applied to the wage lines, so they are
 * never the thing that was forgotten.
 */
import { YEARS, normalizeDistribution, monthlySales, type MonthlyDistribution } from "../sales/projection";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export type OverheadSource = "entered" | "people" | "marketing";
export type Overhead = {
  id?: string; name: string; source?: OverheadSource | null;
  current_value: number | null;
  yearly_change?: Record<string, number> | null;
  monthly_distribution?: MonthlyDistribution | null;
  start_year?: number | null;          // 1–5; the first plan year the expense exists
  on_cost?: boolean | null;            // a wage line: on-costs apply
};

/** A typed expense: the value grows from its start year, exactly as a price or a cost does. */
export function enteredByYear(o: Overhead): number[] {
  const start = Math.min(5, Math.max(1, Math.trunc(num(o.start_year)) || 1));
  let v = num(o.current_value);
  return YEARS.map((year) => {
    if (year < start) return 0;
    if (year > start) v = v * (1 + num(o.yearly_change?.[String(year)]) / 100);
    else if (start === 1) v = v * (1 + num(o.yearly_change?.["1"]) / 100);
    return r2(v);
  });
}

/** Any line's five years — a synced line is taken as given, never grown here. */
export function overheadByYear(o: Overhead, synced?: number[] | null): number[] {
  if (o.source && o.source !== "entered") return YEARS.map((_, i) => r2(num(synced?.[i])));
  return enteredByYear(o);
}

/** Year 1 across the twelve months. A synced line falls evenly unless it has been given a shape of its own. */
export function overheadMonths(o: Overhead, synced?: number[] | null): number[] {
  return monthlySales(overheadByYear(o, synced)[0], normalizeDistribution(o.monthly_distribution));
}

export type OverheadYear = { year: number; wages: number; onCosts: number; other: number; total: number };

/**
 * The plan's overheads by year. `onCostPct` is applied to every line marked as wages — including the
 * Leadership Team line, because superannuation on a director's salary is still an expense of the business.
 */
export function overheadsByYear(lines: { o: Overhead; synced?: number[] | null }[], onCostPct: number): OverheadYear[] {
  const pct = Math.max(0, num(onCostPct)) / 100;
  return YEARS.map((year, i) => {
    let wages = 0, other = 0;
    for (const { o, synced } of lines) {
      const v = overheadByYear(o, synced)[i];
      if (o.on_cost || o.source === "people") wages += v; else other += v;
    }
    const onCosts = r2(wages * pct);
    return { year, wages: r2(wages), onCosts, other: r2(other), total: r2(wages + onCosts + other) };
  });
}

/** Year 1 by month across the plan, on-costs included — what the twelve-month cash flow consumes. */
export function overheadsMonths(lines: { o: Overhead; synced?: number[] | null }[], onCostPct: number): number[] {
  const pct = Math.max(0, num(onCostPct)) / 100;
  const totals = Array(12).fill(0);
  for (const { o, synced } of lines) {
    const factor = o.on_cost || o.source === "people" ? 1 + pct : 1;
    overheadMonths(o, synced).forEach((v, i) => { totals[i] += v * factor; });
  }
  return totals.map(r2);
}
