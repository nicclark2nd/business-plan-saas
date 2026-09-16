import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { ExtraordinaryModule } from "./ExtraordinaryModule";
import type { ExtraordinaryRow, SoldAsset } from "./model";

export default async function ExtraordinaryPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, items, assets, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_extraordinary_items").select("*").eq("plan_id", planId).order("year").order("month").order("sort_order"),
    supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId).order("name"),
    supabase.from("plan_settings").select("financial_year_end_month, no_one_offs").eq("plan_id", planId).maybeSingle(),
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
      /**
       * The whole asset, not just its name (§6.56). Selling one for more than it is worth on the books is a
       * gain, and only the gain reaches profit — so this screen needs the same depreciation series the P&L
       * charges in order to say what a sale actually does, rather than calling the whole cheque profit.
       */
      assets={(assets.data ?? []).map((a) => ({
        id: a.id as string, name: a.name as string,
        purchase_price: Number(a.purchase_price ?? 0),
        residual_value: Number(a.residual_value ?? 0),
        useful_life_months: Number(a.useful_life_months ?? 60) || 60,
        method: a.method as SoldAsset["method"],
        start_year: Number(a.start_year ?? 1) || 1,
        start_month: Number(a.start_month ?? 1) || 1,
        already_owned: a.already_owned === true,
      }))}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6}
      saidNone={settings.data?.no_one_offs === true}
    />
  );
}
