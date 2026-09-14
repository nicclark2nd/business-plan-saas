import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { SalesModule } from "./SalesModule";
import type { Product } from "./model";

export default async function SalesPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, products, historic, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_historic_periods").select("revenue, period_end").eq("plan_id", planId).eq("period_number", 1).maybeSingle(),
    supabase.from("plan_settings").select("has_history, financial_year_end_month, first_projected_year, currency").eq("plan_id", planId).maybeSingle(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  // Defaults keep the module honest if a column has not reached this database yet (§6.17, migration 0013).
  const rows = (products.data ?? []).map((p) => ({
    ...p, average_price: Number(p.average_price), units_sold: Number(p.units_sold),
    sold_as: p.sold_as === "recurring" ? "recurring" : "one_off",
    // 0018 dropped 'saturation'. A database whose migration has not run yet still holds it, so read it as
    // maturity: the grid, the picker and a save then agree whichever side of the migration this deploy is on,
    // and a product saved before the migration lands on a value the new enum accepts instead of being nulled.
    lifecycle: p.lifecycle === "saturation" ? "maturity" : p.lifecycle,
    opening_clients: Number(p.opening_clients ?? 0),
    client_life_months: Number(p.client_life_months ?? 12) || 12,
    life_mode: p.life_mode === "fixed" ? "fixed" : "average",
    monthly_new_clients: p.monthly_new_clients ?? null,
    clients_from_product_id: p.clients_from_product_id ?? null,
  })) as Product[];
  return (
    <SalesModule planId={planId} initial={rows} mode={mode} initialArea={area === "annual" || area === "monthly" ? area : "products"} hasHistory={settings.data?.has_history ?? null}
      historicRevenue={historic.data ? Number(historic.data.revenue) : null} historicEnd={historic.data?.period_end ?? null}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6} firstProjectedYear={settings.data?.first_projected_year ?? null} currency={settings.data?.currency ?? "AUD"} />
  );
}
