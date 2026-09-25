import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { MarketingModule } from "./MarketingModule";
import { ALL_MARKET_KEYS, DRAFTABLE_MARKET_KEYS, type MarketingData, type Market } from "./model";
import { draftingFor } from "../drafting";
import type { Goal, Person } from "../goals/model";
import type { AnyProduct } from "@/engine/sales/product";

export default async function MarketingPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }> }) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, market, spend, evidence, settings, actions, people, products, segments] = await Promise.all([
    getSession(),
    supabase.from("plan_marketing").select("*").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_marketing_spend").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_marketing_evidence").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_settings").select("customer_type, product_type, financial_year_end_month, first_projected_year").eq("plan_id", planId).maybeSingle(),
    /**
     * Marketing actions ARE the marketing goals (§6.60) — the same rows the Goals step shows, not a copy.
     * A marketing action with an owner and a date is a quarterly goal; giving Marketing its own table
     * would put one commitment in two places, which is the fault this project keeps paying for.
     */
    supabase.from("plan_goals").select("*").eq("plan_id", planId).eq("area", "marketing")
      .eq("horizon", "ninety").order("year").order("quarter").order("sort_order"),
    supabase.from("plan_people").select("id, name, role").eq("plan_id", planId).order("sort_order"),
    // The sales lines, so Marketing can say what a customer costs to win (§6.61) from real figures.
    supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order"),
    // One row per kind of buyer (§6.62).
    supabase.from("plan_market_segments").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
  ]);
  const data: MarketingData = {
    market: Object.fromEntries(ALL_MARKET_KEYS.map((k) => [k, (market.data?.[k] as string | null) ?? ""])) as Market,
    spend: (spend.data ?? []).map((s) => ({ ...s, annual_budget: Number(s.annual_budget) })), evidence: evidence.data ?? [],
    segments: (segments.data ?? []).map((g) => ({ ...g, revenue_share: g.revenue_share === null ? null : Number(g.revenue_share) })),
  };
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  /*
   * WHICH OF THE EIGHT NARRATIVE BOXES GET A DRAFT BUTTON (§6.109).
   *
   * Five, not eight. Market size and Market trends are facts about the world that nothing in this plan can
   * ground, and Who sells names people, which no slice is allowed to read. The list lives beside the field
   * definitions in `model.ts`; this page only hands it over. A key that comes back absent gets no button
   * and no explanation, which is the honest answer for a field that was never going to have one.
   */
  const drafting = await draftingFor(planId, DRAFTABLE_MARKET_KEYS);
  const initialArea = ["market", "spend", "research", "brand", "sales", "actions"].includes(area ?? "") ? (area as "market") : "market";

  return <MarketingModule planId={planId} initial={data} mode={mode} initialArea={initialArea}
    customerWord={(settings.data?.customer_type ?? "customer").toLowerCase()} productWord={settings.data?.product_type ?? null}
    actions={(actions.data ?? []) as unknown as Goal[]} people={(people.data ?? []) as Person[]}
    products={(products.data ?? []) as unknown as AnyProduct[]} drafting={drafting} />;
}
