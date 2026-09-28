import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { cleanColour } from "@/engine/plan/brand";

/**
 * THE FIRM A PLAN BELONGS TO (§6.180) — its name, kind, letterhead, and whether the person looking can
 * change it. Read under RLS: a client who is a member of the plan but not of the firm cannot read the firm
 * at all, and gets null — their plan simply has no firm letterhead to show them.
 *
 * Before migration 0058 the two letterhead columns do not exist; the read falls back to name and kind so
 * nothing that calls this breaks in the gap between a deploy and a migration.
 */
export type Firm = {
  orgId: string;
  name: string;
  /** A coach, consultant or accounting firm — the kinds that write plans for other people's businesses. */
  adviser: boolean;
  logoPath: string | null;
  colour: string | null;
  /** Only a firm admin may change the letterhead (0001's "org update" policy, and 0058's bucket). */
  isAdmin: boolean;
  /**
   * THE PERSON LOOKING IS ONE OF THE FIRM'S PLANNERS (§6.181) — an admin or advisor of the firm the plan
   * belongs to. A client given their own login is a member of the PLAN, not of the firm, and is not a Planner:
   * the Planner's briefing, the Planner's report and anything about the firm are never shown to them.
   */
  isPlanner: boolean;
};

export async function loadFirm(planId: string): Promise<Firm | null> {
  const supabase = await createClient();
  const [session, plan] = await Promise.all([
    getSession(),
    supabase.from("plans").select("organisation_id").eq("id", planId).maybeSingle().then((r) => r.data),
  ]);
  const orgId = plan?.organisation_id as string | undefined;
  if (!orgId || !session) return null;

  let org = (await supabase.from("organisations").select("id, name, kind, logo_path, brand_colour").eq("id", orgId).maybeSingle()).data as
    { name: string; kind: string; logo_path?: string | null; brand_colour?: string | null } | null;
  if (!org) org = (await supabase.from("organisations").select("id, name, kind").eq("id", orgId).maybeSingle()).data;
  if (!org) return null;

  const { data: me } = await supabase.from("organisation_members").select("role")
    .eq("organisation_id", orgId).eq("user_id", session.user.id).maybeSingle();

  return {
    orgId, name: org.name, adviser: org.kind !== "owner",
    logoPath: org.logo_path ?? null, colour: cleanColour(org.brand_colour),
    isAdmin: me?.role === "admin",
    isPlanner: me?.role === "admin" || me?.role === "advisor",
  };
}
