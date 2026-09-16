import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { firstProjectedYear, planQuarters, planYearEnding, quarterOf } from "@/engine/plan/calendar";
import { GoalsModule } from "./GoalsModule";
import type { Goal, Person, SwotResponse } from "./model";

/**
 * Goals (§6.7) — one annual goal per area, quarterly goals beneath them.
 *
 * The quarters are the PLAN's, not the calendar's: a June year-end means Q1 is July to September (§6.44).
 * Year 1 and Year 2 are offered, which is as far ahead as anyone sets a quarterly goal honestly.
 */
export default async function GoalsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();

  const [session, settings, goals, people, swot] = await Promise.all([
    getSession(),
    supabase.from("plan_settings").select("financial_year_end_month, first_projected_year").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_goals").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people").select("id, name, role").eq("plan_id", planId).order("sort_order"),
    // What the client said at step 5 they would do about each SWOT line (§6.59.1). Only lines with a
    // response: an observation with no intent behind it is not a goal waiting to be made.
    supabase.from("plan_swot_items").select("id, quadrant, text, response").eq("plan_id", planId)
      .not("response", "is", null).order("sort_order"),
  ]);

  const fyEndMonth = Number(settings.data?.financial_year_end_month ?? 6);
  const firstYear = firstProjectedYear(settings.data?.first_projected_year, fyEndMonth);

  // Two years of quarters, each labelled by the financial year it belongs to.
  const quarters = [1, 2].flatMap((planYear) =>
    planQuarters(fyEndMonth, planYearEnding(firstYear, planYear)).map((q) => ({
      planYear, quarter: q.quarter, label: q.label, months: q.months,
    })));

  return (
    <GoalsModule
      planId={planId}
      mode={(session?.profile?.mode ?? "guided") as "guided" | "advanced"}
      initial={(goals.data ?? []) as unknown as Goal[]}
      people={(people.data ?? []) as Person[]}
      quarters={quarters}
      thisQuarter={{ planYear: 1, quarter: quarterOf(fyEndMonth, new Date()) }}
      swot={((swot.data ?? []) as SwotResponse[]).filter((s) => (s.response ?? "").trim())}
    />
  );
}
