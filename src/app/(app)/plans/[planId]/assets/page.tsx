import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { AssetsModule } from "./AssetsModule";
import type { AssetRow } from "./model";

export default async function AssetsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, assets, debts] = await Promise.all([
    getSession(),
    supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_funding_debt").select("id, lender_name, loan_type").eq("plan_id", planId),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  const rows = (assets.data ?? []).map((a) => ({
    ...a,
    purchase_price: Number(a.purchase_price ?? 0),
    residual_value: Number(a.residual_value ?? 0),
    useful_life_months: Number(a.useful_life_months ?? 60) || 60,
    start_year: Number(a.start_year ?? 1) || 1,
    start_month: Number(a.start_month ?? 1) || 1,
  })) as AssetRow[];

  // A financed asset carries the name of the loan that bought it, so the chain can say where to look.
  const lenders = Object.fromEntries((debts.data ?? []).map((d) => [d.id, d.lender_name as string]));

  return <AssetsModule planId={planId} initial={rows} mode={mode} lenders={lenders} />;
}
