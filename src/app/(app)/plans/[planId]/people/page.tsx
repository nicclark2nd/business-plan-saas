import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { PeopleModule } from "./PeopleModule";
import type { PeopleData } from "./model";

export default async function PeoplePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, people, capabilities, settings, plan] = await Promise.all([
    getSession(),
    supabase.from("plan_people").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people_capabilities").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_settings").select("currency, financial_year_end_month").eq("plan_id", planId).maybeSingle(),
    supabase.from("plans").select("plan_year").eq("id", planId).single(),
  ]);
  const data = { people: people.data ?? [], capabilities: capabilities.data ?? [] } as PeopleData;
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  return (
    <PeopleModule
      planId={planId} initial={data} mode={mode}
      currency={settings.data?.currency ?? "AUD"}
      planYear={plan.data?.plan_year ?? new Date().getFullYear()}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6}
    />
  );
}
