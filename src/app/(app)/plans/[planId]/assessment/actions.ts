"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextHref } from "@/lib/nav";
import { failed } from "@/lib/actionFailed";
import { TARGET_META, clampTarget, mayWriteThrough, readTargets, type AgreedTargets, type TargetKind } from "@/engine/capability/targets";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Forward along the path. When the accounts showed nothing to fix there is nothing to agree, so continuing
 * is itself the Planner working the step through: an empty `{}` marks it done without inventing a target.
 */
export async function continueFromAssessment(planId: string, intent: "next" | "later", nothingToFix = false) {
  if (nothingToFix) {
    const supabase = await createClient();
    await supabase.from("plan_settings").update({ agreed_targets: {} }).eq("plan_id", planId).is("agreed_targets", null);
  }
  redirect(intent === "next" ? nextHref(planId, "assessment") : `/plans/${planId}/dashboard`);
}

/**
 * AGREE A TARGET, CHANGE IT, OR TAKE IT BACK (§6.165).
 *
 * `value` null removes the agreement. Two kinds are also the plan's own setting — the cash floor and the term
 * of the loans already owed — and those are written through, but only to a setting that is empty or still
 * holds what was last agreed here (`mayWriteThrough`): a figure typed on Funding or Assumptions since is
 * the Planner's, and is left alone. Gives back what was stored, and whether the setting now matches.
 */
export async function saveTarget(planId: string, kind: TargetKind, value: number | null, proposed: number):
  Promise<Result<{ targets: AgreedTargets; setting: number | null }>> {
  if (!TARGET_META[kind]) return { ok: false, error: "That target is not one this screen knows." };
  const v = value === null ? null : clampTarget(kind, Number(value));
  if (value !== null && v === null) return { ok: false, error: "That figure is not a number." };
  const p = clampTarget(kind, Number(proposed)) ?? v ?? 0;

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase.from("plan_settings")
    .select("agreed_targets, cash_floor, existing_debt").eq("plan_id", planId).maybeSingle();
  if (readError) return failed(readError, "read the agreed targets");

  const targets = readTargets(row?.agreed_targets) ?? {};
  const last = targets[kind]?.value ?? null;
  if (v === null) delete targets[kind];
  else targets[kind] = { value: v, proposed: p, agreed_at: new Date().toISOString().slice(0, 10) };

  /*
   * Taking back the last target returns the column to null — "not worked through" — so the step is open again.
   * `{}` is kept for its one meaning: the Planner continued past accounts that showed nothing to fix.
   */
  const patch: Record<string, unknown> = { plan_id: planId, agreed_targets: Object.keys(targets).length ? targets : null };
  let setting: number | null = null;
  if (kind === "cashFloor") {
    const now = row?.cash_floor === null || row?.cash_floor === undefined ? null : Number(row.cash_floor);
    setting = now;
    if (mayWriteThrough(now, last)) { patch.cash_floor = v; setting = v; }
  }
  if (kind === "loanTermMonths") {
    const debt = (row?.existing_debt ?? {}) as { interest_rate?: number | null; term_months?: number | null; repayment_type?: string | null };
    const now = debt.term_months ?? null;
    setting = now;
    if (mayWriteThrough(now, last)) {
      const next = { interest_rate: debt.interest_rate ?? null, term_months: v, repayment_type: debt.repayment_type ?? null };
      patch.existing_debt = next.interest_rate === null && next.term_months === null && next.repayment_type === null ? null : next;
      setting = v;
    }
  }

  const { error } = await supabase.from("plan_settings").upsert(patch, { onConflict: "plan_id" });
  if (error) return failed(error, v === null ? "take that target back" : "agree that target");
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true, data: { targets, setting } };
}
