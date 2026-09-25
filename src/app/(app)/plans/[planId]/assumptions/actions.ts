"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextHref } from "@/lib/nav";
import {
  serializeCashTiming, serializeWorkingCapital, cashTimingSchedule, workingCapitalSchedule,
} from "@/engine/forecast/assumptions";
import { failed } from "@/lib/actionFailed";

type Result = { ok: true } | { ok: false; error: string };

/**
 * The assumptions behind the cash flow. Both columns have existed since migration 0002 and nothing has ever
 * written them, so every plan has been forecasting on instant collection and instant payment (§6.32.2).
 *
 * Everything is coerced through the engine's own readers before it is stored, so a grid can never come back
 * half-formed: five years, every key present, out-of-range values clamped rather than carried.
 */
export async function saveAssumptions(planId: string, input: {
  workingCapital: Record<number, { debtorDays: number; inventoryDays: number; creditorDays: number }>;
  cashTiming: Record<number, { taxPaidPct: number; prepaidClosing: number; accruedClosing: number }>;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_settings").update({
    working_capital_schedule: serializeWorkingCapital(workingCapitalSchedule(input.workingCapital)),
    cash_flow_assumptions: serializeCashTiming(cashTimingSchedule(input.cashTiming)),
  }).eq("plan_id", planId);
  if (error) return failed(error, "save the assumptions");
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}

/**
 * Back to the days the business's own accounts imply (§6.43.2).
 *
 * `working_capital_schedule` starts empty, and while it is empty the forecast reads the days implied by the
 * last historic period — so the plan tracks the business. The moment anything is saved the grid is populated
 * and that link is cut: the figures stay right, but they stop following the accounts, and there was no way
 * back. A client who corrected their Historic balance sheet after touching this screen would have been
 * forecasting on the old reading with nothing to tell them.
 *
 * Emptying the column restores the fallback rather than writing today's implied figures into it, which is
 * the difference between reverting and copying: a later correction to Historic moves the forecast again.
 *
 * Only the working-capital column. Tax timing, prepayments and accruals are the client's own judgement and
 * have nothing to do with what the accounts imply.
 */
export async function revertToHistoricDays(planId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("plan_settings")
    .update({ working_capital_schedule: {} }).eq("plan_id", planId);
  if (error) return failed(error, "go back to last year's figures");
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}

/**
 * Forward along the path (§6.81, §6.94). This was `continueFromForecast`, hard-coded to `/goals`, and
 * NOTHING IMPORTED IT — the screen had a status-only footer, so there was no button to call it. A dead
 * function with a hand-written destination is how the forward chain drifted before §6.81 derived it.
 */
export async function continueFromAssumptions(planId: string, intent: "next" | "later") {
  redirect(intent === "next" ? nextHref(planId, "assumptions") : `/plans/${planId}/dashboard`);
}
