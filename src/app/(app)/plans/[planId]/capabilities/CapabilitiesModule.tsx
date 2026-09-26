"use client";

import { useMemo, useState } from "react";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { CellInput, Note } from "@/components/module/DataGrid";
import { StatTile, TileRow, useWidth, type Severity as ChartSeverity } from "@/components/chart/core";
import { MiniDial, RangeBar, ScoreDial } from "@/components/chart/plots";
import { navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { moneyFormatter } from "@/engine/plan/money";
import {
  DEFAULT_GROWTH, DEFAULT_SALE, DEFAULT_STRESS, LENDER_MIN_DSCR, SCORE_BANDS, SEVERITY_LABEL, TRANSFER_FACTORS,
  borrowingCapacity, score, statusOf,
  type CapabilityInput, type Growth, type Metric, type Proposal, type Sale, type Severity, type Stress,
} from "@/engine/capability/model";
import { GROW_WEIGHTS, growMetrics } from "@/engine/capability/grow";
import { BORROW_WEIGHTS, borrowMetrics, stressedCash } from "@/engine/capability/borrow";
import { SELL_WEIGHTS, sellMetrics } from "@/engine/capability/sell";
import { verdict } from "@/engine/capability/verdict";

/** Everything the server can serialise. The formatter and the scenario are the client's own. */
export type PlanFacts = Omit<CapabilityInput, "money" | "proposal" | "stress" | "sale" | "growth">;

type Tab = "grow" | "borrow" | "sell";

/** The engine's three states, in the four the chart primitives speak. */
const TONE: Record<Severity, ChartSeverity> = { good: "good", watch: "warn", bad: "bad" };

/**
 * FINANCIAL CAPABILITIES (§6.128).
 *
 * The three questions an owner asks about their own business: can I afford to grow it, can I borrow
 * against it, and could I sell it.
 *
 * Selling was held back in §6.128 on the reasoning that half of it wanted facts the app had never
 * collected. That was half right, and the half that was wrong is the interesting one: an asking price,
 * the add-backs behind it and the comparable multiples are not facts about the plan at all — they are a
 * position in a negotiation, and they belong exactly where the proposed loan belongs. One card still
 * cannot be answered, customer concentration, and it stays on the page saying so.
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
  const [sale, setSale] = useState<Sale>(DEFAULT_SALE);
  const [growth, setGrowth] = useState<Growth>(DEFAULT_GROWTH);
  const money = useMemo(() => moneyFormatter(currency), [currency]);

  const input: CapabilityInput = useMemo(() => ({
    ...facts, money,
    /* A loan of nothing is not a loan: until an amount is entered, every test that needs one stays blank. */
    proposal: proposal.amount > 0 ? proposal : null,
    stress, sale, growth,
  }), [facts, money, proposal, stress, sale, growth]);

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
      subtitle="What your own forecast says about growing this business, borrowing against it and selling it" mode={mode}
      areas={[
        { key: "grow", label: "Capability to grow", count: growScore.value ?? undefined },
        { key: "borrow", label: "Capability to borrow", count: borrowScore.value ?? undefined },
        { key: "sell", label: "Capability to sell", count: sellScore.value ?? undefined },
      ]}
      area={tab} onArea={(k) => setTab(k as Tab)}
      scope={{ label: "Year 1" }}
      footer={<ModuleFooter planId={planId} moduleId="capabilities" formId="capabilities-form" />}
      help={<>
        <h3>Nothing here is typed</h3>
        <p>Every figure on this page is read from the forecast your plan already produces — the same run behind your Profit &amp; Loss, your dashboard and your report. If a number looks wrong, it is wrong on those screens too, and the fix is in the step that owns it.</p>
        <h3>The one exception</h3>
        <p>The loan on the borrowing tab, and the asking price, add-backs and transferability judgements on the selling tab. A loan you are <em>considering</em> and a price you are <em>asking</em> are not facts about your plan — they are positions in a negotiation. You enter them here and they are gone when you leave. Nothing on this page writes to your plan.</p>
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
      {tab === "grow" && <GrowInputs growth={growth} onGrowth={setGrowth} metrics={grow} money={money} />}

      {tab === "sell" && <SaleInputs sale={sale} onSale={setSale} metrics={sell} input={input} money={money} />}

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

function Card({ m }: { m: Metric }) {
  const s = statusOf(m.value, m.bands);
  return (
    <article className="bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-semibold leading-snug">{m.name}</h3>
        {s ? <Pill s={s} /> : <span className="eyebrow shrink-0 text-muted-foreground">Not yet</span>}
      </div>

      {/*
        THE DIAL AND THE NUMERAL, SIDE BY SIDE (§6.128.3). The arc shows how far through its range the
        value sits and which band caught it; the numeral is what a reader actually compares between cards.
        Neither on its own does both jobs.
      */}
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

/**
 * THE PRICE, AND THE SIX JUDGEMENTS BEHIND IT.
 *
 * Same shape as the loan on the borrowing tab and for the same reason: an asking price is a position in a
 * negotiation, not a fact about the plan. It is typed here, it drives the arithmetic, and it is gone when
 * the client leaves.
 *
 * THE TRANSFERABILITY SCORES ARE THE SOFTEST THING ON THE PAGE, so they are the most plainly labelled.
 * Each factor carries the question it is really asking — "could the business trade for a month if the
 * owner vanished?" — because "owner dependence: 3" means whatever the person scoring it decided, and a
 * number nobody can reconstruct is worse than no number.
 */
function SaleInputs({ sale, onSale, metrics, input, money }: {
  sale: Sale; onSale: (s: Sale) => void; metrics: Metric[]; input: CapabilityInput; money: (v: number) => string;
}) {
  const num = (v: string) => Number(v.replace(/[^0-9.-]/g, "")) || 0;
  const set = (patch: Partial<Sale>) => onSale({ ...sale, ...patch });
  const scoreFactor = (i: number, v: number) => {
    const next = [...(sale.transfer.length ? sale.transfer : new Array(TRANSFER_FACTORS.length).fill(0))];
    next[i] = v;
    set({ transfer: next });
  };
  const scored = sale.transfer.filter((v) => v > 0).length;

  return (
    <>
      <TileRow>
        <StatTile label="Asking price" value={sale.askingPrice ? money(sale.askingPrice) : "—"} sub="Enterprise value">
          <CellInput numeric className="mt-1.5 w-full" placeholder="0"
            value={sale.askingPrice || ""} onChange={(e) => set({ askingPrice: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Owner add-backs" value={money(sale.addBacks)} sub="Costs a buyer would not inherit">
          <CellInput numeric className="mt-1.5 w-full" placeholder="0"
            value={sale.addBacks || ""} onChange={(e) => set({ addBacks: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Comparable deals, low" value={`${sale.multipleLow}×`} sub="Of normalised EBITDA">
          <CellInput numeric className="mt-1.5 w-full" value={sale.multipleLow}
            onChange={(e) => set({ multipleLow: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Comparable deals, high" value={`${sale.multipleHigh}×`} sub="Of normalised EBITDA">
          <CellInput numeric className="mt-1.5 w-full" value={sale.multipleHigh}
            onChange={(e) => set({ multipleHigh: num(e.target.value) })} />
        </StatTile>
      </TileRow>

      {/*
        THE PRICE ARGUMENT AS A PICTURE (§6.128.3). "5.2× is above your range" is a sentence a client can
        disagree with; the same fact as a band with their asking price standing outside it is one they can
        see. Built from the multiples they entered, against the earnings their own forecast produced.
      */}
      <ValuationRange sale={sale} metrics={metrics} input={input} money={money} />

      {/*
        THE ASSESSMENT AS A STRIP, NOT A FORM (§6.128.4).
        Built first as six rows of label, hint and five buttons, it took a third of the tab before a
        single dial and made this page read as a different kind of screen from the other two. Nic, on the
        built thing: *"Capability To Sell seems to be vastly visually different."* Same six judgements,
        same five points, one line each — the weight of Borrow's stress row, which is what it is.
        The hint moves to the label's tooltip: it earns its place on hover, not in the layout.
      */}
      <section className="border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[12.5px] font-semibold">Would it survive a change of owner?</span>
          <span className="text-[11.5px] text-muted-foreground">1 weak, 5 strong — your judgement, not saved</span>
          <span className="ml-auto text-[11.5px] text-muted-foreground">
            {scored === TRANSFER_FACTORS.length ? "All six scored" : `${scored} of ${TRANSFER_FACTORS.length} scored`}
          </span>
        </div>
        <div className="mt-1.5 grid gap-x-6 gap-y-1 @[700px]:grid-cols-2 @[1100px]:grid-cols-3">
          {TRANSFER_FACTORS.map((f, i) => {
            const v = sale.transfer[i] ?? 0;
            return (
              <div key={f.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px]" title={f.hint}>{f.label}</span>
                <div className="flex shrink-0 gap-0.5" role="group" aria-label={`${f.label}. ${f.hint}`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={v === n} title={`${f.label}: ${n} of 5`}
                      onClick={() => scoreFactor(i, n)}
                      className={cn("size-[18px] rounded-sm border text-[10px] font-semibold leading-none tabular-nums",
                        v === n ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-input")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}


/**
 * WHAT THE GROWTH QUESTION NEEDS AND THE PLAN DOES NOT HOLD (§6.128.3).
 *
 * Two numbers, and both are a tolerance rather than a fact: how low the owner is willing to let cash go,
 * and what their money costs. The forecast can say what cash does; only the owner can say what is too
 * low. Before these existed the lowest-month card graded itself against "above zero", which is a much
 * weaker test than the card's own wording described.
 *
 * The range beneath them is the year in one line: the worst month against the floor and against nothing.
 */
function GrowInputs({ growth, onGrowth, metrics, money }: {
  growth: Growth; onGrowth: (g: Growth) => void; metrics: Metric[]; money: (v: number) => string;
}) {
  const num = (v: string) => Number(v.replace(/[^0-9.-]/g, "")) || 0;
  const low = metrics.find((x) => x.key === "lowestCash");
  const lowCash = low?.value ?? null;
  const top = Math.max(growth.cashBuffer * 3, Math.abs(lowCash ?? 0) * 2, 100_000);
  const floorAt = Math.max(growth.cashBuffer, 0);

  return (
    <>
      <TileRow>
        <StatTile label="Cash floor" value={growth.cashBuffer ? money(growth.cashBuffer) : "Not set"}
          sub="How low you will let the bank balance go">
          <CellInput numeric className="mt-1.5 w-full" placeholder="0"
            value={growth.cashBuffer || ""} onChange={(e) => onGrowth({ ...growth, cashBuffer: num(e.target.value) })} />
        </StatTile>
        <StatTile label="Cost of capital" value={`${growth.costOfCapital}%`} sub="What the money funding this costs">
          <CellInput numeric className="mt-1.5 w-full" value={growth.costOfCapital}
            onChange={(e) => onGrowth({ ...growth, costOfCapital: num(e.target.value) })} />
        </StatTile>
      </TileRow>

      <section className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-semibold">The worst month of Year 1</span>
          <span className="text-[11.5px] text-muted-foreground">Closing bank balance at its lowest point</span>
        </div>
        {lowCash === null ? (
          <Note>No monthly cash forecast yet. Fill in your sales and costs and this draws itself.</Note>
        ) : (
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
        )}
      </section>
    </>
  );
}


function ValuationRange({ sale, metrics, input, money }: {
  sale: Sale; metrics: Metric[]; input: CapabilityInput; money: (v: number) => string;
}) {
  const y1 = input.pnl[1];
  const e = y1 ? y1.operatingProfit + y1.depreciation + sale.addBacks : null;
  if (e === null || e <= 0) {
    return (
      <section className="border-b border-border px-5 py-4">
        <span className="text-[12.5px] font-semibold">What the earnings support</span>
        <Note>
          {y1 ? "This plan's Year 1 earnings are not positive, so there is no multiple to apply. A buyer prices a loss on assets, not on earnings." : "No forecast yet, so there is nothing to value."}
        </Note>
      </section>
    );
  }
  const lowV = e * sale.multipleLow, highV = e * sale.multipleHigh;
  const top = Math.max(highV, sale.askingPrice) * 1.2;
  const mult = metrics.find((x) => x.key === "priceMultiple")?.value ?? null;

  return (
    <section className="border-b border-border px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">What the earnings support</span>
        <span className="text-[11.5px] text-muted-foreground">
          {money(e)} of normalised earnings at {sale.multipleLow}× to {sale.multipleHigh}×
        </span>
      </div>
      <RangeBar
        min={0} max={top}
        zones={[{ from: lowV, to: highV, severity: "good" }, { from: highV, to: top, severity: "bad" }]}
        marks={[
          { at: (lowV + highV) / 2, label: `Midpoint ${money((lowV + highV) / 2)}`, below: true },
          ...(sale.askingPrice > 0
            ? [{ at: Math.min(sale.askingPrice, top), label: `Asking ${money(sale.askingPrice)}`,
                 tone: sale.askingPrice > highV ? ("bad" as const) : undefined }]
            : []),
        ]}
        ticks={[0, top / 2, top]} format={(t) => money(t)}
      />
      {sale.askingPrice > highV && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          <b className="font-semibold text-foreground">{money(sale.askingPrice - highV)}</b> above the top of the range
          {mult ? ` — ${mult}× against a ceiling of ${sale.multipleHigh}×` : ""}.
        </p>
      )}
    </section>
  );
}
