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
import { ReportsModule } from "./ReportsModule";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
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

  const [planRow, framework, goals, people, completeness] = await Promise.all([
    supabase.from("plans").select("business_name, plan_year").eq("id", planId).maybeSingle().then((r) => r.data),
    supabase.from("plan_framework").select("vision, mission, purpose, brand_promise").eq("plan_id", planId).maybeSingle().then((r) => r.data),
    supabase.from("plan_goals").select("area, title").eq("plan_id", planId).is("parent_id", null).neq("title", "").then((r) => r.data ?? []),
    supabase.from("plan_people").select("full_name, role, ownership_percent").eq("plan_id", planId).then((r) => r.data ?? []),
    getCompleteness(planId),
  ]);

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
    },
    goals: goals.map((g) => ({ area: String(g.area ?? ""), title: String(g.title ?? "") })),
    capital: (sources.assets as unknown as Record<string, unknown>[]).map((a) => ({
      name: String(a.name ?? "Asset"), amount: n(a.purchase_price), year: n(a.start_year) || 1,
    })).filter((a) => a.amount > 0),
    overheads: (sources.overheads as unknown as Record<string, unknown>[]).map((o) => ({
      name: String(o.name ?? "Expense"), amount: n(o.current_value),
    })).filter((o) => o.amount > 0),
    funding: (sources.funding as unknown as Record<string, unknown>[]).map((x) => ({
      name: String(x.name ?? "Source"), kind: String(x.kind ?? ""), amount: n(x.amount),
    })).filter((x) => x.amount > 0),
    extraordinary: (sources.extraordinary as unknown as Record<string, unknown>[]).map((x) => ({
      name: String(x.name ?? "Item"), amount: Math.abs(n(x.amount)), year: n(x.year) || 1,
      income: String(x.kind ?? "") === "income",
    })).filter((x) => x.amount > 0),
    /** Only people with a stated share are owners. A team member with none is on the team, not the cap table. */
    owners: people.filter((p) => n(p.ownership_percent) > 0).map((p) => ({
      name: String(p.full_name ?? ""), share: n(p.ownership_percent), role: text(p.role),
    })),
    noun,
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
