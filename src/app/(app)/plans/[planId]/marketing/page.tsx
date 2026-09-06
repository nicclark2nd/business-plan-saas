import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { MarketingModule } from "./MarketingModule";
import { MARKET_FIELDS, type MarketingData, type Market } from "./model";

export default async function MarketingPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, market, spend, evidence, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_marketing").select("*").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_marketing_spend").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_marketing_evidence").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_settings").select("customer_type").eq("plan_id", planId).maybeSingle(),
  ]);
  const data: MarketingData = {
    market: Object.fromEntries(MARKET_FIELDS.map((f) => [f.key, (market.data?.[f.key] as string | null) ?? ""])) as Market,
    spend: (spend.data ?? []).map((s) => ({ ...s, annual_budget: Number(s.annual_budget) })), evidence: evidence.data ?? [],
  };
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const initialArea = ["market", "spend", "evidence"].includes(area ?? "") ? (area as "market") : "market";
  return <MarketingModule planId={planId} initial={data} mode={mode} initialArea={initialArea} customerWord={(settings.data?.customer_type ?? "customer").toLowerCase()} />;
}
