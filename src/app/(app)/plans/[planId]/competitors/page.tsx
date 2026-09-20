import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { CompetitorsModule } from "./CompetitorsModule";
import { POSITION_FIELDS, COMPETITOR_PROSE, type Position, type Competitor } from "../marketing/model";
import { draftingFor } from "../drafting";

export default async function CompetitorsPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, marketing, competitors, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_marketing").select("our_advantage, barriers_to_entry, future_threats").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_competitors").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_settings").select("customer_type").eq("plan_id", planId).maybeSingle(),
  ]);
  const position = Object.fromEntries(POSITION_FIELDS.map((f) => [f.key, (marketing.data?.[f.key] as string | null) ?? ""])) as Position;
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  /*
   * ALL THREE POSITION BOXES, PLUS HOW WE WIN PER ROW (§6.110, §6.114).
   *
   * A competitor's strengths and weaknesses stay refused: they are claims about a named real business this
   * plan knows nothing about, and a model will make them up fluently. How we win is a claim about THIS
   * business said against them, which the row subject can ground. See `engine/ai/fields.ts`.
   */
  const drafting = await draftingFor(planId, [
    ...POSITION_FIELDS.map((f) => f.key),
    /* Plus How we win, per row (§6.114). Its two neighbours in that band stay refused. */
    ...COMPETITOR_PROSE.filter((f) => f.draftable).map((f) => f.key),
  ]);

  return (
    <CompetitorsModule planId={planId} initialPosition={position} initialCompetitors={(competitors.data ?? []) as Competitor[]} mode={mode}
      initialArea={area === "position" ? "position" : "competitors"} customerWord={(settings.data?.customer_type ?? "customer").toLowerCase()}
      drafting={drafting} />
  );
}
