"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExtraordinaryCategory } from "@/engine/extraordinary/items";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const money = (v: unknown) => Math.max(0, Number(v) || 0);
const yr = (v: unknown) => Math.min(5, Math.max(1, Math.trunc(Number(v)) || 1));
const mo = (v: unknown) => Math.min(12, Math.max(1, Math.trunc(Number(v)) || 1));

/**
 * One one-off. The year is always a plan year 1–5, so there is no date a client can choose that the
 * forecast then quietly ignores — the fault that left 15,000 of entered income out of APeX's own P&L.
 */
export async function upsertExtraordinary(planId: string, x: {
  id?: string; description: string; category: ExtraordinaryCategory; amount: number;
  year?: number | null; month?: number | null; source_asset_id?: string | null; notes?: string | null;
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const description = (x.description ?? "").trim();
  if (!description) return { ok: false, error: "Say what the one-off is." };

  const category: ExtraordinaryCategory = x.category === "expense" ? "expense" : "income";
  const row = {
    plan_id: planId, description, category,
    amount: money(x.amount),
    year: yr(x.year), month: mo(x.month),
    // only money coming in can be the proceeds of selling something
    source_asset_id: category === "income" ? (x.source_asset_id || null) : null,
    notes: (x.notes ?? "").trim() || null,
  };

  const q = x.id && !x.id.startsWith("tmp-")
    ? supabase.from("plan_extraordinary_items").update(row).eq("id", x.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_extraordinary_items").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save the one-off item");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteExtraordinary(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_extraordinary_items").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove the one-off item");
  touch(planId); return { ok: true };
}

export async function continueFromExtraordinary(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "extraordinary") : `/plans/${planId}/dashboard`);
}
