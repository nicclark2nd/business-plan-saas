"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { failed } from "@/lib/actionFailed";
import { readForBriefing, TABS, VIEWS } from "@/lib/briefing";
import { loadFirm } from "@/lib/firm";
import type { Tab, View } from "@/engine/capability/read";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
export type SavedBriefing = { body: string; score: number | null; headline: string | null; saved_at: string };

const MAX = 8000;

/**
 * SAVE THE PLANNER'S BRIEFING (§6.179), or clear it with an empty body.
 *
 * The score and verdict stored beside it are read here, on the server, from the plan as it stands — not
 * taken from the browser — so "the figures have changed since this was written" compares like with like.
 */
export async function saveBriefing(planId: string, tab: Tab, view: View, body: string): Promise<Result<SavedBriefing | null>> {
  if (!TABS.includes(tab) || !VIEWS.includes(view)) return { ok: false, error: "That tab cannot be briefed." };
  const text = String(body ?? "").replace(/\r\n/g, "\n").trim();
  if (text.length > MAX) return { ok: false, error: `A briefing can be up to ${MAX.toLocaleString()} characters. This one is ${text.length.toLocaleString()}.` };

  if (!(await loadFirm(planId))?.isPlanner) return { ok: false, error: "The briefing is written by the Planner." };

  const supabase = await createClient();
  if (!text) {
    const { error } = await supabase.from("plan_briefings").delete().eq("plan_id", planId).eq("tab", tab).eq("view", view);
    if (error) return failed(error, "clear the briefing");
    return { ok: true, data: null };
  }

  const [session, read] = await Promise.all([getSession(), readForBriefing(planId, tab, view).catch(() => null)]);
  const row = {
    plan_id: planId, tab, view, body: text,
    score: read?.R.s.value ?? null, headline: read?.R.v.headline ?? null,
    saved_by: session?.profile?.id ?? null,
  };
  const { data, error } = await supabase.from("plan_briefings")
    .upsert(row, { onConflict: "plan_id,tab,view" }).select("body, score, headline, updated_at").single();
  if (error) return failed(error, "save the briefing");
  return { ok: true, data: { body: data.body, score: data.score, headline: data.headline, saved_at: data.updated_at } };
}
