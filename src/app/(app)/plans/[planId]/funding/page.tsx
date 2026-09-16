import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { startYearFromDate, planYearStart, totalSalariesByYear } from "@/engine/people/salary";
import { YEARS } from "@/engine/sales/projection";
import { planRevenueMonths, type AnyProduct } from "@/engine/sales/product";
import { planCogsMonths, type CostProduct } from "@/engine/cogs/direct";
import { overheadsMonths, planOverheadLines, type Overhead } from "@/engine/overheads/expenses";
import { assetsMonths, capexMonths, withDisposals, type FixedAsset } from "@/engine/assets/depreciation";
import { soldMonthByAsset, type ExtraordinaryItem } from "@/engine/extraordinary/items";
import { FundingModule } from "./FundingModule";
import { firstProjectedYear } from "@/engine/plan/calendar";
import { openingCashFor } from "@/engine/forecast/assemble";
import { loadCapTable, loadFundingRows } from "@/lib/planSources";

/**
 * Funding comes after Sales, COGS and Overheads precisely so it can answer the question APeX never asks:
 * is the money enough? Everything the cash check needs is gathered here, on the server.
 */
export default async function FundingPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [session, rows, cap, products, fixedCogs, overheads, people, spend, assets, oneOffs, settings, historic] = await Promise.all([
    getSession(),
    /**
     * The five funding tables, read by the ONE loader (§6.32.3). This page carried its own copy of that
     * mapping, and the copy drifted the moment a column was added: `deposit` reached the forecast and never
     * reached the screen the client types it on, so money down was in the plan and invisible beside the loan
     * that took it. Two readings of one plan, again — the fault this app keeps having to learn.
     */
    loadFundingRows(planId),
    // The same cap table the Leadership Team shows (§6.54): both halves, composed in one place.
    loadCapTable(planId),
    supabase.from("plan_products").select("*").eq("plan_id", planId).order("sort_order"),
    supabase.from("plan_fixed_cogs").select("*").eq("plan_id", planId),
    supabase.from("plan_overheads").select("*").eq("plan_id", planId),
    supabase.from("plan_people").select("annual_salary, salary_adjustments, started_on, role").eq("plan_id", planId),
    supabase.from("plan_marketing_spend").select("annual_budget").eq("plan_id", planId),
    supabase.from("plan_fixed_assets").select("*").eq("plan_id", planId),
    // A sold asset stops wearing out (§6.56), so the Year 1 depreciation this page quotes has to know.
    supabase.from("plan_extraordinary_items").select("*").eq("plan_id", planId),
    supabase.from("plan_settings").select("opening_cash, on_cost_pct, financial_year_end_month, first_projected_year").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_historic_periods").select("cash").eq("plan_id", planId).order("period_number").limit(1).maybeSingle(),
  ]);
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  /* ---- what the business does with the money, month by month ---- */
  const prods = (products.data ?? []) as AnyProduct[];
  const sourceFor = (p: AnyProduct) => prods.find((x) => x.id === p.clients_from_product_id) ?? null;
  // Sixty, not twelve: revenue-linked finance repays out of sales for as long as the cap takes, so the
  // funding functions need the whole plan. The cash check still only runs the first twelve (§6.37).
  const revenueMonths = planRevenueMonths(prods);

  const cost = prods as CostProduct[];
  const fixed = (fixedCogs.data ?? []) as never[];
  const cogsMonths = planCogsMonths(cost, fixed, sourceFor);      // the cost of what was actually sold, by month
  // Every figure on this screen is the sum of the months the row below actually spends. A header that adds
  // up differently from the row under it is the Overheads footer mistake again (§6.19).
  const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
  const cogsYear1 = sum(cogsMonths);
  const revenueYear1 = sum(revenueMonths.slice(0, 12));

  const fyStart = planYearStart(firstProjectedYear(settings.data?.first_projected_year, settings.data?.financial_year_end_month), settings.data?.financial_year_end_month ?? 6);
  const salaries = totalSalariesByYear((people.data ?? []).map((p) => ({
    annual_salary: p.annual_salary === null ? null : Number(p.annual_salary),
    salary_adjustments: p.salary_adjustments ?? null,
    startYear: startYearFromDate(p.started_on, fyStart), role: p.role,
  }))).map((y) => y.value);
  const marketingTotal = (spend.data ?? []).reduce((a, s) => a + Number(s.annual_budget ?? 0), 0);
  const ohLines = planOverheadLines(
    (overheads.data ?? []).map((o) => ({ ...o, current_value: Number(o.current_value ?? 0) }) as Overhead),
    salaries, YEARS.map(() => marketingTotal),
  );
  const onCostPct = Number(settings.data?.on_cost_pct ?? 0);
  const ohMonths = overheadsMonths(ohLines, onCostPct);
  const ohYear1 = sum(ohMonths);

  const assetRows = (assets.data ?? []).map((a) => ({
    ...a, purchase_price: Number(a.purchase_price ?? 0), residual_value: Number(a.residual_value ?? 0),
    useful_life_months: Number(a.useful_life_months ?? 60) || 60,
    start_year: Number(a.start_year ?? 1) || 1, start_month: Number(a.start_month ?? 1) || 1,
  })) as FixedAsset[];
  const sold = soldMonthByAsset((oneOffs.data ?? []).map((x) => ({
    ...x, amount: Number(x.amount ?? 0), year: Number(x.year ?? 1) || 1, month: Number(x.month ?? 1) || 1,
  })) as ExtraordinaryItem[]);
  // Every asset is money out in the month it arrives, financed or not (§6.40) — a financed one is paid to
  // its supplier out of what the lender advanced the same day. The loop that used to sit here now lives
  // with the year it has to agree with (§6.36).
  const capex = capexMonths(assetRows);
  /**
   * What each asset-backed loan actually bought (§6.52.2). The loan is named after the LENDER and the thing
   * is named by the client, and a plan with three Westpac vehicle loans on it reads "Westpac, Westpac,
   * Westpac" unless the screen says which is which.
   */
  const bought = Object.fromEntries(
    (assets.data ?? []).filter((a) => a.funding_debt_id).map((a) => [a.funding_debt_id as string, String(a.name ?? "")]),
  );

  return (
    <FundingModule
      planId={planId} initial={rows} mode={mode}
      openingCash={openingCashFor(historic.data, Number(settings.data?.opening_cash ?? 0))}
      openingFromHistory={!!historic.data}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6}
      bought={bought} cap={cap}
      cash={{ revenueMonths, cogsMonths, overheadsMonths: ohMonths, capexMonths: capex }}
      year1={{ revenue: revenueYear1, cogs: cogsYear1, overheads: ohYear1, depreciation: assetsMonths(withDisposals(assetRows, sold)).reduce((a, b) => a + b, 0) }}
    />
  );
}
