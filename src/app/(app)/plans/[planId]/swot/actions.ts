"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { QUADRANTS, type Quadrant } from "./model";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

export async function upsertSwot(planId: string, item: { id?: string; quadrant: Quadrant; text: string; source?: string | null; response?: string | null }): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const text = item.text.trim();
  if (!text) return { ok: false, error: "Write the line first." };
  if (!(QUADRANTS as readonly string[]).includes(item.quadrant)) return { ok: false, error: "Unknown quadrant." };
  // An empty response is stored as null, not "": the screen asks "is anything planned", and "" is not an answer.
  const response = (item.response ?? "").trim() || null;
  const row = { plan_id: planId, quadrant: item.quadrant, text, source: item.source ?? null, response };
  const q = item.id
    ? supabase.from("plan_swot_items").update(row).eq("id", item.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_swot_items").insert({ ...row, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save that line");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteSwot(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_swot_items").delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove that line");
  touch(planId); return { ok: true };
}

export async function continueFromSwot(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "swot") : `/plans/${planId}/dashboard`);
}
