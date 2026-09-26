"use client";

import { useMemo, useState } from "react";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { CellInput, Note } from "@/components/module/DataGrid";
import { Meter, StatTile, TileRow, useWidth, type Severity as ChartSeverity } from "@/components/chart/core";
import { RangeBar, ScoreDial } from "@/components/chart/plots";
import { navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { moneyFormatter } from "@/engine/plan/money";
import {
  DEFAULT_STRESS, LENDER_MIN_DSCR, SCORE_BANDS, SEVERITY_LABEL, borrowingCapacity, score, statusOf,
  type CapabilityInput, type Metric, type Proposal, type Severity, type Stress,
} from "@/engine/capability/model";
import { GROW_WEIGHTS, growMetrics } from "@/engine/capability/grow";
import { BORROW_WEIGHTS, borrowMetrics, stressedCash } from "@/engine/capability/borrow";
import { verdict } from "@/engine/capability/verdict";

/** Everything the server can serialise. The formatter and the scenario are the client's own. */
export type PlanFacts = Omit<CapabilityInput, "money" | "proposal" | "stress">;

type Tab = "grow" | "borrow";

/** The engine's three states, in the four the chart primitives speak. */
const TONE: Record<Severity, ChartSeverity> = { good: "good", watch: "warn", bad: "bad" };

/**
 * FINANCIAL CAPABILITIES (§6.128).
 *
 * Two questions an owner asks that a plan can answer: can I afford to grow this, and can I borrow against
 * it. A third — can I sell it — is deliberately absent, because half of what it needs (an asking price,
 * owner add-backs, who holds the customer relationships) has never been collected, and a dial drawn
 * without them is an opinion with a needle on it.
 *
 * NOTHING HERE IS SAVED. The loan being considered lives in this component and dies with the page, which
 * is the honest shape for a scenario: a client wondering about a loan has not taken one, and writing it
 * into Funding would put debt on their balance sheet because they were curious.
 */
export function CapabilitiesModule({ planId, mode, currency, facts }: {
  planId: string; mode: "guided" | "advanced"; currency: string; facts: PlanFacts;
}) {
  const [tab, setTab] = useState<Tab>("grow");
  const [proposal, setProposal] = useState<Proposal>({ amount: 0, ratePct: 8.5, termYears: 7, undrawn: 0, collateral: null });
  const [stress, setStress] = useState<Stress>(DEFAULT_STRESS);
  const money = useMemo(() => moneyFormatter(currency), [currency]);

  const input: CapabilityInput = useMemo(() => ({
    ...facts, money,
    /* A loan of nothing is not a loan: until an amount is entered, every test that needs one stays blank. */
    proposal: proposal.amount > 0 ? proposal : null,
    stress,
  }), [facts, money, proposal, stress]);

  const grow = useMemo(() => growMetrics(input), [input]);
  const borrow = useMemo(() => borrowMetrics(input), [input]);
  const growScore = useMemo(() => score(grow, GROW_WEIGHTS), [grow]);
  const borrowScore = useMemo(() => score(borrow, BORROW_WEIGHTS), [borrow]);

  const metrics = tab === "grow" ? grow : borrow;
  const s = tab === "grow" ? growScore : borrowScore;
  const v = verdict(tab, metrics, tab === "grow" ? GROW_WEIGHTS : BORROW_WEIGHTS, s.value);
  const band = s.value === null ? null : statusOf(s.value, SCORE_BANDS);

  return (
    <ModuleFrame
      group={navGroup("capabilities")} title="Financial Capabilities"
      subtitle="What your own forecast says about growing the business and borrowing against it" mode={mode}
      areas={[
        { key: "grow", label: "Capability to grow", count: growScore.value ?? undefined },
        { key: "borrow", label: "Capability to borrow", count: borrowScore.value ?? undefined },
      ]}
      area={tab} onArea={(k) => setTab(k as Tab)}
      scope={{ label: "Year 1" }}
      footer={<ModuleFooter planId={planId} moduleId="capabilities" formId="capabilities-form" />}
      help={<>
        <h3>Nothing here is typed</h3>
        <p>Every figure on this page is read from the forecast your plan already produces — the same run behind your Profit &amp; Loss, your dashboard and your report. If a number looks wrong, it is wrong on those screens too, and the fix is in the step that owns it.</p>
        <h3>The one exception</h3>
        <p>The loan on the borrowing tab. A loan you are <em>considering</em> is not in your plan by definition, so you enter it here and it is gone when you leave. Nothing on this page writes to your plan.</p>
        <h3>The score</h3>
        <p>Each measure is judged against its band and the judgements are averaged, weighted by how much each matters to the question. <b>A measure the plan cannot answer is left out rather than scored nought</b> — so an unfinished plan gets a score from what it does hold, and the tab says how many measures that was.</p>
        <h3>Where the bands come from</h3>
        <p>They are general small-business ranges, not your industry&apos;s. A concreter, a café and a software business do not share a sensible cash cycle. Read them as a starting point and use the benchmark line on each card, which says what good looks like rather than just colouring the number.</p>
      </>}
    >
      <form id="capabilities-form" className="hidden" />

      {/* ---------- the verdict ---------- */}
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

      {/* ---------- the loan being considered ---------- */}
      {tab === "borrow" && (
        <BorrowInputs
          proposal={proposal} onProposal={setProposal}
          stress={stress} onStress={setStress}
          input={input} money={money}
        />
      )}

      {/* ---------- the measures ---------- */}
      <div className="grid gap-px bg-border @container sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => <Card key={m.key} m={m} />)}
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
 * ONE MEASURE.
 *
 * The track rather than a dial, for the three reasons `Meter` gives — and the value is printed at full
 * size beside it, because the number is the thing and the bar is the context (§6.49.2).
 *
 * The expander is the reason a client can argue with the card. It carries the formula in the plan's own
 * terms, what the measure is actually for, and how much the app trusts the inputs — which is the sentence
 * that stops a medium-confidence estimate being read as a fact.
 */
function Card({ m }: { m: Metric }) {
  const s = statusOf(m.value, m.bands);
  const pct = m.value === null ? null
    : Math.max(0, Math.min(100, ((m.value - m.min) / (m.max - m.min)) * 100));
  return (
    <article className="bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-semibold leading-snug">{m.name}</h3>
        {s ? <Pill s={s} /> : <span className="eyebrow shrink-0 text-muted-foreground">Not yet</span>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-[26px] font-semibold leading-none tabular-nums",
          s === "good" && "text-good", s === "watch" && "text-warn", s === "bad" && "text-bad",
          !s && "text-muted-foreground")}>{m.display}</span>
        {m.sub && <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">{m.sub}</span>}
      </div>
      <Meter pct={pct} severity={s ? TONE[s] : "accent"} label={`${m.name}: ${m.display}`} />

      <p className="mt-2.5 text-[12.5px] leading-relaxed">{m.missing ?? m.note}</p>
      {!m.missing && <p className="mt-1 text-[11.5px] text-muted-foreground">{m.bench}</p>}

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

/**
 * THE LOAN, AND THE BAD YEAR.
 *
 * Six numbers, none of them stored. The range beneath them is the whole borrowing question in one
 * picture: what a stressed year carries, what the base case carries, and where the loan the client has in
 * mind falls against both.
 */
function BorrowInputs({ proposal, onProposal, stress, onStress, input, money }: {
  proposal: Proposal; onProposal: (p: Proposal) => void;
  stress: Stress; onStress: (s: Stress) => void;
  input: CapabilityInput; money: (v: number) => string;
}) {
  const num = (v: string) => Number(v.replace(/[^0-9.-]/g, "")) || 0;
  const set = (patch: Partial<Proposal>) => onProposal({ ...proposal, ...patch });

  const cf1 = input.cashFlow[1];
  const base = cf1 ? cf1.netOperating + cf1.interestPaid : null;
  const stressedNow = stressedCash(input);
  const existing = input.debtService[1] ?? 0;
  const capBase = base === null ? null : borrowingCapacity(base, existing, proposal.ratePct, proposal.termYears, LENDER_MIN_DSCR);
  const capStress = stressedNow === null ? null : borrowingCapacity(stressedNow, existing, proposal.ratePct, proposal.termYears, LENDER_MIN_DSCR);
  const top = Math.max(capBase ?? 0, proposal.amount, 1) * 1.25;

  return (
    <>
      <TileRow>
        <StatTile label="Loan you are considering" value={money(proposal.amount)}>
          <CellInput numeric className="mt-1.5 w-full" placeholder="0"
            value={proposal.amount || ""} onChange={(e) => set({ amount: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Interest rate" value={`${proposal.ratePct}%`}>
          <CellInput numeric className="mt-1.5 w-full" value={proposal.ratePct}
            onChange={(e) => set({ ratePct: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Term" value={`${proposal.termYears} years`}>
          <CellInput numeric className="mt-1.5 w-full" value={proposal.termYears}
            onChange={(e) => set({ termYears: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Undrawn overdraft" value={money(proposal.undrawn)} sub="Committed only">
          <CellInput numeric className="mt-1.5 w-full" placeholder="0"
            value={proposal.undrawn || ""} onChange={(e) => set({ undrawn: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Security offered" value={proposal.collateral === null ? "—" : money(proposal.collateral)}>
          <CellInput numeric className="mt-1.5 w-full" placeholder="Not valued"
            value={proposal.collateral ?? ""} onChange={(e) => set({ collateral: e.target.value.trim() ? num(e.target.value) : null })} />
        </StatTile>
      </TileRow>

      <section className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-semibold">What this cash flow supports</span>
          <span className="text-[11.5px] text-muted-foreground">
            At {LENDER_MIN_DSCR}× cover, {proposal.ratePct}% over {proposal.termYears} years
          </span>
        </div>
        {capBase === null ? (
          <Note>There is no forecast yet, so there is nothing to lend against. Fill in your sales and costs first.</Note>
        ) : (
          <RangeBar
            min={0} max={top}
            zones={[
              { from: 0, to: capStress ?? 0, severity: "good" },
              { from: capStress ?? 0, to: capBase, severity: "warn" },
              { from: capBase, to: top, severity: "bad" },
            ]}
            marks={[
              { at: capStress ?? 0, label: `Stressed ${money(capStress ?? 0)}`, below: true },
              { at: capBase, label: `Base ${money(capBase)}`, below: true },
              ...(proposal.amount > 0
                ? [{ at: Math.min(proposal.amount, top), label: `Wanted ${money(proposal.amount)}`, tone: "bad" as const }]
                : []),
            ]}
            ticks={[0, top / 2, top]} format={(t) => money(t)}
          />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground">
          <span className="font-semibold text-foreground">The bad year:</span>
          <label className="flex items-center gap-1.5">Sales down
            <CellInput numeric className="w-[62px]" value={stress.salesPct}
              onChange={(e) => onStress({ ...stress, salesPct: num(e.target.value) })} />%
          </label>
          <label className="flex items-center gap-1.5">Margin down
            <CellInput numeric className="w-[62px]" value={stress.marginPts}
              onChange={(e) => onStress({ ...stress, marginPts: num(e.target.value) })} />pts
          </label>
          <label className="flex items-center gap-1.5">Paid
            <CellInput numeric className="w-[62px]" value={stress.debtorDaysAdded}
              onChange={(e) => onStress({ ...stress, debtorDaysAdded: num(e.target.value) })} />days later
          </label>
        </div>
      </section>
    </>
  );
}
