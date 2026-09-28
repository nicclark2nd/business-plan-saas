import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadMyFirm } from "@/lib/myFirm";
import { firstProjectedYear } from "@/engine/plan/calendar";
import { ClientsModule, type ClientRow } from "./ClientsModule";

/** The address the invitation link starts with — this deployment's own, read from the request. */
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * MY CLIENTS (§6.182) — every business the firm plans for, and the one picked, in detail.
 *
 * THE BUSINESS'S OWN DETAILS ARE READ FROM ITS PLAN, NOT ASKED FOR HERE. Its address is its main premises
 * (Operations), its email and website are what its cover prints (Plan settings). The one thing the plan
 * does not hold — the person at the business the consultant deals with — is the only thing typed here.
 */
export default async function MyClientsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const [session, firm] = await Promise.all([getSession(), loadMyFirm()]);
  if (!session || !firm) redirect("/setup");
  const supabase = await createClient();

  /* `*` so the list opens in the gap before migration 0059 adds the contact columns. */
  const { data: plans } = await supabase.from("plans").select("*").eq("organisation_id", firm.id).order("business_name");
  const ids = (plans ?? []).map((p) => p.id as string);
  /* Each client's access (0060), failing soft before the migration: everyone reads "Not invited". */
  const access = ((await supabase.rpc("firm_client_access", { p_org: firm.id })).data ?? []) as
    { plan_id: string; state: string; email: string | null; token: string | null; expires_at: string | null; since: string | null }[];
  const [settings, outlets] = ids.length ? await Promise.all([
    supabase.from("plan_settings").select("plan_id, contact_email, website, country, currency, first_projected_year, financial_year_end_month").in("plan_id", ids),
    supabase.from("plan_outlets").select("plan_id, name, address, is_primary, sort_order").in("plan_id", ids).order("sort_order"),
  ]) : [{ data: [] }, { data: [] }];

  const rows: ClientRow[] = (plans ?? []).map((p) => {
    const s = (settings.data ?? []).find((x) => x.plan_id === p.id);
    const mine = (outlets.data ?? []).filter((o) => o.plan_id === p.id && str(o.address));
    const premises = mine.find((o) => o.is_primary) ?? mine[0] ?? null;
    const first = firstProjectedYear(s?.first_projected_year, s?.financial_year_end_month);
    return {
      id: p.id, businessName: p.business_name, archived: !!p.archived_at, createdAt: p.created_at,
      planYears: `${first}–${first + 4}`,
      address: str(premises?.address), email: str(s?.contact_email), website: str(s?.website), country: str(s?.country),
      canDownload: p.client_can_download !== false,
      access: (() => {
        const a = access.find((x) => x.plan_id === p.id);
        return { state: (a?.state ?? "none") as ClientRow["access"]["state"], email: a?.email ?? null, token: a?.token ?? null, expiresAt: a?.expires_at ?? null, since: a?.since ?? null };
      })(),
      contact: {
        contact_first_name: str(p.contact_first_name), contact_family_name: str(p.contact_family_name),
        contact_email: str(p.contact_email), contact_phone: str(p.contact_phone),
      },
    };
  });

  /* Plans this person can open that are not the firm's — their own business, or a test plan. */
  const others = session.plans.filter((p) => p.organisation_id !== firm.id && !p.archived_at).map((p) => ({ id: p.id, businessName: p.business_name }));

  return <ClientsModule rows={rows} others={others} selected={client ?? null} firm={{ country: firm.country, currency: firm.currency, name: firm.name }}
    me={{ name: session.profile?.full_name || null }} origin={await siteOrigin()} />;
}
