"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  serializeCashTiming, serializeWorkingCapital, cashTimingSchedule, workingCapitalSchedule,
} from "@/engine/forecast/assumptions";

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
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}

export async function continueFromForecast(planId: string) {
  redirect(`/plans/${planId}/goals`);
}
