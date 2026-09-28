import { loadCapabilityFacts } from "@/lib/capabilityFacts";
import { createClient } from "@/lib/supabase/server";
import { CapabilitiesModule } from "./CapabilitiesModule";
import type { SavedBriefing } from "./actions";

/**
 * FINANCIAL CAPABILITIES (§6.128, rebuilt §6.129) — a tool, not a step. The facts are gathered by
 * `loadCapabilityFacts`, which the Planner's assessment reads too (§6.164).
 */
export default async function CapabilitiesPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [f, ai, saved] = await Promise.all([
    loadCapabilityFacts(planId),
    supabase.from("plan_settings").select("ai_enabled").eq("plan_id", planId).maybeSingle().then((r) => !!r.data?.ai_enabled),
    /*
     * The Planner's briefings (§6.179). Read on their own and failing soft: before migration 0057 the table
     * does not exist, and the page must still open — the briefing box simply starts empty.
     */
    supabase.from("plan_briefings").select("tab, view, body, score, headline, updated_at").eq("plan_id", planId)
      .then((r) => Object.fromEntries((r.error ? [] : r.data ?? []).map((b) => [`${b.tab}:${b.view}`,
        { body: b.body, score: b.score, headline: b.headline, saved_at: b.updated_at } satisfies SavedBriefing]))),
  ]);
  return (
    <CapabilitiesModule planId={planId} mode={f.mode} currency={f.currency} facts={f.facts} products={f.products}
      facilities={f.facilities} months={f.months} openingDebt={f.openingDebt} extras={f.extras}
      history={f.history} firstYear={f.firstYear} adviser={f.adviser} monthsByYear={f.monthsByYear} targetChecks={f.targetChecks} agreedTargets={f.agreedTargets}
      aiOn={ai} briefings={saved} />
  );
}
