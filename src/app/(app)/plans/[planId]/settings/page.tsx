import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { SettingsModule } from "./SettingsModule";
import type { Settings } from "./model";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, plan, settings] = await Promise.all([
    getSession(),
    supabase.from("plans").select("business_name, plan_year").eq("id", planId).single(),
    supabase.from("plan_settings").select("*").eq("plan_id", planId).maybeSingle(),
  ]);
  const s = settings.data ?? {};
  const initial: Settings = {
    business_name: plan.data?.business_name ?? "",
    plan_year: plan.data?.plan_year ?? new Date().getFullYear(),
    date_established: s.date_established ?? null, industry: s.industry ?? null, country: s.country ?? null, legal_structure: s.legal_structure ?? null,
    customer_type: s.customer_type ?? null, product_type: s.product_type ?? null, products_services_statement: s.products_services_statement ?? null,
    financial_year_end_month: s.financial_year_end_month ?? 6, first_projected_year: s.first_projected_year ?? null,
    tax_rate: Number(s.tax_rate ?? 25), dividend_rate: Number(s.dividend_rate ?? 0), currency: s.currency ?? "AUD", logo_path: s.logo_path ?? null,
  };
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  return <SettingsModule planId={planId} initial={initial} mode={mode} initialArea={area === "financial" || area === "branding" ? area : "profile"} />;
}
