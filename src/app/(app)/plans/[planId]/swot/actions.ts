"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { QUADRANTS, type Quadrant } from "./model";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

export async function upsertSwot(planId: string, item: { id?: string; quadrant: Quadrant; text: string; source?: string | null }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const text = item.text.trim();
  if (!text) return { ok: false, error: "Write the line first." };
  if (!(QUADRANTS as readonly string[]).includes(item.quadrant)) return { ok: false, error: "Unknown quadrant." };
  const row = { plan_id: planId, quadrant: item.quadrant, text, source: item.source ?? null };
  const q = item.id
    ? supabase.from("plan_swot_items").update(row).eq("id", item.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_swot_items").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) { console.error("swot", error); return { ok: false, error: `Couldn't save: ${error.message}` }; }
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteSwot(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_swot_items").delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: `Couldn't remove: ${error.message}` };
  touch(planId); return { ok: true };
}

export async function continueFromSwot(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/historic` : `/plans/${planId}/dashboard`);
}
