import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_REQUIRED } from "@/app/(app)/plans/[planId]/settings/model";

export type Mode = "guided" | "advanced";

/**
 * The signed-in user's profile plus the plans they can see.
 *
 * Wrapped in React's `cache` so the layout and the page share one call per request. Without it every render
 * did the whole thing twice, including two `auth.getUser()` calls — each a network round trip to the Auth
 * API, not a local check.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, mode, default_organisation_id").eq("id", user.id).single(),
    supabase.from("plans").select("id, business_name, status, plan_year, archived_at, organisation_id, organisations(name, kind)").order("created_at"),
  ]);
  return { user, profile, plans: plans ?? [] };
});

/** Section completeness for the dashboard — counts rows in each module for one plan. */
/**
 * `reconciled` is passed IN rather than worked out here (§6.99).
 *
 * Deciding it needs the whole plan loaded and the forecast run, and `planLoad.ts` imports this file — so
 * computing it here would be a circular import. `planCompleteness.ts` sits above both and supplies it.
 * Undefined means "not known", which is treated as not done: a plan whose checks have not been shown to
 * pass has not passed them.
 */
export const getCompleteness = cache(async (planId: string, reconciled?: boolean) => {
  const supabase = await createClient();
  const count = async (table: string, opts?: { annualOnly?: boolean }) => {
    const base = supabase.from(table).select("*", { count: "exact", head: true }).eq("plan_id", planId);
    /**
     * An annual goal counts once it has been WRITTEN, not once a row exists. Turning a What-If scenario into
     * goals creates the annual goal its quarterly goals hang from, empty — so counting rows told a client
     * three of six areas were done when they had written one sentence (§6.44).
     */
    const { count: c } = opts?.annualOnly ? await base.is("parent_id", null).neq("title", "") : await base;
    return c ?? 0;
  };
  /**
   * The business name lives on `plans`, not `plan_settings` — the other three profile fields are on the
   * settings row. Selecting a column a table does not have makes the whole query error, and this query
   * swallows its error into `null`, which silently zeroed FOUR unrelated sections (§6.82). Caught on Nic's
   * own plan: Review forecast fell to 0/1 the moment the select was wrong, because `assumptionsSet` reads
   * the same row.
   */
  const planRow = supabase.from("plans").select("business_name").eq("id", planId).maybeSingle().then((r) => r.data ?? null);
  const [framework] = await Promise.all([supabase.from("plan_framework").select("vision,mission,purpose,brand_promise,ai_direction,field_of_play").eq("plan_id", planId).maybeSingle()]);
  const fw = framework.data ? Object.values(framework.data).filter(Boolean).length : 0;
  const [people, marketing, competitors, swot, annualGoals, historic, products, cogs, overheads, extraordinary, funding, assets, settings, operations] = await Promise.all([
    /**
     * Leadership Team used to tick on `count("plan_people")` — one named person and the menu went green
     * with an empty Roles & Capability list behind it (the §6.57 fault again: a section reporting done
     * while the substance is missing). A person with a name and nothing else is not a bio, and Roles &
     * Capability is the half of this step a lender actually reads. One written row each is the bar; which
     * kind of row it is stays the client's call.
     */
    Promise.all([
      supabase.from("plan_people").select("id").eq("plan_id", planId),
      supabase.from("plan_people_capabilities").select("person_id, description").eq("plan_id", planId),
    ]).then(([pp, cc]) => {
      const written = new Set((cc.data ?? []).filter((c) => (c.description ?? "").trim()).map((c) => c.person_id));
      const ids = (pp.data ?? []).map((x) => x.id);
      return { n: ids.length, covered: ids.filter((id) => written.has(id)).length };
    }),
    /**
     * Marketing, out of four things the client can ACTUALLY fill in (§6.75).
     *
     * It used to count `target_market`, market size, market trends and `customer_needs` — and two of those
     * four stopped being fillable the day §6.62 replaced them with the segments grid. A plan created after
     * that could reach 2/4 on Marketing and never move again however much its owner wrote, which is the
     * §6.57 fault in a second place: a step nobody can finish.
     */
    Promise.all([
      supabase.from("plan_marketing").select("market_size,market_trends,positioning").eq("plan_id", planId).maybeSingle(),
      supabase.from("plan_market_segments").select("name").eq("plan_id", planId),
    ]).then(([m, seg]) => {
      const written = m.data ? Object.values(m.data).filter((v) => String(v ?? "").trim()).length : 0;
      const named = (seg.data ?? []).some((x) => String(x.name ?? "").trim());
      return written + (named ? 1 : 0);
    }),
    Promise.all([count("plan_competitors"), supabase.from("plan_marketing").select("our_advantage").eq("plan_id", planId).maybeSingle().then((r) => (r.data?.our_advantage ? 1 : 0))]).then(([c, a]) => Math.min(c, 1) + a),
    count("plan_swot_items"),
    count("plan_goals", { annualOnly: true }),
    count("plan_historic_periods"),
    count("plan_products"),
    count("plan_fixed_cogs"),
    count("plan_overheads"),
    count("plan_extraordinary_items"),
    Promise.all([count("plan_funding_owner"), count("plan_funding_debt"), count("plan_funding_equity"), count("plan_funding_grants"), count("plan_funding_revenue_linked")]).then((a) => a.reduce((x, y) => x + y, 0)),
    count("plan_fixed_assets"),
    /**
     * The answers a client gives by saying "none" (§6.57.1), and the assumptions behind the cash flow.
     * `has_history` is three-state — null is unanswered and false is a real answer that changes the plan.
     * The three "no ..." flags are two-state: false means nothing has been said, which is what an empty
     * table meant before there was anything to say it with.
     */
    supabase.from("plan_settings")
      .select("has_history, no_funding, no_fixed_assets, no_one_offs, working_capital_schedule, industry, country, legal_structure")
      .eq("plan_id", planId).maybeSingle().then((r) => r.data ?? null),
    Promise.all([
      count("plan_outlets"), count("plan_suppliers"), count("plan_operations_steps"),
      supabase.from("plan_operations").select("capacity_now, capacity_constraint").eq("plan_id", planId).maybeSingle().then((r) => r.data),
    ]).then(([a, b, c, cap]) => a + b + c + (String(cap?.capacity_now ?? "").trim() ? 1 : 0)),
  ]);
  const said = {
    funding: settings?.no_funding === true,
    assets: settings?.no_fixed_assets === true,
    oneOffs: settings?.no_one_offs === true,
  };
  const profile = { ...(await planRow), ...(settings ?? {}) } as Record<string, unknown>;
  const profileDone = PROFILE_REQUIRED.filter((k) => String(profile[k] ?? "").trim()).length;
  const wc = settings?.working_capital_schedule as Record<string, unknown> | null | undefined;
  const assumptionsSet = !!wc && Object.keys(wc).length > 0;
  const sections = [
    /**
     * PLAN SETTINGS COUNTS (§6.82). Nic: "it seems that Plan settings is critical, and being right at the
     * bottom of the left-hand menu it is sure to never be seen. They can do all the numbers, print the
     * plan, and never see it."
     *
     * He was right, and it was worse than buried. These four are the app's own definition of what a report
     * CANNOT OPEN WITHOUT (`PROFILE_REQUIRED`), and none of them were counted — so a plan could read 94%
     * complete on the dashboard while the thing the whole exercise produces could not be printed. §6.57,
     * one more time: a section reporting done while the substance is missing.
     *
     * And it is upstream of everything, not beside it. Country decides the sales tax and its name; the
     * financial year end decides every month column in the product. Unset, they default to 30 June and 25%
     * with no GST — defaults that are PLAUSIBLE, which is what makes them dangerous. A client in Britain
     * gets an Australian financial year and a tax rate nobody chose, silently.
     */
    { id: "settings", label: "Plan settings", total: PROFILE_REQUIRED.length, done: profileDone },
    { id: "vision", label: "Vision & Purpose", done: fw, total: 6 },
    { id: "people", label: "Leadership Team", done: people.n > 0 && people.covered === people.n ? 1 : 0, total: 1 },
    { id: "marketing", label: "Marketing", done: marketing, total: 4 },
    { id: "competitors", label: "Competitors", done: competitors, total: 2 },
    { id: "swot", label: "SWOT", done: Math.min(swot, 4), total: 4 },
    /**
     * Operations (§6.84). One recorded place, supplier or step is the bar — a business with no fixed
     * premises is a real answer and says so in the capacity fields, so any one of the four counts.
     */
    { id: "operations", label: "Operations", done: Math.min(operations, 1), total: 1 },
    { id: "historic", label: "Historic", done: settings?.has_history === false ? 1 : Math.min(historic, 1), total: 1 },
    { id: "sales", label: "Sales", done: Math.min(products, 1), total: 1 },
    { id: "cogs", label: "COGS", done: Math.min(cogs + products, 1), total: 1 },
    { id: "overheads", label: "Overheads", done: Math.min(overheads, 1), total: 1 },
    { id: "funding", label: "Funding", done: Math.min(funding + (said.funding ? 1 : 0), 1), total: 1 },
    /**
     * Step 11 had no section at all, so `doneSteps` found nothing for it and Fixed Assets sat grey in the
     * menu however much the client had entered — while every step around it turned green. The guided path
     * also counted itself out of fifteen while only twelve steps could ever be counted.
     */
    { id: "assets", label: "Fixed Assets", done: Math.min(assets + (said.assets ? 1 : 0), 1), total: 1 },
    // "none" is a legitimate answer here, and now there is a way to give it rather than only imply it.
    { id: "extraordinary", label: "One-off income & costs", done: Math.min(extraordinary + (said.oneOffs ? 1 : 0), 1), total: 1 },
    /**
     * ASSUMPTIONS MEASURES ASSUMPTIONS (§6.99), which it had not since §6.79 split it out of Review
     * forecast: the row below kept the measure and the row for this step was never written. So a client
     * who set their debtor days ticked off REVIEW FORECAST, and Assumptions — step 14 since §6.94 — could
     * never turn green in the sidebar or appear in the plan's "what is not in this plan" list, however
     * much they entered. One fact wearing another's label (§6.41).
     */
    { id: "assumptions", label: "Assumptions", done: assumptionsSet ? 1 : 0, total: 1 },
    /**
     * REVIEW FORECAST IS DONE WHEN THE CHECKS PASS. It is the one step that writes nothing — it reads the
     * forecast and judges it — so the only honest measure of "finished" is the judgement itself: the
     * statements reconcile. A plan whose checks fail is not a plan a client has finished, whatever else
     * they have filled in, and this is the same test the Reports screen prints as "Figures agree".
     */
    { id: "forecast", label: "Review forecast", done: reconciled ? 1 : 0, total: 1 },
    { id: "goals", label: "Goals", done: annualGoals, total: 6 },
  ];
  const done = sections.reduce((a, s) => a + s.done / s.total, 0);
  return { sections, percent: Math.round((done / sections.length) * 100) };
});
