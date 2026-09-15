import { loadPlan } from "@/lib/planLoad";
import { planMonthNames } from "@/engine/plan/calendar";
import { WhatIfModule } from "./WhatIfModule";

/**
 * The What-If planner (§6.41).
 *
 * Unlike every other financial screen, this one is assembled on the CLIENT — the plan goes down whole and
 * the engine re-runs it as the sliders move. That is a deliberate exception to §6.32.3, and it is safe for
 * one reason: it is the same engine, running the same functions, on the same plan. The engine imports no
 * app, no React and no Supabase, and always has, precisely so this was possible. A round trip per slider
 * drag would be unusable, and an approximation to avoid the round trip is what made the mockup's headline
 * number a fiction.
 *
 * `impliedFromHistory` rides along because the days the business ACTUALLY achieved are the only figures on
 * the three cash levers it has ever proved it can hit (§6.41.3). Review forecast already warns about a plan
 * that assumes better terms than its own accounts show; the screen where those days are actually dragged
 * about should say it too.
 *
 * Nothing here writes. The planner shows what would happen; applying it to the plan comes later.
 */
export default async function WhatIfPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { plan, mode, fyEndMonth, noun, taxLabel, impliedFromHistory } = await loadPlan(planId);

  return (
    <WhatIfModule
      planId={planId} mode={mode} plan={plan} noun={noun} taxLabel={taxLabel}
      monthNames={planMonthNames(fyEndMonth)} history={impliedFromHistory}
    />
  );
}
