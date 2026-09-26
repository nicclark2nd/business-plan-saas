import { createClient } from "@/lib/supabase/server";
import { readRanges } from "@/engine/capability/ranges";
import { readCollateral, readGrowth, readSale, readStress, readUndrawn, type TransferRating } from "@/engine/capability/judgements";
import { getSession } from "@/lib/plan";
import { loadPlan } from "@/lib/planLoad";
import { loadSalariesByYear } from "@/lib/planSources";
import { runForecast } from "@/engine/forecast/run";
import { monthlyProfit } from "@/engine/forecast/monthlyProfit";
import { productYears, sourceOf, recurring, type AnyProduct } from "@/engine/sales/product";
import { productCostYears, type CostProduct } from "@/engine/cogs/direct";
import type { FacilityFacts, ProductFacts } from "@/engine/capability/series";
import type { ExtraFacts } from "@/engine/capability/extras";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { planMonths } from "@/engine/plan/calendar";
import { CapabilitiesModule } from "./CapabilitiesModule";
import type { PlanFacts } from "./CapabilitiesModule";

/**
 * FINANCIAL CAPABILITIES (§6.128, rebuilt §6.129) — a tool, not a step.
 *
 * It asks nothing of the client at all, which is why it sits in Tools beside the What-If planner rather than
 * in the numbered path. Nothing on it is saved because nothing on it is entered: every judgement it needs is
 * now collected on the step that owns the subject, and this page is the one place that gathers them.
 *
 * SIX SOURCES, ONE READER EACH. The forecast for the arithmetic; `readGrowth`, `readStress` and `readSale`
 * for the figures on Assumptions and Plan settings; `plan_transfer_ratings` for the six judgements scored on
 * Leadership Team; `readCollateral` for the security values on Fixed Assets; `readUndrawn` for the facility
 * headroom already recorded on Funding. Nothing is asked for twice (§6.41).
 *
 * THE SAME FORECAST RUN AS EVERY OTHER SCREEN (§6.67). `loadPlan` then `runForecast`, exactly as the
 * dashboard and the statements do — so a cash conversion cycle here cannot disagree with the Assumptions
 * screen, and the lowest month cannot disagree with the dashboard's own chart.
 */
export default async function CapabilitiesPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();

  const [session, ratings, addBacks, measures, customers, marketing, historic, people, meta] = await Promise.all([
    getSession(),
    supabase.from("plan_transfer_ratings").select("factor, score, note").eq("plan_id", planId),
    /*
     * THE FIGURES BEHIND THE FOUR PANELS THAT HAD NO DATA (§6.129.3), each from the step that collects it.
     * Read outside the forecast's try: a plan too empty to forecast still has customers and a lender history
     * worth showing, and those panels should not go dark because the P&L is blank.
     */
    supabase.from("plan_add_backs").select("label, amount").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_capacity_measures").select("name, pct_used").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_customers").select("name, revenue_share, contract_ends_on, assignable").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_marketing").select("customer_retention_pct, weighted_pipeline").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_historic_periods").select("revenue, accounts_receivable, ar_current, ar_30, ar_60, ar_90, fixed_assets").eq("plan_id", planId).eq("period_number", 1).maybeSingle(),
    supabase.from("plan_people").select("started_on").eq("plan_id", planId),
    supabase.from("plan_settings").select("date_established, has_history, repayments_on_time, covenant_history, guarantee_offered, guarantee_by").eq("plan_id", planId).maybeSingle(),
  ]);

  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const today = new Date();
  const yearsSince = (iso: string) => (today.getTime() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000);
  /*
   * KEY HIRES ARE WORKED OUT, NOT ASKED (§6.41). Somebody on the Leadership Team with a start date still to
   * come is a planned hire; everyone else is in place. Tenure is measured to today, because "how long have
   * these people run this business" is asked about the business as it stands.
   */
  const starts = (people.data ?? []).map((p) => p.started_on as string | null);
  const planned = starts.filter((d) => d && new Date(d) > today).length;
  const tenures = starts.filter((d): d is string => !!d && new Date(d) <= today).map(yearsSince);
  const h = historic.data;
  const extras: ExtraFacts = {
    capacity: (measures.data ?? []).map((m) => ({ name: m.name as string, pctUsed: num(m.pct_used) })),
    hires: { inPlace: starts.length - planned, planned },
    pipeline: num(marketing.data?.weighted_pipeline), retention: num(marketing.data?.customer_retention_pct),
    customers: (customers.data ?? []).map((c) => ({
      name: c.name as string, share: num(c.revenue_share), endsOn: (c.contract_ends_on as string | null) ?? null,
      assignable: (c.assignable as boolean | null) ?? null,
    })),
    ageing: { current: num(h?.ar_current), d30: num(h?.ar_30), d60: num(h?.ar_60), d90: num(h?.ar_90) },
    receivables: num(h?.accounts_receivable),
    newBusiness: meta.data?.has_history === false || !h,
    lender: {
      onTime: (meta.data?.repayments_on_time as boolean | null) ?? null,
      covenants: (meta.data?.covenant_history as string | null) ?? null,
      guarantee: (meta.data?.guarantee_offered as boolean | null) ?? null,
      guaranteeBy: (meta.data?.guarantee_by as string | null) ?? null,
    },
    addBackLines: (addBacks.data ?? []).map((a) => ({ label: a.label as string, amount: Number(a.amount) || 0 })),
    yearsTrading: meta.data?.date_established ? Math.max(0, yearsSince(meta.data.date_established as string)) : null,
    leadership: { count: starts.length, avgTenureYears: tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : null },
    lastRevenue: num(h?.revenue),
  };

  let currency = "AUD";
  /*
   * FOR THE PANELS UNDER THE CARDS (§6.129.2), not for any measure: each product's own five years, and the
   * borrowing lines the plan carries. Both through the converters their own steps use — `productCostYears`
   * is what COGS shows per product, the funding rows are what the forecast repays — so a panel here cannot
   * disagree with the screen the figure came from.
   */
  let productFacts: ProductFacts[] = [];
  let facilities: FacilityFacts[] = [];
  /* §6.21: the plan's own twelve months, never the calendar's. */
  let months: string[] = planMonths(6);
  /* Bank debt already on the last balance sheet, which Funding does not itemise (§6.32.4). */
  let openingDebt = 0;

  /*
   * THE FACTS CROSS THE WIRE; THE FORMATTER DOES NOT.
   *
   * `CapabilityInput` carries a `money` function, and a function cannot be serialised from a server
   * component to a client one. The module rebuilds it from the currency, which it needs anyway — so the
   * boundary carries data only, and nothing here has to pretend a function is data.
   */
  let input: PlanFacts = {
    pnl: {}, cashFlow: {}, balanceSheet: {}, days: {},
    monthlyCash: [], monthlyProfit: [], debtService: {}, capex: {},
    /*
     * EVERY JUDGEMENT STARTS ABSENT, never at a default (§6.89). A plan too empty to forecast should show
     * nine grey dials each naming the box that would answer it — not nine dials judged against figures the
     * app chose on the client's behalf.
     */
    growth: { cashBuffer: null, costOfCapital: null },
    stress: { salesPct: null, marginPts: null, debtorDaysAdded: null },
    sale: { askingPrice: null, addBacks: null, multipleLow: null, multipleHigh: null, exitYear: null },
    transfer: (ratings.data ?? []) as TransferRating[],
    recurringShare: null, largestProductShare: null, leadershipPay: null,
    collateral: null, undrawn: 0,
  };

  try {
    const { plan, fyEndMonth, firstYear, settings } = await loadPlan(planId);
    currency = (settings?.currency as string | undefined) ?? "AUD";
    months = planMonths(fyEndMonth);
    openingDebt = (plan.opening.bankLoansCurrent ?? 0) + (plan.opening.bankLoansNonCurrent ?? 0);
    const run = runForecast(plan);
    const f = run.checked ?? run.forecast;

    /*
     * DEBT SERVICE COMES OFF THE CASH FLOW, not out of the funding rows a second time.
     *
     * `debtRepaid` plus `interestPaid` is what the plan actually pays a lender in a year, already
     * including every loan's own schedule, fees and timing. Re-deriving it from the loan table would be a
     * second reading of the same fact, and the two would drift the first time a funding rule changed
     * (§6.41).
     */
    const debtService: Record<number, number> = {};
    const capex: Record<number, number> = {};
    for (const y of FORECAST_YEARS) {
      const cf = f.cashFlow?.[y];
      if (!cf) continue;
      debtService[y] = Math.round((Math.abs(cf.debtRepaid) + Math.abs(cf.interestPaid)) * 100) / 100;
      capex[y] = Math.abs(cf.capex);
    }

    /*
     * HOW MUCH OF NEXT YEAR IS ALREADY SPOKEN FOR (§6.128.2).
     *
     * Read from the products themselves — each one is already marked "One-off job" or "Ongoing client" on
     * the Sales step, and `productYears` is the same revenue projection the forecast runs on. Nobody is
     * asked a second time for something the plan already knows (§6.41).
     */
    const products = (plan.sources.products ?? []) as unknown as AnyProduct[];
    let recurringRevenue = 0, totalRevenue = 0, biggest = 0;
    for (const prod of products) {
      const y1 = productYears(prod, sourceOf(prod, products))[0]?.revenue ?? 0;
      totalRevenue += y1;
      biggest = Math.max(biggest, y1);
      if (recurring(prod)) recurringRevenue += y1;
    }

    /*
     * The leadership wage bill a buyer inherits (§6.128.4). `loadSalariesByYear` is what Overheads shows
     * as its locked line and what the forecast costs — so this is the same figure, not a second count of
     * the same people (§6.19).
     */
    const salaries = await loadSalariesByYear(planId, firstYear, fyEndMonth).catch(() => []);

    productFacts = (products as (CostProduct & { name?: string | null })[]).map((prod) => ({
      name: (prod.name ?? "").trim() || "Unnamed product",
      years: productCostYears(prod, sourceOf(prod, products)).map((y) => ({ revenue: y.revenue, grossProfit: y.grossProfit })),
    }));
    facilities = plan.sources.funding
      .filter((fs) => fs.loan)
      .map((fs) => ({
        name: fs.name || "Unnamed facility", kind: fs.kind,
        drawn: fs.loan!.amount_drawn ?? 0,
        facility: fs.loan!.total_facility_amount ?? fs.loan!.amount_drawn ?? 0,
        ratePct: fs.loan!.interest_rate ?? 0,
        termMonths: fs.loan!.term_months ?? 0,
      }));

    input = {
      ...input,
      recurringShare: totalRevenue > 0 ? recurringRevenue / totalRevenue : null,
      largestProductShare: totalRevenue > 0 ? biggest / totalRevenue : null,
      leadershipPay: salaries[0] ?? null,
      pnl: f.pnl ?? {},
      cashFlow: f.cashFlow ?? {},
      balanceSheet: f.balanceSheet ?? {},
      days: plan.workingCapital ?? {},
      monthlyCash: run.monthly?.months?.map((m) => m.closingCash) ?? [],
      monthlyProfit: run.shapesByYear?.[1] ? monthlyProfit(run.shapesByYear[1]) : [],
      debtService, capex,
      /*
       * The stored judgements, through the one reader each (§6.129). `plan.sources.funding` is the same
       * funding shape the forecast itself runs on, so the undrawn facility here cannot disagree with the
       * facility on the Funding screen — and the security values come off the very assets the balance sheet
       * is carrying.
       */
      growth: readGrowth(settings), stress: readStress(settings), sale: readSale(settings, addBacks.data ?? []),
      collateral: readCollateral((plan.sources.assets ?? []) as { security_value?: unknown }[]),
      /*
       * THE PLANT ALREADY ON THE BOOKS, AND HOW MUCH OF IT IS LISTED (§6.135). Loan-to-value waits until
       * enough of it is — see `securityGap`.
       */
      security: {
        openingPlant: num(historic.data?.fixed_assets),
        listedOwned: ((plan.sources.assets ?? []) as { already_owned?: unknown; purchase_price?: unknown }[])
          .filter((a) => a.already_owned === true).reduce((t, a) => t + (num(a.purchase_price) ?? 0), 0),
      },
      undrawn: readUndrawn(plan.sources.funding),
      /* Ranges set for this plan on Plan settings → Capability ranges (§6.140). */
      ranges: readRanges(settings?.capability_ranges),
    };
  } catch (e) {
    /*
     * A plan too empty to forecast is not a fault here. Every metric reports itself unanswerable with the
     * sentence that says what would answer it, which is a more useful screen than an error page.
     */
    console.error("capabilities", planId, e);
  }

  return (
    <CapabilitiesModule
      planId={planId}
      mode={(session?.profile?.mode ?? "guided") as "guided" | "advanced"}
      currency={currency}
      facts={input}
      products={productFacts}
      facilities={facilities}
      months={months}
      openingDebt={openingDebt}
      extras={extras}
    />
  );
}
