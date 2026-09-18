import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadFundingRows, loadMarketingByYear, loadSalariesByYear } from "@/lib/planSources";
import { grantOf, loanOf, rbfOf } from "@/app/(app)/plans/[planId]/funding/model";
import { assembleOpening, type PlanSources } from "@/engine/forecast/assemble";
import { cashTimingSchedule, daysFromHistory, workingCapitalSchedule } from "@/engine/forecast/assumptions";
import { firstProjectedYear } from "@/engine/plan/calendar";
import { taxComponents, taxHeading, type GstSettings } from "@/engine/plan/gst";
import { productNoun, type Noun } from "@/engine/plan/vocabulary";
import type { WorkingCapitalDays } from "@/engine/forecast/model";
import type { WhatIfPlan } from "@/engine/whatif/levers";
import type { FundingSource } from "@/engine/funding/sources";

/**
 * The plan, loaded once, for every screen that runs the forecast on it (§6.41).
 *
 * Review forecast and the What-If planner are two readings of one plan, and two readings of one plan is how
 * every expensive fault in this project started. So there is one loader: the same tables, the same
 * converters, the same opening balance, the same working-capital schedule and the same tax components. If a
 * figure is wrong on one of those screens it is wrong on both, and both move together when it is fixed.
 *
 * It returns the engine's own input object — `WhatIfPlan` — because that is exactly what a forecast needs:
 * sources, an opening position, the two schedules, the rates, and the taxes. The What-If planner hands it
 * straight to the client and re-runs it there as the sliders move; the forecast page runs it once on the
 * server and hands down the finished statements (§6.32.3).
 */
export type LoadedPlan = {
  /** Everything the engine needs, and nothing it does not. Serialisable: it crosses to the client as-is. */
  plan: WhatIfPlan;
  mode: "guided" | "advanced";
  components: GstSettings[];
  /** "GST", "VAT", "GST and PST" — whatever this plan's country calls it. */
  taxLabel: string;
  fyEndMonth: number;
  firstYear: number;
  /** Days a trading business's own accounts already imply, so it is not asked to guess at them. */
  impliedFromHistory: WorkingCapitalDays | null;
  assumptionsSet: boolean;
  /** The plan's word for what it sells (§6.31). */
  noun: Noun;
  settings: Record<string, unknown> | null;
};

const num = (v: unknown) => Number(v ?? 0) || 0;

/**
 * DEDUPED PER REQUEST (§6.99). It was a plain async function, so a page that loads the plan and a helper
 * that also needs it each paid the nine queries. React's `cache` makes the second call free within one
 * request and changes nothing across requests — the data cannot move underneath a single render.
 */
export const loadPlan = cache(async function loadPlan(planId: string): Promise<LoadedPlan> {
  const supabase = await createClient();
  const [session, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_settings").select("*").eq("plan_id", planId).maybeSingle(),
  ]);
  const s = settings.data;
  const fyEndMonth = Number(s?.financial_year_end_month ?? 6);
  const firstYear = firstProjectedYear(s?.first_projected_year, fyEndMonth);

  const [products, fixedCogs, overheads, assets, extraordinary, historic, fundingRows, salaries, marketing] =
    await Promise.all([
      supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order"),
      supabase.from("plan_fixed_cogs").select("*").eq("plan_id", planId),
      supabase.from("plan_overheads").select("*").eq("plan_id", planId),
      supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId),
      supabase.from("plan_extraordinary_items").select("*").eq("plan_id", planId),
      supabase.from("plan_historic_periods").select("*").eq("plan_id", planId).order("period_number").limit(1).maybeSingle(),
      loadFundingRows(planId),
      loadSalariesByYear(planId, firstYear, fyEndMonth),
      loadMarketingByYear(planId),
    ]);

  const h = historic.data;

  // The engine's own funding shape, via the converter the Funding module uses — not a second reading.
  const funding: FundingSource[] = fundingRows.map((r) => ({
    id: r.id, kind: r.kind, name: r.name, amount: r.amount,
    start_year: r.start_year, start_month: r.start_month,
    loan: loanOf(r), rbf: rbfOf(r), grant: grantOf(r), equity_percent: r.equity_percent,
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
  // The Forecast page passed one array as both, and the What-If planner relies on that to adjust it once.
  (sources as { costProducts: unknown }).costProducts = sources.products;

  // A trading business should not be asked to guess at days its own accounts already answer.
  const impliedFromHistory = daysFromHistory(h ? {
    revenue: num(h.revenue), cogs: num(h.cogs),
    accounts_receivable: num(h.accounts_receivable), inventory_wip: num(h.inventory_wip),
    accounts_payable: num(h.accounts_payable),
  } : null);
  const stored = s?.working_capital_schedule as Record<string, unknown> | null | undefined;
  const components = taxComponents(s);

  return {
    plan: {
      sources,
      opening: assembleOpening(h ?? null, num(s?.opening_cash), num(s?.opening_tax_payable)),
      workingCapital: workingCapitalSchedule(s?.working_capital_schedule, impliedFromHistory ?? undefined),
      cashTiming: cashTimingSchedule(s?.cash_flow_assumptions),
      taxRate: Number(s?.tax_rate ?? 25), dividendRate: num(s?.dividend_rate),
      openingTaxLosses: num(s?.opening_tax_losses), openingRetainedEarnings: num(s?.opening_retained_earnings),
      components,
    },
    mode: (session?.profile?.mode ?? "guided") as "guided" | "advanced",
    components,
    taxLabel: taxHeading(components),
    fyEndMonth, firstYear,
    impliedFromHistory,
    assumptionsSet: !!stored && Object.keys(stored).length > 0,
    noun: productNoun(s?.product_type as string | null),
    settings: (s ?? null) as Record<string, unknown> | null,
  };
});
