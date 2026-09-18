import Link from "next/link";
import { getSession } from "@/lib/plan";
import { getPlanCompleteness } from "@/lib/planCompleteness";
import { GUIDED_STEPS } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { profileMissing } from "../settings/model";
import { firstProjectedYear, planQuarters, planYearEnding, quarterOf } from "@/engine/plan/calendar";
import { AREA_LABEL, type GoalArea } from "@/engine/whatif/goals";
import { loadPlan } from "@/lib/planLoad";
import { runForecast } from "@/engine/forecast/run";
import { breakEvenByYear } from "@/engine/breakeven/point";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { MONTH_SHORT } from "@/engine/plan/calendar";
import { CashChart, RevenueChart } from "./Charts";
import { STATUS_LABEL, type GoalStatus } from "../goals/model";

function Panel({ title, badge, children, className }: { title: string; badge?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader className="flex items-center justify-between"><CardTitle className="text-sm">{title}</CardTitle>{badge}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const session = await getSession();
  const plan = session!.plans.find((p) => p.id === planId)!;
  const c = await getPlanCompleteness(planId);
  const supabase = await createClient();
  const { data: ps } = await supabase.from("plan_settings")
    .select("industry, country, legal_structure, products_services_statement, financial_year_end_month, first_projected_year")
    .eq("plan_id", planId).maybeSingle();

  /**
   * This quarter's goals (§6.44) — the plan's quarter, not the calendar's. A goal set for "Q1" on a June
   * year-end business belongs to July–September, and showing it against January–March would be telling the
   * client something false about their own year.
   */
  const fyEndMonth = Number(ps?.financial_year_end_month ?? 6);
  const nowQuarter = quarterOf(fyEndMonth, new Date());
  const quarterLabel = planQuarters(fyEndMonth, planYearEnding(firstProjectedYear(ps?.first_projected_year, fyEndMonth), 1))
    .find((q) => q.quarter === nowQuarter);
  const { data: quarterGoals } = await supabase.from("plan_goals")
    .select("id, area, title, status, owner_person_id, milestone_date")
    .eq("plan_id", planId).not("parent_id", "is", null).eq("year", 1).eq("quarter", nowQuarter)
    .order("area");
  const { data: goalPeople } = await supabase.from("plan_people").select("id, name").eq("plan_id", planId);
  const ownerOf = (id: string | null) => goalPeople?.find((p) => p.id === id)?.name ?? "";
  const DOT: Record<GoalStatus, string> = {
    not_started: "bg-faint", in_progress: "bg-primary", done: "bg-good", at_risk: "bg-warn",
  };
  /**
   * The dashboard reads the SAME run as every other screen (§6.67, §6.69). It used to read none at all:
   * five KPI tiles hard-coded to an em dash and a cash panel that said "Not yet", on a plan with five years
   * of statements that agree. The first page a client opens was the last one wired to the engine.
   */
  const { plan: planInput } = await loadPlan(planId);
  const { forecast, monthly } = runForecast(planInput);
  const y1 = forecast.pnl[1];
  const be = breakEvenByYear(forecast.pnl);
  const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
  const signed = (v: number) => (v < 0 ? `(${fmt.format(Math.abs(v))})` : fmt.format(v));
  const pct1 = (v: number | null) => (v === null ? "\u2014" : `${v.toFixed(1)}%`);
  const lowMonth = monthly.low;
  const tiles: { label: string; value: string; sub: string; bad?: boolean }[] = [
    { label: "Revenue", value: fmt.format(y1.revenue), sub: "Year 1 of five" },
    { label: "Gross margin", value: pct1(y1.grossMargin), sub: `${fmt.format(y1.grossProfit)} of gross profit` },
    { label: "Net profit", value: signed(y1.netProfit), sub: y1.netProfit < 0 ? "After tax \u2014 a loss in Year 1" : "After tax", bad: y1.netProfit < 0 },
    { label: "Cash at year end", value: signed(forecast.cashFlow[1].closingCash), sub: `Opened at ${fmt.format(forecast.cashFlow[1].openingCash)}`, bad: forecast.cashFlow[1].closingCash < 0 },
    { label: "Lowest cash month", value: signed(lowMonth.closingCash), sub: `${MONTH_SHORT[(lowMonth.month - 1) % 12]} \u00b7 month ${lowMonth.month}`, bad: lowMonth.closingCash < 0 },
  ];

  const missingProfile = profileMissing({ business_name: plan.business_name, ...(ps ?? {}) });
  const nextStep = GUIDED_STEPS.find((s) => { const sec = c.sections.find((x) => x.id === s.id); return sec && sec.done < sec.total; }) ?? GUIDED_STEPS[GUIDED_STEPS.length - 1];
  const hasNumbers = c.sections.filter((s) => ["sales", "overheads"].includes(s.id)).every((s) => s.done >= s.total);
  const base = `/plans/${planId}`;
  const waiting = <Badge variant="outline" className="text-muted-foreground">Waiting for data</Badge>;

  return (
    <div className="mx-auto max-w-[1180px] px-7 pt-6">
      <div className="mb-4">
        <div className="eyebrow">Dashboard</div>
        <h1 className="text-[22px] font-semibold leading-tight">{plan.business_name} — Year 1 plan</h1>
        <div className="mt-1 text-[13px] text-muted-foreground">{hasNumbers ? "Plan figures shown." : "Add Sales and Overheads to see your plan's numbers here."}</div>
      </div>
      {missingProfile.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded border border-warn/40 bg-warn-soft px-4 py-2.5 text-[13px]">
          <i className="size-2 rounded-full bg-warn" />
          <span>The business profile is missing <b>{missingProfile.map((k) => k.replace(/_/g, " ").replace("products services statement", "products & services statement")).join(", ")}</b> — reports open with this page.</span>
          <Link href={`${base}/settings`} className="ml-auto font-semibold text-primary hover:underline">Complete the profile →</Link>
        </div>
      )}

      <div className="mb-3 grid grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="gap-1 py-3.5"><CardContent className="px-4">
            <div className="text-xs font-semibold text-muted-foreground">{t.label}</div>
            <div className={cn("num mt-1 text-2xl font-bold tracking-[-0.01em]", hasNumbers ? (t.bad ? "text-bad" : "") : "text-faint")}>
              {hasNumbers ? t.value : "\u2014"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{hasNumbers ? t.sub : "Needs Sales & Overheads"}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-[1.2fr_1fr_1fr] gap-3">
        <Panel title="Cash through Year 1"
          badge={<Badge variant="outline" className={cn(hasNumbers && lowMonth.closingCash < 0 ? "border-bad/40 text-bad" : "text-muted-foreground")}>
            {!hasNumbers ? "Not yet" : monthly.negative.length ? `${monthly.negative.length} month${monthly.negative.length === 1 ? "" : "s"} below zero` : "Never below zero"}
          </Badge>}>
          {hasNumbers ? (
            <>
              <CashChart months={MONTH_SHORT.slice(0, 12)} values={monthly.months.map((m) => m.closingCash)} />
              <p className="mt-1 text-[12px] text-muted-foreground">
                Lowest at <b className={cn(lowMonth.closingCash < 0 && "text-bad")}>{signed(lowMonth.closingCash)}</b> in {MONTH_SHORT[(lowMonth.month - 1) % 12]}.
                {" "}It is the month, not the year, that runs a business out of money.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Your lowest projected cash month and how long opening cash lasts. Appears once Sales and Overheads are in.</p>
          )}
        </Panel>
        <Panel title="Plan completeness" badge={<Badge variant="secondary" className="num bg-accent text-accent-foreground">{c.percent}%</Badge>}>
          {c.sections.map((s) => (
            <Link key={s.id} href={`${base}/${s.id}`} className="flex items-center gap-2.5 py-1 text-[13px] hover:text-primary">
              <span className="w-[120px] flex-none">{s.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-border"><i className={cn("block h-full", s.done >= s.total ? "bg-good" : "bg-primary")} style={{ width: `${(s.done / s.total) * 100}%` }} /></span>
              <span className="num w-10 text-right text-xs text-muted-foreground">{s.done}/{s.total}</span>
            </Link>
          ))}
        </Panel>
        <Panel title="This quarter's goals" badge={<span className="eyebrow">{quarterLabel?.label ?? "This quarter"}</span>}>
          {quarterGoals?.length ? (
            <>
              {quarterGoals.map((g) => (
                <Link key={g.id} href={`${base}/goals`} className="flex items-start gap-2.5 py-1.5 text-[13px] hover:text-primary">
                  <i className={cn("mt-1.5 size-2 flex-none rounded-full", DOT[g.status as GoalStatus])} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{g.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {AREA_LABEL[g.area as GoalArea]} · {STATUS_LABEL[g.status as GoalStatus]}
                      {ownerOf(g.owner_person_id) && ` · ${ownerOf(g.owner_person_id)}`}
                      {g.milestone_date && ` · by ${g.milestone_date}`}
                    </span>
                  </span>
                </Link>
              ))}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Nothing due in {quarterLabel?.months ?? "this quarter"}. Set them at step {GUIDED_STEPS.find((s) => s.id === "goals")?.step}, or move the levers on the <Link className="font-semibold text-primary" href={`${base}/what-if`}>What-If planner</Link> and turn a scenario into goals. <Link className="font-semibold text-primary" href={`${base}/goals`}>Open Goals</Link>
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        <Panel title="Revenue against break-even"
          badge={<span className="eyebrow">{hasNumbers ? "Five years" : "Not yet"}</span>}>
          {hasNumbers ? (
            <>
              <RevenueChart labels={FORECAST_YEARS.map((y) => `Year ${y}`)} revenue={be.map((b) => b.revenue)} breakEven={be.map((b) => b.breakEvenRevenue)} />
              <p className="mt-1 text-[12px] text-muted-foreground">
                The bar is what you plan to sell; the rule across it is what you have to sell. <Link className="font-semibold text-primary" href={`${base}/break-even`}>Open Break-Even →</Link>
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">What you plan to sell against what you have to sell, year by year. Appears once Sales and Overheads are in.</p>
          )}
        </Panel>
        <Card className="gap-2 border-primary bg-accent">
          <CardHeader><div className="eyebrow text-primary">Next action</div><CardTitle className="text-[15px]">Step {nextStep.step}: {nextStep.label}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{c.percent === 0 ? "Start with what the business is for — six short statements." : "Pick up where you left off."}</p>
            <Button className="mt-3" render={<Link href={`${base}/${nextStep.id}`} />}>Continue →</Button>
          </CardContent>
        </Card>
      </div>

      <Panel className="mt-3" title="AI insights" badge={waiting}>
        <p className="text-[13px] text-muted-foreground">Three observations about your plan, read from your own numbers — margins, costs, cash timing.</p>
      </Panel>
    </div>
  );
}
