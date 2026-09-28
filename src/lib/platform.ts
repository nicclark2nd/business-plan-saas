import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * SITE ADMIN (§6.186) — Nic, as the owner of BizPlanHQ. Decided in SQL only (`platform_admins`, 0063); this
 * asks the database and fails closed: an error, a missing function, anything unexpected reads as "no".
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  return !error && data === true;
});

/** Whether an organisation is on hold, for the banner its own people and clients see (0063). Fails soft to "no". */
export async function holdOf(orgId: string): Promise<{ since: string; reason: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_on_hold", { p_org: orgId });
  const r = (data as { on_hold_at: string | null; reason: string | null }[] | null)?.[0];
  return !error && r?.on_hold_at ? { since: r.on_hold_at, reason: r.reason } : null;
}
