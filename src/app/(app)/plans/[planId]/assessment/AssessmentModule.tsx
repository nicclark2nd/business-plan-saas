"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { Note } from "@/components/module/DataGrid";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/MoneyProvider";
import type { BridgeStep, Issue } from "@/engine/capability/assessment";
import type { Severity } from "@/engine/capability/model";
import type { AgreedTargets } from "@/engine/capability/targets";
import { continueFromAssessment } from "./actions";
import { TargetControl } from "./TargetControl";

type Score = { kind: "grow" | "borrow" | "sell"; value: number | null; band: Severity | null; label: string; headline: string };
type Ask = { label: string; why: string; done: boolean; to: string };
export type AssessmentData =
  | { hasHistory: false; adviser: boolean }
  | {
      hasHistory: true; adviser: boolean; span: string; lastYear: number; prevYear: number | null;
      scores: Score[]; profit: BridgeStep[] | null; cash: BridgeStep[] | null; issues: Issue[]; asks: Ask[];
      firstYear: number; agreed: AgreedTargets;
      /** The two targets that are also plan settings, as the plan holds them now. */
      settings: { cashFloor: number | null; loanTermMonths: number | null };
    };

const STEP = GUIDED_STEPS.find((s) => s.id === "assessment")?.step ?? 8;
const NAME = { grow: "Capability to grow", borrow: "Capability to borrow", sell: "Capability to sell" };
const LINK = "font-semibold text-primary underline-offset-2 hover:underline";

/**
 * THE PLANNER'S ASSESSMENT (§6.164).
 *
 * Four things, in the order a Planner uses them before the plan is built: where the business stands on each
 * capability; WHY profit and cash moved; the problems that matter, each with its number, its likely cause,
 * the direction the plan should take and the question to put to the client; and what is still to be
 * collected from the client. It reads the accounts only — the plan does not exist yet.
 */
export function AssessmentModule({ planId, mode, data }: { planId: string; mode: "guided" | "advanced"; data: AssessmentData }) {
  const [, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    const nothingToFix = data.hasHistory && data.issues.length === 0;
    start(async () => { await continueFromAssessment(planId, intent, nothingToFix); });
  };
  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("assessment")} title="Planner's assessment"
      subtitle="Where the business stands, from its accounts — before the plan is built" mode={mode}
      areas={[{ key: "main", label: data.hasHistory ? `From the accounts, ${data.span}` : "No accounts" }]} area="main" onArea={() => {}}
      scope={{ label: data.hasHistory ? `Actual ${data.span}` : "No accounts" }}
      footer={<ModuleFooter planId={planId} moduleId="assessment" formId="assessment-form" />}
      help={<>
        <h3>What this step is for</h3>
        <p>Before any projection is typed, the Planner reads the accounts and decides what the plan has to fix. This screen does that reading: how the business stands on growing, borrowing and selling, why profit and cash moved, and the problems that matter most — each with the direction the plan should take and the question to ask the client.</p>
        <h3>Where it goes next</h3>
        <p>The directions here are what the Sales, COGS, Overheads, Funding and Assumptions steps should be built to. At the end, Financial Capabilities checks whether the plan got there.</p>
        <h3>Agreeing the targets</h3>
        <p>Each problem comes with a target proposed from the accounts. Agree it as it is, or type the figure you and the client settle on and agree that. The cash floor and the term of the loans already owed are also settings the plan runs on, so agreeing them here sets them on Assumptions and Funding — unless a different figure has already been typed there, which is left alone.</p>
      </>}
    >
      <form id="assessment-form" onSubmit={onSubmit} className="hidden" />
      {!data.hasHistory ? <NoAccounts planId={planId} /> : <Assessment planId={planId} d={data} />}
    </ModuleFrame>
  );
}

function NoAccounts({ planId }: { planId: string }) {
  return (
    <div className="px-5 py-6 text-[13.5px] leading-relaxed">
      <p className="font-semibold">There are no accounts in Historic, so there is nothing to assess yet.</p>
      <p className="mt-1 text-muted-foreground">
        For a new business the plan comes first. Build it, and <Link className={LINK} href={`/plans/${planId}/capabilities`}>Financial Capabilities</Link> will
        assess it afterwards — including in which of the five years it could grow, borrow or sell. If the business
        does have accounts, add them on <Link className={LINK} href={`/plans/${planId}/historic`}>Historic</Link> and this step reads them.
      </p>
    </div>
  );
}

function Assessment({ planId, d }: { planId: string; d: Extract<AssessmentData, { hasHistory: true }> }) {
  const num = useMoney();
  const open = d.asks.filter((a) => !a.done).length;
  const [agreed, setAgreed] = useState<AgreedTargets>(d.agreed);
  const [settings, setSettings] = useState(d.settings);
  const agreedCount = d.issues.filter((i) => agreed[i.target.kind]).length;
  const settingOf = (i: Issue) => (i.target.kind === "cashFloor" ? settings.cashFloor : i.target.kind === "loanTermMonths" ? settings.loanTermMonths : undefined);
  return (
    <>
      {/* ---- where it stands ---- */}
      <section className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
        {d.scores.map((s) => (
          <Link key={s.kind} href={`/plans/${planId}/capabilities`} className="block bg-card px-5 py-4 hover:bg-secondary/40">
            <div className="text-[12px] font-semibold text-muted-foreground">{NAME[s.kind]}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn("text-[30px] font-semibold tabular-nums", s.band === "good" && "text-good", s.band === "watch" && "text-warn", s.band === "bad" && "text-bad")}>{s.value ?? "—"}</span>
              <span className={cn("text-[12.5px] font-semibold", s.band === "good" && "text-good", s.band === "watch" && "text-warn", s.band === "bad" && "text-bad")}>{s.label}</span>
            </div>
            <div className="mt-0.5 text-[12.5px]">{s.headline}</div>
          </Link>
        ))}
      </section>

      {/* ---- why ---- */}
      {(d.profit || d.cash) && (
        <section className="grid gap-px border-b border-border bg-border lg:grid-cols-2">
          {d.profit && <Bridge title={`Why operating profit moved, ${d.prevYear} → ${d.lastYear}`} steps={d.profit} num={num} />}
          {d.cash && <Bridge title={`Where the cash went in ${d.lastYear}`} steps={d.cash} num={num} />}
        </section>
      )}

      {/* ---- what to fix, and the direction for the plan ---- */}
      <section className="border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold">What the plan has to fix</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Most urgent first — anything that threatens the loans or the bank — then by the money at stake.
          {d.issues.length > 0 && <> Each has a target proposed from the accounts: agree it, or change the figure first. <span className="font-semibold text-foreground">{agreedCount} of {d.issues.length} agreed.</span></>}
        </p>
        {d.issues.length === 0
          ? <p className="mt-3 text-[13px]">Nothing in the accounts stands out as a problem. The plan can be built for growth.</p>
          : (
            <ol className="mt-3 space-y-3">
              {d.issues.map((i, n) => (
                <li key={i.key} className={cn("rounded-md border px-4 py-3", i.urgent ? "border-bad/40 bg-bad-soft" : "border-border bg-card")}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-semibold text-muted-foreground">{n + 1}.</span>
                    <h3 className="text-[14px] font-semibold">{i.title}</h3>
                    {i.urgent && <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-bad">First</span>}
                  </div>
                  <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-[13px] leading-relaxed sm:grid-cols-[150px_minmax(0,1fr)]">
                    <dt className="font-semibold text-muted-foreground">The accounts show</dt><dd>{i.finding}</dd>
                    <dt className="font-semibold text-muted-foreground">Likely cause</dt><dd>{i.cause}</dd>
                    <dt className="font-semibold text-muted-foreground">Direction for the plan</dt>
                    <dd>{i.direction} <Link className={LINK} href={`/plans/${planId}/${i.where.to}`}>{i.where.label} →</Link></dd>
                    <dt className="font-semibold text-muted-foreground">{d.adviser ? "Ask the client" : "Ask yourself"}</dt><dd className="italic">{i.ask}</dd>
                  </dl>
                  <TargetControl planId={planId} proposed={i.target} agreed={agreed[i.target.kind]} setting={settingOf(i)} firstYear={d.firstYear}
                    onSaved={(t, value) => {
                      setAgreed(t);
                      if (i.target.kind === "cashFloor") setSettings((s) => ({ ...s, cashFloor: value }));
                      if (i.target.kind === "loanTermMonths") setSettings((s) => ({ ...s, loanTermMonths: value }));
                    }} />
                </li>
              ))}
            </ol>
          )}
      </section>

      {/* ---- what to collect ---- */}
      <section className="px-5 py-4">
        <h2 className="text-[15px] font-semibold">{d.adviser ? "Still to collect from the client" : "Still to fill in"}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {open === 0 ? "Everything a lender or buyer would ask for is in." : `${open} of ${d.asks.length} still open — the agenda for the next meeting.`}
        </p>
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {d.asks.map((a) => (
            <li key={a.label} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
              <span className={cn("size-2 shrink-0 rounded-full", a.done ? "bg-good" : "bg-warn")} />
              <span className={cn("font-medium", a.done && "text-muted-foreground")}>{a.label}</span>
              <span className="text-[12px] text-muted-foreground">{a.why}</span>
              <Link className={cn(LINK, "ml-auto text-[12.5px]")} href={`/plans/${planId}/${a.to}`}>{a.done ? "Review" : "Add"} →</Link>
            </li>
          ))}
        </ul>
        <Note>Every figure here comes from Historic, and nothing here changes it. Agreeing a target records it for the plan; the cash floor and the loan term are also set where the plan reads them.</Note>
      </section>
    </>
  );
}

/** A bridge drawn as rows: where it started, each step up or down, where it ended. */
function Bridge({ title, steps, num }: { title: string; steps: BridgeStep[]; num: (v: number) => string }) {
  const max = Math.max(1, ...steps.map((s) => Math.abs(s.value)));
  const signed = (v: number) => (v < 0 ? `(${num(-v)})` : num(v));
  return (
    <div className="bg-card px-5 py-4">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      <div className="mt-2 space-y-1">
        {steps.map((s) => {
          const w = `${Math.max(1.5, (Math.abs(s.value) / max) * 100)}%`;
          const tone = s.kind === "step" ? (s.value < 0 ? "bg-bad" : "bg-good") : "bg-foreground/60";
          return (
            <div key={s.label} className={cn("grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_90px] items-center gap-2 text-[12.5px]", s.kind !== "step" && "font-semibold")}>
              <span className="truncate">{s.label}</span>
              <span className="flex h-3.5 items-center"><span className={cn("h-full rounded-sm", tone)} style={{ width: w }} /></span>
              <span className={cn("text-right tabular-nums", s.kind === "step" && s.value < 0 && "text-bad")}>{s.kind === "step" && s.value > 0 ? "+" : ""}{signed(s.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
