"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveFromComponents, deriveFromTotals, PERIOD_FIELDS, type PeriodInput, type PeriodValues } from "@/engine/historic/derive";
import { parseMonth } from "../people/model";

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
  const { error } = await supabase.from("plan_historic_periods").upsert(row, { onConflict: "plan_id,period_number" });
  if (error) { console.error("historic", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
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
  if (delErr) return { ok: false, error: `Couldn't clear the old periods: ${delErr.message}` };
  const { error } = await supabase.from("plan_historic_periods").insert(rows);
  if (error) { console.error("import", error); return { ok: false, error: `Couldn't load: ${error.message}` }; }
  await supabase.from("plan_settings").upsert({ plan_id: planId, has_history: true }, { onConflict: "plan_id" });
  touch(planId);
  return { ok: true, data: { loaded: rows.length } };
}

export async function deletePeriod(planId: string, periodNumber: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_historic_periods").delete().eq("plan_id", planId).eq("period_number", periodNumber);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function setHasHistory(planId: string, has: boolean | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_settings").upsert({ plan_id: planId, has_history: has }, { onConflict: "plan_id" });
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function continueFromHistoric(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/sales` : `/plans/${planId}/dashboard`);
}

export { PERIOD_FIELDS };
