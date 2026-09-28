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
  SCORE_BANDS, CARD_LABEL, DIAL_LABEL, borrowingCapacity, statusOf,
  type CapabilityInput, type Metric, type Severity,
} from "@/engine/capability/model";
import { LENDER_MIN_DSCR, TRANSFER_FACTORS, saleYear } from "@/engine/capability/judgements";
import { BORROW_WEIGHTS, CAPACITY_TERM_YEARS, stressedCash } from "@/engine/capability/borrow";
import { SELL_WEIGHTS } from "@/engine/capability/sell";
import { buyerQuestions, verdict } from "@/engine/capability/verdict";
import { panels as buildPanels, type FacilityFacts, type Panels, type ProductFacts } from "@/engine/capability/series";
import { ageingView, concentration, earningsBridge, executionLines, lenderChecklist, type ExtraFacts, type Line } from "@/engine/capability/extras";
import { Meter } from "@/components/chart/core";
import { borrowSummary, growSummary, sellSummary, type SummaryFacts } from "@/engine/capability/summary";
import { buildView } from "@/engine/capability/views";
import { capabilityTimeline, readiness, type MonthsByYear, type TimelineYear } from "@/engine/capability/timeline";
import { capabilityViews, compareWith, type Comparison, type HistoricRow, type YearNames } from "@/engine/capability/actual";

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
export function CapabilitiesModule({ planId, mode, currency, facts, products, facilities, months, openingDebt, extras, history = [], firstYear, adviser = false, monthsByYear = {} }: {
  planId: string; mode: "guided" | "advanced"; currency: string; facts: PlanFacts;
  /** Historic, every period, for the actual view (§6.158). Empty for a business with no accounts. */
  history?: HistoricRow[];
  /** The year Year 1 ends in — to name the plan's years and the last actual one. */
  firstYear: number;
  /** A coach, consultant or firm: the summary box is written to them, about the owner (§6.160). */
  adviser?: boolean;
  /** Every plan year month by month, for when-it-is-ready (§6.166). */
  monthsByYear?: MonthsByYear;
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
  const money = useMemo(() => moneyFormatter(currency), [currency]);

  /* The plan's own input, unchanged — the pictures and panels that chart the plan's five years read this. */
  const input: CapabilityInput = useMemo(() => ({ ...facts, money }), [facts, money]);

  /*
   * ACTUAL AND PLAN (§6.158). Nic: "If the plan has historical information then I want the last two
   * historic financial years as the financial capabilities." The page opens on the accounts; the plan is the
   * second view, and its growth is measured from the last actual year into the first plan year. A business
   * with no accounts has only the plan.
   */
  const views = useMemo(() => capabilityViews(facts, history, firstYear), [facts, history, firstYear]);
  const [view, setView] = useState<View>(views.hasHistory ? "actual" : "plan");
  const actualV = useMemo(() => (views.actual ? buildView(views.actual, money, views.actual.last) : null), [views, money]);
  const planV = useMemo(() => buildView(views.plan, money, null), [views, money]);
  const V = view === "actual" && actualV ? actualV : planV;
  /* Each plan year scored on its own: the year each capability arrives (§6.166). */
  const line = useMemo(() => capabilityTimeline(facts, views, monthsByYear, firstYear, money), [facts, views, monthsByYear, firstYear, money]);
  const onActual = view === "actual" && !!actualV;

  const { grow, borrow, sell } = V;
  const waiting = tab === "grow" ? V.waiting : 0;
  /* The plan's own five years, charted under their names (§6.157). */
  const P = useMemo(() => buildPanels(input, products, [1, 2, 3, 4, 5].map((y) => String(firstYear + y - 1))), [input, products, firstYear]);
  const growScore = V.scores.grow, borrowScore = V.scores.borrow, sellScore = V.scores.sell;

  const WEIGHTS = { grow: V.growWeights, borrow: BORROW_WEIGHTS, sell: SELL_WEIGHTS }[tab];
  const metrics = { grow, borrow, sell }[tab];
  const s = V.scores[tab];
  const raw = verdict(tab, metrics, WEIGHTS, s.value);
  /* The headline speaks about what happened on the actual view, and about what is planned on the plan view. */
  const PAST: Record<string, string> = {
    "The growth plan does not fund itself": "Growth so far has not paid for itself",
    "Worth doing, but it will be tight on cash": "Growing, but tight on cash",
    "The growth stands up": "The growth so far stands up",
  };
  const past = (t: string) => t.replace(/\bin the plan\b/g, "in the business").replace(/\bthe plan\b/g, "the business");
  const v = onActual
    ? { ...raw, headline: PAST[raw.headline] ?? raw.headline, actions: raw.actions.map(past), paragraphs: raw.paragraphs.map((p) => ({ ...p, body: past(p.body) })) }
    : raw;
  const band = s.value === null ? null : statusOf(s.value, SCORE_BANDS);
  const span = onActual ? views.actual!.span : views.plan.span;

  /*
   * THREE LINES FOR THE PERSON IN THE ROOM (§6.160): what happened, what the plan asks, what to talk about
   * first. Both views at once, whichever is showing — it is the gap between them that the conversation is about.
   */
  const summary = useMemo(() => {
    const f: SummaryFacts = {
      adviser, money,
      actual: views.actual && actualV ? { growIn: actualV.growIn, posIn: actualV.posIn, year: views.actual.last.year, grow: actualV.grow, borrow: actualV.borrow } : null,
      plan: { input, firstYear, grow: planV.grow, borrow: planV.borrow, monthNames: months },
    };
    return { grow: growSummary, borrow: borrowSummary, sell: sellSummary }[tab](f);
  }, [adviser, money, views, actualV, planV, input, firstYear, months, tab]);

  /* The same card on the other view (§6.159): the track record on the plan, the plan on the accounts. */
  const otherV = actualV ? (onActual ? planV : actualV) : null;
  const otherLabel = !views.actual ? ""
    : onActual ? (tab === "grow" ? `The plan, ${views.plan.span.replace(" onward", "")}` : `The plan, ${firstYear}`)
    : (tab === "grow" ? `Track record, ${views.actual.span}` : `Actual, ${views.actual.last.year}`);
  const otherOf = (m: Metric): Comparison | null => {
    if (!otherV) return null;
    return compareWith(m, otherV[tab].find((x) => x.key === m.key), otherLabel, !onActual);
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
        <p>Every figure here is read from your plan — the same forecast run behind your Profit &amp; Loss, your dashboard and your report. If a number looks wrong, it is wrong on those screens too, and the fix is in the step that owns it.</p>
        <h3>A grey dial is a question, not a bad score</h3>
        <p>Some measures need a judgement the forecast cannot make: how low you will let cash go, what your money costs, what you would want for the business, whether it would run without you. Those live on the steps that own them, and a measure waiting on one shows greyed with a <b>pencil</b> that takes you straight to the box.</p>
        <h3>The score</h3>
        <p>Each measure is judged against its band and the judgements are averaged, weighted by how much each matters to the question. <b>A measure the plan cannot answer is left out rather than scored nought</b> — so an unfinished plan gets a score from what it does hold, and the tab says how many measures that was.</p>
        <h3>Where the bands come from</h3>
        <p>They start as general small-business ranges, not your industry&apos;s. A concreter, a café and a software business do not share a sensible cash cycle. If you know what good looks like in this industry, set the ranges for this plan in <a className="font-semibold text-primary hover:underline" href={`/plans/${planId}/settings?area=ranges`}>Plan settings → Capability ranges</a>; the benchmark line on each card says which it is using.</p>
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
          <dt className="font-semibold text-muted-foreground">What the plan asks</dt><dd>{summary.asks}</dd>
          <dt className="font-semibold text-muted-foreground">{adviser ? "Talk about first" : "Start with"}</dt><dd className="font-semibold">{summary.talk}</dd>
        </dl>
      </section>

      {!onActual && line.length > 1 && <WhenReady line={line} tab={tab} onTab={setTab} />}

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
              : s.covered === s.total ? `From ${s.total} measures` : `From the ${s.covered} of ${s.total} measures ${onActual ? "the accounts" : "this plan"} can answer`}
            {s.value !== null && waiting > 0 && ` — ${waiting} more ${waiting === 1 ? "applies" : "apply"} once the business makes a profit`}
          </p>
        </div>

        <div className="border-b border-border px-5 py-5 @[1100px]:border-b-0">
          <p className="text-[13px] text-muted-foreground">{v.question}</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight">{v.headline}</h2>
          <div className="mt-3 space-y-2">
            {v.paragraphs.map((p, i) => (
              <p key={i} className="text-[13.5px] leading-relaxed">
                <b className="font-semibold">{p.lead}</b> {p.body}
              </p>
            ))}
          </div>
        </div>

        <aside className="px-5 py-5 @[720px]:col-span-2 @[1100px]:col-span-1 @[1100px]:border-l @[1100px]:border-border">
          <span className="eyebrow">What to do next, in order</span>
          {v.actions.length ? (
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
              Held under 50 by <b className="font-semibold text-foreground">
                {s.capped.map((k) => metrics.find((m) => m.key === k)?.name ?? k).join(" and ")}
              </b>. A measure this decisive cannot be averaged out by the ones that are going well.
            </p>
          )}
        </aside>
      </section>
      </div>

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
          {metrics.map((m) => <Card key={m.key} m={m} planId={planId} labels={CARD_LABEL[tab]} other={otherOf(m)} />)}
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
          These cards read your accounts only. The five-year charts — cash month by month, the cash cycle, where
          the growth comes from — are on the <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setView("plan")}>Plan view</button>.
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
        <span className="text-[12px] text-muted-foreground">Each year scored on its own. Ready means over 70. Sell is read as if the business were sold that year.</span>
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
  const zones = m.bands.map((b) => ({ to: Math.min(b.to, m.max), severity: TONE[b.s] }));
  return (
    <div ref={ref} className="w-[112px] shrink-0">
      {width > 0 && (
        <MiniDial width={width} value={m.value} min={m.min} max={m.max} zones={zones}
          severity={s ? TONE[s] : null} label={`${m.name}: ${m.display}`} />
      )}
    </div>
  );
}

function Card({ m, planId, labels, other }: { m: Metric; planId: string; labels: Record<Severity, string>; other?: Comparison | null }) {
  const s = statusOf(m.value, m.bands);
  return (
    <article className="bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-semibold leading-snug">{m.name}</h3>
        {s ? <Pill s={s} label={labels[s]} /> : <span className="eyebrow shrink-0 text-muted-foreground">{m.unscored ?? "Not yet"}</span>}
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
    <Picture title={`The worst month of ${Y.label(1)}`} aside={hasFloor ? `Dashed line: your floor of ${money(bar)}` : "Against zero — no floor set"}>
      {low === null ? (
        <Note>No monthly cash forecast yet. Fill in your sales and costs and this draws itself.</Note>
      ) : (
        <>
          <div className={cn("mt-2 rounded-md border px-4 py-3", short > 0 ? "border-bad/40 bg-bad-soft" : "border-good/40 bg-good-soft")}>
            <div className={cn("text-[26px] font-semibold leading-tight tabular-nums", short > 0 ? "text-bad" : "text-good")}>
              {short > 0
                ? (hasFloor ? <>{money(short)} short <span className="text-[16px] font-medium">of your floor in {name(lowAt)}</span></>
                  : <>{money(-low)} overdrawn <span className="text-[16px] font-medium">in {name(lowAt)}</span></>)
                : <>{money(low - bar)} clear <span className="text-[16px] font-medium">{hasFloor ? "of your floor" : "of zero"} at the tightest point</span></>}
            </div>
            <p className="mt-1 text-[12.5px] text-foreground/80">
              {short > 0
                ? <>The bank goes to {money(low)}. {under.length} of {cash.length} months {under.length === 1 ? "is" : "are"} below {hasFloor ? "the floor" : "zero"}, starting {name(under[0])}.
                    {" "}That is the cash — or overdraft — the plan has to find.{" "}
                    <a href={`/plans/${planId}/assumptions?area=cash`} className="font-semibold text-primary hover:underline">Where to fix it</a></>
                : <>The tightest month is {name(lowAt)}, at {money(low)}. Every month of {Y.year(1)} stays above {hasFloor ? "the floor" : "zero"}.</>}
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
              No cash floor set, so months are only judged against zero — a weaker test than any business
              actually runs to.
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
    <Picture title={`How ${lastYear} ended`} aside={bar > 0 ? `Dashed line: your floor of ${money(bar)}` : "Year-end bank balance, from Historic"}>
      <div className={cn("mt-2 rounded-md border px-4 py-3", short > 0 ? "border-bad/40 bg-bad-soft" : "border-good/40 bg-good-soft")}>
        <div className={cn("text-[26px] font-semibold leading-tight tabular-nums", short > 0 ? "text-bad" : "text-good")}>
          {money(cash)} <span className="text-[16px] font-medium">in the bank at the end of {lastYear}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-foreground/80">
          {cover !== null && <>About {Math.round(cover * 10) / 10} {Math.round(cover * 10) / 10 === 1 ? "month" : "months"} of overheads. </>}
          {bar > 0 && short > 0 && <>{money(short)} below your floor. </>}
          Annual accounts only show the last day of the year, so the tightest month is not visible here — the
          plan&apos;s month-by-month cash is on the Plan view.
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
    <Picture title="How much more this cash flow would carry"
      aside={coc === null ? "Needs a rate to price it at" : `At ${LENDER_MIN_DSCR}× cover, ${coc}% over ${CAPACITY_TERM_YEARS} years`}>
      {base === null ? (
        <Note>There is no forecast yet, so there is nothing to lend against. Fill in your sales and costs first.</Note>
      ) : coc === null ? (
        <>
          <Note>Headroom has to be priced at a rate. Set what your money costs and this draws itself.</Note>
          <Pencil planId={planId} fix={{ label: "Set the cost of capital", to: "assumptions?area=cash" }} />
        </>
      ) : capStress === null ? (
        <>
          <Note>
            {(capBase ?? 0) > 0
              ? <>The base case supports about {money(capBase ?? 0)} more. What a BAD year supports is the figure that matters, and that needs a bad year to be described.</>
              : <>Even the base case supports nothing further — what this business already repays uses the cover up. Describe a bad year and the picture can show how far short it falls.</>}
          </Note>
          <Pencil planId={planId} fix={{ label: "Describe a bad year", to: "assumptions?area=downside" }} />
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
              { at: capBase ?? 0, label: `Base case ${money(capBase ?? 0)}`, below: true },
            ]}
            ticks={[0, top / 2, top]} format={(t) => money(t)}
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            {service > 0
              ? <>Already repaying <b className="font-semibold text-foreground">{money(service)}</b> a year. This is room on top of that.</>
              : <>The plan carries no borrowing yet, so all of this is room.</>}
            {" "}Borrow what the bad year carries, not what the good one allows.
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
      <Picture title="What the earnings support" aside={`${names[sy] ?? `Year ${sy}`} normalised EBITDA × comparable multiples`}>
        <Note>{ys
          ? `${names[sy] ?? `Year ${sy}`} earnings are not positive, so there is no multiple to apply. Nothing about the price can be judged until the business makes money.`
          : "No forecast yet, so there is nothing to value."}</Note>
      </Picture>
    );
  }

  if (!ranged) {
    return (
      <Picture title="What the earnings support" aside={`${money(e)} of ${names[sy] ?? `Year ${sy}`} normalised earnings`}>
        <Note>A range needs a low and a high multiple — what businesses like this one have actually sold for.</Note>
        <Pencil planId={planId} fix={{ label: "Set the similar-sales range", to: "settings?area=exit" }} />
      </Picture>
    );
  }

  const lowV = e * (sale.multipleLow ?? 0), highV = e * (sale.multipleHigh ?? 0);
  const top = Math.max(highV, price) * 1.2;
  const mult = metrics.find((x) => x.key === "priceMultiple")?.value ?? null;

  return (
    <Picture title="What the earnings support"
      aside={`${money(e)} of ${names[sy] ?? `Year ${sy}`} normalised earnings at ${sale.multipleLow}× to ${sale.multipleHigh}×`}>
      <RangeBar
        min={0} max={top}
        zones={[{ from: lowV, to: highV, severity: "good" }, { from: highV, to: top, severity: "bad" }]}
        marks={[
          { at: (lowV + highV) / 2, label: `Midpoint ${money((lowV + highV) / 2)}`, below: true },
          ...(price > 0
            ? [{ at: Math.min(price, top), label: `Asking ${money(price)}`,
                 tone: price > highV ? ("bad" as const) : undefined }]
            : []),
        ]}
        ticks={[0, top / 2, top]} format={(t) => money(t)}
      />
      {price === 0 && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          The business has not been priced, so there is nothing standing against the range.
          <span className="ml-2 inline-block align-middle"><Pencil planId={planId} fix={{ label: "Set the asking price", to: "settings?area=exit" }} /></span>
        </p>
      )}
      {price > highV && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          <b className="font-semibold text-foreground">{money(price - highV)}</b> above the top of the range
          {mult ? ` — ${mult}× against a ceiling of ${sale.multipleHigh}×` : ""}.
        </p>
      )}
      {/* A searched range says so (§6.130): the dial weighing 3 should never rest on a figure of unknown origin. */}
      {sale.multipleFound && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Range from {sale.multipleFound.sources} published sources
          {sale.multipleFound.wider ? " in the wider sector or nearby markets" : ""}, found{" "}
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
      <Panel height={220} title="The cash cycle, year by year" sub="Days cash is tied up: stock days + debtor days − creditor days, from Assumptions">
        {P.has
          ? (w) => (
            <Lines width={w} height={220} categories={P.cycle.categories} format={(v) => `${Math.round(v)} days`}
              series={[
                { label: "Cash cycle", values: P.cycle.cycle },
                { label: "Debtor days", values: P.cycle.debtor },
                { label: "Stock days", values: P.cycle.stock },
                { label: "Creditor days", values: P.cycle.creditor },
              ]} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel height={220} title="Keeping it standing, and growing it"
        sub={P.capex.runDown.length
          ? <>Spending below depreciation in {yearsIn(P.capex.runDown, Y.year)} — the assets are being run down, not kept.</>
          : <>Depreciation stands in for what it costs to stand still; capital spending above that is growth.</>}>
        {P.has
          ? (w) => (
            <Lines width={w} height={220} categories={P.capex.categories} format={money}
              series={[
                { label: "Keeping it standing (depreciation)", values: P.capex.maintenance },
                { label: "Growth spending (capex above that)", values: P.capex.growth },
              ]} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel title={`Where ${Y.year(2)}'s growth comes from`} sub={`Change in revenue, ${Y.year(1)} to ${Y.year(2)}, by product — the accounts do not split sales by product, so this is inside the plan`}>
        {growth.length
          ? (w) => <BarRows width={w} format={money}
              rows={growth.map((p) => ({ label: p.name, value: p.change, tone: p.change < 0 ? "bad" : "accent" }))} />
          : <Empty planId={planId} fix={{ label: "Add products", to: "sales" }}>No product changes between {Y.year(1)} and {Y.year(2)}.</Empty>}
      </Panel>

      <Panel title="Can the business execute it?"
        sub="Capacity, people, work in the pipeline, customers kept. Growth stalls at whichever runs out first.">
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
      <Panel height={220} title="Debt cover over five years"
        sub={hasStress
          ? <>Cash from trading against what the plan repays each year, as it stands and in the bad year you described. Drawn up to 4× — an open ring is higher; hover for the figure.</>
          : <>Cash from trading against what the plan repays each year. Drawn up to 4× — an open ring is higher. Describe a bad year on Assumptions and it draws beside this.</>}>
        {hasCover
          ? (w) => (
            <Lines width={w} height={220} categories={P.cover.categories} format={timesFmt}
              reference={{ value: P.cover.minimum, label: `Lender minimum ${P.cover.minimum}×` }}
              /* Above 4× the exact multiple stops mattering to a lender; the minimum line is what must be visible. */
              ceiling={4}
              series={[
                { label: "As planned", values: P.cover.base },
                ...(hasStress ? [{ label: "In a bad year", values: P.cover.stressed }] : []),
              ]} />
          )
          : <Empty planId={planId} fix={{ label: "Add the borrowing", to: "funding" }}>The plan carries no borrowing, so there is no cover to draw.</Empty>}
      </Panel>

      <Panel height={220} title="Cash available against repayments" sub="Each year's cash from trading, with the repayments it has to meet marked across it">
        {P.has
          ? (w) => (
            <Columns width={w} height={220} categories={P.service.categories} values={P.service.available}
              threshold={P.service.repayments.map((r) => (r > 0 ? r : null))} thresholdLabel="Repayments"
              format={money} tone={(i) => (P.service.available[i] < P.service.repayments[i] ? "bad" : "accent")} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel title="How overdue are the invoices?"
        sub={ageing.state === "ready"
          ? <>{ageing.overduePct}% of debtors is past its due date.{ageing.gap !== null && Math.abs(ageing.gap) >= 1 ? <> The split is {money(Math.abs(ageing.gap))} {ageing.gap > 0 ? "short of" : "over"} the debtors figure it should add up to.</> : null}</>
          : <>The most recent year&apos;s debtors, split by how late each invoice is.</>}>
        {ageing.state === "new"
          ? <Empty planId={planId}>A new business has no invoices to age yet. This fills in once there is a year of trading.</Empty>
          : ageing.state === "missing"
            ? <Empty planId={planId} fix={ageing.fix}>Debtors are one figure on the balance sheet. A lender wants them split by age.</Empty>
            : (w) => <BarRows width={w} format={money} labelShare={0.42}
                rows={ageing.buckets.map((b) => ({ label: b.label, value: b.value, tone: b.value > 0 ? TONE[b.tone] : undefined }))} />}
      </Panel>

      <Panel title="What the lender will check beyond the numbers"
        sub="The half of a credit paper no forecast answers. A grey line is not a pass — it is a question nobody has answered yet.">
        <LineList lines={lenderChecklist(extras, input, metrics)} planId={planId} />
      </Panel>

      {/*
        WHAT REPLACED "PROPOSED FACILITY" (§6.129). The dashboard this was modelled on opened the borrowing tab
        with the loan being asked for. That loan was typed into a dashboard and thrown away; what is shown
        instead is what the plan actually owes, read from the Funding rows the forecast repays.
      */}
      <Panel wide title="The borrowing the plan already carries" sub="From the Funding step — the same loans the forecast repays">
        {facilities.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[.05em] text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Facility</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Drawn</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Limit</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Undrawn</th>
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
                    <td className="py-1.5 pr-3">Brought forward from the last balance sheet</td>
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
            {money(openingDebt)} of bank debt from the last balance sheet, with no rate yet — so the forecast cannot cost it.
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
      <Panel height={220} title="Revenue over five years"
        sub={P.revenue.lossYears.length
          ? <>Red is a year the business makes an operating loss: {yearsIn(P.revenue.lossYears, Y.year)}.</>
          : <>What a buyer is being shown, from the plan&apos;s own forecast.</>}>
        {P.has
          ? (w) => <Columns width={w} height={220} categories={P.revenue.categories} values={P.revenue.values} format={money}
              tone={(i) => (P.revenue.lossYears.includes(i + 1) ? "bad" : "accent")} />
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel height={220} title="Margins over five years" sub="Gross margin, and the earnings margin a buyer strikes a price on (with your add-backs)">
        {P.has
          ? (w) => (
            <Lines width={w} height={220} categories={P.margins.categories} format={pctFmt}
              series={[
                { label: "Gross margin", values: P.margins.gross },
                { label: "Normalised EBITDA margin", values: P.margins.normalised },
              ]} />
          )
          : <Empty planId={planId}>Needs a forecast.</Empty>}
      </Panel>

      <Panel title="Would it survive a change of owner?"
        sub={unscored ? <>{TRANSFER_TOTAL - unscored} of {TRANSFER_TOTAL} scored on Leadership Team → Risk &amp; Succession.</> : <>1 weak to 5 strong, scored on Leadership Team → Risk &amp; Succession.</>}>
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
        sub="Products, not customers — who buys is the panel beside this. A buyer asks both.">
        {shares.length
          ? (w) => <BarRows width={w} format={pctFmt}
              rows={shares.map((p) => ({ label: p.name, value: p.share ?? 0, tone: (p.share ?? 0) > 60 ? "bad" : (p.share ?? 0) > 35 ? "warn" : "accent" }))} />
          : <Empty planId={planId} fix={{ label: "Add products", to: "sales" }}>No products with revenue in {Y.year(1)}.</Empty>}
      </Panel>

      <Panel title="Who the customers are"
        sub={conc.rows.length
          ? <>{conc.topShare !== null ? <>The largest is {conc.topShare}% of sales{conc.listedShare !== null && conc.rows.length > 1 ? <>; the {conc.rows.length} listed are {conc.listedShare}% together</> : null}.</> : <>No shares given yet.</>}
              {conc.notAssignable ? <> {conc.notAssignable} contract{conc.notAssignable === 1 ? "" : "s"} end on a sale.</> : null}
              {conc.unchecked ? <> {conc.unchecked} not checked for assignability.</> : null}</>
          : <>The first thing a buyer&apos;s adviser asks: who buys, and how much of the business each one is.</>}>
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
          : <Empty planId={planId} fix={{ label: "Add the largest customers", to: "marketing?area=market" }}>
              No customers recorded. Up to five, with each one&apos;s share of sales.
            </Empty>}
      </Panel>

      <Panel title="From reported to normalised earnings"
        sub="What the accounts show, each add-back a buyer's accountant will test, and what a price is struck on.">
        {!bridge
          ? <Empty planId={planId}>Needs a {Y.year(saleYear(input.sale))} forecast.</Empty>
          : (w) => (
            <>
              <BarRows width={w} format={money} labelShare={0.45}
                rows={[
                  /* §6.115.1: a loss is said in words, never left to a minus sign in front of the figure. */
                  { label: `Reported EBITDA, ${Y.year(saleYear(input.sale))}`, value: bridge.reported, tone: bridge.reported < 0 ? "bad" : "accent",
                    display: bridge.reported < 0 ? `${money(Math.abs(bridge.reported))} loss` : undefined },
                  ...bridge.adds.map((a) => ({ label: `+ ${a.label}`, value: a.amount, tone: "good" as const })),
                  { label: "Normalised earnings", value: bridge.normalised, tone: bridge.normalised < 0 ? "bad" : "accent",
                    display: bridge.normalised < 0 ? `${money(Math.abs(bridge.normalised))} loss` : undefined },
                ]} />
              {!bridge.adds.length && <Pencil planId={planId} fix={{ label: "List the add-backs", to: "settings?area=exit" }} />}
            </>
          )}
      </Panel>

      <Panel wide title="Questions a buyer will ask"
        sub="Written from this plan's own weak measures. Have an answer to each before the first meeting.">
        {questions.length ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed marker:font-semibold marker:text-primary">
            {questions.map((q, idx) => <li key={idx}>{q}</li>)}
          </ol>
        ) : (
          <Empty planId={planId}>Nothing on this tab raises a question a buyer would open with.</Empty>
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
