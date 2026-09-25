import "server-only";
import { workingCapitalSchedule } from "@/engine/forecast/assumptions";
import type { Forecast } from "@/engine/forecast/model";
import { PLAN_MEASURES, RUNGS, type MeasureKey } from "@/app/(app)/plans/[planId]/goals/model";
import { AREA_LABEL } from "@/engine/whatif/goals";
import { planYearEndDate, firstProjectedYear } from "@/engine/plan/calendar";

/**
 * THE LADDER, ASSEMBLED ONCE (§6.125.2).
 *
 * Two screens need it and they must not work it out separately. The Goals step shows it; the report
 * prints it for a lender. §6.125 put the calculation in `goals/page.tsx` because only one screen wanted
 * it; the moment the report wanted it too, leaving it there would have meant two places deciding what a
 * plan's 3-year revenue is — and the one a client looks at and the one a bank reads are the two that must
 * never disagree (§6.41).
 *
 * NOTHING HERE IS STORED, AND THAT IS THE POINT OF THE MODULE.
 *
 *   Dates      — from the financial year end and the first projected year, both stated in Settings.
 *   Revenue    — the forecast's own P&L for that rung's year.
 *   Profit     — likewise, and its sign is carried out as a flag rather than left to a minus sign.
 *   Measures   — either the plan's own answer (gross margin, cash, the working-capital days the forecast
 *                RUNS on) or the client's typed target, and the two are told apart by `fromPlan` so a
 *                reader is never left guessing which kind of number they are looking at.
 *
 * The goals themselves are the only part that is read from a table, because a sentence somebody wrote is
 * the one thing on this screen no calculation could produce.
 */

export type LadderRung = {
  key: string;
  label: string;
  /** ISO. Computed from the plan's own calendar; there is no picker for it anywhere. */
  endsOn: string;
  revenue: number | null;
  profit: number | null;
  /** True when `profit` is negative. Carried as a flag so no renderer has to infer a loss from a sign. */
  loss: boolean;
  /** What the client wrote at this rung, in their order. */
  goals: string[];
};

export type LadderMeasure = {
  name: string;
  unit: string | null;
  /** True when the plan answers it and the client cannot type it (§6.125.1). */
  fromPlan: boolean;
  /**
   * True when the figure is an amount of money and must be rendered by the plan's own formatter.
   *
   * Carried as a flag rather than inferred from an empty unit, because a client measure with no unit is
   * not money — it is a count of something — and a renderer guessing would put a dollar sign on "jobs
   * won per month" (§6.87).
   */
  money: boolean;
  /** One per rung, in `rungs` order. Null means no target set — which is not the same as a target of nought. */
  values: (number | null)[];
};

export type Ladder = {
  bigGoal: string;
  northStar: { metric: string; value: string; why: string } | null;
  /** ISO, or null when the client has not said when the current 90 days end. */
  ninetyEndsOn: string | null;
  rungs: LadderRung[];
  measures: LadderMeasure[];
  /**
   * The 90-day rung, kept apart because it is the only one carrying owners, dates and statuses.
   *
   * `area` is the LABEL, not the key. Every caller wants it readable, and two of them translating
   * "operational" into "Operational" separately is how one of them ends up printing the key (§6.41).
   */
  ninety: { title: string; area: string | null; owner: string | null; due: string | null; status: string }[];
};

type SettingsRow = {
  financial_year_end_month?: number | null;
  first_projected_year?: number | null;
  working_capital_schedule?: unknown;
  big_goal?: string | null;
  north_star_metric?: string | null;
  north_star_value?: string | null;
  north_star_why?: string | null;
  ninety_day_ends_on?: string | null;
} | null | undefined;

type GoalRow = {
  horizon?: string | null; title?: string | null; area?: string | null;
  owner_person_id?: string | null; milestone_date?: string | null; status?: string | null;
  sort_order?: number | null;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function buildLadder(args: {
  settings: SettingsRow;
  /** Null for a plan too empty to forecast: the days-based measures still answer, the rest read as blank. */
  forecast: Forecast | null;
  kpis: { id: string; name: string; unit: string | null; source_key: string | null; sort_order?: number | null }[];
  targets: { kpi_id: string; horizon: string; target: number | null }[];
  goals: GoalRow[];
  /** Resolves an owner id to a name. The report prints names; the screen shows them too. */
  ownerName?: (id: string | null) => string;
}): Ladder {
  const { settings: s, forecast, kpis, targets, goals } = args;

  const fyEndMonth = Number(s?.financial_year_end_month ?? 6);
  const firstYear = firstProjectedYear(s?.first_projected_year, fyEndMonth);
  const days = workingCapitalSchedule(s?.working_capital_schedule);

  const atRung = (h: string) => goals
    .filter((g) => String(g.horizon ?? "") === h)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

  const rungs: LadderRung[] = RUNGS.map(({ key, planYear, label }) => {
    const p = forecast?.pnl?.[planYear];
    const profit = p?.netProfit ?? null;
    return {
      key, label,
      endsOn: planYearEndDate(firstYear, planYear, fyEndMonth),
      revenue: p?.revenue ?? null,
      profit,
      loss: profit !== null && profit < 0,
      goals: atRung(key).map((g) => text(g.title)).filter(Boolean),
    };
  });

  /** What one plan-held measure reads at a rung. The only place this mapping exists. */
  const held = (key: MeasureKey, planYear: number): number | null => {
    const d = days[planYear];
    switch (key) {
      case "grossMargin": return forecast?.pnl?.[planYear]?.grossMargin ?? null;
      case "closingCash": return forecast?.cashFlow?.[planYear]?.closingCash ?? null;
      case "debtorDays": return d?.debtorDays ?? null;
      case "stockDays": return d?.inventoryDays ?? null;
      case "creditorDays": return d?.creditorDays ?? null;
      default: return null;
    }
  };

  const measures: LadderMeasure[] = [...kpis]
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((k) => {
      const def = k.source_key ? PLAN_MEASURES.find((m) => m.key === k.source_key) : null;
      return {
        /*
         * A plan-held measure is named by the app, never by the row. The name and unit were written by
         * the app when it was added, but reading them back from the list means a row edited by any other
         * route cannot put a label on a figure that does not mean what the label says (§6.87).
         */
        name: def ? def.name : text(k.name),
        unit: def ? (def.unit || null) : (k.unit ?? null),
        fromPlan: !!def,
        money: def?.key === "closingCash",
        values: RUNGS.map(({ key, planYear }) => def
          ? held(def.key, planYear)
          : (targets.find((t) => t.kpi_id === k.id && t.horizon === key)?.target ?? null)),
      };
    })
    .filter((m) => m.name);

  const ninety = atRung("ninety").map((g) => ({
    title: text(g.title),
    area: AREA_LABEL[text(g.area) as keyof typeof AREA_LABEL] ?? null,
    owner: args.ownerName?.(g.owner_person_id ?? null) || null,
    due: text(g.milestone_date) || null,
    status: text(g.status) || "not_started",
  })).filter((g) => g.title);

  const metric = text(s?.north_star_metric);
  return {
    bigGoal: text(s?.big_goal),
    /* A north star with no measure named is not a north star, so it is absent rather than half-printed. */
    northStar: metric ? { metric, value: text(s?.north_star_value), why: text(s?.north_star_why) } : null,
    ninetyEndsOn: text(s?.ninety_day_ends_on) || null,
    rungs,
    measures,
    ninety,
  };
}
