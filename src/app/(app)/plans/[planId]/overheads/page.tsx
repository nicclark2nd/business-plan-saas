import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { startYearFromDate, planYearStart, totalSalariesByYear } from "@/engine/people/salary";
import { YEARS } from "@/engine/sales/projection";
import { OverheadsModule } from "./OverheadsModule";
import type { OverheadRow } from "./model";

export default async function OverheadsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, overheads, people, spend, settings, plan] = await Promise.all([
    getSession(),
    supabase.from("plan_overheads").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people").select("annual_salary, salary_adjustments, started_on, role").eq("plan_id", planId),
    supabase.from("plan_marketing_spend").select("annual_budget").eq("plan_id", planId),
    supabase.from("plan_settings").select("on_cost_pct, financial_year_end_month").eq("plan_id", planId).maybeSingle(),
    supabase.from("plans").select("plan_year").eq("id", planId).single(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  // The Leadership Team already models each person's start year and yearly rises — all five years come from it.
  const fyStart = planYearStart(plan.data?.plan_year ?? new Date().getFullYear(), settings.data?.financial_year_end_month ?? 6);
  const salaries = totalSalariesByYear((people.data ?? []).map((p) => ({
    annual_salary: p.annual_salary === null ? null : Number(p.annual_salary),
    salary_adjustments: p.salary_adjustments ?? null,
    startYear: startYearFromDate(p.started_on, fyStart),
    role: p.role,
  }))).map((y) => y.value);

  // Marketing sets one budget for the plan; it holds across the five years until they change it there.
  const marketingTotal = (spend.data ?? []).reduce((a, s) => a + Number(s.annual_budget ?? 0), 0);
  const marketing = YEARS.map(() => marketingTotal);

  const rows = (overheads.data ?? []).map((o) => ({
    ...o, current_value: Number(o.current_value ?? 0),
    source: o.source ?? "entered", start_year: Number(o.start_year ?? 1) || 1, on_cost: !!o.on_cost,
    yearly_change: o.yearly_change ?? null, monthly_distribution: o.monthly_distribution ?? null,
  })) as OverheadRow[];

  return (
    <OverheadsModule planId={planId} initial={rows} mode={mode}
      salaries={salaries} marketing={marketing} peopleCount={(people.data ?? []).filter((p) => p.role !== "contractor").length}
      marketingLines={(spend.data ?? []).length} onCostPct={Number(settings.data?.on_cost_pct ?? 0)}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6} />
  );
}
