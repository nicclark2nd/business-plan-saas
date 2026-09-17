import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/lib/planLoad";
import { getCompleteness } from "@/lib/plan";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { runForecast } from "@/engine/forecast/run";
import { strengthByYear } from "@/engine/balance/lines";
import { serviceProfit } from "@/engine/pnl/lines";
import { productYears, sourceOf, type AnyProduct } from "@/engine/sales/product";
import type { CostProduct } from "@/engine/cogs/direct";
import { monthYearLabel, planYearEndLabel } from "@/engine/plan/calendar";
import { buildReport, type ReportInput } from "@/engine/report/build";
import { AREA_LABEL } from "@/engine/whatif/goals";
import { SPEND_LABEL } from "../marketing/model";
import { ROLE_LABEL } from "../people/model";
import { BS_LINES, PNL_LINES } from "../historic/model";
import { FREQUENCIES, LOAN_TYPES, REPAYMENT_TYPES } from "../funding/model";
import { ReportsModule } from "./ReportsModule";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
/* The label maps the screens use, so the report says what the client saw (§6.86). */
const AREA: Record<string, string> = AREA_LABEL;
const ROLE: Record<string, string> = ROLE_LABEL;
const SPEND: Record<string, string> = SPEND_LABEL;
const LOAN_TYPE: Record<string, string> = Object.fromEntries(LOAN_TYPES.map((x) => [x.value, x.label]));
const REPAYMENT: Record<string, string> = Object.fromEntries(REPAYMENT_TYPES.map((x) => [x.value, x.label]));
const FREQ: Record<string, string> = Object.fromEntries(FREQUENCIES.map((x) => [x.value, x.label]));
const KIND: Record<string, string> = { debt: "Borrowing", equity: "Equity", grant: "Grant", owner: "Owner funds", revenue_linked: "Revenue-linked" };

const raw = (v: unknown) => v as Record<string, unknown>;
const text = (v: unknown) => { const s = String(v ?? "").trim(); return s || null; };

/**
 * The business plan (§6.83), assembled on the server and handed down finished.
 *
 * It runs the SAME pipeline every statement runs, from the same loader (§6.67). That is not a nicety here:
 * a report whose profit and loss disagreed with the Profit & Loss screen would be the worst fault this app
 * could have, because the report is the thing that leaves the building.
 */
export default async function ReportsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { plan, mode, components, taxLabel, fyEndMonth, firstYear, noun, settings } = await loadPlan(planId);
  const supabase = await createClient();

  const rows = <T,>(p: PromiseLike<{ data: T[] | null }>) => p.then((r) => r.data ?? []) as Promise<Record<string, unknown>[]>;
  const [planRow, framework, goals, people, caps, licences, marketing, segments, evidence, spend, competitors, premises, suppliers, opSteps, opCapacity, completeness] = await Promise.all([
    supabase.from("plans").select("business_name, plan_year").eq("id", planId).maybeSingle().then((r) => r.data),
    supabase.from("plan_framework").select("vision, mission, purpose, brand_promise, field_of_play").eq("plan_id", planId).maybeSingle().then((r) => r.data),
    rows(supabase.from("plan_goals").select("*").eq("plan_id", planId).neq("title", "").order("year").order("quarter").order("sort_order")),
    rows(supabase.from("plan_people").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_people_capabilities").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_licences").select("*").eq("plan_id", planId).order("sort_order")),
    supabase.from("plan_marketing").select("*").eq("plan_id", planId).maybeSingle().then((r) => r.data),
    rows(supabase.from("plan_market_segments").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_marketing_evidence").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_marketing_spend").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_competitors").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_outlets").select("*").eq("plan_id", planId).order("is_primary", { ascending: false }).order("sort_order")),
    rows(supabase.from("plan_suppliers").select("*").eq("plan_id", planId).order("sort_order")),
    rows(supabase.from("plan_operations_steps").select("*").eq("plan_id", planId).order("sort_order")),
    supabase.from("plan_operations").select("*").eq("plan_id", planId).maybeSingle().then((r) => r.data),
    getCompleteness(planId),
  ]);
  const historicRow = await supabase.from("plan_historic_periods").select("*").eq("plan_id", planId)
    .order("period_number").limit(1).maybeSingle().then((r) => r.data);
  const swotItems = await rows(supabase.from("plan_swot_items").select("*").eq("plan_id", planId).order("sort_order"));

  const { checked } = runForecast(plan);
  const { sources } = plan;

  const products = sources.products as unknown as AnyProduct[];
  const named = products as unknown as (AnyProduct & { name?: string | null })[];
  const currency = String(settings?.currency ?? "AUD");
  /**
   * `Math.round(v) || 0` is not belt and braces — it is the fix for NEGATIVE ZERO (§6.83). A line built as
   * `-pnl[y].tax` on a year with no tax is -0, and `Intl` faithfully prints "-0" on a business plan going
   * to a bank. Rounding to zero here catches it once, for every figure in the document.
   */
  const money = (v: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(Math.round(v) || 0);

  const input: ReportInput = {
    businessName: text(planRow?.business_name) ?? "This business",
    forecast: checked,
    strength: strengthByYear(checked.balanceSheet, FORECAST_YEARS),
    services: serviceProfit(
      sources.costProducts as unknown as (CostProduct & { id?: string; name?: string | null })[],
      (c) => sourceOf(c as unknown as AnyProduct, products),
    ),
    productLines: named.map((p) => ({
      name: String(p.name ?? "Unnamed"),
      averagePrice: n(p.average_price),
      units: n(p.units_sold),
      revenue: productYears(p, sourceOf(p, products))[0]?.revenue ?? 0,
      description: text(raw(p).description),
      whyTheyBuy: text(raw(p).notes),
      pricingRationale: text(raw(p).pricing_rationale),
      lifecycle: text(raw(p).lifecycle),
      soldAs: text(raw(p).sold_as),
      startYear: n(raw(p).start_selling_year) || 1,
    })).filter((l) => l.revenue > 0 || l.averagePrice > 0),
    profile: {
      established: monthYearLabel(settings?.date_established as string | null),
      industry: text(settings?.industry),
      country: text(settings?.country),
      legalStructure: text(settings?.legal_structure),
      customerType: text(settings?.customer_type),
      productType: text(settings?.product_type),
    },
    framework: {
      vision: text(framework?.vision), mission: text(framework?.mission),
      purpose: text(framework?.purpose), brandPromise: text(framework?.brand_promise),
      fieldOfPlay: text(framework?.field_of_play),
    },
    goals: goals.filter((g) => !g.parent_id).map((g) => ({ area: AREA[String(g.area)] ?? String(g.area ?? ""), title: String(g.title ?? "") })),
    capital: (sources.assets as unknown as Record<string, unknown>[]).map((a) => ({
      name: String(a.name ?? "Asset"), amount: n(a.purchase_price), year: n(a.start_year) || 1,
      category: text(a.category), usefulLifeMonths: n(a.useful_life_months) || null,
      residual: n(a.residual_value), financed: !!a.funding_debt_id,
    })).filter((a) => a.amount > 0),
    overheads: (sources.overheads as unknown as Record<string, unknown>[]).map((o) => ({
      name: String(o.name ?? "Expense"), category: text(o.category), amount: n(o.current_value),
    })).filter((o) => o.amount > 0),
    funding: (sources.funding as unknown as Record<string, unknown>[]).map((x) => {
      const loan = raw(x.loan);
      return {
        name: String(x.name ?? "Source"),
        kind: LOAN_TYPE[String(loan?.loan_type)] ?? KIND[String(x.kind)] ?? String(x.kind ?? ""),
        amount: n(x.amount),
        rate: loan && loan.interest_rate !== null && loan.interest_rate !== undefined ? n(loan.interest_rate) : null,
        termMonths: loan ? n(loan.term_months) || null : null,
        repayment: loan ? REPAYMENT[String(loan.repayment_type)] ?? null : null,
        frequency: loan ? FREQ[String(loan.payment_frequency)] ?? null : null,
        startsYear: n(x.start_year) || null,
        taxable: null,
      };
    }).filter((x) => x.amount > 0),
    extraordinary: (sources.extraordinary as unknown as Record<string, unknown>[]).map((x) => ({
      name: String(x.name ?? "Item"), amount: Math.abs(n(x.amount)), year: n(x.year) || 1,
      income: String(x.kind ?? "") === "income",
    })).filter((x) => x.amount > 0),
    /** Only people with a stated share are owners. A team member with none is on the team, not the cap table. */
    owners: people.filter((p) => n(p.pct_shareholding) > 0).map((p) => ({
      name: String(p.name ?? ""), share: n(p.pct_shareholding), role: text(p.position),
    })),

    licences: licences.map((l) => ({
      name: String(l.name ?? ""), number: text(l.number), issuer: text(l.issuer),
      expires: l.expires_on ? new Date(String(l.expires_on)).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : null,
    })).filter((l) => l.name),

    market: {
      size: text(marketing?.market_size), trends: text(marketing?.market_trends),
      positioning: text(marketing?.positioning), brandValues: text(marketing?.brand_values),
      brandPersonality: text(marketing?.brand_personality), visualIdentity: text(marketing?.visual_identity),
      salesProcess: text(marketing?.sales_process), salesTeam: text(marketing?.sales_team),
    },
    segments: segments.map((x) => ({
      name: String(x.name ?? ""), profile: text(x.profile), caresAbout: text(x.cares_about),
      share: x.revenue_share === null || x.revenue_share === undefined ? null : n(x.revenue_share),
    })).filter((x) => x.name),
    evidence: evidence.map((x) => ({
      source: String(x.source ?? ""), method: text(x.method), finding: text(x.finding), decision: text(x.decision),
    })).filter((x) => x.source),
    spend: spend.map((x) => ({
      label: SPEND[String(x.kind)] ?? String(x.kind ?? ""), approach: text(x.approach), budget: n(x.annual_budget),
    })).filter((x) => x.approach || x.budget > 0),
    competitors: competitors.map((x) => ({
      name: String(x.name ?? ""), kind: text(x.kind), reach: text(x.reach), pricing: text(x.pricing),
      threat: text(x.threat), strengths: text(x.strengths), weaknesses: text(x.weaknesses), howWeWin: text(x.how_we_win),
    })).filter((x) => x.name),
    position: {
      ourAdvantage: text(marketing?.our_advantage), barriers: text(marketing?.barriers_to_entry),
      futureThreats: text(marketing?.future_threats),
    },
    people: people.map((p) => ({
      id: String(p.id), name: String(p.name ?? ""), position: text(p.position),
      role: ROLE[String(p.role)] ?? text(p.role), share: n(p.pct_shareholding) || null,
    })).filter((p) => p.name),
    /**
     * FILTERED AT THE BOUNDARY (§6.86). The People screen tells a client, in those words, that development
     * areas are "never printed in an external report". This line is where that promise is kept.
     */
    capabilities: caps.filter((c) => c.internal !== true && c.kind !== "development").map((c) => ({
      personId: String(c.person_id), kind: String(c.kind ?? ""), description: String(c.description ?? ""),
    })).filter((c) => c.description.trim()),
    swot: swotItems.map((x) => ({
      quadrant: String(x.quadrant ?? ""), text: String(x.text ?? ""), response: text(x.response),
    })).filter((x) => x.text.trim()),
    goalsAnnual: goals.filter((g) => !g.parent_id).map((g) => ({
      area: AREA[String(g.area)] ?? String(g.area ?? ""), title: String(g.title ?? ""), detail: text(g.detail),
    })),
    goalsQuarterly: goals.filter((g) => g.parent_id).map((g) => ({
      area: AREA[String(g.area)] ?? String(g.area ?? ""), title: String(g.title ?? ""),
      when: g.quarter ? `Q${n(g.quarter)}${g.year ? ` FY${n(g.year)}` : ""}` : null,
      due: g.milestone_date ? new Date(String(g.milestone_date)).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : null,
      owner: text(people.find((p) => p.id === g.owner_person_id)?.name),
      status: String(g.status ?? "not_started"),
    })),
    operations: {
      premises: premises.map((x) => ({
        name: String(x.name ?? ""), address: text(x.address), tenure: text(x.tenure),
        isPrimary: x.is_primary === true, floorArea: text(x.floor_area), purpose: text(x.purpose),
      })).filter((x) => x.name),
      suppliers: suppliers.map((x) => ({
        name: String(x.name ?? ""), supplies: text(x.supplies), terms: text(x.terms),
        dependency: text(x.dependency), alternative: text(x.alternative),
      })).filter((x) => x.name),
      steps: opSteps.map((x) => ({
        title: String(x.title ?? ""), detail: text(x.detail), owner: text(x.owner), duration: text(x.duration),
      })).filter((x) => x.title),
      capacity: {
        operatingHours: text(opCapacity?.operating_hours), capacityNow: text(opCapacity?.capacity_now),
        capacityConstraint: text(opCapacity?.capacity_constraint), capacityPlan: text(opCapacity?.capacity_plan),
        qualityApproach: text(opCapacity?.quality_approach),
      },
    },
    /* The client's own accounts, which until now reached the opening balances and no further (§6.87). */
    historic: historicRow ? (() => {
      const pick = (defs: { field: string; label: string }[]) => defs
        .map((d) => ({ label: d.label, value: n((historicRow as Record<string, unknown>)[d.field]) }))
        .filter((r) => r.value !== 0);
      const pnl = pick(PNL_LINES), balance = pick(BS_LINES);
      if (!pnl.length && !balance.length) return null;
      return {
        label: historicRow.period_end
          ? `Year ended ${new Date(String(historicRow.period_end)).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`
          : "Last full year",
        pnl, balance,
      };
    })() : null,
    noun: { ...noun, aOne: `${/^[aeiou]/i.test(noun.one) ? "an" : "a"} ${noun.one}` },
    taxLabel: components.length ? taxLabel : "Not registered",
    currency,
    yearEndLabels: FORECAST_YEARS.map((y) => planYearEndLabel(firstYear + y - 1, fyEndMonth)),
    money,
    date: new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
  };

  /**
   * What the plan could not say, named so a client can go and fix it (§6.57). Taken from the completeness
   * the dashboard already computes rather than a second opinion about what "empty" means — and only for
   * steps, because a client cannot fill in a module that does not exist yet.
   */
  const missing = completeness.sections.filter((s) => s.done === 0).map((s) => ({ label: s.label, id: s.id }));

  return (
    <ReportsModule planId={planId} mode={mode} doc={buildReport(input)}
      reconciled={checked.reconciled} missing={missing} />
  );
}
