import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { GoalsModule } from "./GoalsModule";
import { PLAN_MEASURES, RUNGS, type Figures, type Goal, type Header, type Kpi, type KpiTarget, type Person, type PlanMeasureValues, type SwotResponse } from "./model";
import { gatherReport } from "../reports/gather";
import { buildLadder } from "@/engine/plan/ladder";
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

  /*
   * ONE ASSEMBLY, FOR THIS SCREEN AND FOR THE REPORT (§6.125.2).
   *
   * Every figure on the ladder used to be worked out here, which was right while this was the only screen
   * that showed it. The report prints it now, so the calculation moved to `buildLadder` and both callers
   * read the same answer — the one a client looks at and the one a lender reads being the two that must
   * never disagree (§6.41).
   *
   * A plan too empty to gather is not a fault: the forecast goes in as null, the days-based measures still
   * answer from the working-capital schedule, and everything else reads as a dash.
   */
  let forecast = null;
  let drafting: { ready: boolean; reason?: string } | null = null;
  try {
    const { input } = await gatherReport(planId);
    forecast = input.forecast ?? null;
    if (s?.ai_enabled) drafting = goalsReadiness(input);
  } catch (e) {
    console.error("goals gather", planId, e);
  }

  const ladder = buildLadder({
    settings: s,
    forecast,
    kpis: (kpis.data ?? []) as { id: string; name: string; unit: string | null; source_key: string | null; sort_order: number }[],
    targets: ((targets.data ?? []) as { kpi_id: string; horizon: string; target: string | number | null }[])
      .map((t) => ({ ...t, target: t.target === null ? null : Number(t.target) })),
    goals: (goals.data ?? []) as { horizon: string; title: string }[],
  });

  /* The screen's own shapes, mapped off the one assembly rather than computed a second time. */
  const figures: Partial<Record<string, Figures>> = Object.fromEntries(
    ladder.rungs.map((r) => [r.key, { revenue: r.revenue, profit: r.profit }]));
  const dates = Object.fromEntries(ladder.rungs.map((r) => [r.key, r.endsOn]));
  const planMeasures: PlanMeasureValues = Object.fromEntries(PLAN_MEASURES.map((m) => {
    const row = ladder.measures.find((x) => x.fromPlan && x.name === m.name);
    return [m.key, Object.fromEntries(RUNGS.map(({ key }, i) => [key, row?.values[i] ?? null]))];
  }));

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
      drafting={drafting} aiOff={!s?.ai_enabled}
      questions={GOAL_ASKS.map((question, i) => ({ key: `ask:${i}`, question }))}
    />
  );
}
