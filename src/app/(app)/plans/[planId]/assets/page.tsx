import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadPlan } from "@/lib/planLoad";
import { assembleBase, assembleMonths } from "@/engine/forecast/assemble";
import { buildForecast, FORECAST_YEARS } from "@/engine/forecast/model";
import { buildMonthlyCashFlow } from "@/engine/forecast/monthly";
import { assembleGst, type GstPlanSources } from "@/engine/forecast/gst_assemble";
import { AssetsModule } from "./AssetsModule";
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
    supabase.from("plan_settings").select("financial_year_end_month").eq("plan_id", planId).maybeSingle(),
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

  const { plan, components } = loaded;
  const { sources, opening, workingCapital, cashTiming } = plan;
  const gstParts = assembleGst(sources as unknown as GstPlanSources, components);
  const base = assembleBase(sources);
  for (const y of FORECAST_YEARS) base[y].gst = gstParts.byYear[y];
  const forecast = buildForecast({
    base, opening, workingCapital, cashTiming,
    taxRate: plan.taxRate, dividendRate: plan.dividendRate,
    openingTaxLosses: plan.openingTaxLosses, openingRetainedEarnings: plan.openingRetainedEarnings,
  });
  const monthly = buildMonthlyCashFlow({
    openingCash: forecast.cashFlow[1].openingCash,
    opening: {
      accountsReceivable: opening.accountsReceivable, inventory: opening.inventory,
      accountsPayable: opening.accountsPayable, prepaid: 0, accrued: 0,
    },
    closing: {
      accountsReceivable: forecast.workingCapital[1].accountsReceivable,
      inventory: forecast.workingCapital[1].inventory,
      accountsPayable: forecast.workingCapital[1].accountsPayable,
      prepaid: forecast.workingCapital[1].prepaid,
      accrued: forecast.workingCapital[1].accrued,
    },
    taxPaid: forecast.cashFlow[1].taxPaid,
    dividends: forecast.cashFlow[1].dividendsPaid,
    shapes: assembleMonths(sources, components),
  });

  const cash = {
    openingCash: forecast.cashFlow[1].openingCash,
    closing: FORECAST_YEARS.map((y) => forecast.cashFlow[y].closingCash),
    spent: FORECAST_YEARS.map((y) => forecast.cashFlow[y].capex),
    borrowed: FORECAST_YEARS.map((y) => forecast.cashFlow[y].debtProceeds),
    lowMonth: monthly.low,
    negativeMonths: monthly.negative,
    reconciled: forecast.reconciled,
  };

  return <AssetsModule planId={planId} initial={rows} mode={mode} lenders={lenders} cash={cash}
    fyEndMonth={settings.data?.financial_year_end_month ?? 6} />;
}
