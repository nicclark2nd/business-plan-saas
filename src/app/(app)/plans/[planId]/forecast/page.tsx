import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadFundingRows, loadMarketingByYear, loadSalariesByYear } from "@/lib/planSources";
import { loanOf, rbfOf } from "../funding/model";
import { ForecastModule } from "./ForecastModule";
import { assembleBase, assembleMonths, assembleOpening, type PlanSources } from "@/engine/forecast/assemble";
import { buildForecast } from "@/engine/forecast/model";
import { buildMonthlyCashFlow, monthlyInvariants } from "@/engine/forecast/monthly";
import { assembleGst, type GstPlanSources } from "@/engine/forecast/gst_assemble";
import { taxComponents, taxHeading } from "@/engine/plan/gst";
import { cashTimingSchedule, daysFromHistory, workingCapitalSchedule } from "@/engine/forecast/assumptions";
import { firstProjectedYear } from "@/engine/plan/calendar";
import type { FundingSource } from "@/engine/funding/sources";

/**
 * The forecast is assembled on the server and handed down finished (§6.32.3). Nothing on the client
 * recomputes any of it, so a figure can never differ between the statement showing it and the check
 * verifying it. Every source here is loaded by the same helper the owning module uses.
 */
export default async function ForecastPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();

  const [session, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_settings").select("*").eq("plan_id", planId).maybeSingle(),
  ]);
  const s = settings.data;
  const fyEndMonth = Number(s?.financial_year_end_month ?? 6);

  const [products, fixedCogs, overheads, assets, extraordinary, historic, fundingRows, salaries, marketing] =
    await Promise.all([
      supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order"),
      supabase.from("plan_fixed_cogs").select("*").eq("plan_id", planId),
      supabase.from("plan_overheads").select("*").eq("plan_id", planId),
      supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId),
      supabase.from("plan_extraordinary_items").select("*").eq("plan_id", planId),
      supabase.from("plan_historic_periods").select("*").eq("plan_id", planId).order("period_number").limit(1).maybeSingle(),
      loadFundingRows(planId),
      loadSalariesByYear(planId, firstProjectedYear(s?.first_projected_year, fyEndMonth), fyEndMonth),
      loadMarketingByYear(planId),
    ]);

  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const h = historic.data;
  const num = (v: unknown) => Number(v ?? 0) || 0;

  // The engine's own funding shape, via the converter the Funding module uses — not a second reading.
  const funding: FundingSource[] = fundingRows.map((r) => ({
    id: r.id, kind: r.kind, name: r.name, amount: r.amount,
    start_year: r.start_year, start_month: r.start_month,
    loan: loanOf(r), rbf: rbfOf(r), equity_percent: r.equity_percent,
  }));

  const sources = {
    products: products.data ?? [], costProducts: products.data ?? [], fixedCogs: fixedCogs.data ?? [],
    overheads: (overheads.data ?? []).map((o) => ({ ...o, current_value: num(o.current_value) })),
    salaries, marketing, onCostPct: num(s?.on_cost_pct),
    funding,
    assets: (assets.data ?? []).map((a) => ({
      ...a, purchase_price: num(a.purchase_price), residual_value: num(a.residual_value),
      useful_life_months: num(a.useful_life_months) || 60,
      start_year: num(a.start_year) || 1, start_month: num(a.start_month) || 1,
    })),
    extraordinary: (extraordinary.data ?? []).map((e) => ({ ...e, amount: num(e.amount), year: num(e.year) || 1, month: num(e.month) || 1 })),
  } as unknown as PlanSources;

  // A trading business should not be asked to guess at days its own accounts already answer.
  const impliedFromHistory = daysFromHistory(h ? {
    revenue: num(h.revenue), cogs: num(h.cogs),
    accounts_receivable: num(h.accounts_receivable), inventory_wip: num(h.inventory_wip),
    accounts_payable: num(h.accounts_payable),
  } : null);
  const workingCapital = workingCapitalSchedule(s?.working_capital_schedule, impliedFromHistory ?? undefined);
  const cashTiming = cashTimingSchedule(s?.cash_flow_assumptions);
  const stored = s?.working_capital_schedule as Record<string, unknown> | null | undefined;

  const opening = assembleOpening(h ?? null, num(s?.opening_cash), num(s?.opening_tax_payable));

  /**
   * GST (§6.38). Assembled once and fed into the year and the months from the same place, so the liability
   * on the balance sheet and the BAS payment on the cash flow can never be two different readings.
   */
  const components = taxComponents(s);
  const gstParts = assembleGst(sources as unknown as GstPlanSources, components);
  const base = assembleBase(sources);
  for (const y of [1, 2, 3, 4, 5]) base[y].gst = gstParts.byYear[y];

  const forecast = buildForecast({
    base,
    opening,
    workingCapital, cashTiming,
    taxRate: Number(s?.tax_rate ?? 25), dividendRate: num(s?.dividend_rate),
    openingTaxLosses: num(s?.opening_tax_losses), openingRetainedEarnings: num(s?.opening_retained_earnings),
  });

  /**
   * Year 1 month by month (§6.36), off the same annual figures rather than a second reading of the plan:
   * the opening balances the forecast opened on, the closing balances it computed, and the month series each
   * module already publishes. The invariants it returns are appended to the strip, so a module whose twelve
   * months stop adding to its own year fails visibly here rather than drifting quietly.
   */
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
  const checked = {
    ...forecast,
    invariants: [...forecast.invariants, ...monthlyInvariants(monthly, forecast.cashFlow[1])],
  };
  checked.reconciled = checked.invariants.every((i) => i.passed);

  const areas = ["pnl", "cash", "balance", "assumptions"] as const;
  return (
    <ForecastModule
      planId={planId} mode={mode} forecast={checked} monthly={monthly}
      initialArea={areas.includes((area ?? "") as typeof areas[number]) ? (area as typeof areas[number]) : "pnl"}
      workingCapital={workingCapital} cashTiming={cashTiming}
      impliedFromHistory={impliedFromHistory}
      assumptionsSet={!!stored && Object.keys(stored).length > 0}
      fyEndMonth={fyEndMonth} firstYear={firstProjectedYear(s?.first_projected_year, fyEndMonth)}
      gst={{ registered: components.length > 0 }} gstLabel={taxHeading(components)}
      gstSchedules={gstParts.schedules} gstComponents={components.map((c) => ({ label: c.label, rate: c.rate, frequency: c.frequency, reclaimable: c.reclaimable }))}
    />
  );
}
