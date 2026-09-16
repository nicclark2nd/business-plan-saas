"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Putting a plan away, and destroying one (§6.58).
 *
 * Two actions with very different weights, deliberately kept apart. Archiving is reversible and takes one
 * click: it is what somebody means nine times in ten by "get rid of it" — a client who finished last year,
 * a plan that has gone stale. Deleting is permanent and cannot be reached by muscle memory, because the
 * gap that prompted all this was a MISTYPED business name: the one thing a client cannot be asked to
 * confirm by recognising it is a name they got wrong.
 *
 * The typed confirmation is checked HERE, against the plan's own name read from the database, not only in
 * the dialog. A guard that lives in the browser is a guard that is not there.
 */
type Result = { ok: true } | { ok: false; error: string };

const refresh = () => { revalidatePath("/setup"); revalidatePath("/", "layout"); };

/** Put a plan on the shelf, or take it back off. Status is untouched: a complete plan stays complete. */
export async function setArchived(planId: string, archived: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Destroy a plan and everything in it. Every plan_* table cascades from plans(id), so the database removes
 * the figures, the goals, the forecast and the history in one statement — there is no partial state to be
 * left in, and nothing to put back afterwards.
 */
export async function deletePlan(planId: string, typedName: string): Promise<Result> {
  const supabase = await createClient();
  const { data: plan, error: readErr } = await supabase
    .from("plans").select("business_name").eq("id", planId).single();
  if (readErr || !plan) return { ok: false, error: "That plan could not be found." };

  const same = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
  if (same(typedName) !== same(plan.business_name)) {
    return { ok: false, error: `Type the plan's name exactly — ${plan.business_name} — to delete it.` };
  }

  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) return { ok: false, error: error.message };
  // Nothing was deleted and nothing said so: RLS allows a delete only for an org admin or advisor, and a
  // policy that refuses returns success with no rows rather than an error.
  const { data: still } = await supabase.from("plans").select("id").eq("id", planId).maybeSingle();
  if (still) return { ok: false, error: "You do not have permission to delete this plan. An organisation admin can." };

  refresh();
  return { ok: true };
}
