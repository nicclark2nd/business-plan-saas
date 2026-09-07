"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FundingKind } from "@/engine/funding/sources";
import type { FundingRow, LoanType } from "./model";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

const TABLE: Record<FundingKind, string> = {
  owner: "plan_funding_owner", debt: "plan_funding_debt", equity: "plan_funding_equity",
  grant: "plan_funding_grants", revenue_linked: "plan_funding_revenue_linked",
};

const money = (v: unknown) => Math.max(0, Number(v) || 0);
const pct = (v: unknown, max = 1000) => Math.min(max, Math.max(0, Number(v) || 0));
const yr = (v: unknown) => Math.min(5, Math.max(1, Math.trunc(Number(v)) || 1));
const mo = (v: unknown) => Math.min(12, Math.max(1, Math.trunc(Number(v)) || 1));
const ASSET_BACKED = ["equipment_finance", "vehicle_finance"];

/** One row of funding, whichever of the five tables it belongs to. */
export async function upsertFunding(planId: string, r: Partial<FundingRow> & { kind: FundingKind }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const name = (r.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the source a name." };

  const when = { start_year: yr(r.start_year), start_month: mo(r.start_month) };
  let row: Record<string, unknown>;

  switch (r.kind) {
    case "owner":
      row = { plan_id: planId, name, funding_type: r.owner_type === "owner_loan" ? "owner_loan" : "owner_capital",
        amount: money(r.amount), interest_rate: r.owner_type === "owner_loan" ? pct(r.interest_rate, 100) : null,
        repayment_term_months: r.owner_type === "owner_loan" ? Math.max(0, Math.trunc(Number(r.term_months) || 0)) : null, ...when };
      break;
    case "debt": {
      const amount = money(r.amount);
      row = { plan_id: planId, lender_name: name, loan_type: r.loan_type ?? "term_loan",
        amount_drawn: amount, total_facility_amount: Math.max(amount, money(r.total_facility_amount)),
        interest_rate: pct(r.interest_rate, 100), term_months: Math.max(0, Math.trunc(Number(r.term_months) || 0)),
        repayment_type: r.repayment_type ?? "amortised", payment_frequency: r.payment_frequency ?? "monthly",
        residual_value: money(r.residual_value), min_repayment_pct: pct(r.min_repayment_pct, 100),
        annual_fee: money(r.annual_fee), ...when };
      break;
    }
    case "equity":
      row = { plan_id: planId, investor_name: name, amount_invested: money(r.amount),
        equity_percent: pct(r.equity_percent, 100), pre_money_valuation: r.pre_money_valuation ? money(r.pre_money_valuation) : null,
        dividend_policy: !!r.dividend_policy, ...when };
      break;
    case "grant":
      row = { plan_id: planId, grant_name: name, amount_approved: money(r.amount),
        has_conditions: !!r.has_conditions, conditions: (r.conditions ?? "").trim() || null,
        recognition_type: r.recognition_type ?? "immediate",
        recognition_period_months: r.recognition_type === "deferred" ? Math.max(1, Math.trunc(Number(r.recognition_period_months) || 12)) : null, ...when };
      break;
    default:
      row = { plan_id: planId, provider: name, amount_received: money(r.amount),
        repayment_percent: pct(r.repayment_percent, 100), cap_multiple: Math.max(1, Number(r.cap_multiple) || 1.5),
        min_monthly_payment: money(r.min_monthly_payment), ...when };
  }

  const table = TABLE[r.kind];
  const q = r.id && !r.id.startsWith("tmp-")
    ? supabase.from(table).update(row).eq("id", r.id).eq("plan_id", planId).select("id").single()
    : supabase.from(table).insert(row).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("funding", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }

  // Equipment and vehicle finance buy something the business then owns. The asset belongs to this loan and is
  // never editable in Fixed Assets — the same rule as a synced Overheads line (§6.19).
  if (r.kind === "debt") await syncFinancedAsset(planId, data.id, name, r);

  touch(planId);
  return { ok: true, data: { id: data.id } };
}

/** Create, update or clear the asset a finance row carries. */
async function syncFinancedAsset(planId: string, debtId: string, name: string, r: Partial<FundingRow>) {
  const supabase = await createClient();
  const backed = ASSET_BACKED.includes((r.loan_type ?? "term_loan") as LoanType);
  const { data: existing } = await supabase.from("plan_fixed_assets").select("id").eq("funding_debt_id", debtId).maybeSingle();

  if (!backed) {
    if (existing) await supabase.from("plan_fixed_assets").delete().eq("id", existing.id).eq("plan_id", planId);
    return;
  }
  // The asset costs what the loan bought — the drawn amount plus anything paid up front.
  const asset = {
    plan_id: planId, source: "finance" as const, funding_debt_id: debtId, name,
    category: r.loan_type === "vehicle_finance" ? "Vehicle" : "Equipment",
    purchase_price: money(r.amount),               // what the lender advanced is what the asset cost
    residual_value: money(r.residual_value),       // the balloon is what it is expected to be worth
    useful_life_months: Math.max(12, Math.trunc(Number(r.term_months) || 60)),
    start_year: yr(r.start_year), start_month: mo(r.start_month),
  };
  if (existing) await supabase.from("plan_fixed_assets").update(asset).eq("id", existing.id).eq("plan_id", planId);
  else await supabase.from("plan_fixed_assets").insert(asset);
}

export async function deleteFunding(planId: string, kind: FundingKind, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };                 // a financed asset goes with its loan, by cascade
}

/** What is in the bank the day the plan starts — the starting point for "is the funding enough?". */
export async function saveOpeningCash(planId: string, value: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_settings").update({ opening_cash: Number(value) || 0 }).eq("plan_id", planId);
  if (error) { console.error("opening cash", error); return { ok: false, error: error.message }; }
  touch(planId); return { ok: true };
}

export async function continueFromFunding(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/assets` : `/plans/${planId}/dashboard`);
}
