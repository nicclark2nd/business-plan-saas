import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadMyFirm } from "@/lib/myFirm";
import { firstProjectedYear } from "@/engine/plan/calendar";
import { ClientsModule, type ClientRow } from "./ClientsModule";

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
      contact: {
        contact_first_name: str(p.contact_first_name), contact_family_name: str(p.contact_family_name),
        contact_email: str(p.contact_email), contact_phone: str(p.contact_phone),
      },
    };
  });

  /* Plans this person can open that are not the firm's — their own business, or a test plan. */
  const others = session.plans.filter((p) => p.organisation_id !== firm.id && !p.archived_at).map((p) => ({ id: p.id, businessName: p.business_name }));

  return <ClientsModule rows={rows} others={others} selected={client ?? null} firm={{ country: firm.country, currency: firm.currency }} />;
}
