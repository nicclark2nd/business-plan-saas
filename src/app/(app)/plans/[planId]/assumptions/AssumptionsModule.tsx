"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleStatusFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type CashTiming, type WorkingCapitalDays } from "@/engine/forecast/model";
import { creditorBalance, debtorBalance, inventoryBalance } from "@/engine/forecast/assumptions";
import { revertToHistoricDays, saveAssumptions } from "./actions";
import { navGroup } from "@/lib/nav";

const box = "h-8";

/**
 * Assumptions, its own module under Financials (§6.79).
 *
 * §6.43.1 already made the argument and then only half-acted on it: debtor, stock and creditor days are an
 * INPUT — a thing the client types — so the menu item was moved up to Financials with the rest of the
 * inputs. But it was a deep link, and the grid itself stayed a tab on Review forecast. Once the three
 * statements left for modules of their own, Review forecast was a screen called "Checks & assumptions",
 * which is two unrelated jobs sharing a tab because of where the code happened to live.
 *
 * So the grid comes to the menu item rather than the menu item pointing at the grid, and Review forecast
 * goes back to being one thing: the checks.
 */
export function AssumptionsModule({
  planId, mode, revenue, cogs, workingCapital, cashTiming, impliedFromHistory, assumptionsSet,
}: {
  planId: string; mode: "guided" | "advanced";
  /** Year 1–5 revenue and cost of sales, so each day can show what it is worth (§6.43).  */
  revenue: number[]; cogs: number[];
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
   * The grid is edited locally and saved on blur, so it is state — but the plan can move underneath it
   * (a revert here, or the days saved from the What-If planner), and `useState` would hold the old figures
   * on screen. Adjusted during render off the prop, so the corrected grid paints first time.
   */
  const [gridFrom, setGridFrom] = useState(workingCapital);
  if (workingCapital !== gridFrom) { setGridFrom(workingCapital); setWc(workingCapital); setCt(cashTiming); }

  const save = (nextWc = wc, nextCt = ct) => start(async () => {
    const r = await saveAssumptions(planId, { workingCapital: nextWc, cashTiming: nextCt });
    if (!r.ok) setErr(r.error); else { setErr(undefined); router.refresh(); }
  });
  const setDays = (year: number, key: keyof WorkingCapitalDays, raw: string) => {
    setWc({ ...wc, [year]: { ...wc[year], [key]: Math.min(365, Math.max(0, Math.round(Number(raw) || 0))) } });
  };
  const setTiming = (year: number, key: keyof CashTiming, raw: string) => {
    const v = Number(raw) || 0;
    setCt({ ...ct, [year]: { ...ct[year], [key]: key === "taxPaidPct" ? Math.min(100, Math.max(0, v)) : Math.max(0, v) } });
  };

  return (
    <ModuleFrame
      group={navGroup("assumptions")} title="Assumptions" subtitle="How fast money comes in and goes out" mode={mode}
      areas={[{ key: "days", label: "Days & timing", tag: assumptionsSet ? undefined : "not set" }]}
      area="days" onArea={() => {}} scope={{ label: "Five years" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Debtor days</b> is how long your clients actually take to pay, not what your invoice says. The figure under each box is what that many days holds in debtors — money earned, counted as profit, and not in the bank.</p>
        <p><b>Creditor days</b> is the same arithmetic in your favour. Longer is cash in your pocket, up to the point where a supplier stops delivering.</p>
        <p>Leave them all at zero and the forecast assumes every client pays on the day of the job and every bill is settled the same day. That is not conservative — it is the most optimistic cash flow that can be drawn.</p>
        <h3>Where this goes</h3>
        <p>Every figure on the <b>Cash Flow</b>, and the debtors, stock and creditors on the <b>Balance Sheet</b>. Nothing here touches the profit and loss: when money moves does not change what was earned.</p>
      </>}
    >
      {err && <Note><span className="text-bad">{err}</span></Note>}
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
