"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { useMoney } from "@/components/MoneyProvider";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type CashTiming, type Forecast, type WorkingCapitalDays } from "@/engine/forecast/model";
import { creditorBalance, debtorBalance, inventoryBalance } from "@/engine/forecast/assumptions";
import { revertToHistoricDays, saveAssumptions } from "./actions";

/**
 * Review forecast (§6.32.3, §6.78) — do the statements agree, and what are the days driving them.
 *
 * It began as four tabs, on the rule that **three statements that must agree belong on one screen.** All
 * three have left: the profit and loss in §6.76, the balance sheet in §6.77, the cash flow in §6.78, each
 * to a module with tiles, a chart and a reading of its own. What the rule was protecting went with them —
 * it was never the adjacency, it was the CHECK, and the reconciliation strip renders above every statement
 * in the product, so a client learns whether the figures agree before reading one, wherever they stand.
 *
 * What is left is the question no single statement answers, which is what step 13 was always for: whether
 * the plan holds together, and the days that decide it. One area rather than four, and that is honest —
 * a tab bar of one is a smaller thing to explain than three statements pretending they still live here.
 */
const STEP = GUIDED_STEPS.find((s) => s.id === "forecast")?.step ?? 13;
const box = "h-8";

export function ForecastModule({
  planId, mode, forecast, workingCapital, cashTiming, impliedFromHistory, assumptionsSet,
}: {
  planId: string; mode: "guided" | "advanced"; forecast: Forecast;
  workingCapital: Record<number, WorkingCapitalDays>; cashTiming: Record<number, CashTiming>;
  impliedFromHistory: WorkingCapitalDays | null; assumptionsSet: boolean;
}) {
  const num = useMoney();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wc, setWc] = useState(workingCapital);
  const [ct, setCt] = useState(cashTiming);
  const [err, setErr] = useState<string>();
  const [revert, setRevert] = useState(false);
  /**
   * The grids are edited locally and saved on blur, so they are state — but the plan can move underneath
   * them (a revert here, or the days saved from the What-If planner), and `useState` would hold the old
   * figures on screen while the statements above showed the new ones. Adjusted during render off the prop,
   * so the corrected grid paints first time instead of flashing the old one.
   */
  const [gridFrom, setGridFrom] = useState(workingCapital);
  if (workingCapital !== gridFrom) { setGridFrom(workingCapital); setWc(workingCapital); setCt(cashTiming); }

  const failures = forecast.invariants.filter((i) => !i.passed);
  const pnl = forecast.pnl;

  const save = (nextWc = wc, nextCt = ct) => start(async () => {
    const r = await saveAssumptions(planId, { workingCapital: nextWc, cashTiming: nextCt });
    if (!r.ok) setErr(r.error); else { setErr(undefined); router.refresh(); }
  });
  const setDays = (year: number, key: keyof WorkingCapitalDays, raw: string) => {
    const next = { ...wc, [year]: { ...wc[year], [key]: Math.min(365, Math.max(0, Math.round(Number(raw) || 0))) } };
    setWc(next);
  };
  const setTiming = (year: number, key: keyof CashTiming, raw: string) => {
    const v = Number(raw) || 0;
    const next = { ...ct, [year]: { ...ct[year], [key]: key === "taxPaidPct" ? Math.min(100, Math.max(0, v)) : Math.max(0, v) } };
    setCt(next);
  };

  const revenue = useMemo(() => FORECAST_YEARS.map((y) => pnl[y].revenue), [pnl]);
  const cogs = useMemo(() => FORECAST_YEARS.map((y) => pnl[y].cogs), [pnl]);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Forecasts" title="Review forecast"
      subtitle="Whether the statements agree, and the days that drive them" mode={mode}
      areas={[{ key: "assumptions", label: "Checks & assumptions", tag: assumptionsSet ? undefined : "not set" }]}
      area="assumptions" onArea={() => {}} scope={{ label: "Five years" }}
      footer={<ModuleFooter planId={planId} prevId="extraordinary" formId="forecast-form" />}
      help={<>
        <h3>What this screen is for</h3>
        <p><b>The checks</b> above every statement in the product are computed here. The balance sheet has to balance, the profit has to explain the cash, and each year has to open where the last one closed — in all five years. Until they pass, the plan is not worth printing.</p>
        <p><b>Assumptions</b> — debtor days, creditor days and tax timing. Leave them at zero and the forecast assumes every client pays on the day of the job and every bill is settled the same day. That is not conservative, it is the most optimistic cash flow that can be drawn.</p>
        <h3>Where the statements went</h3>
        <p><b>Profit &amp; Loss</b>, <b>Balance Sheet</b> and <b>Cash Flow</b> each have their own screen in this group now, with tiles, a chart and readings this table could never give. They are built from the same run of the same forecast, so they cannot disagree — and the strip above says so on every one of them.</p>
      </>}
    >
      <form id="forecast-form" className="hidden" />
      <Reconciled failures={failures} />
      {err && <Note><span className="text-bad">{err}</span></Note>}

      {/*
        * The profit and loss moved to its own module (§6.76). What stays here is the question step 13
        * actually asks — whether the three statements hold together — and the two that had nowhere else
        * to be read from.
        */}
      {(
        <>
          <Toolbar><Meta className="ml-0">
            {assumptionsSet
              ? <>How fast money comes in and goes out. Every figure on the cash flow moves with these.</>
              : <span className="text-warn">Not set yet — the forecast is using {impliedFromHistory ? "days implied by your history" : "30 days in, 30 days out"}. Check them against how the business actually trades.</span>}
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "28%" }}>Assumption</Th>
              {FORECAST_YEARS.map((y) => <Th key={y} right style={{ width: 130 }}>Year {y}</Th>)}
            </tr></thead>
            <tbody>
              <DaysRow label="Debtor days" hint="How long clients take to pay. Each day holds this much in debtors."
                value={(y) => wc[y].debtorDays} onChange={(y, v) => setDays(y, "debtorDays", v)} onBlur={() => save()}
                worth={(y) => debtorBalance(revenue[y - 1], wc[y].debtorDays)} num={num} pending={pending} />
              <DaysRow label="Stock days" hint="How long stock and work in progress sit before they are sold."
                value={(y) => wc[y].inventoryDays} onChange={(y, v) => setDays(y, "inventoryDays", v)} onBlur={() => save()}
                worth={(y) => inventoryBalance(cogs[y - 1], wc[y].inventoryDays)} num={num} pending={pending} />
              <DaysRow label="Creditor days" hint="How long you take to pay suppliers. Longer is cash in your pocket."
                value={(y) => wc[y].creditorDays} onChange={(y, v) => setDays(y, "creditorDays", v)} onBlur={() => save()}
                worth={(y) => creditorBalance(cogs[y - 1], wc[y].creditorDays)} num={num} pending={pending} />
              <GridRow>
                <AssumptionLabel label="Tax paid in year" hint="What is left is owed at year end." />
                {FORECAST_YEARS.map((y) => (
                  <Td key={y} right>
                    <span className="relative block">
                      <Input inputMode="decimal" disabled={pending} className={cn(box, "num pr-6 text-right")}
                        value={String(ct[y].taxPaidPct)} onChange={(e) => setTiming(y, "taxPaidPct", e.target.value)} onBlur={() => save()} />
                      <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </span>
                  </Td>
                ))}
              </GridRow>
              <MoneyRow label="Prepayments at year end" hint="Paid in advance — insurance, rent, registrations."
                value={(y) => ct[y].prepaidClosing} onChange={(y, v) => setTiming(y, "prepaidClosing", v)} onBlur={() => save()} pending={pending} />
              <MoneyRow label="Accruals at year end" hint="Incurred but not yet billed to you."
                value={(y) => ct[y].accruedClosing} onChange={(y, v) => setTiming(y, "accruedClosing", v)} onBlur={() => save()} pending={pending} />
            </tbody>
          </Grid>
          <Note>
            {impliedFromHistory
              ? <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span>Your own accounts imply {impliedFromHistory.debtorDays} debtor days, {impliedFromHistory.inventoryDays} stock days and {impliedFromHistory.creditorDays} creditor days. A forecast that assumes better terms than the business has ever achieved is the first thing a lender questions.</span>
                  {assumptionsSet && <Button size="sm" variant="outline" onClick={() => setRevert(true)}>Use the days my history implies</Button>}
                </span>
              : <>With no history to read, these start at ordinary trade terms. They are assumptions, not facts — change them to what you can actually collect and actually pay.</>}
          </Note>
        </>
      )}

      {revert && impliedFromHistory && (
        <RevertDays
          implied={impliedFromHistory} current={wc[1]} pending={pending}
          onClose={() => setRevert(false)}
          onConfirm={() => start(async () => {
            const r = await revertToHistoricDays(planId);
            if (!r.ok) { setErr(r.error); return; }
            setErr(undefined); setRevert(false); router.refresh();
          })}
        />
      )}
    </ModuleFrame>
  );
}

/**
 * Handing the days back to the accounts (§6.43.2).
 *
 * Worth confirming, because it overwrites five years of figures somebody may have meant — and worth saying
 * what it really does, which is not "copy today's implied numbers in" but "stop overriding them", so a
 * correction to Historic moves the forecast again.
 */
function RevertDays({ implied, current, pending, onClose, onConfirm }: {
  implied: WorkingCapitalDays; current: WorkingCapitalDays; pending: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const rows: [string, number, number][] = [
    ["Debtor days", current.debtorDays, implied.debtorDays],
    ["Stock days", current.inventoryDays, implied.inventoryDays],
    ["Creditor days", current.creditorDays, implied.creditorDays],
  ];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Use the days my history implies</DialogTitle>
          <DialogDescription>
            All five years go back to reading your last set of accounts. They will keep reading them, so if
            you correct your Historic figures later the forecast follows.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded border border-border">
          {rows.map(([label, from, to]) => (
            <div key={label} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] last:border-b-0">
              <span className="w-28">{label}</span>
              <span className="tabular-nums text-muted-foreground">Year 1: {from}</span>
              <span className="text-muted-foreground">→</span>
              <span className={cn("font-semibold tabular-nums", from !== to && "text-primary")}>{to}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">
          Tax timing, prepayments and accruals are your own judgement and are left exactly as they are.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={onConfirm} disabled={pending}>{pending ? "Reverting…" : "Use my history"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Whether the three statements agree, said before any figure is read rather than buried under them. */
function Reconciled({ failures }: { failures: Forecast["invariants"] }) {
  const num = useMoney();
  if (!failures.length) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded border border-good/40 bg-good-soft px-3 py-1.5 text-[12.5px]">
        <b className="text-good">✓ The statements agree</b>
        <span className="text-muted-foreground">The balance sheet balances, profit explains the cash, and each year opens where the last one closed — in all five years.</span>
      </div>
    );
  }
  const byKey = new Map<string, { label: string; years: number[]; worst: number }>();
  for (const f of failures) {
    const e = byKey.get(f.key) ?? { label: f.label, years: [], worst: 0 };
    e.years.push(f.year);
    if (Math.abs(f.difference) > Math.abs(e.worst)) e.worst = f.difference;
    byKey.set(f.key, e);
  }
  return (
    <div className="mb-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px]">
      <b className="text-bad">The statements do not agree</b>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {[...byKey.values()].map((e) => (
          <li key={e.label}>
            {e.label} — fails in {e.years.length === 5 ? "every year" : `Year ${e.years.join(", ")}`}, out by {num(Math.abs(e.worst))} at worst
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A number of days, with what that many days is actually worth underneath it. */
/**
 * An assumption's name and what it means (§6.65).
 *
 * This was one nowrap line in a 28% column, so every hint ran straight on under the Year 1 input: "How long
 * clients take to pay. Each day holds this much in debtor" with a number box sitting on top of the rest of
 * the sentence. Three rows wrote the same markup by hand, so the fault was in the grid three times over.
 *
 * The hint goes on its own line and is allowed to wrap. Nothing is truncated — the sentence explains what
 * the number does to the cash flow, which is the one thing somebody typing into this screen needs to read.
 */
function AssumptionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <Td wrap>
      <b>{label}</b>
      <div className="mt-px max-w-[46ch] text-[11.5px] leading-snug text-muted-foreground">{hint}</div>
    </Td>
  );
}

function DaysRow({ label, hint, value, onChange, onBlur, worth, num, pending }: {
  label: string; hint: string; value: (y: number) => number; onChange: (y: number, v: string) => void;
  onBlur: () => void; worth: (y: number) => number; num: (v: number) => string; pending: boolean;
}) {
  return (
    <GridRow>
      <AssumptionLabel label={label} hint={hint} />
      {FORECAST_YEARS.map((y) => (
        <Td key={y} right>
          <Input inputMode="numeric" disabled={pending} className={cn(box, "num text-right")}
            value={String(value(y))} onChange={(e) => onChange(y, e.target.value)} onBlur={onBlur} />
          <div className="mt-0.5 text-right text-[11px] text-muted-foreground num">{num(worth(y))}</div>
        </Td>
      ))}
    </GridRow>
  );
}

function MoneyRow({ label, hint, value, onChange, onBlur, pending }: {
  label: string; hint: string; value: (y: number) => number;
  onChange: (y: number, v: string) => void; onBlur: () => void; pending: boolean;
}) {
  return (
    <GridRow>
      <AssumptionLabel label={label} hint={hint} />
      {FORECAST_YEARS.map((y) => (
        <Td key={y} right>
          <Input inputMode="decimal" disabled={pending} className={cn(box, "num text-right")}
            value={String(value(y))} onChange={(e) => onChange(y, e.target.value)} onBlur={onBlur} />
        </Td>
      ))}
    </GridRow>
  );
}

/** Five years, or the twelve months inside the first one. One statement, two spans. */
