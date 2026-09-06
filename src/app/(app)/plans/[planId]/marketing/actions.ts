"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseMonth } from "../people/model";
import { MARKET_FIELDS, SPEND_KINDS, type Market } from "./model";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (e: { message: string }, what: string): Result<never> => { console.error(what, e); return { ok: false, error: `Couldn't save ${what}: ${e.message}` }; };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

export async function saveMarket(planId: string, m: Partial<Market>): Promise<Result> {
  const supabase = await createClient();
  const row: Record<string, string | null> = { plan_id: planId };
  for (const f of MARKET_FIELDS) if (f.key in m) row[f.key] = (m[f.key] ?? "").trim() || null;
  const { error } = await supabase.from("plan_marketing").upsert(row, { onConflict: "plan_id" });
  if (error) return fail(error, "market");
  touch(planId); return { ok: true };
}

/** One save path for the three row grids. Column whitelist per table; nothing else reaches the database. */
const TABLES = {
  competitors: { table: "plan_competitors", cols: ["name", "strengths", "weaknesses", "how_we_win"], required: "name" },
  spend: { table: "plan_marketing_spend", cols: ["kind", "approach", "annual_budget"], required: "approach" },
  evidence: { table: "plan_marketing_evidence", cols: ["source", "finding", "occurred_on"], required: "source" },
} as const;
export type RowKind = keyof typeof TABLES;

export async function upsertRow(planId: string, kind: RowKind, row: Record<string, unknown> & { id?: string }): Promise<Result<{ id: string; occurred_on?: string | null }>> {
  const supabase = await createClient();
  const spec = TABLES[kind];
  const clean: Record<string, unknown> = { plan_id: planId };
  for (const c of spec.cols) {
    if (!(c in row)) continue;
    const v = row[c];
    if (c === "annual_budget") clean[c] = Math.max(0, Number(v) || 0);
    else if (c === "kind") clean[c] = (SPEND_KINDS as readonly string[]).includes(String(v)) ? v : "advertising";
    else if (c === "occurred_on") { const d = parseMonth(v as string); if (d === undefined) return { ok: false, error: "When should be a month and year, e.g. Mar 2026." }; clean[c] = d; }
    else clean[c] = typeof v === "string" ? (v.trim() || null) : v;
  }
  if (!String(clean[spec.required] ?? "").trim()) return { ok: false, error: "Fill in the first column." };
  const q = row.id
    ? supabase.from(spec.table).update(clean).eq("id", row.id).eq("plan_id", planId).select("id").single()
    : supabase.from(spec.table).insert({ ...clean, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return fail(error, kind);
  touch(planId);
  return { ok: true, data: { id: data.id, occurred_on: clean.occurred_on as string | null | undefined } };
}

export async function deleteRow(planId: string, kind: RowKind, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES[kind].table).delete().eq("id", id).eq("plan_id", planId);
  if (error) return fail(error, "removal");
  touch(planId); return { ok: true };
}

export async function continueFromMarketing(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/swot` : `/plans/${planId}/dashboard`);
}
