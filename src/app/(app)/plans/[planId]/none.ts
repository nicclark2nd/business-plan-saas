"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * "The business has none of these" — an answer, not an empty screen (§6.57.1).
 *
 * Three guided steps can be legitimately empty, and each of their empty states says so in plain words: a
 * business that runs on its own cash raises no funding, a service business with a laptop owns no fixed
 * assets, plenty of plans have no one-offs. Completeness counted rows, so the only way to answer was to
 * enter something that is not true — the screen told the client empty was right and the menu marked them
 * unfinished for believing it.
 *
 * One writer for one fact, and the column is chosen from a fixed map rather than from anything the caller
 * sends. Saying "none" never deletes anything and never blocks adding a row later: a row that exists
 * answers the question on its own, so the flag is only ever read when the table is empty.
 */
const COLUMN = {
  funding: "no_funding",
  assets: "no_fixed_assets",
  extraordinary: "no_one_offs",
} as const;

export type NoneStep = keyof typeof COLUMN;

export async function sayNone(planId: string, step: NoneStep, value: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const column = COLUMN[step];
  if (!column) return { ok: false, error: "Unknown step." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_settings")
    .upsert({ plan_id: planId, [column]: value }, { onConflict: "plan_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plans/${planId}`, "layout");
  return { ok: true };
}
