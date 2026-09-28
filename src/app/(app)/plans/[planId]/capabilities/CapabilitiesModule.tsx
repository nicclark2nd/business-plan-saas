"use client";

import { usePlanYears } from "@/components/PlanYearsProvider";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { Note } from "@/components/module/DataGrid";
import { useWidth, type Severity as ChartSeverity } from "@/components/chart/core";
import { BarRows, Columns, Lines, MiniDial, RangeBar, ScoreDial, Spark } from "@/components/chart/plots";
import { navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { moneyFormatter } from "@/engine/plan/money";
import {
  SCORE_BANDS, CARD_LABEL, DIAL_LABEL, INFO_MISSING, borrowingCapacity, statusOf,
  type CapabilityInput, type Metric, type Severity,
} from "@/engine/capability/model";
import { LENDER_MIN_DSCR, TRANSFER_FACTORS, saleYear } from "@/engine/capability/judgements";
import { CAPACITY_TERM_YEARS, stressedCash } from "@/engine/capability/borrow";
import { buyerQuestions } from "@/engine/capability/verdict";
import { panels as buildPanels, type FacilityFacts, type Panels, type ProductFacts } from "@/engine/capability/series";
import { ageingView, concentration, earningsBridge, executionLines, lenderChecklist, type ExtraFacts, type Line } from "@/engine/capability/extras";
import { Meter } from "@/components/chart/core";
import { capabilityTimeline, readiness, type MonthsByYear, type TimelineYear } from "@/engine/capability/timeline";
import type { AgreedTargets, TargetCheck } from "@/engine/capability/targets";
import { type Lever, type WithLeversRow } from "@/engine/capability/levers";
import { Briefing } from "./Briefing";
import type { SavedBriefing } from "./actions";
import { leverValue, readTab, readViews } from "@/engine/capability/read";
import { compareWith, type Comparison, type HistoricRow, type YearNames } from "@/engine/capability/actual";

/**
 * Everything the server hands down. Only the money formatter is built here, because a function cannot cross
 * the boundary — every FIGURE now comes from the plan, including the judgements (§6.129).
 */
export type PlanFacts = Omit<CapabilityInput, "money">;

type Tab = "grow" | "borrow" | "sell";
type View = "actual" | "plan";


/** The engine's three states, in the four the chart primitives speak. */
const TONE: Record<Severity, ChartSeverity> = { good: "good", watch: "warn", bad: "bad" };

/**
 * FINANCIAL CAPABILITIES (§6.128, rebuilt §6.129).
 *
 * The three questions an owner asks about their own business: can I afford to grow it, can I borrow against
 * it, and could I sell it.
 *
 * THIS SCREEN COLLECTS NOTHING, AND THAT IS THE WHOLE REBUILD.
 *
 * §6.128 put the inputs on the tabs — a cash floor in a tile on the growth tab, a loan proposal in five
 * boxes on the borrowing tab, an asking price and six scoring strips on the selling tab. Three attempts were
 * then made to make the three tabs look alike, each treating it as a layout problem: shrink the form, move
 * the scores into tiles, cut the height. Nic, after the third:
 *
 * > "You keep mixing in data entry with visual dials. And you are now getting confused and producing low
 * > quality UI/UX. THESE THREE TABS ARE FOR DISPLAY - NOT FOR COLLECTING DATA."
 *
 * The tabs looked different because they WERE different: each had a different amount of form on it, and no
 * amount of shrinking makes a form into a dashboard. Worse, none of it saved — every figure was gone on
 * refresh, so the score changed between two visits and no report could print any of it.
 *
 * So every tab is now exactly three things: the verdict, one picture, and the cards. Nothing on the page has
 * an input in it. A card with no figure behind it draws greyed, with no needle, and carries a PENCIL to the
 * box on the step that owns the figure — Assumptions for the cash floor and the downside, Plan settings for
 * the price, Leadership Team for owner dependence, Fixed Assets for security, Funding for the borrowing.
 */
export function CapabilitiesModule({ planId, mode, currency, facts, products, facilities, months, openingDebt, extras, history = [], firstYear, adviser = false, monthsByYear = {}, targetChecks = [], agreedTargets = {}, aiOn = false, briefings = {} }: {
  planId: string; mode: "guided" | "advanced"; currency: string; facts: PlanFacts;
  /** Historic, every period, for the actual view (§6.158). Empty for a business with no accounts. */
  history?: HistoricRow[];
  /** The year Year 1 ends in — to name the plan's years and the last actual one. */
  firstYear: number;
  /** A coach, consultant or firm: the summary box is written to them, about the owner (§6.160). */
  adviser?: boolean;
  /** Every plan year month by month, for when-it-is-ready (§6.166). */
  monthsByYear?: MonthsByYear;
  /** The targets agreed on the Planner's assessment, read against the plan (§6.167). */
  targetChecks?: TargetCheck[];
  /** The agreed targets themselves — what the Plan view's levers aim at (§6.173). */
  agreedTargets?: AgreedTargets;
  /** AI switched on for this plan, and the Planner's saved briefings keyed "tab:view" (§6.179). */
  aiOn?: boolean;
  briefings?: Record<string, SavedBriefing>;
  /** For the panels only (§6.129.2) — each product's five years, and the borrowing the plan carries. */
  products: ProductFacts[]; facilities: FacilityFacts[];
  /** The plan's own twelve months (§6.21), for the month-by-month cash panel. */
  months: string[];
  /** Bank debt already on the last balance sheet — owed, repaid by the forecast, and not a Funding row. */
  openingDebt: number;
  /** The figures behind the four panels that had no data until §6.129.3. */
  extras: ExtraFacts;
}) {
  const [tab, setTab] = useState<Tab>("grow");
  /* Saved briefings live here, not in each box, so switching tab and back shows what was just saved. */
  const [notes, setNotes] = useState<Record<string, SavedBriefing>>(briefings);
  const money = useMemo(() => moneyFormatter(currency), [currency]);

  /* The plan's own input, unchanged — the pictures and panels that chart the plan's five years read this. */
  const input: CapabilityInput = useMemo(() => ({ ...facts, money }), [facts, money]);

  /*
   * ACTUAL AND PLAN (§6.158). Nic: "If the plan has historical information then I want the last two
   * historic financial years as the financial capabilities." The page opens on the accounts; the plan is the
   * second view, and its growth is measured from the last actual year into the first plan year. A business
   * with no accounts has only the plan.
   */
  const RV = useMemo(() => readViews({ facts, history, firstYear, money }), [facts, history, firstYear, money]);
  const { views, actualV, planV } = RV;
  const [view, setView] = useState<View>(views.hasHistory ? "actual" : "plan");
  const V = view === "actual" && actualV ? actualV : planV;
  /* Each plan year scored on its own: the year each capability arrives (§6.166). */
  const line = useMemo(() => capabilityTimeline(facts, views, monthsByYear, firstYear, money), [facts, views, monthsByYear, firstYear, money]);
  const onActual = view === "actual" && !!actualV;

  const { borrow, sell } = V;
  const waiting = tab === "grow" ? V.waiting : 0;
  /* The plan's own five years, charted under their names (§6.157). */
  const P = useMemo(() => buildPanels(input, products, [1, 2, 3, 4, 5].map((y) => String(firstYear + y - 1))), [input, products, firstYear]);
  const growScore = V.scores.grow, borrowScore = V.scores.borrow, sellScore = V.scores.sell;

  /* The verdict, the "In short" box and the fixes, read by the same function the briefing and report use (§6.179). */
  const R = useMemo(() => readTab({ facts, history, firstYear, money, adviser, months, agreedTargets, facilities }, RV, tab, view === "actual"),
    [facts, history, firstYear, money, adviser, months, agreedTargets, facilities, RV, tab, view]);
  const { metrics, s, v, band, span, summary } = R;

  /* The same card on the other view (§6.159): the track record on the plan, the plan on the accounts. */
  const otherV = actualV ? (onActual ? planV : actualV) : null;
  /*
   * THE YEAR THE OTHER CARD READS, NAMED AS THAT YEAR (§6.168). Nic, on Operating margin: "The plan,
   * 2026 → 2027: −4%" — does that mean a projected year? It is 2027 alone; the span belongs only to the
   * measures that compare one year with the next. A single-year measure names its single year: 2027 for
   * the plan (the sale year on Sell), the latest actual year for the accounts.
   */
  const TWO_YEAR = new Set(["revenueGrowth", "incrementalMargin", "operatingLeverage", "returnOnPlan", "workingCapitalPerDollar"]);
  const planYear = tab === "sell" ? firstYear + saleYear(input.sale) - 1 : firstYear;
  const otherLabel = (key: string) => !views.actual ? ""
    : onActual
      ? (TWO_YEAR.has(key) ? `The plan, ${views.plan.span.replace(" onward", "")}` : `The plan, ${planYear}`)
      : (TWO_YEAR.has(key) ? `Track record, ${views.actual.span}` : `Actual, ${views.actual.last.year}`);
  const fixes = R.fixes;

  const otherOf = (m: Metric): Comparison | null => {
    /* Not on the Actual view: a line about the plan is a line about a projected year (§6.169). */
    if (!otherV || onActual) return null;
    return compareWith(m, otherV[tab].find((x) => x.key === m.key), otherLabel(m.key), !onActual);
  };

  return (
    <ModuleFrame
      group={navGroup("capabilities")} title="Financial Capabilities"
      subtitle={onActual ? "What your accounts say about growing this business, borrowing against it and selling it" : "What your plan says about growing this business, borrowing against it and selling it"} mode={mode}
      areas={[
        { key: "grow", label: "Capability to grow", count: growScore.value ?? undefined },
        { key: "borrow", label: "Capability to borrow", count: borrowScore.value ?? undefined },
        { key: "sell", label: "Capability to sell", count: sellScore.value ?? undefined },
      ]}
      area={tab} onArea={(k) => setTab(k as Tab)}
      scope={{ label: onActual ? `Actual ${span}` : `Plan ${span}` }}
      footer={<ModuleFooter planId={planId} moduleId="capabilities" formId="capabilities-form" />}
      help={<>
        <h3>Nothing is typed on this screen</h3>
        {onActual
          ? <p>The Actual view reads your past accounts in Historic and nothing else — no projected year, and no figure from the plan. If a number looks wrong, fix it on Historic.</p>
          : <p>Every figure on the Plan view comes from your plan — the same numbers as your Profit &amp; Loss, dashboard and report. If a number looks wrong here, it is wrong there too. Fix it on the step it comes from.</p>}
        <h3>A grey dial is a question, not a bad score</h3>
        <p>Some measures need something only you can decide: how low you will let cash go, what your money costs, what you would sell for, and whether the business runs without you. These are set on other steps. A measure waiting on one shows grey, with a <b>pencil</b> that takes you straight to the right box.</p>
        <h3>How the score works</h3>
        <p>Each measure is rated green, amber or red, and the ratings are averaged — the ones that matter most count for more. <b>A measure that cannot be worked out yet is left out, not scored as zero</b>, so an unfinished plan still gets a fair score. The score tells you how many measures it is based on.</p>
        <h3>Where the green, amber and red come from</h3>
        <p>They start as general small-business ranges, not ranges for your industry. A concreter, a café and a software business run very differently. If you know what good looks like in this industry, set the ranges in <a className="font-semibold text-primary hover:underline" href={`/plans/${planId}/settings?area=ranges`}>Plan settings → Capability ranges</a>. The line under each measure says which ranges it uses.</p>
      </>}
    >
      <form id="capabilities-form" className="hidden" />

      {/*
        THE TWO VIEWS (§6.158), and each one's score on this tab, so the gap between what the business has
        done and what the plan says it will do is the first thing on the page.
      */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/30 px-5 py-2.5">
        {views.actual && actualV ? (
          <div className="inline-flex overflow-hidden rounded-md border border-input" role="tablist">
            {([
              { k: "actual" as const, head: `Actual: ${views.actual.span}`, sub: "from your accounts", sc: actualV.scores[tab].value },
              { k: "plan" as const, head: `Plan: ${views.plan.span}`, sub: "from your projections", sc: planV.scores[tab].value },
            ]).map((o) => (
              <button key={o.k} type="button" role="tab" aria-selected={view === o.k} onClick={() => setView(o.k)}
                className={cn("px-3.5 py-1.5 text-left text-[12.5px] leading-tight",
                  view === o.k ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary")}>
                <span className="font-semibold">{o.head}</span>
                <span className={cn("ml-1.5", view === o.k ? "text-primary-foreground/80" : "text-muted-foreground")}>{o.sub}</span>
                <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", view === o.k ? "bg-primary-foreground/20" : "bg-secondary")}>{o.sc ?? "—"}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[12.5px]"><b>Plan: {views.plan.span}</b> <span className="text-muted-foreground">— from your projections. There are no accounts in Historic yet, so there is no actual view.</span></span>
        )}
      </div>

      <section className="border-b border-border bg-accent/40 px-5 py-3.5">
        <span className="eyebrow">{adviser ? "For the Planner" : "In short"}</span>
        <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-[13.5px] leading-relaxed @container sm:grid-cols-[170px_minmax(0,1fr)]">
          <dt className="font-semibold text-muted-foreground">What happened</dt><dd>{summary.happened}</dd>
          <dt className="font-semibold text-muted-foreground">{onActual ? "What it means" : "What the plan asks"}</dt><dd>{summary.asks}</dd>
          <dt className="font-semibold text-muted-foreground">{adviser ? "Talk about first" : "Start with"}</dt><dd className="font-semibold">{summary.talk}</dd>
        </dl>
      </section>

      {!onActual && line.length > 1 && <WhenReady line={line} tab={tab} onTab={setTab} />}
      {!onActual && targetChecks.length > 0 && <AgreedTargets planId={planId} checks={targetChecks} />}

      {/* ---------- the verdict: identical on all three tabs ---------- */}
      {/*
        SIZED BY THE MODULE, NOT THE WINDOW (§6.129.2). This band used `md:` — the VIEWPORT — while it lives
        in a column the sidebar has already taken 260px from. On a laptop-width window the viewport said
        "three columns" and the module had room for one, and the verdict paragraph was squeezed into a
        sliver one word wide. Container queries ask the module how wide it actually is.
      */}
      <div className="@container border-b border-border">
      <section className="grid gap-0 @[720px]:grid-cols-[minmax(200px,260px)_minmax(0,1fr)] @[1100px]:grid-cols-[minmax(220px,300px)_minmax(0,1fr)_minmax(230px,320px)]">
        <div className="flex flex-col items-center justify-center border-b border-border bg-secondary/40 px-5 py-5 text-center @[720px]:border-b-0 @[720px]:border-r">
          <Dial value={s.value} />
          <div className={cn("mt-1 text-[44px] font-semibold leading-none tabular-nums",
            band === "good" && "text-good", band === "watch" && "text-warn", band === "bad" && "text-bad")}>
            {s.value ?? "—"}<span className="text-[15px] font-normal text-muted-foreground">/100</span>
          </div>
          {band && <div className="mt-2"><Pill s={band} label={DIAL_LABEL[tab][band]} /></div>}
          <p className="mt-2 max-w-[26ch] text-[11.5px] text-muted-foreground">
            {s.value === null ? "Nothing to score yet"
              : s.covered === s.total ? `Based on ${s.total} measures.` : `Based on ${s.covered} of ${s.total} measures — the others need more information.`}
            {s.value !== null && waiting > 0 && ` ${waiting} more ${waiting === 1 ? "counts" : "count"} once the business makes a profit.`}
          </p>
        </div>

        <div className="border-b border-border px-5 py-5 @[1100px]:border-b-0">
          <p className="text-[13px] text-muted-foreground">{v.question}</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight">{v.headline}</h2>
          {fixes?.story ? (
            <>
              <p className="mt-3 text-[13.5px] leading-relaxed">{fixes.story}</p>
              {fixes.table.length > 0 && <LeverTable rows={fixes.table} title={onActual ? `${fixes.year} with these fixes` : `${fixes.year} if the plan makes these fixes`} />}
              {fixes.short !== null && (
                <p className="mt-2 text-[12.5px] font-semibold text-bad">
                  Even with all these fixes, {fixes.year} {onActual ? "would still have lost" : "still loses"} {money(-fixes.short)}. That gap has to be closed with higher prices, more sales at a good profit, or lower costs.
                </p>
              )}
              {fixes.shortCover !== null && (
                <p className="mt-2 text-[12.5px] font-semibold text-bad">
                  Even with all these fixes, trading would cover the loan payments only {Math.round(fixes.shortCover * 100) / 100} times — lenders want {LENDER_MIN_DSCR}. The rest has to come from more profit, or smaller loans.
                </p>
              )}
              {fixes.priceNote && (
                <p className="mt-2 text-[12.5px] font-semibold text-bad">
                  To keep the asking price of {money(fixes.priceNote.price)}, a buyer would need to see {money(fixes.priceNote.needed)} of profit after add-backs a year (at {fixes.priceNote.high}×, the top of what similar businesses sold for).
                  {" "}{fixes.priceNote.after > 0 ? <>With the fixes, it would be {money(fixes.priceNote.after)}.</> : <>Even with the fixes, there is no profit.</>}
                </p>
              )}
              {fixes.shortStress !== null && (
                <p className="mt-2 text-[12.5px] font-semibold text-bad">
                  Even with all these fixes, the loans could not be paid in the bad year set up on Assumptions ({fixes.shortStress.replace(/^Bad year: /, "")}). That keeps the score below 50 — check the bad year is realistic.
                  {" "}<a href={`/plans/${planId}/assumptions?area=downside`} className="font-semibold text-primary hover:underline">Check the bad year →</a>
                </p>
              )}
            </>
          ) : (
            <div className="mt-3 space-y-2">
              {v.paragraphs.map((p, i) => (
                <p key={i} className="text-[13.5px] leading-relaxed">
                  <b className="font-semibold">{p.lead}</b> {p.body}
                </p>
              ))}
            </div>
          )}
        </div>

        <aside className="px-5 py-5 @[720px]:col-span-2 @[1100px]:col-span-1 @[1100px]:border-l @[1100px]:border-border">
          <span className="eyebrow">What to do next, in order</span>
          {fixes && fixes.levers.length > 0 ? (
            <Levers planId={planId} levers={fixes.levers} money={money} agreed={agreedTargets} />
          ) : v.actions.length ? (
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-[13px] marker:font-semibold marker:text-primary">
              {v.actions.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">
              {s.value === null
                ? "Fill in the plan and this fills itself in."
                : "Nothing to fix on this tab. Come back when the forecast changes."}
            </p>
          )}
          {/*
            WHY THE SCORE IS WHERE IT IS, when an average would have put it higher (§6.128.1). A capped
            score with no explanation is a number the client argues with; naming the measure that did it
            turns the argument into a decision.
          */}
          {s.capped.length > 0 && (
            <p className="mt-3 rounded border border-border bg-secondary/50 px-3 py-2 text-[12px] text-muted-foreground">
              <b className="font-semibold text-foreground">
                {s.capped.map((k) => metrics.find((m) => m.key === k)?.name ?? k).join(" and ")}
              </b> {s.capped.length === 1 ? "keeps" : "keep"} this score below 50. A problem this big can&apos;t be made up for by the things that are going well.
            </p>
          )}
        </aside>
      </section>
      </div>

      {/* The Planner's briefing (§6.179): one note per tab and view, keyed so each starts from its own saved copy. */}
      {s.value !== null || fixes.story ? (
        <Briefing key={`${tab}:${R.onActual ? "actual" : "plan"}`} planId={planId} tab={tab} view={R.onActual ? "actual" : "plan"} R={R}
          money={money} adviser={adviser} aiOn={aiOn} initial={notes[`${tab}:${R.onActual ? "actual" : "plan"}`] ?? null}
          onSaved={(b) => setNotes((n) => { const k = `${tab}:${R.onActual ? "actual" : "plan"}`; const x = { ...n }; if (b) x[k] = b; else delete x[k]; return x; })} />
      ) : null}

      {/*
        ---------- one picture, and every tab has exactly one ----------

        THIS IS WHERE THE THREE TABS USED TO DIVERGE. The growth tab had two tiles and a bar, borrowing had
        five tiles, a bar and three inline boxes, selling had ten tiles and a bar. Now each tab has a single
        band showing the one argument it is making: where the worst month falls against the floor, how much
        borrowing the cash flow carries, where the asking price falls against what the earnings support.
      */}
      {tab === "grow" && (onActual
        ? <YearEndCash planId={planId} history={history} firstYear={firstYear} floor={input.growth.cashBuffer} money={money} />
        : <WorstMonth planId={planId} input={input} money={money} months={months} />)}
      {tab === "borrow" && <BorrowingRoom planId={planId} input={V.posIn} money={money} />}
      {tab === "sell" && <ValuationRange planId={planId} metrics={sell} input={V.posIn} money={money} names={onActual ? views.actual!.positionNames : views.plan.positionNames} />}

      {/* ---------- the measures ---------- */}
      <div className="@container">
        <div className="grid gap-px bg-border @[640px]:grid-cols-2 @[1000px]:grid-cols-3">
          {metrics.map((m) => <Card key={m.key} m={m} planId={planId} labels={CARD_LABEL[tab]} other={otherOf(m)} move={fixes?.moves[m.key]} />)}
        </div>
      </div>

      {/*
        ---------- the panels (§6.129.2) ----------

        THE BOTTOM HALF OF THE DASHBOARD THIS WAS MODELLED ON, and the half that was never brought across.
        The cards judge one year each; these show the shape behind the judgement — five years of cover, the
        cash month by month, where the growth actually comes from. Same skeleton on every tab: a grid of
        panels, each one a picture of figures the plan already holds, none of them with a box to type in.
      */}
      {onActual ? (
        <p className="border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
          Everything on this view is read from your accounts in Historic, {views.actual?.span}. Nothing here is projected.
        </p>
      ) : (
      <div className="@container border-t border-border">
      <div className="grid gap-px bg-border @[860px]:grid-cols-2">
        {tab === "grow" && <GrowPanels P={P} input={input} money={money} planId={planId} extras={extras} />}
        {tab === "borrow" && <BorrowPanels P={P} facilities={facilities} openingDebt={openingDebt} money={money} planId={planId} extras={extras} input={input} metrics={borrow} />}
        {tab === "sell" && <SellPanels P={P} metrics={sell} input={input} money={money} planId={planId} extras={extras} />}
      </div>
      </div>
      )}
    </ModuleFrame>
  );
}

/**
 * WHEN THE BUSINESS IS READY (§6.166) — the three capabilities scored year by year, and the year each one
 * arrives. The question a Planner is asked most ("when could we borrow?"), answered in one line each.
 */
function WhenReady({ line, tab, onTab }: { line: TimelineYear[]; tab: Tab; onTab: (t: Tab) => void }) {
  const rows: { k: Tab; name: string }[] = [{ k: "grow", name: "Grow" }, { k: "borrow", name: "Borrow" }, { k: "sell", name: "Sell" }];
  const say = (k: Tab) => {
    const r = readiness(line, k), ready = DIAL_LABEL[k].good, start = line[0].year;
    if (r.from !== null && r.from === start) return <span className="text-good">{ready} from the start</span>;
    if (r.from !== null) return <><span className="text-good">{ready} from {r.from}</span>{r.first !== null && r.first < r.from ? <span className="text-muted-foreground"> — briefly in {r.first} too</span> : null}</>;
    if (r.first !== null) return <span className="text-warn">Ready in {r.first}, but slips back in {r.slips.join(" and ")}</span>;
    return <span className="text-bad">Not ready in any year of the plan</span>;
  };
  const tone = (v: number | null) => {
    const b = v === null ? null : statusOf(v, SCORE_BANDS);
    return b === "good" ? "bg-good-soft text-good" : b === "watch" ? "bg-warn-soft text-warn" : b === "bad" ? "bg-bad-soft text-bad" : "bg-secondary text-muted-foreground";
  };
  return (
    <section className="@container border-b border-border px-5 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="eyebrow">When the business is ready</span>
        <span className="text-[12px] text-muted-foreground">Each year is scored on its own. Over 70 means ready. For Sell, each year is scored as if the business were sold that year.</span>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1 text-[13px]">
          <thead>
            <tr className="text-[11.5px] font-semibold text-muted-foreground">
              <th className="w-20 text-left font-semibold" />
              {line.map((y) => <th key={y.k} className="w-16 text-center font-semibold tabular-nums">{y.year}</th>)}
              <th className="pl-4 text-left font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} onClick={() => onTab(r.k)} className={cn("cursor-pointer", r.k === tab ? "font-semibold" : "hover:bg-secondary/40")}>
                <td className={cn("py-0.5 pr-2", r.k === tab && "text-primary")}>{r.name}</td>
                {line.map((y) => (
                  <td key={y.k} className="px-1 text-center">
                    <span className={cn("inline-block min-w-10 rounded px-1.5 py-0.5 text-[12px] font-semibold tabular-nums", tone(y.scores[r.k]))}>{y.scores[r.k] ?? "—"}</span>
                  </td>
                ))}
                <td className="pl-4 text-[12.5px] font-semibold">{say(r.k)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * THE PLAN AGAINST WHAT WAS AGREED (§6.167). The assessment set the direction; this is whether the plan
 * took it. Counted, not blended into the dials: a missed target is a conversation, not a band.
 */
function AgreedTargets({ planId, checks }: { planId: string; checks: TargetCheck[] }) {
  const met = checks.filter((c) => c.met === true).length;
  const LINK = "font-semibold text-primary underline-offset-2 hover:underline";
  return (
    <section className="border-b border-border px-5 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="eyebrow">The plan against the agreed targets</span>
        <span className={cn("text-[12.5px] font-semibold", met === checks.length ? "text-good" : "text-bad")}>{met} of {checks.length} met</span>
        <Link href={`/plans/${planId}/assessment`} className={cn(LINK, "text-[12px]")}>Planner&apos;s assessment →</Link>
      </div>
      <ul className="mt-2 divide-y divide-border rounded-md border border-border">
        {checks.map((c) => (
          <li key={c.kind} className="grid gap-x-3 gap-y-0.5 px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto]">
            <span className="flex items-baseline gap-2 font-semibold">
              <span className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", c.met === true ? "bg-good" : c.met === false ? "bg-bad" : "bg-muted-foreground/40")} />
              {c.target}
            </span>
            <span>
              <span className={cn(c.met === true && "text-good", c.met === false && "text-bad", c.met === null && "text-muted-foreground")}>{c.plan}</span>
              {c.gap && <span className="text-[12.5px] text-muted-foreground"> — {c.gap}</span>}
            </span>
            <span className="text-[12.5px]">
              {c.met === true ? <span className="font-semibold text-good">✓ Met</span> : <Link className={LINK} href={`/plans/${planId}/${c.fix.to}`}>{c.fix.label} →</Link>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * EVERY CARD NOT IN THE GREEN SAYS HOW TO IMPROVE IT (§6.178). When none of the money levers moves a card, it
 * gets the plain action for it instead — and the bad-year card says to check the bad year itself.
 */
/** The levers, most money first — what to do, what it is worth, which dials it moves (§6.173). */
function Levers({ planId, levers, money, agreed }: { planId: string; levers: Lever[]; money: (v: number) => string; agreed: AgreedTargets }) {
  return (
    <ol className="mt-2 list-decimal space-y-3 pl-4 text-[13px] marker:font-semibold marker:text-primary">
      {levers.map((l) => (
        <li key={l.key}>
          <span className="font-semibold">{l.label}</span>
          <span className="ml-1.5 font-semibold text-good">{leverValue(l, money)}</span>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{l.detail}</p>
          {l.moves.length > 0 && <p className="text-[12px] text-muted-foreground">Improves: {l.moves.join(", ")}</p>}
          {l.target && (agreed[l.target]
            ? <p className="text-[12px] font-semibold text-good">✓ Agreed as a target</p>
            : <Link href={`/plans/${planId}/assessment`} className="text-[12px] font-semibold text-primary hover:underline">Agree as a target →</Link>)}
        </li>
      ))}
    </ol>
  );
}

/** Now against with the levers pulled — the judged year re-scored, not estimated. */
function LeverTable({ rows, title }: { rows: WithLeversRow[]; title: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] bg-secondary/60 px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground">
        <span>{title}</span><span className="text-right">Now</span><span className="text-right">With the fixes</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-border px-3 py-1.5 text-[13px]">
          <span>{r.label}</span>
          <span className="text-right tabular-nums">{r.now}</span>
          <span className={cn("text-right font-semibold tabular-nums", r.better && "text-good")}>{r.after}</span>
        </div>
      ))}
    </div>
  );
}

function Dial({ value }: { value: number | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <div ref={ref} className="w-full max-w-[260px]">
      {width > 0 && (
        <ScoreDial width={width} value={value}
          zones={SCORE_BANDS.map((b) => ({ to: b.to, severity: TONE[b.s] }))} caption="Capability score" />
      )}
    </div>
  );
}

function Pill({ s, label }: { s: Severity; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
      s === "good" && "bg-good-soft text-good", s === "watch" && "bg-warn-soft text-warn", s === "bad" && "bg-bad-soft text-bad")}>
      <i className={cn("size-1.5 rounded-full", s === "good" && "bg-good", s === "watch" && "bg-warn", s === "bad" && "bg-bad")} />
      {label}
    </span>
  );
}

/**
 * THE PENCIL (§6.129).
 *
 * A dashboard that cannot be edited has to be able to say where the editing happens, or a grey dial is a
 * dead end. This is the whole affordance: the word for what is missing, and a link to the tab that holds the
 * box — not a dialog that writes the figure from here, because a figure entered on a dashboard is how this
 * feature went wrong the first time.
 */
function Pencil({ planId, fix }: { planId: string; fix: { label: string; to: string } }) {
  return (
    <Link href={`/plans/${planId}/${fix.to}`}
      className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary no-underline hover:underline">
      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 2.5l2 2-7.5 7.5-2.5.5.5-2.5z" />
        <path d="M2.5 14h11" />
      </svg>
      {fix.label}
    </Link>
  );
}

/**
 * ONE MEASURE.
 *
 * The dial and the numeral side by side (§6.128.3): the arc shows how far through its range the value sits
 * and which band caught it, and the numeral is what a reader actually compares between cards. Neither on its
 * own does both jobs.
 *
 * The expander is the reason a client can argue with the card. It carries the formula in the plan's own
 * terms, what the measure is actually for, and how much the app trusts the inputs — which is the sentence
 * that stops a medium-confidence estimate being read as a fact.
 */
function Gauge({ m, s }: { m: Metric; s: Severity | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  /* The last band runs to MAX_SAFE_INTEGER on some metrics; the arc is drawn to the card's own scale. */
  /* An unscored measure is context: one plain arc, no red-to-green judgement (§6.170). */
  const zones = m.unscored ? [{ to: m.max, severity: "accent" as ChartSeverity }] : m.bands.map((b) => ({ to: Math.min(b.to, m.max), severity: TONE[b.s] }));
  return (
    <div ref={ref} className="w-[112px] shrink-0">
      {width > 0 && (
        <MiniDial width={width} value={m.value} min={m.min} max={m.max} zones={zones}
          severity={s ? TONE[s] : null} label={`${m.name}: ${m.display}`} />
      )}
    </div>
  );
}

function Card({ m, planId, labels, other, move }: { m: Metric; planId: string; labels: Record<Severity, string>; other?: Comparison | null; move?: string }) {
  /* An unscored measure has no band to colour it and says what it is instead (§6.170). */
  const s = m.unscored ? null : statusOf(m.value, m.bands);
  return (
    <article className="bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-semibold leading-snug">{m.name}</h3>
        {s ? <Pill s={s} label={labels[s]} /> : <span className="eyebrow shrink-0 text-muted-foreground">{m.unscored ?? INFO_MISSING}</span>}
      </div>

      <div className="mt-1 flex items-center gap-3">
        <Gauge m={m} s={s} />
        <div className="min-w-0 flex-1">
          <div className={cn("text-[26px] font-semibold leading-none tabular-nums",
            s === "good" && "text-good", s === "watch" && "text-warn", s === "bad" && "text-bad",
            !s && "text-muted-foreground")}>{m.display}</div>
          {m.sub && <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{m.sub}</div>}
          {/* The same measure across the forecast (§6.129.2); the marked dot is the year the dial judges. */}
          {m.trend && m.trendAt !== undefined && (
            <div className="mt-1.5 flex items-center gap-2">
              <Spark values={m.trend} at={m.trendAt} severity={s ? TONE[s] : null} label={`${m.name}, ${m.trendLabel ?? ""}`} />
              <span className="text-[10.5px] text-muted-foreground">{m.trendLabel}</span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed">{m.missing ?? m.note}</p>
      {/* What would move it, from the levers the other dials point to (§6.173). */}
      {move && <p className="mt-1.5 rounded bg-accent/50 px-2.5 py-1.5 text-[12px] leading-relaxed"><b className="font-semibold">How to improve it:</b> {move}</p>}
      {other && (
        <p className={cn("mt-2 rounded px-2.5 py-1.5 text-[12px]", other.ahead ? "bg-warn-soft text-foreground" : "bg-secondary/60 text-muted-foreground")}>
          <b className="font-semibold">{other.label}:</b> {other.display}
          {other.ahead && <span className="text-warn"> — the plan is better than the business has done. What changes to make it true?</span>}
        </p>
      )}
      {m.missing
        ? m.fix && <Pencil planId={planId} fix={m.fix} />
        : <p className="mt-1 text-[11.5px] text-muted-foreground">{m.bench}
            {/* Where the range came from, one click away (§6.140). */}
            {m.rangeSet && <a href={`/plans/${planId}/settings?area=ranges`} className="ml-1.5 font-semibold text-primary hover:underline">Change</a>}</p>}

      <details className="mt-2.5 border-t border-dashed border-border pt-2">
        <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-primary marker:hidden">
          Formula and data confidence
        </summary>
        <dl className="mt-2 space-y-1.5 text-[11.5px]">
          <div><dt className="font-semibold text-muted-foreground">Formula</dt><dd>{m.formula}</dd></div>
          <div><dt className="font-semibold text-muted-foreground">What it shows</dt><dd>{m.reveals}</dd></div>
          <div><dt className="font-semibold text-muted-foreground">Data confidence</dt><dd>{m.confidence}</dd></div>
        </dl>
      </details>
    </article>
  );
}

/** The shell every picture sits in, so the three tabs cannot drift apart again. */
function Picture({ title, aside, children }: { title: string; aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">{title}</span>
        <span className="text-[11.5px] text-muted-foreground">{aside}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * GROWTH'S PICTURE: HOW SHORT, AND WHEN (§6.156).
 *
 * It was a gauge — red, amber and green bands with the worst month as a hairline. Nic, on SEQ: "a little bit
 * of red, a little bit of yellow and a lot of green AND so what?" The scale ran to three times the floor, so
 * seventy per cent of the bar was green on a plan that goes overdrawn, and the one fact that mattered — how
 * far short, and in which month — was not on it at all.
 *
 * Now the shortfall is the headline, in the plan's own money, and under it the twelve months against the
 * floor: red where a month is below it, green where it is not. The same month-by-month chart used to sit
 * further down the page; it lives here now, once.
 */
function WorstMonth({ planId, input, money, months }: {
  planId: string; input: CapabilityInput; money: (v: number) => string; months: string[];
}) {
  const Y = usePlanYears();
  const [ref, width] = useWidth<HTMLDivElement>();
  const cash = input.monthlyCash;
  const floor = input.growth.cashBuffer;
  const hasFloor = floor !== null && floor > 0;
  const bar = hasFloor ? floor : 0;
  const low = cash.length ? Math.min(...cash) : null;
  const lowAt = low === null ? -1 : cash.indexOf(low);
  const name = (i: number) => months[i] ?? `month ${i + 1}`;
  const under = cash.map((c, i) => (c < bar ? i : -1)).filter((i) => i >= 0);
  const short = low === null ? 0 : bar - low;

  return (
    <Picture title={`The worst month of ${Y.label(1)}`} aside={hasFloor ? `Dashed line: your cash floor of ${money(bar)}` : "Measured against zero — no cash floor set"}>
      {low === null ? (
        <Note>No month-by-month cash yet. Fill in your sales and costs and this will appear.</Note>
      ) : (
        <>
          <div className={cn("mt-2 rounded-md border px-4 py-3", short > 0 ? "border-bad/40 bg-bad-soft" : "border-good/40 bg-good-soft")}>
            <div className={cn("text-[26px] font-semibold leading-tight tabular-nums", short > 0 ? "text-bad" : "text-good")}>
              {short > 0
                ? (hasFloor ? <>{money(short)} <span className="text-[16px] font-medium">below your cash floor in {name(lowAt)}</span></>
                  : <>{money(-low)} overdrawn <span className="text-[16px] font-medium">in {name(lowAt)}</span></>)
                : <>{money(low - bar)} <span className="text-[16px] font-medium">{hasFloor ? "above your cash floor" : "above zero"} in the tightest month</span></>}
            </div>
            <p className="mt-1 text-[12.5px] text-foreground/80">
              {short > 0
                ? <>The bank goes to {money(low)}. {under.length} of {cash.length} months {under.length === 1 ? "is" : "are"} below {hasFloor ? "the cash floor" : "zero"}, starting in {name(under[0])}.
                    {" "}The plan has to find that cash, or arrange an overdraft.{" "}
                    <a href={`/plans/${planId}/assumptions?area=cash`} className="font-semibold text-primary hover:underline">Where to fix it</a></>
                : <>The tightest month is {name(lowAt)}, at {money(low)}. Every month of {Y.year(1)} stays above {hasFloor ? "the cash floor" : "zero"}.</>}
            </p>
          </div>
          <div ref={ref} className="mt-3" style={{ minHeight: 220 }}>
            {width > 0 && (
              <Columns width={width} height={220} categories={months.slice(0, cash.length)} values={cash}
                threshold={hasFloor ? cash.map(() => bar) : undefined}
                format={money}
                tone={(i) => (cash[i] < bar ? "bad" : "good")} />
            )}
          </div>
          {/* Without a floor the only line is zero, and the picture says so rather than drawing one nobody set. */}
          {!hasFloor && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              No cash floor has been set, so each month is only checked against zero. Most businesses need
              more of a cushion than that.
              <span className="ml-2 inline-block align-middle"><Pencil planId={planId} fix={{ label: "Set a cash floor", to: "assumptions?area=cash" }} /></span>
            </p>
          )}
        </>
      )}
    </Picture>
  );
}

/**
 * GROWTH'S PICTURE ON THE ACTUAL VIEW (§6.158). Annual accounts show the bank on one day a year, so there
 * is no worst month to draw. What they do show is how each year ended — against the floor if one is set, or
 * against zero — and how many months of overheads that cash would have covered. The page says what it
 * cannot see rather than letting a year-end balance pass for the tightest month.
 */
function YearEndCash({ planId, history, firstYear, floor, money }: {
  planId: string; history: HistoricRow[]; firstYear: number; floor: number | null; money: (v: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
  const years = [...history].filter((h) => num(h.revenue) > 0).sort((a, b) => Number(b.period_number) - Number(a.period_number));
  const bar = floor !== null && floor > 0 ? floor : 0;
  const last = years[years.length - 1];
  if (!last) return null;
  const cash = num(last.cash);
  const monthly = num(last.overheads) / 12;
  const cover = monthly > 0 ? cash / monthly : null;
  const lastYear = firstYear - Number(last.period_number);
  const short = bar - cash;
  return (
    <Picture title={`How ${lastYear} ended`} aside={bar > 0 ? `Dashed line: your cash floor of ${money(bar)}` : "Bank balance at the year end, from Historic"}>
      <div className={cn("mt-2 rounded-md border px-4 py-3", short > 0 ? "border-bad/40 bg-bad-soft" : "border-good/40 bg-good-soft")}>
        <div className={cn("text-[26px] font-semibold leading-tight tabular-nums", short > 0 ? "text-bad" : "text-good")}>
          {money(cash)} <span className="text-[16px] font-medium">in the bank at the end of {lastYear}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-foreground/80">
          {cover !== null && <>About {Math.round(cover * 10) / 10} {Math.round(cover * 10) / 10 === 1 ? "month" : "months"} of running costs. </>}
          {bar > 0 && short > 0 && <>{money(short)} below your cash floor. </>}
          The accounts only show the last day of the year, so the tightest month is not shown.
          {floor === null && <span className="ml-2 inline-block align-middle"><Pencil planId={planId} fix={{ label: "Set a cash floor", to: "assumptions?area=cash" }} /></span>}
        </p>
      </div>
      <div ref={ref} className="mt-3" style={{ minHeight: 200 }}>
        {width > 0 && years.length > 1 && (
          <Columns width={width} height={200} categories={years.map((h) => `${firstYear - Number(h.period_number)} actual`)}
            values={years.map((h) => num(h.cash))}
            threshold={bar > 0 ? years.map(() => bar) : undefined}
            format={money} tone={(i) => (num(years[i].cash) < bar ? "bad" : "good")} />
        )}
      </div>
    </Picture>
  );
}

/**
 * Borrowing's picture: what the plan already repays, what a stressed year would carry, and what the base
 * case would. No "wanted" mark any more — there is no loan being typed, so there is nothing to want (§6.129).
 */
function BorrowingRoom({ planId, input, money }: {
  planId: string; input: CapabilityInput; money: (v: number) => string;
}) {
  const cf1 = input.cashFlow[1];
  /* Before interest already (§6.158) — the forecast keeps interest under financing. */
  const base = cf1 ? cf1.netOperating : null;
  const stressed = stressedCash(input);
  const service = input.debtService[1] ?? 0;
  const coc = input.growth.costOfCapital;
  const capBase = base === null || coc === null ? null : borrowingCapacity(base, service, coc, CAPACITY_TERM_YEARS, LENDER_MIN_DSCR);
  const capStress = stressed === null || coc === null ? null : borrowingCapacity(stressed, service, coc, CAPACITY_TERM_YEARS, LENDER_MIN_DSCR);
  const top = Math.max(capBase ?? 0, 1) * 1.25;

  return (
    <Picture title="How much more the business could borrow"
      aside={coc === null ? "Needs an interest rate to work it out" : `Keeping loan payments covered ${LENDER_MIN_DSCR}×, at ${coc}% over ${CAPACITY_TERM_YEARS} years`}>
      {base === null ? (
        <Note>There is no plan yet, so there is nothing to lend against. Fill in your sales and costs first.</Note>
      ) : coc === null ? (
        <>
          <Note>This needs an interest rate. Set what your money costs and this will appear.</Note>
          <Pencil planId={planId} fix={{ label: "Set what your money costs", to: "assumptions?area=cash" }} />
        </>
      ) : capStress === null ? (
        <>
          <Note>
            {(capBase ?? 0) > 0
              ? <>In a normal year the business could borrow about {money(capBase ?? 0)} more. What matters is what a BAD year could support — set up a bad year to see it.</>
              : <>Even a normal year leaves no room to borrow more — the loans the business already has use it all up. Set up a bad year to see how far short it falls.</>}
          </Note>
          <Pencil planId={planId} fix={{ label: "Set up a bad year", to: "assumptions?area=downside" }} />
        </>
      ) : (
        <>
          <RangeBar
            min={0} max={top}
            zones={[
              { from: 0, to: Math.max(capStress, 0), severity: "good" },
              { from: Math.max(capStress, 0), to: capBase ?? 0, severity: "warn" },
              { from: capBase ?? 0, to: top, severity: "bad" },
            ]}
            marks={[
              { at: Math.max(capStress, 0), label: `Bad year ${money(Math.max(capStress, 0))}`, below: true },
              { at: capBase ?? 0, label: `Normal year ${money(capBase ?? 0)}`, below: true },
            ]}
            ticks={[0, top / 2, top]} format={(t) => money(t)}
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            {service > 0
              ? <>Already paying <b className="font-semibold text-foreground">{money(service)}</b> a year on loans. This is extra room on top of that.</>
              : <>The plan has no loans yet, so all of this is room.</>}
            {" "}Borrow what a bad year can carry, not what a good year allows.
          </p>
        </>
      )}
    </Picture>
  );
}

/**
 * Selling's picture (§6.128.3): "5.2× is above your range" is a sentence a client can disagree with; the
 * same fact as a band with their asking price standing outside it is one they can see. Built from the
 * multiples and the price in Plan settings, against the earnings their own forecast produced.
 */
function ValuationRange({ planId, metrics, input, money, names }: {
  planId: string; metrics: Metric[]; input: CapabilityInput; money: (v: number) => string; names: YearNames;
}) {
  /* The year the sale is aimed at, or Year 1 until one is chosen (§6.135) — the same year the dial uses. */
  const sale = input.sale;
  const sy = saleYear(sale);
  const ys = input.pnl[sy];
  const e = ys ? ys.operatingProfit + ys.depreciation + (sale.addBacks ?? 0) : null;
  const ranged = sale.multipleLow !== null && sale.multipleHigh !== null;
  const price = sale.askingPrice ?? 0;

  if (e === null || e <= 0) {
    return (
      <Picture title="What the profit is worth to a buyer" aside={`${names[sy] ?? `Year ${sy}`} profit (after add-backs) × what similar businesses sold for`}>
        <Note>{ys
          ? `${names[sy] ?? `Year ${sy}`} makes no profit, so there is nothing to base a price on. The price cannot be judged until the business makes money.`
          : "No plan yet, so there is nothing to value."}</Note>
      </Picture>
    );
  }

  if (!ranged) {
    return (
      <Picture title="What the profit is worth to a buyer" aside={`${money(e)} of ${names[sy] ?? `Year ${sy}`} profit (after add-backs)`}>
        <Note>This needs a low and a high figure — what businesses like this one have actually sold for.</Note>
        <Pencil planId={planId} fix={{ label: "Add what similar businesses sold for", to: "settings?area=exit" }} />
      </Picture>
    );
  }

  const lowV = e * (sale.multipleLow ?? 0), highV = e * (sale.multipleHigh ?? 0);
  const top = Math.max(highV, price) * 1.2;
  const mult = metrics.find((x) => x.key === "priceMultiple")?.value ?? null;

  return (
    <Picture title="What the profit is worth to a buyer"
      aside={`${money(e)} of ${names[sy] ?? `Year ${sy}`} profit (after add-backs), at ${sale.multipleLow}× to ${sale.multipleHigh}×`}>
      <RangeBar
        min={0} max={top}
        zones={[{ from: lowV, to: highV, severity: "good" }, { from: highV, to: top, severity: "bad" }]}
        marks={[
          { at: (lowV + highV) / 2, label: `Middle ${money((lowV + highV) / 2)}`, below: true },
          ...(price > 0
            ? [{ at: Math.min(price, top), label: `Asking ${money(price)}`,
                 tone: price > highV ? ("bad" as const) : undefined }]
            : []),
        ]}
        ticks={[0, top / 2, top]} format={(t) => money(t)}
      />
      {price === 0 && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          No asking price has been set, so there is nothing to compare.
          <span className="ml-2 inline-block align-middle"><Pencil planId={planId} fix={{ label: "Set the asking price", to: "settings?area=exit" }} /></span>
        </p>
      )}
      {price > highV && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          <b className="font-semibold text-foreground">{money(price - highV)}</b> above the most similar businesses sold for
          {mult ? ` — ${mult}× profit, when the top of the range is ${sale.multipleHigh}×` : ""}.
        </p>
      )}
      {/* A searched range says so (§6.130): the dial weighing 3 should never rest on a figure of unknown origin. */}
      {sale.multipleFound && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Range taken from {sale.multipleFound.sources} published sources
          {sale.multipleFound.wider ? " in the wider industry or nearby markets" : ""}, found{" "}
          {new Date(`${sale.multipleFound.on}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
          {sale.multipleFound.converted
            ? `, ${sale.multipleFound.converted.count} converted from owner earnings at ×${sale.multipleFound.converted.factor}` : ""}.
        </p>
      )}
    </Picture>
  );
}

/* ------------------------------------------------------------------ *
 * The panels (§6.129.2)                                               *
 * ------------------------------------------------------------------ */

/**
 * ONE PANEL. Title, one line saying what it shows, and the picture — the same furniture on all three tabs,
 * so the tabs cannot drift apart again the way they did in §6.128.3–5. `wide` spans both columns and is for
 * the one panel on a tab whose categories need the room (twelve months).
 */
function Panel({ title, sub, wide, height, children }: {
  title: string; sub?: React.ReactNode; wide?: boolean;
  /**
   * Reserved before the width is measured, so a CHART does not make the page jump when it appears. Given only
   * by chart panels: a list of bars sizes itself, and a reserved 220px under four short rows left a blank
   * slab the height of the rows again beneath the debtor ageing (§6.129.3).
   */
  height?: number;
  children: React.ReactNode | ((width: number) => React.ReactNode);
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <section className={cn("min-w-0 bg-card px-5 py-4", wide && "@[860px]:col-span-2")}>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {sub && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>}
      <div ref={ref} className="mt-2.5" style={typeof children === "function" && height ? { minHeight: height } : undefined}>
        {typeof children === "function" ? (width > 0 && children(width)) : children}
      </div>
    </section>
  );
}

/** A panel with nothing to draw says what would draw it, and points there when a box would (§6.87). */
function Empty({ children, planId, fix }: { children: React.ReactNode; planId: string; fix?: { label: string; to: string } }) {
  return (
    <div className="rounded border border-dashed border-border bg-secondary/30 px-4 py-5 text-[12.5px] text-muted-foreground">
      {children}
      {fix && <div><Pencil planId={planId} fix={fix} /></div>}
    </div>
  );
}

const pctFmt = (v: number) => `${Math.round(v * 10) / 10}%`;
/** Plan years by name (§6.157): [2, 3, 4, 5] → "2028, 2029, 2030 and 2031". */
const yearsIn = (ys: number[], year: (y: number) => number) => ys.length === 1 ? String(year(ys[0])) : `${ys.slice(0, -1).map(year).join(", ")} and ${year(ys[ys.length - 1])}`;
const timesFmt = (v: number) => `${Math.round(v * 100) / 100}×`;

function GrowPanels({ P, input, money, planId, extras }: {
  P: Panels; input: CapabilityInput; money: (v: number) => string; planId: string; extras: ExtraFacts;
}) {
  const Y = usePlanYears();
  const growth = [...P.byProduct].filter((p) => p.change !== 0).sort((a, b) => b.change - a.change);
  const margins = [...P.byProduct].filter((p) => p.margin !== null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));

  return (
    <>
      <Panel height={220} title="How long cash is tied up, year by year" sub="Days of stock + days to get paid − days to pay suppliers, from Assumptions">
        {P.has
          ? (w) => (
            <Lines width={w} height={220} categories={P.cycle.categories} format={(v) => `${Math.round(v)} days`}
              series={[
                { label: "Days cash is tied up", values: P.cycle.cycle },
                { label: "Days to get paid", values: P.cycle.debtor },
                { label: "Days of stock", values: P.cycle.stock },
                { label: "Days to pay suppliers", values: P.cycle.creditor },
              ]} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel height={220} title="Keeping equipment going, and growing"
        sub={P.capex.runDown.length
          ? <>Spending below depreciation in {yearsIn(P.capex.runDown, Y.year)} — equipment is wearing out faster than it is being replaced.</>
          : <>Depreciation shows what it costs to keep equipment going. Spending above that is growth.</>}>
        {P.has
          ? (w) => (
            <Lines width={w} height={220} categories={P.capex.categories} format={money}
              series={[
                { label: "Keeping equipment going (depreciation)", values: P.capex.maintenance },
                { label: "Spending on growth (above that)", values: P.capex.growth },
              ]} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel title={`Where ${Y.year(2)}'s growth comes from`} sub={`Change in sales, ${Y.year(1)} to ${Y.year(2)}, by product — from the plan, because the accounts do not split sales by product`}>
        {growth.length
          ? (w) => <BarRows width={w} format={money}
              rows={growth.map((p) => ({ label: p.name, value: p.change, tone: p.change < 0 ? "bad" : "accent" }))} />
          : <Empty planId={planId} fix={{ label: "Add products", to: "sales" }}>No product changes between {Y.year(1)} and {Y.year(2)}.</Empty>}
      </Panel>

      <Panel title="Can the business deliver it?"
        sub="Room to do more work, people, quoted work, customers kept. Growth stops at whichever runs out first.">
        <LineList lines={executionLines(extras, input)} planId={planId} meters />
      </Panel>

      <Panel title={`Gross margin by product, ${Y.year(1)}`}
        /*
         * TWO AVERAGES ON ONE TAB, AND THE SENTENCE SAYS WHICH IS WHICH (§6.41). The incremental-margin card
         * reads the forecast's gross margin, which carries fixed cost of sales; this is per product, direct
         * cost only. SEQ showed 39.4% on the card and 41.5% here, and without the explanation that reads as
         * the app disagreeing with itself.
         */
        sub={P.avgMargin !== null
          ? <>Direct cost only. Across all products that averages {pctFmt(P.avgMargin)} — higher than the forecast&apos;s gross margin because fixed cost of sales is not in it. A line below the average makes it worse every time it grows.</>
          : undefined}>
        {margins.length
          ? (w) => <BarRows width={w} format={pctFmt}
              rows={margins.map((p) => ({
                label: p.name, value: p.margin ?? 0,
                tone: (p.margin ?? 0) < 0 ? "bad" : P.avgMargin !== null && (p.margin ?? 0) < P.avgMargin ? "warn" : "good",
              }))} />
          : <Empty planId={planId} fix={{ label: "Add products and their costs", to: "cogs" }}>No products with revenue in {Y.year(1)}.</Empty>}
      </Panel>
    </>
  );
}

function BorrowPanels({ P, facilities, openingDebt, money, planId, extras, input, metrics }: {
  P: Panels; facilities: FacilityFacts[]; openingDebt: number; money: (v: number) => string; planId: string;
  extras: ExtraFacts; input: CapabilityInput; metrics: Metric[];
}) {
  const ageing = ageingView(extras);
  const hasCover = P.cover.base.some((v) => v !== null);
  const hasStress = P.cover.stressed.some((v) => v !== null);
  return (
    <>
      <Panel height={220} title="Can the loans be paid, over five years?"
        sub={hasStress
          ? <>Cash from trading compared with loan payments each year, in the plan and in the bad year you set up. The chart stops at 4× — an open circle means higher; hover to see the figure.</>
          : <>Cash from trading compared with loan payments each year. The chart stops at 4× — an open circle means higher. Set up a bad year on Assumptions to see it here too.</>}>
        {hasCover
          ? (w) => (
            <Lines width={w} height={220} categories={P.cover.categories} format={timesFmt}
              reference={{ value: P.cover.minimum, label: `Lenders want at least ${P.cover.minimum}×` }}
              /* Above 4× the exact multiple stops mattering to a lender; the minimum line is what must be visible. */
              ceiling={4}
              series={[
                { label: "As planned", values: P.cover.base },
                ...(hasStress ? [{ label: "In a bad year", values: P.cover.stressed }] : []),
              ]} />
          )
          : <Empty planId={planId} fix={{ label: "Add the borrowing", to: "funding" }}>The plan has no loans, so there is nothing to show.</Empty>}
      </Panel>

      <Panel height={220} title="Cash from trading and loan payments" sub="Each year's cash from trading, with the loan payments marked across it">
        {P.has
          ? (w) => (
            <Columns width={w} height={220} categories={P.service.categories} values={P.service.available}
              threshold={P.service.repayments.map((r) => (r > 0 ? r : null))} thresholdLabel="Repayments"
              format={money} tone={(i) => (P.service.available[i] < P.service.repayments[i] ? "bad" : "accent")} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel title="How late are customers paying?"
        sub={ageing.state === "ready"
          ? <>{ageing.overduePct}% of unpaid invoices are past their due date.{ageing.gap !== null && Math.abs(ageing.gap) >= 1 ? <> The split is {money(Math.abs(ageing.gap))} {ageing.gap > 0 ? "short of" : "over"} the unpaid invoices figure it should add up to.</> : null}</>
          : <>Last year&apos;s unpaid invoices, split by how late each one is.</>}>
        {ageing.state === "new"
          ? <Empty planId={planId}>A new business has no invoices yet. This fills in after a year of trading.</Empty>
          : ageing.state === "missing"
            ? <Empty planId={planId} fix={ageing.fix}>The balance sheet shows unpaid invoices as one number. A lender wants to see how late they are.</Empty>
            : (w) => <BarRows width={w} format={money} labelShare={0.42}
                rows={ageing.buckets.map((b) => ({ label: b.label, value: b.value, tone: b.value > 0 ? TONE[b.tone] : undefined }))} />}
      </Panel>

      <Panel title="What a lender checks besides the numbers"
        sub="Questions a lender asks that the numbers cannot answer. A grey line is not a pass — it just has not been answered yet.">
        <LineList lines={lenderChecklist(extras, input, metrics)} planId={planId} />
      </Panel>

      {/*
        WHAT REPLACED "PROPOSED FACILITY" (§6.129). The dashboard this was modelled on opened the borrowing tab
        with the loan being asked for. That loan was typed into a dashboard and thrown away; what is shown
        instead is what the plan actually owes, read from the Funding rows the forecast repays.
      */}
      <Panel wide title="Loans in the plan" sub="From the Funding step — the same loans the plan pays back">
        {facilities.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[.05em] text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Loan</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Borrowed</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Limit</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Not yet used</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Rate</th>
                  <th className="py-1.5 text-right font-semibold">Term</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((f, idx) => (
                  <tr key={f.name + idx} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-3">{f.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(f.drawn)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(f.facility)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.facility > f.drawn ? money(f.facility - f.drawn) : "—"}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{f.ratePct ? `${f.ratePct}%` : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{f.termMonths ? `${Math.round((f.termMonths / 12) * 10) / 10} years` : "—"}</td>
                  </tr>
                ))}
                {/*
                  THE DEBT THAT IS NOT A FUNDING ROW (§6.129.2). SEQ listed 45,000 of loans here while the
                  loan-to-value card, one scroll up, said 225,001 of debt. Both were right: the rest is bank
                  debt on the last balance sheet, which the forecast repays but Funding does not itemise.
                  Without this row the panel and the card read as the app disagreeing with itself.
                */}
                {openingDebt > 0 && (
                  <tr className="border-b border-border text-muted-foreground last:border-b-0">
                    <td className="py-1.5 pr-3">Carried over from the last balance sheet</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(openingDebt)}</td>
                    <td className="py-1.5 pr-3 text-right">—</td>
                    <td className="py-1.5 pr-3 text-right">—</td>
                    <td className="py-1.5 pr-3 text-right">—</td>
                    <td className="py-1.5 text-right">—</td>
                  </tr>
                )}
              </tbody>
            </table>
            {openingDebt > 0 && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                The last line is bank debt from the Historic balance sheet. Its rate could not be worked out from
                last year&apos;s interest, so the forecast holds it flat — add the rate on Funding, under
                &ldquo;Loans already owed&rdquo;, and every figure on this tab becomes exact.
              </p>
            )}
          </div>
        ) : openingDebt > 0 ? (
          <Empty planId={planId} fix={{ label: "Add its rate on Funding", to: "funding" }}>
            {money(openingDebt)} of bank loans from the last balance sheet, with no interest rate yet — so the plan cannot work out the payments.
          </Empty>
        ) : (
          <Empty planId={planId} fix={{ label: "Add the borrowing", to: "funding" }}>No loans in the plan.</Empty>
        )}
      </Panel>
    </>
  );
}

function SellPanels({ P, metrics, input, money, planId, extras }: {
  P: Panels; metrics: Metric[]; input: CapabilityInput; money: (v: number) => string; planId: string; extras: ExtraFacts;
}) {
  const Y = usePlanYears();
  const conc = concentration(extras, new Date());
  const bridge = earningsBridge(extras, input);
  const unscored = P.transfer.filter((t) => t.score === null).length;
  const shares = [...P.byProduct].filter((p) => p.share !== null && p.share > 0).sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  const questions = buyerQuestions(metrics, {
    money, addBacks: input.sale.addBacks,
    transfer: P.transfer.map((t) => ({ key: t.key, label: t.label, score: t.score })),
    knowsCustomers: conc.rows.length > 0,
    customers: conc.rows.map((c) => ({ name: c.name, share: c.share, assignable: c.assignable, endsWithinYear: c.endsWithinYear })),
  });
  return (
    <>
      <Panel height={220} title="Sales over five years"
        sub={P.revenue.lossYears.length
          ? <>Red shows a year the business makes a loss: {yearsIn(P.revenue.lossYears, Y.year)}.</>
          : <>What a buyer would be shown, from the plan.</>}>
        {P.has
          ? (w) => <Columns width={w} height={220} categories={P.revenue.categories} values={P.revenue.values} format={money}
              tone={(i) => (P.revenue.lossYears.includes(i + 1) ? "bad" : "accent")} />
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel height={220} title="Margins over five years" sub="Gross margin, and the profit margin a buyer bases a price on (after your add-backs)">
        {P.has
          ? (w) => (
            <Lines width={w} height={220} categories={P.margins.categories} format={pctFmt}
              series={[
                { label: "Gross margin", values: P.margins.gross },
                { label: "Profit margin after add-backs", values: P.margins.normalised },
              ]} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel title="Would it keep running under a new owner?"
        sub={unscored ? <>{TRANSFER_TOTAL - unscored} of {TRANSFER_TOTAL} scored on Leadership Team → Risk &amp; Succession.</> : <>1 is weak and 5 is strong, scored on Leadership Team → Risk &amp; Succession.</>}>
        {(w) => (
          <>
            <BarRows width={w} format={(v) => `${v} / 5`} labelShare={0.5}
              rows={P.transfer.map((t) => ({
                label: t.label, value: t.score ?? 0,
                display: t.score === null ? "Not scored" : undefined,
                tone: t.score === null ? undefined : t.score <= 2 ? "bad" : t.score === 3 ? "warn" : "good",
              }))} />
            {unscored > 0 && <Pencil planId={planId} fix={{ label: "Score the rest", to: "people?area=risk" }} />}
          </>
        )}
      </Panel>

      <Panel title={`Revenue by product, ${Y.year(1)}`}
        sub="By product, not customer — the panel beside this shows who buys. A buyer asks about both.">
        {shares.length
          ? (w) => <BarRows width={w} format={pctFmt}
              rows={shares.map((p) => ({ label: p.name, value: p.share ?? 0, tone: (p.share ?? 0) > 60 ? "bad" : (p.share ?? 0) > 35 ? "warn" : "accent" }))} />
          : <Empty planId={planId} fix={{ label: "Add products", to: "sales" }}>No products with revenue in {Y.year(1)}.</Empty>}
      </Panel>

      <Panel title="Who the customers are"
        sub={conc.rows.length
          ? <>{conc.topShare !== null ? <>The biggest is {conc.topShare}% of sales{conc.listedShare !== null && conc.rows.length > 1 ? <>; the {conc.rows.length} listed are {conc.listedShare}% together</> : null}.</> : <>No shares given yet.</>}
              {conc.notAssignable ? <> {conc.notAssignable} contract{conc.notAssignable === 1 ? "" : "s"} would end if the business is sold.</> : null}
              {conc.unchecked ? <> {conc.unchecked} not checked yet for whether they pass to a new owner.</> : null}</>
          : <>The first thing a buyer asks: who the customers are, and how much of the business each one is.</>}>
        {conc.rows.length
          ? (w) => (
            <>
              <BarRows width={w} format={pctFmt} labelShare={0.36}
                rows={conc.rows.map((c) => ({
                  label: c.name, value: c.share ?? 0,
                  display: [c.share === null ? "Share not given" : pctFmt(c.share),
                    c.endsWithinYear ? "ends within a year" : null,
                    c.assignable === false ? "ends on a sale" : c.assignable === null ? "not checked" : null].filter(Boolean).join(" · "),
                  tone: c.share === null ? undefined : c.share > 20 ? "bad" : c.share > 15 ? "warn" : "accent",
                }))} />
              <Pencil planId={planId} fix={{ label: "Edit the customers", to: "marketing?area=market" }} />
            </>
          )
          : <Empty planId={planId} fix={{ label: "Add the biggest customers", to: "marketing?area=market" }}>
              No customers entered yet. Add up to five, with each one&apos;s share of sales.
            </Empty>}
      </Panel>

      <Panel title="From profit in the accounts to profit after add-backs"
        sub="What the accounts show, each add-back a buyer's accountant will check, and the profit a price is based on.">
        {!bridge
          ? <Empty planId={planId}>Needs a {Y.year(saleYear(input.sale))} forecast.</Empty>
          : (w) => (
            <>
              <BarRows width={w} format={money} labelShare={0.45}
                rows={[
                  /* §6.115.1: a loss is said in words, never left to a minus sign in front of the figure. */
                  { label: `Profit in the accounts (EBITDA), ${Y.year(saleYear(input.sale))}`, value: bridge.reported, tone: bridge.reported < 0 ? "bad" : "accent",
                    display: bridge.reported < 0 ? `${money(Math.abs(bridge.reported))} loss` : undefined },
                  ...bridge.adds.map((a) => ({ label: `+ ${a.label}`, value: a.amount, tone: "good" as const })),
                  { label: "Profit after add-backs", value: bridge.normalised, tone: bridge.normalised < 0 ? "bad" : "accent",
                    display: bridge.normalised < 0 ? `${money(Math.abs(bridge.normalised))} loss` : undefined },
                ]} />
              {!bridge.adds.length && <Pencil planId={planId} fix={{ label: "List the add-backs", to: "settings?area=exit" }} />}
            </>
          )}
      </Panel>

      <Panel wide title="Questions a buyer will ask"
        sub="Based on this plan's weak spots. Have an answer to each one before the first meeting.">
        {questions.length ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed marker:font-semibold marker:text-primary">
            {questions.map((q, idx) => <li key={idx}>{q}</li>)}
          </ol>
        ) : (
          <Empty planId={planId}>Nothing on this tab raises a question a buyer would start with.</Empty>
        )}
      </Panel>
    </>
  );
}

/* Counted from the list, not written down: the list is the fact (§6.41). */
const TRANSFER_TOTAL = TRANSFER_FACTORS.length;

/**
 * A CHECKLIST, OR A SET OF METERS (§6.129.3).
 *
 * The same row either way: a label, a reading, one sentence, and — when nobody has answered it — a pencil
 * to the box that would. An unanswered line is drawn greyed with a hollow marker, never with a status: a
 * checklist item nobody has checked is not a pass, and drawing it neutral-but-solid would read as one.
 */
function LineList({ lines, planId, meters }: { lines: Line[]; planId: string; meters?: boolean }) {
  const DOT: Record<Severity, string> = { good: "bg-good", watch: "bg-warn", bad: "bg-bad" };
  const TXT: Record<Severity, string> = { good: "text-good", watch: "text-warn", bad: "text-bad" };
  return (
    <ul className="space-y-3">
      {lines.map((l, idx) => (
        <li key={l.label + idx} className={cn(l.status === null && "opacity-70")}>
          <div className="flex items-baseline gap-2.5">
            {!meters && (
              <i className={cn("mt-[3px] inline-block size-2.5 shrink-0 rounded-full",
                l.status ? DOT[l.status] : "border border-dashed border-muted-foreground")} />
            )}
            <span className="min-w-0 flex-1 text-[12.5px] font-medium">{l.label}</span>
            <span className={cn("shrink-0 text-[12.5px] font-semibold tabular-nums", l.status ? TXT[l.status] : "text-muted-foreground")}>{l.display}</span>
          </div>
          {meters && (
            <Meter pct={l.pct} severity={l.status === "good" ? "good" : l.status === "watch" ? "warn" : l.status === "bad" ? "bad" : "accent"} label={`${l.label}: ${l.display}`} />
          )}
          {l.detail && <p className={cn("mt-0.5 text-[11.5px] text-muted-foreground", !meters && "pl-5")}>{l.detail}</p>}
          {l.fix && <div className={cn(!meters && "pl-5")}><Pencil planId={planId} fix={l.fix} /></div>}
        </li>
      ))}
    </ul>
  );
}
