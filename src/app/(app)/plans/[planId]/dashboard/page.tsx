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
import { AREA_LABEL, type GoalArea } from "@/engine/whatif/goals";
import { loadPlan } from "@/lib/planLoad";
import { runForecast } from "@/engine/forecast/run";
import { lossMonths, monthlyProfit, monthlyProfitGap } from "@/engine/forecast/monthlyProfit";
import { breakEvenByYear } from "@/engine/breakeven/point";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { planMonths } from "@/engine/plan/calendar";
import { CashChart, ProfitChart, RevenueChart } from "./Charts";
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
    .select("industry, country, legal_structure, products_services_statement, financial_year_end_month, first_projected_year, ninety_day_ends_on")
    .eq("plan_id", planId).maybeSingle();

  /**
   * THE NEXT NINETY DAYS (§6.125), which is what this panel used to call "this quarter".
   *
   * The plan's quarter was the right unit while goals hung off six annual ones and the dashboard had to
   * decide which three months a client was standing in. The ladder replaced that with a single 90-day
   * period whose end date the client sets on the Goals screen — so there is nothing to work out here any
   * more, and nothing that can be worked out WRONG. The fault §6.44 fixed (a June year-end plan shown its
   * Q1 goals against January–March) is now unreachable rather than merely handled.
   */
  const ninetyEnds = ps?.ninety_day_ends_on ?? null;

  /**
   * THE PLAN'S OWN TWELVE MONTHS, NOT THE CALENDAR'S (§6.21, §6.126).
   *
   * §6.21 killed six hardcoded ["Jan" … "Dec"] arrays and left one function that answers "what is month 1
   * of THIS plan". The dashboard was never converted, and nothing caught it because every chart still drew
   * twelve labelled columns in the right order — they were simply the wrong twelve names.
   *
   * On a June year-end — which is every Australian small business, and most of this product's market —
   * month 1 is JULY. The cash chart, the profit chart and the "lowest cash month" callout have all been
   * six months out, and the callout is the worst of them: "Jan · month 1" states the contradiction
   * outright and still gets believed, because the month name is the part a person reads.
   */
  const months = planMonths(Number(ps?.financial_year_end_month ?? 6));
  const monthName = (m: number) => months[(m - 1) % 12];
  const { data: quarterGoals } = await supabase.from("plan_goals")
    .select("id, area, title, status, owner_person_id, milestone_date")
    .eq("plan_id", planId).eq("horizon", "ninety")
    .order("milestone_date", { ascending: true, nullsFirst: false }).order("sort_order");
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
  const run = runForecast(planInput);
  const { forecast, monthly } = run;
  const y1 = forecast.pnl[1];
  const be = breakEvenByYear(forecast.pnl);
  const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
  const signed = (v: number) => (v < 0 ? `(${fmt.format(Math.abs(v))})` : fmt.format(v));
  const pct1 = (v: number | null) => (v === null ? "\u2014" : `${v.toFixed(1)}%`);
  const lowMonth = monthly.low;

  /*
   * PROFIT BESIDE CASH (§6.124).
   *
   * Arithmetic on `shapesByYear`, which `runForecast` returns precisely so a profit and loss never reads
   * the plan a second time. Before tax, because tax is an annual figure the monthly model places rather
   * than recomputes — and the tile above says "after tax", so the caption carries the difference.
   */
  const profitMonths = monthlyProfit(run.shapesByYear[1]);
  const profitGap = monthlyProfitGap(run.shapesByYear[1], y1.profitBeforeTax);
  const losses = lossMonths(profitMonths);
  const tiles: { label: string; value: string; sub: string; bad?: boolean }[] = [
    { label: "Revenue", value: fmt.format(y1.revenue), sub: "Year 1 of five" },
    { label: "Gross margin", value: pct1(y1.grossMargin), sub: `${fmt.format(y1.grossProfit)} of gross profit` },
    { label: "Net profit", value: signed(y1.netProfit), sub: y1.netProfit < 0 ? "After tax \u2014 a loss in Year 1" : "After tax", bad: y1.netProfit < 0 },
    { label: "Cash at year end", value: signed(forecast.cashFlow[1].closingCash), sub: `Opened at ${fmt.format(forecast.cashFlow[1].openingCash)}`, bad: forecast.cashFlow[1].closingCash < 0 },
    { label: "Lowest cash month", value: signed(lowMonth.closingCash), sub: `${monthName(lowMonth.month)} \u00b7 month ${lowMonth.month}`, bad: lowMonth.closingCash < 0 },
  ];

  const missingProfile = profileMissing({ business_name: plan.business_name, ...(ps ?? {}) });
  const nextStep = GUIDED_STEPS.find((s) => { const sec = c.sections.find((x) => x.id === s.id); return sec && sec.done < sec.total; }) ?? GUIDED_STEPS[GUIDED_STEPS.length - 1];
  const hasNumbers = c.sections.filter((s) => ["sales", "overheads"].includes(s.id)).every((s) => s.done >= s.total);
  const base = `/plans/${planId}`;
  const waiting = <Badge variant="outline" className="text-muted-foreground">Waiting for data</Badge>;

  return (
    /*
     * THE SAME GUTTER AS EVERY OTHER STEP (§6.118).
     *
     * This div used to carry `mx-auto max-w-[1180px]`, and it was the only page in the app that did. On a
     * 1700px window the main column is 1460 wide, so clamping to 1180 left 280px of slack split evenly —
     * and the dashboard's first pixel of content landed 168px from the sidebar while every guided step
     * started at 28px. Nic saw the app move sideways when he clicked Dashboard, which is exactly what was
     * happening.
     *
     * The cap itself was not a bad idea; declaring it HERE was. A reading width is a property of the
     * shell, so it now lives on `<main>` in the plan layout where one decision covers all seventeen steps.
     */
    <div className="px-7 pt-6">
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

      <div className="mb-3 grid grid-cols-[1.2fr_1fr_1fr] items-start gap-3">
        {/*
          TWO CARDS IN THE LEFT COLUMN (§6.124).
          The row's height is set by Plan completeness and the quarter's goals, and cash alone used 233 of
          the 578 it was given — 345px of white space in the column carrying the most important picture on
          the page. `items-start` so neither card stretches to fill what is left; they size to their own
          content and the column ends where they do.
        */}
        <div className="flex flex-col gap-3">
        <Panel title="Cash through Year 1"
          badge={<Badge variant="outline" className={cn(hasNumbers && lowMonth.closingCash < 0 ? "border-bad/40 text-bad" : "text-muted-foreground")}>
            {!hasNumbers ? "Not yet" : monthly.negative.length ? `${monthly.negative.length} month${monthly.negative.length === 1 ? "" : "s"} below zero` : "Never below zero"}
          </Badge>}>
          {hasNumbers ? (
            <>
              <CashChart months={months} values={monthly.months.map((m) => m.closingCash)} />
              <p className="mt-1 text-[12px] text-muted-foreground">
                Lowest at <b className={cn(lowMonth.closingCash < 0 && "text-bad")}>{signed(lowMonth.closingCash)}</b> in {monthName(lowMonth.month)}.
                {" "}It is the month, not the year, that runs a business out of money.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Your lowest projected cash month and how long opening cash lasts. Appears once Sales and Overheads are in.</p>
          )}
        </Panel>
        <Panel title="Profit before tax, month by month"
          badge={<Badge variant="outline" className={cn(hasNumbers && losses.length ? "border-bad/40 text-bad" : "text-muted-foreground")}>
            {!hasNumbers ? "Not yet" : losses.length ? `${losses.length} month${losses.length === 1 ? "" : "s"} at a loss` : "Every month profitable"}
          </Badge>}>
          {hasNumbers ? (
            <>
              <ProfitChart months={months} values={profitMonths} />
              <p className="mt-1 text-[12px] text-muted-foreground">
                {/*
                  THE TWO FIGURES ON THIS SCREEN ARE RECONCILED IN WORDS (§6.124). The tile above says
                  "after tax"; this chart is before it. Left unsaid, a client reads two different numbers
                  for one year and trusts neither.
                */}
                The twelve add to <b className={cn(y1.profitBeforeTax < 0 && "text-bad")}>{signed(y1.profitBeforeTax)}</b> before tax
                {y1.netProfit !== y1.profitBeforeTax && <> — <b className={cn(y1.netProfit < 0 && "text-bad")}>{signed(y1.netProfit)}</b> after it, which is the figure above</>}.
                {/*
                  Rounding, not equality. The gap is a floating-point subtraction of two rounded figures,
                  so it is "0.004, not 0" often enough to matter — and a sentence announcing that an asset
                  sold added nothing is worse than no sentence.
                */}
                {Math.round(profitGap) !== 0 && <> An asset sold adds {signed(profitGap)} that belongs to no single month.</>}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">Which months make money and which do not. Appears once Sales and Overheads are in.</p>
          )}
        </Panel>
        </div>
        <Panel title="Plan completeness" badge={<Badge variant="secondary" className="num bg-accent text-accent-foreground">{c.percent}%</Badge>}>
          {c.sections.map((s) => (
            <Link key={s.id} href={`${base}/${s.id}`} className="flex items-center gap-2.5 py-1 text-[13px] hover:text-primary">
              <span className="w-[120px] flex-none">{s.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-border"><i className={cn("block h-full", s.done >= s.total ? "bg-good" : "bg-primary")} style={{ width: `${(s.done / s.total) * 100}%` }} /></span>
              <span className="num w-10 text-right text-xs text-muted-foreground">{s.done}/{s.total}</span>
            </Link>
          ))}
        </Panel>
        <Panel title="Next 90 days" badge={<span className="eyebrow">{ninetyEnds ? `ends ${ninetyEnds}` : "no end date set"}</span>}>
          {quarterGoals?.length ? (
            <>
              {quarterGoals.map((g) => (
                <Link key={g.id} href={`${base}/goals`} className="flex items-start gap-2.5 py-1.5 text-[13px] hover:text-primary">
                  <i className={cn("mt-1.5 size-2 flex-none rounded-full", DOT[g.status as GoalStatus])} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{g.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {g.area ? `${AREA_LABEL[g.area as GoalArea]} · ` : ""}{STATUS_LABEL[g.status as GoalStatus]}
                      {ownerOf(g.owner_person_id) && ` · ${ownerOf(g.owner_person_id)}`}
                      {g.milestone_date && ` · by ${g.milestone_date}`}
                    </span>
                  </span>
                </Link>
              ))}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Nothing set for the next ninety days. Set them at step {GUIDED_STEPS.find((s) => s.id === "goals")?.step}, or move the levers on the <Link className="font-semibold text-primary" href={`${base}/what-if`}>What-If planner</Link> and turn a scenario into goals. <Link className="font-semibold text-primary" href={`${base}/goals`}>Open Goals</Link>
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
