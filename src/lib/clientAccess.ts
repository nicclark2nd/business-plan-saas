import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadFirm } from "@/lib/firm";
import { LOGO_URL_TTL_SECONDS, PHOTO_BUCKET } from "@/engine/plan/logo";

/**
 * WHAT A CLIENT MAY DO IN THEIR OWN PLAN, AND WHO THEIR PLANNER IS (§6.183).
 *
 * The firm's Planners — and a business planning for itself, whose owner is its own admin — may always
 * download. A client of a firm may when their Planner has said so (the switch in My Clients, 0060), which is
 * copied onto their membership.
 */
export async function mayDownload(planId: string): Promise<boolean> {
  if ((await loadFirm(planId))?.isPlanner) return true;
  const session = await getSession();
  if (!session) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("plan_members").select("can_generate_reports").eq("plan_id", planId).eq("user_id", session.user.id).maybeSingle();
  return data?.can_generate_reports !== false;
}

export type PlannerCard = { name: string; title: string | null; phone: string | null; email: string | null; photoUrl: string | null };

/** The "Your Planner" card — only ever asked for when the person looking is not one of the firm's Planners. */
export async function plannerCard(planId: string): Promise<PlannerCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plan_planner", { p_plan: planId });
  const p = (data as { full_name: string | null; title: string | null; phone: string | null; email: string | null; photo_path: string | null }[] | null)?.[0];
  if (error || !p) return null;
  const photoUrl = p.photo_path
    ? (await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(p.photo_path, LOGO_URL_TTL_SECONDS)).data?.signedUrl ?? null
    : null;
  return { name: p.full_name || p.email || "Your Planner", title: p.title, phone: p.phone, email: p.email, photoUrl };
}
