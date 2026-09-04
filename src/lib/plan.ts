import { createClient } from "@/lib/supabase/server";

export type Mode = "guided" | "advanced";

/** The signed-in user's profile plus the plans they can see. */
export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, mode, default_organisation_id").eq("id", user.id).single(),
    supabase.from("plans").select("id, business_name, status, plan_year, organisation_id, organisations(name, kind)").order("created_at"),
  ]);
  return { user, profile, plans: plans ?? [] };
}

/** Section completeness for the dashboard — counts rows in each module for one plan. */
export async function getCompleteness(planId: string) {
  const supabase = await createClient();
  const count = async (table: string, opts?: { annualOnly?: boolean }) => {
    const base = supabase.from(table).select("*", { count: "exact", head: true }).eq("plan_id", planId);
    const { count: c } = opts?.annualOnly ? await base.is("parent_id", null) : await base;
    return c ?? 0;
  };
  const [framework] = await Promise.all([supabase.from("plan_framework").select("vision,mission,purpose,brand_promise,ai_direction,field_of_play").eq("plan_id", planId).maybeSingle()]);
  const fw = framework.data ? Object.values(framework.data).filter(Boolean).length : 0;
  const [people, marketing, swot, annualGoals, historic, products, cogs, overheads, funding] = await Promise.all([
    count("plan_people"),
    supabase.from("plan_marketing").select("target_market,market_size,market_trends,customer_needs,competitive_analysis").eq("plan_id", planId).maybeSingle().then((r) => (r.data ? Object.values(r.data).filter(Boolean).length : 0)),
    count("plan_swot_items"),
    count("plan_goals", { annualOnly: true }),
    count("plan_historic_periods"),
    count("plan_products"),
    count("plan_fixed_cogs"),
    count("plan_overheads"),
    Promise.all([count("plan_funding_owner"), count("plan_funding_debt"), count("plan_funding_equity"), count("plan_funding_grants"), count("plan_funding_revenue_linked")]).then((a) => a.reduce((x, y) => x + y, 0)),
  ]);
  const sections = [
    { id: "vision", label: "Vision & Purpose", done: fw, total: 6 },
    { id: "people", label: "Key People", done: Math.min(people, 1), total: 1 },
    { id: "marketing", label: "Marketing", done: marketing, total: 5 },
    { id: "swot", label: "SWOT", done: Math.min(swot, 4), total: 4 },
    { id: "historic", label: "Historic", done: historic, total: 4 },
    { id: "sales", label: "Sales", done: Math.min(products, 1), total: 1 },
    { id: "cogs", label: "COGS", done: Math.min(cogs + products, 1), total: 1 },
    { id: "overheads", label: "Overheads", done: Math.min(overheads, 1), total: 1 },
    { id: "funding", label: "Funding", done: Math.min(funding, 1), total: 1 },
    { id: "goals", label: "Goals", done: annualGoals, total: 6 },
  ];
  const done = sections.reduce((a, s) => a + s.done / s.total, 0);
  return { sections, percent: Math.round((done / sections.length) * 100) };
}
