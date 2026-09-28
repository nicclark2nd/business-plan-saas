import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadMyFirm } from "@/lib/myFirm";
import { siteOrigin } from "@/lib/siteOrigin";
import { TeamModule, type Teammate, type TeamInvite } from "./TeamModule";

/**
 * TEAM (§6.184) — the firm's consultants, their role, and how many clients each looks after. Everyone in the
 * firm can see it; only an admin invites, changes a role or removes someone. Who looks after which client is
 * set on My Clients, where the client is.
 */
export default async function TeamPage() {
  const [session, firm] = await Promise.all([getSession(), loadMyFirm()]);
  if (!session || !firm) redirect("/setup");
  const supabase = await createClient();
  const [team, invites] = await Promise.all([
    supabase.rpc("firm_team", { p_org: firm.id }).then((r) => (r.data ?? []) as Teammate[]),
    firm.role === "admin"
      ? supabase.from("organisation_invitations").select("id, email, role, token, expires_at")
          .eq("organisation_id", firm.id).is("accepted_at", null).is("revoked_at", null).gte("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }).then((r) => (r.error ? [] : r.data ?? []) as TeamInvite[])
      : Promise.resolve([] as TeamInvite[]),
  ]);
  return <TeamModule team={team} invites={invites} isAdmin={firm.role === "admin"} me={session.user.id}
    firm={firm.name} myName={session.profile?.full_name ?? null} origin={await siteOrigin()} />;
}
