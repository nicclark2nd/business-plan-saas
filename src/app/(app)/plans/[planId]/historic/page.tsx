import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { HistoricModule } from "./HistoricModule";
import type { Period } from "./model";

export default async function HistoricPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, periods, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_historic_periods").select("*").eq("plan_id", planId).order("period_number"),
    supabase.from("plan_settings").select("has_history, currency, financial_year_end_month").eq("plan_id", planId).maybeSingle(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const rows = (periods.data ?? []).map((p) => { const o: Record<string, unknown> = { ...p }; for (const k of Object.keys(o)) if (typeof o[k] === "string" && /^-?\d+(\.\d+)?$/.test(o[k] as string) && !["period_end", "source", "plan_id"].includes(k)) o[k] = Number(o[k]); return o as unknown as Period; });
  return (
    <HistoricModule planId={planId} initial={rows} hasHistory={settings.data?.has_history ?? null} mode={mode}
      initialArea={area === "bs" || area === "import" ? area : "pnl"} fyEndMonth={settings.data?.financial_year_end_month ?? 6} />
  );
}
