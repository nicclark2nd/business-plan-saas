"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldInput } from "@/components/module/FieldGrid";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type CashTiming, type WorkingCapitalDays } from "@/engine/forecast/model";
import { creditorBalance, debtorBalance, inventoryBalance } from "@/engine/forecast/assumptions";
import { SUGGESTED_COST_OF_CAPITAL, SUGGESTED_STRESS, type Growth, type Stress } from "@/engine/capability/judgements";
import { continueFromAssumptions, revertToHistoricDays, saveAssumptions, saveCapitalAssumptions } from "./actions";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";

const box = "h-8";
const STEP = GUIDED_STEPS.find((s) => s.id === "assumptions")?.step ?? 14;

type AreaKey = "days" | "cash" | "downside";
type CapKey = "cash_floor" | "cost_of_capital" | "stress_sales_pct" | "stress_margin_pts" | "stress_debtor_days";

/** A stored figure into a box: null becomes empty, and empty is what "nobody has said" looks like. */
const str = (v: number | null) => (v === null ? "" : String(v));
/**
 * A box back into a stored figure. An empty box is NULL, not nought — clearing the cash floor unsays the
 * answer rather than committing the client to running at zero (§6.89).
 */
const numOrNull = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : null;
};

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
  growth, stress, impliedCost, lowestMonth, initialArea,
}: {
  planId: string; mode: "guided" | "advanced";
  /** Year 1–5 revenue and cost of sales, so each day can show what it is worth (§6.43).  */
  revenue: number[]; cogs: number[];
  workingCapital: Record<number, WorkingCapitalDays>; cashTiming: Record<number, CashTiming>;
  impliedFromHistory: WorkingCapitalDays | null; assumptionsSet: boolean;
  /**
   * The five figures the capability dials need and the forecast cannot produce (§6.129). Stored nullable,
   * read nullable, and never defaulted behind the client's back: a cash floor of zero is an answer and a
   * blank one is silence (§6.89).
   */
  growth: Growth; stress: Stress;
  /** The dearest interest rate on Funding, offered as a starting point for the cost of capital. */
  impliedCost: number | null;
  /** The worst month this forecast actually reaches, so a floor is typed against a figure. */
  lowestMonth: number | null;
  /** Which tab to open on, so a pencil from Financial Capabilities lands on the box it promised. */
  initialArea: AreaKey;
}) {
  const num = useMoney();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wc, setWc] = useState(workingCapital);
  const [ct, setCt] = useState(cashTiming);
  const [err, setErr] = useState<string>();
  const [revert, setRevert] = useState(false);
  const [area, setArea] = useState<AreaKey>(initialArea);
  /**
   * RAW STRINGS, PARSED ON BLUR. A box that runs every keystroke through Number() and feeds the result back
   * cannot have a decimal point typed into it — 1.5 arrives as 1, then 15. That fault was found and fixed on
   * the Goals KPI targets; it is not being rebuilt here.
   */
  const [cap, setCap] = useState<Record<CapKey, string>>({
    cash_floor: str(growth.cashBuffer), cost_of_capital: str(growth.costOfCapital),
    stress_sales_pct: str(stress.salesPct), stress_margin_pts: str(stress.marginPts),
    stress_debtor_days: str(stress.debtorDaysAdded),
  });
  /*
   * THE SAVE READS A REF, NOT THE CLOSURE (§6.129).
   *
   * `commitCap` used to read `cap[k]` straight out of the render it was created in, which is right only if a
   * re-render always lands between the last keystroke and the blur. Caught on the built screen: two boxes
   * filled in quick succession saved one figure and silently dropped the other — the same shape as the KPI
   * row that lost its unit on the Goals ladder, and the same fix. The ref is written on every edit, so the
   * blur always sends what is actually in the box.
   */
  const capRef = useRef(cap); useEffect(() => { capRef.current = cap; }, [cap]);
  const editCap = (k: CapKey, v: string) => {
    const next = { ...capRef.current, [k]: v };
    capRef.current = next;
    setCap(next);
  };
  const commitCap = (k: CapKey) => start(async () => {
    const r = await saveCapitalAssumptions(planId, { [k]: numOrNull(capRef.current[k]) });
    if (!r.ok) setErr(r.error); else { setErr(undefined); router.refresh(); }
  });
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    /* The grid has already saved itself on blur (§6.10); this only moves the client along the path. */
    start(async () => { await continueFromAssumptions(planId, intent); });
  };

  /*
   * "Not set" means NOT SET, on the tab as well as in the dial. Both flags read the stored values rather
   * than the boxes, so a half-typed figure does not make a tab claim it is answered.
   */
  const capitalSet = growth.cashBuffer !== null || growth.costOfCapital !== null;
  const stressSet = stress.salesPct !== null && stress.marginPts !== null && stress.debtorDaysAdded !== null;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length}
      group={navGroup("assumptions")} title="Assumptions" subtitle="How fast money comes in and goes out" mode={mode}
      /*
       * THREE AREAS, AND THE TWO NEW ONES ARE HERE FOR A REASON (§6.129). A cash floor, a cost of capital
       * and a downside case were all typed on the Financial Capabilities dashboard and lost on refresh.
       * They are assumptions about how the business is run and how bad a year it is asked to survive, which
       * is this screen's subject — and step 14 is on the guided path, so the client is actually asked.
       */
      areas={[
        { key: "days", label: "Days & timing", tag: assumptionsSet ? undefined : "not set" },
        { key: "cash", label: "Cash & capital", tag: capitalSet ? undefined : "not set" },
        { key: "downside", label: "Downside", tag: stressSet ? undefined : "not set" },
      ]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "Five years" }}
      footer={<ModuleFooter planId={planId} moduleId="assumptions" formId="assumptions-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Debtor days</b> is how long your clients actually take to pay, not what your invoice says. The figure under each box is what that many days holds in debtors — money earned, counted as profit, and not in the bank.</p>
        <p><b>Creditor days</b> is the same arithmetic in your favour. Longer is cash in your pocket, up to the point where a supplier stops delivering.</p>
        <p>Leave them all at zero and the forecast assumes every client pays on the day of the job and every bill is settled the same day. That is not conservative — it is the most optimistic cash flow that can be drawn.</p>
        <h3>Cash &amp; capital</h3>
        <p><b>Cash floor</b> is the lowest balance you are willing to let the business reach — not a prediction, a tolerance. <b>Cost of capital</b> is what the money funding the plan costs you a year; growth that returns less than that is spending, not investing.</p>
        <h3>Downside</h3>
        <p>One bad year, described in three numbers. Nothing here changes the forecast — it is a second, worse reading of the same plan, and it is what the stressed cover figure on Financial Capabilities is measured against. All three have to be answered before that figure can be calculated.</p>
        <h3>Where this goes</h3>
        <p>Days and timing drive every figure on the <b>Cash Flow</b>, and the debtors, stock and creditors on the <b>Balance Sheet</b>. Nothing there touches the profit and loss: when money moves does not change what was earned.</p>
        <p>Cash &amp; capital and the Downside are read by <b>Financial Capabilities</b> — the growth dials and the stressed debt-service cover. They are stored here so the score means the same thing next week.</p>
      </>}
    >
      {err && <Note><span className="text-bad">{err}</span></Note>}
      {/* The footer's buttons submit this; every area on the screen saves on blur. */}
      <form id="assumptions-form" onSubmit={onSubmit} className="hidden" />

      {area === "days" && (
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

      {/*
        * CASH & CAPITAL (§6.129). Two figures, and neither is a fact the forecast can produce: how low the
        * client is willing to let cash go, and what their money costs. Both were typed on the Financial
        * Capabilities dashboard and lost on refresh, which made the growth score change every visit.
        */}
      {area === "cash" && (
        <>
          <Toolbar><Meta className="ml-0">
            {capitalSet
              ? <>Two judgements the forecast cannot make for you. The growth dials read them.</>
              : <span className="text-warn">Not set yet — the growth capability cannot judge the cash floor or the return until these are answered.</span>}
          </Meta></Toolbar>
          <Section title="Cash & capital">
            <FieldGrid>
              <Field span={2} label="Cash floor"
                hint={lowestMonth === null
                  ? "The lowest balance you are willing to let the business reach. Zero is a real answer: it means \u201Cjust don\u2019t go negative\u201D."
                  : `The lowest balance you are willing to reach. This forecast\u2019s worst month closes at ${num(lowestMonth)}.`}>
                <FieldInput numeric placeholder="Not set" disabled={pending}
                  value={cap.cash_floor} onChange={(e) => editCap("cash_floor", e.target.value)}
                  onBlur={() => commitCap("cash_floor")} />
              </Field>
              <Field span={2} label="Cost of capital %"
                hint={impliedCost === null
                  ? `What the money funding this plan costs you a year. Growth has to beat it to be worth doing. ${SUGGESTED_COST_OF_CAPITAL}% is a common starting point.`
                  : `What the money costs you a year. Your dearest loan on Funding is ${impliedCost}%, and equity costs more than debt.`}>
                <FieldInput numeric placeholder="Not set" disabled={pending}
                  value={cap.cost_of_capital} onChange={(e) => editCap("cost_of_capital", e.target.value)}
                  onBlur={() => commitCap("cost_of_capital")} />
              </Field>
            </FieldGrid>
          </Section>
          <Note>
            Clearing a box is not the same as typing 0. Empty means you have not said, and the dial that
            reads it stays grey rather than guessing.
          </Note>
        </>
      )}

      {/*
        * THE DOWNSIDE (§6.129). A stress case is a standing second view of the plan, not an experiment,
        * which is why it is stored here and not in What-If: What-If applies its changes TO the plan and the
        * plan becomes them, while these three never touch a forecast figure. A lender reading a stressed
        * debt-service cover has to be told which three numbers made it stressed.
        */}
      {area === "downside" && (
        <>
          <Toolbar><Meta className="ml-0">
            {stressSet
              ? <>A bad year, described once. The borrowing capability tests every cover figure against it.</>
              : <span className="text-warn">Not set yet — stressed debt-service cover cannot be calculated until all three are answered.</span>}
          </Meta></Toolbar>
          <Section title="A bad year">
            <FieldGrid>
              <Field span={2} label="Sales fall by %"
                hint={`How far revenue could drop and the business still be recognisable. ${SUGGESTED_STRESS.salesPct}% is a common bank test.`}>
                <FieldInput numeric placeholder="Not set" disabled={pending}
                  value={cap.stress_sales_pct} onChange={(e) => editCap("stress_sales_pct", e.target.value)}
                  onBlur={() => commitCap("stress_sales_pct")} />
              </Field>
              <Field span={2} label="Gross margin falls by points"
                hint={`Percentage POINTS, not percent: a 40% margin losing ${SUGGESTED_STRESS.marginPts} points becomes ${40 - SUGGESTED_STRESS.marginPts}%.`}>
                <FieldInput numeric placeholder="Not set" disabled={pending}
                  value={cap.stress_margin_pts} onChange={(e) => editCap("stress_margin_pts", e.target.value)}
                  onBlur={() => commitCap("stress_margin_pts")} />
              </Field>
              <Field span={2} label="Customers pay this many days later"
                hint={`On top of the debtor days on the first tab. ${SUGGESTED_STRESS.debtorDaysAdded} days is what a slow quarter looks like.`}>
                <FieldInput numeric placeholder="Not set" disabled={pending}
                  value={cap.stress_debtor_days} onChange={(e) => editCap("stress_debtor_days", e.target.value)}
                  onBlur={() => commitCap("stress_debtor_days")} />
              </Field>
            </FieldGrid>
          </Section>
          <Note>
            Nothing here changes the forecast. It is a second, worse reading of the same plan, used to ask
            whether the debt would still be covered — which is the question a lender asks before the good one.
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
