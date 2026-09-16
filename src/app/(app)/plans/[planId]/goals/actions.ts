"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import type { GoalStatus } from "./model";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");
const isArea = (a: string): a is GoalArea => GOAL_AREAS.some((x) => x.key === a);

/**
 * The one annual goal for an area (§6.7).
 *
 * The database allows exactly one per area per plan, so this upserts on that pair rather than carrying an
 * id around: whichever screen writes it — this module, or the AI drafting step when it exists — lands on
 * the same row. An empty title deletes it, because an area with nothing to say should not leave a blank
 * heading in the report.
 */
export async function saveAnnualGoal(planId: string, area: string, title: string): Promise<Result<{ id: string | null }>> {
  if (!isArea(area)) return { ok: false, error: "Unknown area." };
  const supabase = await createClient();
  const text = title.trim();

  if (!text) {
    // Its quarterly goals go with it — the foreign key cascades, which is the honest reading: a quarterly
    // goal with no annual goal above it has nothing to be a step towards.
    const { error } = await supabase.from("plan_goals").delete()
      .eq("plan_id", planId).eq("area", area).is("parent_id", null);
    if (error) return { ok: false, error: `Couldn't remove: ${error.message}` };
    touch(planId); return { ok: true, data: { id: null } };
  }

  const { data: existing } = await supabase.from("plan_goals").select("id")
    .eq("plan_id", planId).eq("area", area).is("parent_id", null).maybeSingle();

  const q = existing
    ? supabase.from("plan_goals").update({ title: text }).eq("id", existing.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_goals").insert({ plan_id: planId, area, title: text, source: "manual" }).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  touch(planId); return { ok: true, data: { id: data.id } };
}

export type QuarterlyInput = {
  id?: string;
  area: string;
  title: string;
  /** The SWOT line this goal answers (§6.59.1), so the two can never drift into saying the same thing twice. */
  swotItemId?: string | null;
  year: number;
  quarter: number;
  ownerPersonId: string | null;
  status: GoalStatus;
  milestoneDate: string | null;
};

/**
 * A quarterly goal, under the annual goal for its area.
 *
 * The annual goal is created empty if the area has none yet, because the alternative is refusing a client
 * who knows what they will do this quarter but has not yet written the sentence above it. The report reads
 * the annual goals, so an empty one is visible and askable-about rather than silently absent.
 */
export async function saveQuarterlyGoal(planId: string, input: QuarterlyInput): Promise<Result<{ id: string }>> {
  if (!isArea(input.area)) return { ok: false, error: "Unknown area." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the goal a name first." };
  const supabase = await createClient();

  const { data: parent, error: parentErr } = await supabase.from("plan_goals")
    .select("id").eq("plan_id", planId).eq("area", input.area).is("parent_id", null).maybeSingle();
  if (parentErr) return { ok: false, error: parentErr.message };

  let parentId = parent?.id as string | undefined;
  if (!parentId) {
    const { data, error } = await supabase.from("plan_goals")
      .insert({ plan_id: planId, area: input.area, title: "", source: "manual" }).select("id").single();
    if (error) return { ok: false, error: `Couldn't create the annual goal: ${error.message}` };
    parentId = data.id;
  }

  const row = {
    plan_id: planId, parent_id: parentId, area: input.area, title,
    year: Math.min(5, Math.max(1, Math.trunc(input.year) || 1)),
    quarter: Math.min(4, Math.max(1, Math.trunc(input.quarter) || 1)),
    owner_person_id: input.ownerPersonId || null,
    status: input.status,
    milestone_date: input.milestoneDate || null,
    swot_item_id: input.swotItemId || null,
  };
  const q = input.id
    ? supabase.from("plan_goals").update(row).eq("id", input.id).eq("plan_id", planId).select("id").single()
    : supabase.from("plan_goals").insert({ ...row, source: "manual" }).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: `Couldn't save: ${error.message}` };
  touch(planId); return { ok: true, data: { id: data.id } };
}

/** Status is the one field a review meeting changes, so it saves on its own without opening the dialog. */
export async function setGoalStatus(planId: string, id: string, status: GoalStatus): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_goals").update({ status }).eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: error.message };
  touch(planId); return { ok: true };
}

export async function deleteGoal(planId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_goals").delete().eq("id", id).eq("plan_id", planId);
  if (error) return { ok: false, error: `Couldn't remove: ${error.message}` };
  touch(planId); return { ok: true };
}

export async function continueFromGoals(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? `/plans/${planId}/reports` : `/plans/${planId}/dashboard`);
}
