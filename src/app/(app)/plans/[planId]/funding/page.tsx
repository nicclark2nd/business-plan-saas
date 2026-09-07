import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { startYearFromDate, planYearStart, totalSalariesByYear } from "@/engine/people/salary";
import { YEARS } from "@/engine/sales/projection";
import { planYear1Months, type AnyProduct } from "@/engine/sales/product";
import { planCogsByYear, planCogsMonths, type CostProduct } from "@/engine/cogs/direct";
import { overheadsByYear, overheadsMonths, type Overhead } from "@/engine/overheads/expenses";
import { assetsMonths, capexByYear, type FixedAsset } from "@/engine/assets/depreciation";
import { FundingModule } from "./FundingModule";
import type { FundingRow } from "./model";

/**
 * Funding comes after Sales, COGS and Overheads precisely so it can answer the question APeX never asks:
 * is the money enough? Everything the cash check needs is gathered here, on the server.
 */
export default async function FundingPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, owner, debt, equity, grants, rbf, products, fixedCogs, overheads, people, spend, assets, settings, plan] = await Promise.all([
    getSession(),
    supabase.from("plan_funding_owner").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_debt").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_equity").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_grants").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_revenue_linked").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order"),
    supabase.from("plan_fixed_cogs").select("*").eq("plan_id", planId),
    supabase.from("plan_overheads").select("*").eq("plan_id", planId),
    supabase.from("plan_people").select("annual_salary, salary_adjustments, started_on, role").eq("plan_id", planId),
    supabase.from("plan_marketing_spend").select("annual_budget").eq("plan_id", planId),
    supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId),
    supabase.from("plan_settings").select("opening_cash, on_cost_pct, financial_year_end_month").eq("plan_id", planId).maybeSingle(),
    supabase.from("plans").select("plan_year").eq("id", planId).single(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const n = (v: unknown) => Number(v ?? 0) || 0;

  const rows: FundingRow[] = [
    ...(owner.data ?? []).map((o) => ({
      _key: o.id, id: o.id, kind: "owner" as const, name: o.name ?? "Owner", amount: n(o.amount),
      start_year: n(o.start_year) || 1, start_month: n(o.start_month) || 1,
      owner_type: (o.funding_type ?? "owner_capital") as "owner_capital" | "owner_loan",
      interest_rate: n(o.interest_rate), term_months: n(o.repayment_term_months) || 60,
      repayment_type: "amortised" as const, payment_frequency: "monthly" as const,
    })),
    ...(debt.data ?? []).map((d) => ({
      _key: d.id, id: d.id, kind: "debt" as const, name: d.lender_name ?? "Lender", amount: n(d.amount_drawn),
      start_year: n(d.start_year) || 1, start_month: n(d.start_month) || 1,
      loan_type: d.loan_type, total_facility_amount: n(d.total_facility_amount), interest_rate: n(d.interest_rate),
      term_months: n(d.term_months), repayment_type: d.repayment_type, payment_frequency: d.payment_frequency,
      residual_value: n(d.residual_value), min_repayment_pct: n(d.min_repayment_pct), annual_fee: n(d.annual_fee),
    })),
    ...(equity.data ?? []).map((e) => ({
      _key: e.id, id: e.id, kind: "equity" as const, name: e.investor_name ?? "Investor", amount: n(e.amount_invested),
      start_year: n(e.start_year) || 1, start_month: n(e.start_month) || 1,
      equity_percent: n(e.equity_percent), pre_money_valuation: e.pre_money_valuation === null ? null : n(e.pre_money_valuation),
      dividend_policy: !!e.dividend_policy,
    })),
    ...(grants.data ?? []).map((g) => ({
      _key: g.id, id: g.id, kind: "grant" as const, name: g.grant_name ?? "Grant", amount: n(g.amount_approved),
      start_year: n(g.start_year) || 1, start_month: n(g.start_month) || 1,
      has_conditions: !!g.has_conditions, conditions: g.conditions, recognition_type: g.recognition_type,
      recognition_period_months: g.recognition_period_months === null ? null : n(g.recognition_period_months),
    })),
    ...(rbf.data ?? []).map((v) => ({
      _key: v.id, id: v.id, kind: "revenue_linked" as const, name: v.provider ?? "Provider", amount: n(v.amount_received),
      start_year: n(v.start_year) || 1, start_month: n(v.start_month) || 1,
      repayment_percent: n(v.repayment_percent), cap_multiple: n(v.cap_multiple) || 1.5, min_monthly_payment: n(v.min_monthly_payment),
    })),
  ] as FundingRow[];

  /* ---- what the business does with the money, month by month ---- */
  const prods = (products.data ?? []) as AnyProduct[];
  const sourceFor = (p: AnyProduct) => prods.find((x) => x.id === p.clients_from_product_id) ?? null;
  const revenueMonths = planYear1Months(prods);

  const cost = prods as CostProduct[];
  const fixed = (fixedCogs.data ?? []) as never[];
  const cogsYear1 = planCogsByYear(cost, fixed, sourceFor)[0]?.total ?? 0;
  const cogsMonths = planCogsMonths(cost, fixed, sourceFor);      // the cost of what was actually sold, by month
  const revenueYear1 = revenueMonths.reduce((a, b) => a + b, 0);

  const fyStart = planYearStart(plan.data?.plan_year ?? new Date().getFullYear(), settings.data?.financial_year_end_month ?? 6);
  const salaries = totalSalariesByYear((people.data ?? []).map((p) => ({
    annual_salary: p.annual_salary === null ? null : Number(p.annual_salary),
    salary_adjustments: p.salary_adjustments ?? null,
    startYear: startYearFromDate(p.started_on, fyStart), role: p.role,
  }))).map((y) => y.value);
  const marketingTotal = (spend.data ?? []).reduce((a, s) => a + Number(s.annual_budget ?? 0), 0);
  const ohLines = (overheads.data ?? []).map((o) => ({
    o: { ...o, current_value: Number(o.current_value ?? 0) } as Overhead,
    synced: o.source === "people" ? salaries : o.source === "marketing" ? YEARS.map(() => marketingTotal) : null,
  }));
  const onCostPct = Number(settings.data?.on_cost_pct ?? 0);
  const ohMonths = overheadsMonths(ohLines, onCostPct);
  const ohYear1 = overheadsByYear(ohLines, onCostPct)[0]?.total ?? 0;

  const assetRows = (assets.data ?? []).map((a) => ({
    ...a, purchase_price: Number(a.purchase_price ?? 0), residual_value: Number(a.residual_value ?? 0),
    useful_life_months: Number(a.useful_life_months ?? 60) || 60,
    start_year: Number(a.start_year ?? 1) || 1, start_month: Number(a.start_month ?? 1) || 1,
  })) as FixedAsset[];
  // Buying an asset for cash is money out in the month it arrives; a financed one costs nothing here.
  const capexMonths = Array(12).fill(0) as number[];
  for (const a of assetRows) {
    if (a.source === "finance" || (a.start_year ?? 1) !== 1) continue;
    capexMonths[(a.start_month ?? 1) - 1] += capexByYear(a)[0];
  }

  return (
    <FundingModule
      planId={planId} initial={rows} mode={mode}
      openingCash={Number(settings.data?.opening_cash ?? 0)}
      cash={{ revenueMonths, cogsMonths, overheadsMonths: ohMonths, capexMonths }}
      year1={{ revenue: revenueYear1, cogs: cogsYear1, overheads: ohYear1, depreciation: assetsMonths(assetRows).reduce((a, b) => a + b, 0) }}
    />
  );
}
