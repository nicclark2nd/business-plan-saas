"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { VISION_FIELDS } from "./fields";

export type SaveState = { error?: string; savedAt?: string } | undefined;

export async function saveVision(planId: string, _: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const row: Record<string, string | null> = { plan_id: planId };
  for (const f of VISION_FIELDS) {
    const v = String(formData.get(f.key) ?? "").trim();
    row[f.key] = v || null;
  }
  const { error } = await supabase.from("plan_framework").upsert(row, { onConflict: "plan_id" });
  if (error) return { error: "Couldn't save. Check your connection and try again." };
  revalidatePath(`/plans/${planId}`, "layout");
  if (formData.get("intent") === "next") redirect(`/plans/${planId}/people`);
  if (formData.get("intent") === "later") redirect(`/plans/${planId}/dashboard`);
  return { savedAt: new Date().toISOString() };
}
