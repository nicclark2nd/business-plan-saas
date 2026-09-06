import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { SwotModule } from "./SwotModule";
import { buildSuggestions } from "./suggest";
import type { SwotItem } from "./model";

export default async function SwotPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, items, competitors, marketing, people, capabilities, succession] = await Promise.all([
    getSession(),
    supabase.from("plan_swot_items").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_competitors").select("id, name, threat, weaknesses, strengths, how_we_win").eq("plan_id", planId),
    supabase.from("plan_marketing").select("our_advantage, barriers_to_entry, future_threats, market_trends").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_people").select("id, name, role").eq("plan_id", planId),
    supabase.from("plan_people_capabilities").select("person_id, kind, description").eq("plan_id", planId),
    supabase.from("plan_people_succession").select("person_id, dependency, successor_person_id, successor_external").eq("plan_id", planId),
  ]);
  const suggestions = buildSuggestions({
    competitors: competitors.data ?? [],
    position: marketing.data ?? { our_advantage: null, barriers_to_entry: null, future_threats: null, market_trends: null },
    people: people.data ?? [], capabilities: capabilities.data ?? [], succession: succession.data ?? [],
  });
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  return <SwotModule planId={planId} initial={(items.data ?? []) as SwotItem[]} suggestions={suggestions} mode={mode} />;
}
