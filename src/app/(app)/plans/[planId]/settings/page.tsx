import { cleanComponent } from "@/engine/plan/gst";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { SettingsModule } from "./SettingsModule";
import type { Settings } from "./model";

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

  const [session, plan, settings, ...inventory] = await Promise.all([
    getSession(),
    supabase.from("plans").select("business_name, plan_year, archived_at").eq("id", planId).single(),
    supabase.from("plan_settings").select("*").eq("plan_id", planId).maybeSingle(),
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
    financial_year_end_month: s.financial_year_end_month ?? 6, first_projected_year: s.first_projected_year ?? null,
    tax_rate: Number(s.tax_rate ?? 25), dividend_rate: Number(s.dividend_rate ?? 0),
    opening_tax_losses: Number(s.opening_tax_losses ?? 0), opening_retained_earnings: Number(s.opening_retained_earnings ?? 0),
    gst_registered: !!s.gst_registered, gst_rate: Number(s.gst_rate ?? 10),
    gst_frequency: (s.gst_frequency ?? "quarterly") as "monthly" | "quarterly" | "annually",
    tax_region: s.tax_region ?? null,
    tax_components: (Array.isArray(s.tax_components) ? s.tax_components : []).map(cleanComponent),
    currency: s.currency ?? "AUD", logo_path: s.logo_path ?? null,
  };
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const initialArea = area === "financial" || area === "branding" || area === "lifecycle" ? area : "profile";
  return <SettingsModule planId={planId} initial={initial} mode={mode} initialArea={initialArea}
    archivedAt={plan.data?.archived_at ?? null} inventory={inventory} />;
}
