import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { ExtraordinaryModule } from "./ExtraordinaryModule";
import type { ExtraordinaryRow } from "./model";

export default async function ExtraordinaryPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, items, assets, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_extraordinary_items").select("*").eq("plan_id", planId).order("year").order("month").order("sort_order"),
    supabase.from("plan_fixed_assets").select("id, name").eq("plan_id", planId).order("name"),
    supabase.from("plan_settings").select("financial_year_end_month").eq("plan_id", planId).maybeSingle(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  const rows = (items.data ?? []).map((x) => ({
    ...x,
    amount: Number(x.amount ?? 0),
    year: Number(x.year ?? 1) || 1,
    month: Number(x.month ?? 1) || 1,
  })) as ExtraordinaryRow[];

  return (
    <ExtraordinaryModule
      planId={planId} initial={rows} mode={mode}
      assets={(assets.data ?? []).map((a) => ({ id: a.id as string, name: a.name as string }))}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6}
    />
  );
}
