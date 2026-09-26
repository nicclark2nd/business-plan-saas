"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { Note } from "@/components/module/DataGrid";
import { useWidth, type Severity as ChartSeverity } from "@/components/chart/core";
import { MiniDial, RangeBar, ScoreDial } from "@/components/chart/plots";
import { navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { moneyFormatter } from "@/engine/plan/money";
import {
  SCORE_BANDS, SEVERITY_LABEL, borrowingCapacity, score, statusOf,
  type CapabilityInput, type Metric, type Severity,
} from "@/engine/capability/model";
import { LENDER_MIN_DSCR } from "@/engine/capability/judgements";
import { GROW_WEIGHTS, growMetrics } from "@/engine/capability/grow";
import { BORROW_WEIGHTS, CAPACITY_TERM_YEARS, borrowMetrics, stressedCash } from "@/engine/capability/borrow";
import { SELL_WEIGHTS, sellMetrics } from "@/engine/capability/sell";
import { verdict } from "@/engine/capability/verdict";

/**
 * Everything the server hands down. Only the money formatter is built here, because a function cannot cross
 * the boundary — every FIGURE now comes from the plan, including the judgements (§6.129).
 */
export type PlanFacts = Omit<CapabilityInput, "money">;

type Tab = "grow" | "borrow" | "sell";

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
export function CapabilitiesModule({ planId, mode, currency, facts }: {
  planId: string; mode: "guided" | "advanced"; currency: string; facts: PlanFacts;
}) {
  const [tab, setTab] = useState<Tab>("grow");
  const money = useMemo(() => moneyFormatter(currency), [currency]);

  const input: CapabilityInput = useMemo(() => ({ ...facts, money }), [facts, money]);

  const grow = useMemo(() => growMetrics(input), [input]);
  const borrow = useMemo(() => borrowMetrics(input), [input]);
  const sell = useMemo(() => sellMetrics(input), [input]);
  const growScore = useMemo(() => score(grow, GROW_WEIGHTS), [grow]);
  const borrowScore = useMemo(() => score(borrow, BORROW_WEIGHTS), [borrow]);
  const sellScore = useMemo(() => score(sell, SELL_WEIGHTS), [sell]);

  const WEIGHTS = { grow: GROW_WEIGHTS, borrow: BORROW_WEIGHTS, sell: SELL_WEIGHTS }[tab];
  const metrics = { grow, borrow, sell }[tab];
  const s = { grow: growScore, borrow: borrowScore, sell: sellScore }[tab];
  const v = verdict(tab, metrics, WEIGHTS, s.value);
  const band = s.value === null ? null : statusOf(s.value, SCORE_BANDS);

  return (
    <ModuleFrame
      group={navGroup("capabilities")} title="Financial Capabilities"
      subtitle="What your own plan says about growing this business, borrowing against it and selling it" mode={mode}
      areas={[
        { key: "grow", label: "Capability to grow", count: growScore.value ?? undefined },
        { key: "borrow", label: "Capability to borrow", count: borrowScore.value ?? undefined },
        { key: "sell", label: "Capability to sell", count: sellScore.value ?? undefined },
      ]}
      area={tab} onArea={(k) => setTab(k as Tab)}
      scope={{ label: "Year 1" }}
      footer={<ModuleFooter planId={planId} moduleId="capabilities" formId="capabilities-form" />}
      help={<>
        <h3>Nothing is typed on this screen</h3>
        <p>Every figure here is read from your plan — the same forecast run behind your Profit &amp; Loss, your dashboard and your report. If a number looks wrong, it is wrong on those screens too, and the fix is in the step that owns it.</p>
        <h3>A grey dial is a question, not a bad score</h3>
        <p>Some measures need a judgement the forecast cannot make: how low you will let cash go, what your money costs, what you would want for the business, whether it would run without you. Those live on the steps that own them, and a measure waiting on one shows greyed with a <b>pencil</b> that takes you straight to the box.</p>
        <h3>The score</h3>
        <p>Each measure is judged against its band and the judgements are averaged, weighted by how much each matters to the question. <b>A measure the plan cannot answer is left out rather than scored nought</b> — so an unfinished plan gets a score from what it does hold, and the tab says how many measures that was.</p>
        <h3>Where the bands come from</h3>
        <p>They are general small-business ranges, not your industry&apos;s. A concreter, a café and a software business do not share a sensible cash cycle. Read them as a starting point and use the benchmark line on each card, which says what good looks like rather than just colouring the number.</p>
      </>}
    >
      <form id="capabilities-form" className="hidden" />

      {/* ---------- the verdict: identical on all three tabs ---------- */}
      <section className="grid gap-0 border-b border-border @container md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)_minmax(230px,320px)]">
        <div className="flex flex-col items-center justify-center border-b border-border bg-secondary/40 px-5 py-5 text-center md:border-b-0 md:border-r">
          <Dial value={s.value} />
          <div className={cn("mt-1 text-[44px] font-semibold leading-none tabular-nums",
            band === "good" && "text-good", band === "watch" && "text-warn", band === "bad" && "text-bad")}>
            {s.value ?? "—"}<span className="text-[15px] font-normal text-muted-foreground">/100</span>
          </div>
          {band && <div className="mt-2"><Pill s={band} /></div>}
          <p className="mt-2 max-w-[26ch] text-[11.5px] text-muted-foreground">
            {s.value === null ? "Nothing to score yet" : `From the ${s.covered} of ${s.total} measures this plan can answer`}
          </p>
        </div>

        <div className="border-b border-border px-5 py-5 md:border-b-0">
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

        <aside className="px-5 py-5 md:border-l md:border-border">
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
              Held in the at-risk band by <b className="font-semibold text-foreground">
                {s.capped.map((k) => metrics.find((m) => m.key === k)?.name ?? k).join(" and ")}
              </b>. A measure this decisive cannot be averaged out by the ones that are going well.
            </p>
          )}
        </aside>
      </section>

      {/*
        ---------- one picture, and every tab has exactly one ----------

        THIS IS WHERE THE THREE TABS USED TO DIVERGE. The growth tab had two tiles and a bar, borrowing had
        five tiles, a bar and three inline boxes, selling had ten tiles and a bar. Now each tab has a single
        band showing the one argument it is making: where the worst month falls against the floor, how much
        borrowing the cash flow carries, where the asking price falls against what the earnings support.
      */}
      {tab === "grow" && <WorstMonth planId={planId} metrics={grow} input={input} money={money} />}
      {tab === "borrow" && <BorrowingRoom planId={planId} input={input} money={money} />}
      {tab === "sell" && <ValuationRange planId={planId} metrics={sell} input={input} money={money} />}

      {/* ---------- the measures ---------- */}
      <div className="grid gap-px bg-border @container sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => <Card key={m.key} m={m} planId={planId} />)}
      </div>
    </ModuleFrame>
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

function Pill({ s }: { s: Severity }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
      s === "good" && "bg-good-soft text-good", s === "watch" && "bg-warn-soft text-warn", s === "bad" && "bg-bad-soft text-bad")}>
      <i className={cn("size-1.5 rounded-full", s === "good" && "bg-good", s === "watch" && "bg-warn", s === "bad" && "bg-bad")} />
      {SEVERITY_LABEL[s]}
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

function Card({ m, planId }: { m: Metric; planId: string }) {
  const s = statusOf(m.value, m.bands);
  return (
    <article className="bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-semibold leading-snug">{m.name}</h3>
        {s ? <Pill s={s} /> : <span className="eyebrow shrink-0 text-muted-foreground">Not yet</span>}
      </div>

      <div className="mt-1 flex items-center gap-3">
        <Gauge m={m} s={s} />
        <div className="min-w-0 flex-1">
          <div className={cn("text-[26px] font-semibold leading-none tabular-nums",
            s === "good" && "text-good", s === "watch" && "text-warn", s === "bad" && "text-bad",
            !s && "text-muted-foreground")}>{m.display}</div>
          {m.sub && <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{m.sub}</div>}
        </div>
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed">{m.missing ?? m.note}</p>
      {m.missing
        ? m.fix && <Pencil planId={planId} fix={m.fix} />
        : <p className="mt-1 text-[11.5px] text-muted-foreground">{m.bench}</p>}

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

/** Growth's picture: the year in one line — the worst month against the floor, and against zero. */
function WorstMonth({ planId, metrics, input, money }: {
  planId: string; metrics: Metric[]; input: CapabilityInput; money: (v: number) => string;
}) {
  const lowCash = metrics.find((x) => x.key === "lowestCash")?.value ?? null;
  const floor = input.growth.cashBuffer;
  const floorAt = floor !== null && floor > 0 ? floor : 0;
  const top = Math.max(floorAt * 3, Math.abs(lowCash ?? 0) * 2, 100_000);

  return (
    <Picture title="The worst month of Year 1" aside="Closing bank balance at its lowest point">
      {lowCash === null ? (
        <Note>No monthly cash forecast yet. Fill in your sales and costs and this draws itself.</Note>
      ) : (
        <>
          <RangeBar
            min={Math.min(0, lowCash) - (lowCash < 0 ? Math.abs(lowCash) * 0.2 : 0)} max={top}
            zones={[
              { from: Math.min(0, lowCash), to: 0, severity: "bad" },
              { from: 0, to: floorAt, severity: "warn" },
              { from: floorAt, to: top, severity: "good" },
            ]}
            marks={[
              ...(floorAt > 0 ? [{ at: floorAt, label: `Your floor ${money(floorAt)}`, below: true }] : []),
              { at: Math.min(lowCash, top), label: `Lowest ${money(lowCash)}`, tone: lowCash < floorAt ? ("bad" as const) : undefined },
            ]}
            ticks={[Math.min(0, lowCash), top / 2, top]} format={(t) => money(t)}
          />
          {/* Without a floor the band is only "above or below zero", and the picture says so rather than
              drawing a line the client never drew. */}
          {floor === null && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              No cash floor set, so the only line here is zero — which is a weaker test than any business
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
 * Borrowing's picture: what the plan already repays, what a stressed year would carry, and what the base
 * case would. No "wanted" mark any more — there is no loan being typed, so there is nothing to want (§6.129).
 */
function BorrowingRoom({ planId, input, money }: {
  planId: string; input: CapabilityInput; money: (v: number) => string;
}) {
  const cf1 = input.cashFlow[1];
  const base = cf1 ? cf1.netOperating + cf1.interestPaid : null;
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
              ? <>The base case supports about {money(capBase ?? 0)} more. What a BAD year supports is the figure that matters, and that needs a downside to be described.</>
              : <>Even the base case supports nothing further — what this business already repays uses the cover up. Describe a bad year and the picture can show how far short it falls.</>}
          </Note>
          <Pencil planId={planId} fix={{ label: "Set the downside", to: "assumptions?area=downside" }} />
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
function ValuationRange({ planId, metrics, input, money }: {
  planId: string; metrics: Metric[]; input: CapabilityInput; money: (v: number) => string;
}) {
  const y1 = input.pnl[1];
  const sale = input.sale;
  const e = y1 ? y1.operatingProfit + y1.depreciation + (sale.addBacks ?? 0) : null;
  const ranged = sale.multipleLow !== null && sale.multipleHigh !== null;
  const price = sale.askingPrice ?? 0;

  if (e === null || e <= 0) {
    return (
      <Picture title="What the earnings support" aside="Normalised EBITDA × comparable multiples">
        <Note>{y1
          ? "Year 1 earnings are not positive, so there is no multiple to apply. Nothing about the price can be judged until the business makes money."
          : "No forecast yet, so there is nothing to value."}</Note>
      </Picture>
    );
  }

  if (!ranged) {
    return (
      <Picture title="What the earnings support" aside={`${money(e)} of normalised earnings`}>
        <Note>A range needs a low and a high multiple — what businesses like this one have actually sold for.</Note>
        <Pencil planId={planId} fix={{ label: "Set the comparable range", to: "settings?area=exit" }} />
      </Picture>
    );
  }

  const lowV = e * (sale.multipleLow ?? 0), highV = e * (sale.multipleHigh ?? 0);
  const top = Math.max(highV, price) * 1.2;
  const mult = metrics.find((x) => x.key === "priceMultiple")?.value ?? null;

  return (
    <Picture title="What the earnings support"
      aside={`${money(e)} of normalised earnings at ${sale.multipleLow}× to ${sale.multipleHigh}×`}>
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
    </Picture>
  );
}
