import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { RegistersModule } from "./RegistersModule";
import { AREAS, type AreaKey, type Ip, type Membership, type Social } from "./model";

/* `?area=` — each of the three menu items lands on its own register (§6.147). */
export default async function RegistersPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, social, memberships, ip] = await Promise.all([
    getSession(),
    supabase.from("plan_social_media").select("id, platform, url, description, sort_order").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_memberships").select("id, organisation_name, description, sort_order").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_ip").select("id, name, ip_type, description, sort_order").eq("plan_id", planId).order("sort_order").order("created_at"),
  ]);
  return (
    <RegistersModule planId={planId}
      mode={(session?.profile?.mode ?? "guided") as "guided" | "advanced"}
      initialArea={(AREAS as readonly string[]).includes(area ?? "") ? area as AreaKey : "social"}
      initialSocial={(social.data ?? []) as Social[]}
      initialMemberships={(memberships.data ?? []) as Membership[]}
      initialIp={(ip.data ?? []) as Ip[]} />
  );
}
