import "server-only";
import { createClient } from "@/lib/supabase/server";
import { YEARS } from "@/engine/sales/projection";
import { startYearFromDate, planYearStart, totalSalariesByYear } from "@/engine/people/salary";
import type { FundingRow } from "@/app/(app)/plans/[planId]/funding/model";
import { capTable, type CapTable } from "@/engine/funding/ownership";

/**
 * Loading the plan, once (§6.32.3).
 *
 * Funding lives in five tables and the engine wants one shape; salaries come from People and are grown by
 * each person's own adjustments. Both were assembled inside `funding/page.tsx`, and the forecast needs them
 * too — so rather than a second copy that drifts, they live here and both pages call them.
 *
 * This is the same rule the adapter enforces one layer down, applied to loading rather than computing: the
 * first time a second page needed the same rows was the moment to extract them, not the moment to paste them.
 */
const n = (v: unknown) => Number(v ?? 0) || 0;

/** The five funding tables as the one row shape the module and the engine both understand. */
export async function loadFundingRows(planId: string): Promise<FundingRow[]> {
  const supabase = await createClient();
  const [owner, debt, equity, grants, rbf] = await Promise.all([
    supabase.from("plan_funding_owner").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_debt").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_equity").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_grants").select("*").eq("plan_id", planId).order("created_at"),
    supabase.from("plan_funding_revenue_linked").select("*").eq("plan_id", planId).order("created_at"),
  ]);
  return [
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
      deposit: n(d.deposit),
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
}

/**
 * Salaries by plan year, grown by each person's own adjustments and started from the month they joined.
 * Overheads shows this as its locked Leadership Team line; the forecast must show the same figure, so it
 * comes from the same function rather than a second reading of the same rows (§6.19).
 */
export async function loadSalariesByYear(planId: string, planYear: number, fyEndMonth: number): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("plan_people")
    .select("annual_salary, salary_adjustments, started_on, role").eq("plan_id", planId);
  const fyStart = planYearStart(planYear, fyEndMonth);
  return totalSalariesByYear((data ?? []).map((p) => ({
    annual_salary: p.annual_salary === null ? null : Number(p.annual_salary),
    salary_adjustments: p.salary_adjustments ?? null,
    startYear: startYearFromDate(p.started_on, fyStart), role: p.role,
  }))).map((y) => y.value);
}

/**
 * Who owns the business, composed ONCE (§6.54). Both the Leadership Team and Funding show it, and both get
 * it from here — the whole point being that they stopped agreeing the moment each counted only its own half.
 */
export async function loadCapTable(planId: string): Promise<CapTable> {
  const supabase = await createClient();
  const [people, investors] = await Promise.all([
    supabase.from("plan_people").select("name, first_name, last_name, pct_shareholding").eq("plan_id", planId),
    supabase.from("plan_funding_equity").select("investor_name, equity_percent").eq("plan_id", planId),
  ]);
  return capTable(
    (people.data ?? []).map((p) => ({
      name: (p.name as string) || [p.first_name, p.last_name].filter(Boolean).join(" "),
      pct_shareholding: n(p.pct_shareholding),
    })),
    (investors.data ?? []).map((i) => ({ name: i.investor_name as string, equity_percent: n(i.equity_percent) })),
  );
}

/** The marketing budget, repeated across the five years exactly as Overheads syncs it. */
export async function loadMarketingByYear(planId: string): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("plan_marketing_spend").select("annual_budget").eq("plan_id", planId);
  const total = (data ?? []).reduce((a, s) => a + Number(s.annual_budget ?? 0), 0);
  return YEARS.map(() => total);
}
