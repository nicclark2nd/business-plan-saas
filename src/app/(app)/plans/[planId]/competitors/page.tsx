import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { CompetitorsModule } from "./CompetitorsModule";
import { POSITION_FIELDS, type Position, type Competitor } from "../marketing/model";

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
  return (
    <CompetitorsModule planId={planId} initialPosition={position} initialCompetitors={(competitors.data ?? []) as Competitor[]} mode={mode}
      initialArea={area === "position" ? "position" : "competitors"} customerWord={(settings.data?.customer_type ?? "customer").toLowerCase()} />
  );
}
