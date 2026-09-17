/**
 * Every check the forecast runs, laid out so a person can read them (§6.79).
 *
 * About a hundred run on every plan and until now a client saw one green strip saying "the statements
 * agree". Which is the right thing to say first — but a check nobody can inspect is a check nobody can
 * trust, and "it agrees" means nothing to somebody who cannot see what was compared.
 *
 * Nothing here computes a check. The invariants come off the same run the statements come off; this puts
 * them in rows.
 */
import type { Invariant } from "./model";
import { FORECAST_YEARS } from "./model";

export type CheckCell = { year: number; passed: boolean; difference: number } | null;

export type CheckRow = {
  row: string;
  cells: CheckCell[];
  passed: boolean;
  /** The biggest miss on the row, signed, for the one number worth printing when it fails. */
  worst: number;
};

export type CheckGroup = {
  key: Invariant["group"];
  rows: CheckRow[];
  passed: boolean;
  failures: number;
};

const ORDER: Invariant["group"][] = ["statements", "months", "engine"];

/**
 * One row per test, five years across it, in the order the engine emitted them — not alphabetical.
 *
 * A check that only exists in some years gets a null cell rather than a passing one: "not tested" and
 * "tested and fine" are different answers, and a table that renders them the same is telling the reader
 * something it does not know.
 */
export function checkGroups(invariants: Invariant[]): CheckGroup[] {
  const groups = new Map<Invariant["group"], Map<string, CheckRow>>();
  for (const i of invariants) {
    const rows = groups.get(i.group) ?? new Map<string, CheckRow>();
    const row = rows.get(i.row) ?? {
      row: i.row,
      cells: FORECAST_YEARS.map(() => null as CheckCell),
      passed: true,
      worst: 0,
    };
    const at = FORECAST_YEARS.indexOf(i.year);
    if (at >= 0) row.cells[at] = { year: i.year, passed: i.passed, difference: i.difference };
    if (!i.passed) {
      row.passed = false;
      if (Math.abs(i.difference) > Math.abs(row.worst)) row.worst = i.difference;
    }
    rows.set(i.row, row);
    groups.set(i.group, rows);
  }
  return ORDER.filter((g) => groups.has(g)).map((key) => {
    const rows = [...groups.get(key)!.values()];
    return { key, rows, passed: rows.every((r) => r.passed), failures: rows.filter((r) => !r.passed).length };
  });
}

/** How many individual checks ran, which is the honest headline — not how many rows they fold into. */
export const checkCount = (invariants: Invariant[]) => invariants.length;
