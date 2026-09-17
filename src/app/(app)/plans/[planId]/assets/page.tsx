import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadPlan } from "@/lib/planLoad";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { AssetsModule } from "./AssetsModule";
import { soldMonthByAsset, type ExtraordinaryItem } from "@/engine/extraordinary/items";
import type { AssetRow } from "./model";

export default async function AssetsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, loaded, assets, debts, settings] = await Promise.all([
    getSession(),
    /**
     * The whole plan, so this screen can answer the question it never asked: can the business AFFORD this?
     * An asset bought in a projected year takes its price out of the bank that year, and until now the only
     * place that showed was Review forecast, three steps further on (§6.53). It runs the same pipeline from
     * the same loader as every other reader, so it cannot disagree with the statements it is warning about.
     */
    loadPlan(planId),
    supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_funding_debt").select("id, lender_name, loan_type").eq("plan_id", planId),
    supabase.from("plan_settings").select("financial_year_end_month, no_fixed_assets").eq("plan_id", planId).maybeSingle(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  /**
   * An asset that has been sold stops wearing out (§6.56). The disposal lives on the one-off that names it,
   * so the month it went is attached here — from the plan the forecast itself is reading — and every
   * depreciation figure on this screen is then the same one the P&L charges.
   */
  const sold = soldMonthByAsset(loaded.plan.sources.extraordinary as ExtraordinaryItem[]);

  const rows = (assets.data ?? []).map((a) => ({
    ...a,
    purchase_price: Number(a.purchase_price ?? 0),
    residual_value: Number(a.residual_value ?? 0),
    useful_life_months: Number(a.useful_life_months ?? 60) || 60,
    start_year: Number(a.start_year ?? 1) || 1,
    start_month: Number(a.start_month ?? 1) || 1,
    already_owned: a.already_owned === true,
    sold_in_month: sold[a.id as string] ?? null,
  })) as AssetRow[];

  // A financed asset carries the name of the loan that bought it, so the chain can say where to look.
  const lenders = Object.fromEntries((debts.data ?? []).map((d) => [d.id, d.lender_name as string]));

  const { plan } = loaded;
  const { opening } = plan;
  const { forecast, monthly } = runForecast(plan);   // §6.67

  const cash = {
    /** What the last balance sheet said the business's plant was worth — the total these items sit inside. */
    openingFixedAssets: opening.fixedAssets,
    openingCash: forecast.cashFlow[1].openingCash,
    closing: FORECAST_YEARS.map((y) => forecast.cashFlow[y].closingCash),
    spent: FORECAST_YEARS.map((y) => forecast.cashFlow[y].capex),
    borrowed: FORECAST_YEARS.map((y) => forecast.cashFlow[y].debtProceeds),
    lowMonth: monthly.low,
    negativeMonths: monthly.negative,
    reconciled: forecast.reconciled,
  };

  return <AssetsModule planId={planId} initial={rows} mode={mode} lenders={lenders} cash={cash}
    fyEndMonth={settings.data?.financial_year_end_month ?? 6} saidNone={settings.data?.no_fixed_assets === true} />;
}
