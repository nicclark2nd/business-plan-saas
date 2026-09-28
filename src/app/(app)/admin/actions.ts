"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { failed } from "@/lib/actionFailed";

type Result = { ok: true } | { ok: false; error: string };

/** Put an account on hold, or lift it (§6.186). The database checks the caller is a site admin and logs it. */
export async function setHold(orgId: string, on: boolean, reason: string): Promise<Result> {
  if (on && !reason.trim()) return { ok: false, error: "Say why — the account's people will see this reason." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_hold", { p_org: orgId, p_on: on, p_reason: reason.trim().slice(0, 300) });
  if (error) return failed(error, on ? "put the account on hold" : "lift the hold");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Plans given by BizPlanHQ, on top of anything paid for. Sets the number (0 takes them away). */
export async function grantPlans(orgId: string, plans: number): Promise<Result> {
  const n = Math.trunc(Number(plans));
  if (!Number.isFinite(n) || n < 0 || n > 10000) return { ok: false, error: "Give a whole number from 0 to 10,000." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_grant_plans", { p_org: orgId, p_plans: n });
  if (error) return failed(error, "give the plans");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
