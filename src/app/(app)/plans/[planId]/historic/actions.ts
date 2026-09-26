"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveFromComponents, deriveFromTotals, type PeriodInput, type PeriodValues } from "@/engine/historic/derive";
import { parseMonth } from "../people/model";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

/** "2026" → last day of the plan's financial year 2026; "Jun 2026" → 2026-06-30; ISO passes through. */
async function periodEndDate(planId: string, raw: string | number | null | undefined): Promise<string | null | undefined> {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  const supabase = await createClient();
  const { data } = await supabase.from("plan_settings").select("financial_year_end_month").eq("plan_id", planId).maybeSingle();
  const fyEnd = data?.financial_year_end_month ?? 6;
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);   // m is 1-based; day 0 of next month
  if (/^\d{4}$/.test(s)) return lastDay(Number(s), fyEnd);
  const month = parseMonth(s);
  if (month === undefined) return undefined;
  if (month === null) return null;
  const [y, m] = month.split("-").map(Number);
  return lastDay(y, m);
}

/** Save one period column from the grid: the user typed components; the engine fills the subtotals. */
export async function savePeriod(planId: string, periodNumber: number, input: { period_end_text?: string; period_length?: number } & PeriodInput): Promise<Result<{ values: PeriodValues; period_end: string | null }>> {
  const supabase = await createClient();
  if (periodNumber < 1 || periodNumber > 4) return { ok: false, error: "Only four periods are kept." };
  const end = await periodEndDate(planId, input.period_end_text);
  if (end === undefined) return { ok: false, error: "Period end should be a year (2026) or a month and year (Jun 2026)." };
  const values = deriveFromComponents(input);
  const row = { plan_id: planId, period_number: periodNumber, period_end: end, period_length: Math.min(24, Math.max(1, Math.trunc(Number(input.period_length)) || 12)), source: "manual", ...values };
  const { data, error, status } = await supabase.from("plan_historic_periods").upsert(row, { onConflict: "plan_id,period_number" }).select("period_number, revenue");
  if (error) return failed(error, "save the period");
  if (!data?.length) return { ok: false, error: `Saved nothing (status ${status}) — the row was rejected silently. Check plan access.` };
  touch(planId);
  return { ok: true, data: { values, period_end: end } };
}

/** Load the four columns of an uploaded template (totals path). Replaces whatever is there. */
export async function importPeriods(planId: string, periods: { period_number: number; period_end: string | number | null; period_length: number; present: boolean; input: PeriodInput }[]): Promise<Result<{ loaded: number }>> {
  const supabase = await createClient();
  const rows = [];
  for (const p of periods) {
    if (!p.present) continue;
    const end = await periodEndDate(planId, p.period_end);
    const values = deriveFromTotals(p.input);
    rows.push({ plan_id: planId, period_number: p.period_number, period_end: end ?? null, period_length: p.period_length || 12, source: "excel", ...values });
  }
  if (!rows.length) return { ok: false, error: "No periods with numbers were found in that file." };
  const { error: delErr } = await supabase.from("plan_historic_periods").delete().eq("plan_id", planId);
  if (delErr) return failed(delErr, "clear the old periods");
  const { error } = await supabase.from("plan_historic_periods").insert(rows);
  if (error) return failed(error, "load the figures");
  await supabase.from("plan_settings").upsert({ plan_id: planId, has_history: true }, { onConflict: "plan_id" });
  touch(planId);
  return { ok: true, data: { loaded: rows.length } };
}

export async function deletePeriod(planId: string, periodNumber: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_historic_periods").delete().eq("plan_id", planId).eq("period_number", periodNumber);
  if (error) return failed(error, "remove the period");
  touch(planId); return { ok: true };
}

export async function setHasHistory(planId: string, has: boolean | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_settings").upsert({ plan_id: planId, has_history: has }, { onConflict: "plan_id" });
  if (error) return failed(error, "save whether this business has history");
  touch(planId); return { ok: true };
}

export async function continueFromHistoric(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "historic") : `/plans/${planId}/dashboard`);
}


/**
 * HOW OLD THE DEBTORS ARE (§6.129.3), on the most recent period — the one the forecast opens from.
 *
 * Four buckets that must add up to the debtors figure already on that period. The check is here rather than
 * in the database so the message can say by how much it is out; a split that does not reconcile is saved
 * anyway and flagged, because a client halfway through typing four numbers has not made a mistake yet.
 * All four empty clears the split — nobody has aged the ledger, which is a different answer from "nothing
 * is overdue" (§6.89).
 */
export async function saveAgeing(planId: string, a: { ar_current: number | null; ar_30: number | null; ar_60: number | null; ar_90: number | null }): Promise<Result<{ gap: number | null }>> {
  const clean = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.max(0, Math.round(v * 100) / 100));
  const row = { ar_current: clean(a.ar_current), ar_30: clean(a.ar_30), ar_60: clean(a.ar_60), ar_90: clean(a.ar_90) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_historic_periods").update(row)
    .eq("plan_id", planId).eq("period_number", 1).select("accounts_receivable").maybeSingle();
  if (error) return failed(error, "save the debtor ageing");
  if (!data) return { ok: false, error: "Enter the most recent year's balance sheet first — the ageing is a split of its debtors figure." };
  revalidatePath(`/plans/${planId}`, "layout");
  const parts = [row.ar_current, row.ar_30, row.ar_60, row.ar_90];
  const gap = parts.every((p) => p === null) ? null : Math.round(((Number(data.accounts_receivable) || 0) - parts.reduce<number>((t, p) => t + (p ?? 0), 0)) * 100) / 100;
  return { ok: true, data: { gap } };
}
