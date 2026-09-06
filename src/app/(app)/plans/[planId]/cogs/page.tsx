import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { CogsModule } from "./CogsModule";
import type { CostedProduct, FixedCogs } from "./model";

export default async function CogsPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, products, fixed, historic] = await Promise.all([
    getSession(),
    supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_fixed_cogs").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_historic_periods").select("revenue, cogs, period_end").eq("plan_id", planId).eq("period_number", 1).maybeSingle(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  const rows = (products.data ?? []).map((p) => ({
    ...p, average_price: Number(p.average_price), units_sold: Number(p.units_sold), cost_per_unit: Number(p.cost_per_unit ?? 0),
    yearly_cost_increase: p.yearly_cost_increase ?? null,
    sold_as: p.sold_as === "recurring" ? "recurring" : "one_off",
    opening_clients: Number(p.opening_clients ?? 0),
    client_life_months: Number(p.client_life_months ?? 12) || 12,
    life_mode: p.life_mode === "fixed" ? "fixed" : "average",
    monthly_new_clients: p.monthly_new_clients ?? null,
    clients_from_product_id: p.clients_from_product_id ?? null,
  })) as CostedProduct[];
  const fixedRows = (fixed.data ?? []).map((f) => ({ ...f, annual_cost: Number(f.annual_cost) })) as FixedCogs[];
  const h = historic.data;
  return (
    <CogsModule planId={planId} products={rows} fixed={fixedRows} mode={mode}
      initialArea={area === "fixed" ? "fixed" : "products"}
      historicRevenue={h ? Number(h.revenue) : null} historicCogs={h ? Number(h.cogs) : null} historicEnd={h?.period_end ?? null} />
  );
}
