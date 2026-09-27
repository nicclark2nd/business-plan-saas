"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { failed } from "@/lib/actionFailed";
import { IP_TYPES, type AreaKey } from "./model";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** One spec per register: its table, the column it cannot be stored without, and what the client may write. */
const TABLES = {
  social: { table: "plan_social_media", required: "platform", cols: ["platform", "url", "description"], ask: "Name the platform first." },
  memberships: { table: "plan_memberships", required: "organisation_name", cols: ["organisation_name", "description"], ask: "Name the organisation first." },
  ip: { table: "plan_ip", required: "name", cols: ["name", "ip_type", "description"], ask: "Name it first." },
} as const satisfies Record<AreaKey, unknown>;

const touch = (planId: string) => revalidatePath(`/plans/${planId}`, "layout");

export async function upsertAsset(planId: string, kind: AreaKey, row: Record<string, unknown> & { id?: string }): Promise<Result<{ id: string }>> {
  const spec = TABLES[kind];
  if (!spec) return { ok: false, error: "That is not one of the registers." };
  const clean: Record<string, unknown> = { plan_id: planId };
  for (const c of spec.cols) {
    if (!(c in row)) continue;
    const v = row[c];
    if (c === "ip_type") clean[c] = IP_TYPES.some((t) => t.value === v) ? v : null;
    else clean[c] = typeof v === "string" ? (v.trim() || null) : null;
  }
  if (!String(clean[spec.required] ?? "").trim()) return { ok: false, error: spec.ask };

  const supabase = await createClient();
  const q = row.id
    ? supabase.from(spec.table).update(clean).eq("id", row.id).eq("plan_id", planId).select("id").single()
    : supabase.from(spec.table).insert({ ...clean, sort_order: -Math.floor(Date.now() / 1000) }).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error, "save that row");
  touch(planId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteAsset(planId: string, kind: AreaKey, id: string): Promise<Result> {
  const spec = TABLES[kind];
  if (!spec) return { ok: false, error: "That is not one of the registers." };
  const supabase = await createClient();
  const { error } = await supabase.from(spec.table).delete().eq("id", id).eq("plan_id", planId);
  if (error) return failed(error, "remove that row");
  touch(planId);
  return { ok: true };
}
