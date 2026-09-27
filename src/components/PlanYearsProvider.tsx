"use client";

import { createContext, useContext, useMemo } from "react";
import { planYearOf, yearLabel } from "@/engine/plan/calendar";

/**
 * THE PLAN'S YEARS, ONCE, FOR EVERY MODULE UNDER IT (§6.157) — the same arrangement as the currency
 * (§6.30). The layout already reads the plan's settings, so the first projected year hangs off that fetch
 * and no module has to thread it through as a prop to print "2027 · Year 1" on a column.
 */
const Ctx = createContext<number>(new Date().getFullYear() + 1);

export function PlanYearsProvider({ firstYear, children }: { firstYear: number; children: React.ReactNode }) {
  return <Ctx.Provider value={firstYear}>{children}</Ctx.Provider>;
}

/** `label(1)` → "2027 · Year 1"; `year(1)` → 2027; `firstYear` → 2027. */
export function usePlanYears() {
  const firstYear = useContext(Ctx);
  return useMemo(() => ({
    firstYear,
    label: (y: number) => yearLabel(firstYear, y),
    year: (y: number) => planYearOf(firstYear, y),
  }), [firstYear]);
}
