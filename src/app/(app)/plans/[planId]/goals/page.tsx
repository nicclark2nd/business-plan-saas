import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { firstProjectedYear, planYearEndDate } from "@/engine/plan/calendar";
import { GoalsModule } from "./GoalsModule";
import { PLAN_MEASURES, RUNGS, type Figures, type Goal, type Header, type Kpi, type KpiTarget, type Person, type PlanMeasureValues, type SwotResponse } from "./model";
import { gatherReport } from "../reports/gather";
import { workingCapitalSchedule } from "@/engine/forecast/assumptions";
import { GOAL_ASKS, goalsReadiness } from "@/engine/ai/goals";

/**
 * Goals (§6.125) — a ladder at 1, 3 and 5 years, and a 90-day list underneath.
 *
 * THE SIX FIGURES ON THIS PAGE ARE READ, NOT STORED. Revenue and profit at each rung come out of the
 * forecast the plan already computed, which runs five years. The obvious build gives each rung a revenue
 * and a profit to type; that is a second answer to a question the plan has already answered, on the page a
 * lender reads, with nothing able to say which is true (§6.41). A client who wants different numbers
 * changes the forecast — What-If exists to do exactly that.
 *
 * THE THREE DATES ARE COMPUTED FOR THE SAME REASON. "Financial year ends in" and "First projected year" are
 * already stated in Settings, so 1, 3 and 5 years out are decided. No picker is offered for them. The
 * 90-day date IS a picker, because nothing in the plan could know when a review cycle starts.
 */
export default async function GoalsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();

  const [session, settings, goals, kpis, targets, people, swot] = await Promise.all([
    getSession(),
    supabase.from("plan_settings")
      .select("financial_year_end_month, first_projected_year, currency, working_capital_schedule, ai_enabled, big_goal, north_star_metric, north_star_value, north_star_why, ninety_day_ends_on")
      .eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_goals").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_kpis").select("id, name, unit, sort_order, source_key").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_kpi_targets").select("kpi_id, horizon, target").eq("plan_id", planId),
    supabase.from("plan_people").select("id, name, role").eq("plan_id", planId).order("sort_order"),
    // What the client said at step 5 they would do about each SWOT line (§6.59.1). Only lines with a
    // response: an observation with no intent behind it is not a goal waiting to be made.
    supabase.from("plan_swot_items").select("id, quadrant, text, response").eq("plan_id", planId)
      .not("response", "is", null).order("sort_order"),
  ]);

  const s = settings.data;
  const fyEndMonth = Number(s?.financial_year_end_month ?? 6);
  const firstYear = firstProjectedYear(s?.first_projected_year, fyEndMonth);

  /*
   * ONE GATHER, USED FOR BOTH THINGS IT IS NEEDED FOR (§6.41).
   *
   * The figures on the three cards and the drafter's readiness both want the assembled plan, and the
   * assembly is the expensive call on this page. A plan too empty to gather is not a fault here: the cards
   * show a dash where a figure would be and the drafter says why it cannot run yet.
   */
  /*
   * WHAT A PLAN-HELD MEASURE READS AT EACH RUNG (§6.125.1).
   *
   * Two sources, and neither of them is this screen. Gross margin and closing cash are the forecast's own
   * output; debtor, stock and creditor days are the working-capital schedule the forecast RUNS on, read
   * through the same `workingCapitalSchedule` the engine uses so the Goals screen and the cash flow cannot
   * disagree about what the plan assumes (§6.41).
   */
  const days = workingCapitalSchedule(s?.working_capital_schedule);

  let figures: Partial<Record<string, Figures>> = {};
  const planMeasures: PlanMeasureValues = Object.fromEntries(PLAN_MEASURES.map((m) => [m.key, {}]));
  let drafting: { ready: boolean; reason?: string } | null = null;
  try {
    const { input } = await gatherReport(planId);
    figures = Object.fromEntries(RUNGS.map(({ key, planYear }) => {
      const p = input.forecast?.pnl?.[planYear];
      return [key, { revenue: p?.revenue ?? null, profit: p?.netProfit ?? null }];
    }));
    for (const { key, planYear } of RUNGS) {
      const p = input.forecast?.pnl?.[planYear];
      const c = input.forecast?.cashFlow?.[planYear];
      const d = days[planYear];
      planMeasures.grossMargin![key] = p?.grossMargin ?? null;
      planMeasures.closingCash![key] = c?.closingCash ?? null;
      planMeasures.debtorDays![key] = d?.debtorDays ?? null;
      planMeasures.stockDays![key] = d?.inventoryDays ?? null;
      planMeasures.creditorDays![key] = d?.creditorDays ?? null;
    }
    if (s?.ai_enabled) drafting = goalsReadiness(input);
  } catch (e) {
    console.error("goals gather", planId, e);
    /*
     * A plan that will not gather still has a working-capital schedule, and three of the five measures come
     * from it — so they are filled even here rather than all five going blank together.
     */
    for (const { key, planYear } of RUNGS) {
      const d = days[planYear];
      planMeasures.debtorDays![key] = d?.debtorDays ?? null;
      planMeasures.stockDays![key] = d?.inventoryDays ?? null;
      planMeasures.creditorDays![key] = d?.creditorDays ?? null;
    }
  }

  const dates = Object.fromEntries(RUNGS.map(({ key, planYear }) => [key, planYearEndDate(firstYear, planYear, fyEndMonth)]));

  const header: Header = {
    big_goal: s?.big_goal ?? "",
    north_star_metric: s?.north_star_metric ?? "",
    north_star_value: s?.north_star_value ?? "",
    north_star_why: s?.north_star_why ?? "",
    ninety_day_ends_on: s?.ninety_day_ends_on ?? null,
  };

  return (
    <GoalsModule
      planId={planId}
      mode={(session?.profile?.mode ?? "guided") as "guided" | "advanced"}
      initial={(goals.data ?? []) as unknown as Goal[]}
      kpis={(kpis.data ?? []) as Kpi[]}
      targets={((targets.data ?? []) as { kpi_id: string; horizon: string; target: string | number | null }[])
        .map((t) => ({ ...t, horizon: t.horizon, target: t.target === null ? null : Number(t.target) })) as KpiTarget[]}
      header={header}
      figures={figures}
      planMeasures={planMeasures}
      dates={dates as Record<string, string>}
      currency={s?.currency ?? "AUD"}
      people={(people.data ?? []) as Person[]}
      swot={((swot.data ?? []) as SwotResponse[]).filter((x) => (x.response ?? "").trim())}
      drafting={drafting}
      questions={GOAL_ASKS.map((question, i) => ({ key: `ask:${i}`, question }))}
    />
  );
}
