import { cleanComponent } from "@/engine/plan/gst";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { SettingsModule } from "./SettingsModule";
import type { Settings, Licence } from "./model";
import { LOGO_BUCKET, LOGO_URL_TTL_SECONDS } from "@/engine/plan/logo";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  /**
   * What the plan holds, so deleting it can name the work rather than ask "are you sure?" (§6.58). Counted
   * here because it is the only screen that needs it, and only ever read — never used to decide anything.
   */
  const held = (table: string, label: string, plural = `${label}s`) =>
    supabase.from(table).select("*", { count: "exact", head: true }).eq("plan_id", planId)
      .then(({ count }) => ({ label: (count ?? 0) === 1 ? label : plural, count: count ?? 0 }));

  const [session, plan, settings, licences, ...inventory] = await Promise.all([
    getSession(),
    supabase.from("plans").select("business_name, plan_year, archived_at").eq("id", planId).single(),
    supabase.from("plan_settings").select("*").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_licences").select("id, name, number, issuer, expires_on, sort_order").eq("plan_id", planId).order("sort_order").order("created_at"),
    held("plan_products", "product"),
    held("plan_overheads", "overhead"),
    held("plan_people", "person", "people"),
    held("plan_fixed_assets", "fixed asset"),
    held("plan_extraordinary_items", "one-off"),
    held("plan_historic_periods", "year of history", "years of history"),
    held("plan_goals", "goal"),
  ]);
  const s = settings.data ?? {};
  const initial: Settings = {
    business_name: plan.data?.business_name ?? "",
    plan_year: plan.data?.plan_year ?? new Date().getFullYear(),
    date_established: s.date_established ?? null, industry: s.industry ?? null, country: s.country ?? null, legal_structure: s.legal_structure ?? null,
    customer_type: s.customer_type ?? null, product_type: s.product_type ?? null, products_services_statement: s.products_services_statement ?? null,
    tagline: s.tagline ?? null, contact_email: s.contact_email ?? null, website: s.website ?? null,
    financial_year_end_month: s.financial_year_end_month ?? 6, first_projected_year: s.first_projected_year ?? null,
    tax_rate: Number(s.tax_rate ?? 25), dividend_rate: Number(s.dividend_rate ?? 0),
    opening_tax_losses: Number(s.opening_tax_losses ?? 0), opening_retained_earnings: Number(s.opening_retained_earnings ?? 0),
    gst_registered: !!s.gst_registered, gst_rate: Number(s.gst_rate ?? 10),
    gst_frequency: (s.gst_frequency ?? "quarterly") as "monthly" | "quarterly" | "annually",
    tax_region: s.tax_region ?? null,
    tax_components: (Array.isArray(s.tax_components) ? s.tax_components : []).map(cleanComponent),
    currency: s.currency ?? "AUD", logo_path: s.logo_path ?? null,
    /* Default true: a client who typed every salary should see them in the plan unless someone decided
       otherwise (§6.93). `?? true` covers the row that predates the column as well as a genuine null. */
    print_key_people_salaries: s.print_key_people_salaries ?? true,
    /* Off unless someone turned it on. A default that adds is not a default that discloses (0044). */
    ai_enabled: !!s.ai_enabled,
    ai_enabled_at: s.ai_enabled_at ?? null,
    ai_enabled_by: s.ai_enabled_by ?? null,
    page_size: (s.page_size === "a4" || s.page_size === "letter" ? s.page_size : null),
  };
  /**
   * A SIGNED URL, minted per request (§6.94). The bucket is private, so there is no permanent address to
   * store — and storing one would be a second record of where the file is, which is the fault this project
   * keeps relearning (§6.41). If signing fails the screen shows "no logo yet" rather than a broken image.
   */
  const logoPath = s.logo_path as string | null | undefined;
  const logoUrl = logoPath
    ? (await supabase.storage.from(LOGO_BUCKET).createSignedUrl(logoPath, LOGO_URL_TTL_SECONDS)).data?.signedUrl ?? null
    : null;
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const initialArea = area === "financial" || area === "printing" || area === "branding" || area === "lifecycle" ? area : "profile";
  return <SettingsModule planId={planId} initial={initial} mode={mode} initialArea={initialArea}
    licences={(licences.data ?? []) as Licence[]} logoUrl={logoUrl}
    archivedAt={plan.data?.archived_at ?? null} inventory={inventory} />;
}
