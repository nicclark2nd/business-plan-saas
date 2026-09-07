"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, LinkMark, RemoveButton } from "@/components/module/DataGrid";
import { FieldSelect } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { planMonths, planMonthNames } from "@/engine/plan/calendar";
import { cn } from "@/lib/utils";
import { YEARS, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, distributionTotal, type MonthlyDistribution } from "@/engine/sales/projection";
import { enteredByYear, overheadByYear, overheadMonths, overheadsByYear, type Overhead } from "@/engine/overheads/expenses";
import { upsertOverhead, deleteOverhead, saveSyncedShape, saveOnCostPct, continueFromOverheads } from "./actions";
import { SOURCE_LABEL, SOURCE_STEP, type OverheadRow } from "./model";

/**
 * Overheads — what the business costs to run whether or not it sells (§6.19). One list, three dialogs.
 * Two lines are not typed here: the Leadership Team's salaries and the Marketing budget come from the module
 * that owns them, across all five years, and are never grown a second time. They carry the chain back to their
 * source, cannot be deleted, and own only their monthly shape here.
 */
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const parseSigned = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "-" || t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const pct = (v: number | undefined) => v === undefined || v === null ? "" : String(Math.round(v * 10000) / 10000);

type AreaKey = "expenses" | "monthly";
type Dlg = { kind: "expense" | "split"; key: string } | null;
type Row = OverheadRow & { _key: string; _error?: string };
const STEP = GUIDED_STEPS.find((s) => s.id === "overheads")?.step ?? 9;
const isNew = (r: Row) => r.id.startsWith("tmp-");
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";
const START_OPTIONS = YEARS.map((y) => ({ value: String(y), label: y === 1 ? "Year 1" : `Year ${y}` }));

export function OverheadsModule({ planId, initial, mode, salaries, marketing, peopleCount, marketingLines, onCostPct, fyEndMonth }: {
  planId: string; initial: OverheadRow[]; mode: "guided" | "advanced";
  salaries: number[]; marketing: number[]; peopleCount: number; marketingLines: number; onCostPct: number; fyEndMonth: number;
}) {
  const MONTHS = planMonths(fyEndMonth);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map((o) => ({ ...o, _key: o.id })));
  const [onCost, setOnCost] = useState(onCostPct);
  const [onCostText, setOnCostText] = useState<string | null>(null);
  const [area, setArea] = useState<AreaKey>("expenses");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [draftNew, setDraftNew] = useState<Row | null>(null);
  const [error, setErr] = useState<string | undefined>();
  const [pending, start] = useTransition();

  /** The two synced lines always show, whether or not a row exists yet to hold their monthly shape. */
  const syncedFor = (source: "people" | "marketing"): Row => rows.find((r) => r.source === source) ?? {
    id: `tmp-${source}`, _key: `synced-${source}`, source, sort_order: source === "people" ? -2 : -1,
    name: source === "people" ? "Leadership Team salaries" : "Marketing spend",
    current_value: 0, yearly_change: null, monthly_distribution: null, start_year: 1, on_cost: source === "people",
  };
  const syncedValues = (source: "people" | "marketing") => (source === "people" ? salaries : marketing);
  const entered = rows.filter((r) => r.source === "entered" && r.name.trim());
  const lines: Row[] = [syncedFor("people"), syncedFor("marketing"), ...entered];
  const valuesFor = (r: Row) => r.source === "entered" ? enteredByYear(r as Overhead) : overheadByYear(r as Overhead, syncedValues(r.source as "people" | "marketing"));
  const totals = overheadsByYear(lines.map((r) => ({ o: r as Overhead, synced: r.source === "entered" ? null : syncedValues(r.source as "people" | "marketing") })), onCost);
  /** Today's figures, on-costs included, so the "This year" column is the same shape as the years beside it. */
  const thisYear = (() => {
    let wages = 0, other = 0;
    for (const r of lines) {
      const v = r.source === "entered" ? r.current_value : valuesFor(r)[0];
      if (r.on_cost || r.source === "people") wages += v; else other += v;
    }
    const onCosts = Math.round(wages * (Math.max(0, onCost) / 100) * 100) / 100;
    return { wages, other, onCosts, total: Math.round((wages + onCosts + other) * 100) / 100 };
  })();

  const saveRow = (r: Row) => {
    const key = r._key;
    setRows((xs) => (xs.some((x) => x._key === key) ? xs.map((x) => (x._key === key ? r : x)) : [...xs, r]));
    setDlg(null); setDraftNew(null);
    start(async () => {
      const res = r.source === "entered"
        ? await upsertOverhead(planId, { ...r, id: isNew(r) ? undefined : r.id })
        : await saveSyncedShape(planId, r.source as "people" | "marketing", r.monthly_distribution);
      if (!res.ok) setErr(res.error);
      else if (r.source !== "entered") router.refresh();
      else setRows((xs) => xs.map((x) => (x._key === key && res.data ? { ...x, id: res.data.id } : x)));
    });
  };
  const remove = (r: Row) => {
    setRows((xs) => xs.filter((x) => x._key !== r._key));
    if (!isNew(r)) start(async () => { await deleteOverhead(planId, r.id); });
  };
  const add = () => {
    const id = `tmp-${crypto.randomUUID()}`;
    setDraftNew({ id, _key: id, source: "entered", name: "", current_value: 0, yearly_change: null, monthly_distribution: null, start_year: 1, on_cost: false, sort_order: 0 });
    setDlg({ kind: "expense", key: id });
  };
  const commitOnCost = () => {
    setOnCostText(null);
    if (onCost === onCostPct) return;
    start(async () => { const res = await saveOnCostPct(planId, onCost); if (!res.ok) setErr(res.error); });
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    start(async () => { await continueFromOverheads(planId, intent); });
  };

  const open = dlg ? (draftNew && draftNew._key === dlg.key ? draftNew : lines.find((r) => r._key === dlg.key)) ?? null : null;
  const close = () => { setDlg(null); setDraftNew(null); };
  const sourceNote = (r: Row) => r.source === "people"
    ? `${peopleCount} ${peopleCount === 1 ? "person" : "people"} on the Leadership Team, across all five years. Click to open it.`
    : `${marketingLines} ${marketingLines === 1 ? "line" : "lines"} of Channels & spend in Marketing. Click to open it.`;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Overheads" subtitle="What the business costs to run whether or not it sells anything" mode={mode}
      areas={[{ key: "expenses", label: "Expenses", count: lines.length }, { key: "monthly", label: "Monthly projections" }]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      primaryAction={area === "expenses" ? <Button size="sm" type="button" onClick={add}>+ Expense</Button> : undefined}
      footer={<ModuleFooter planId={planId} prevId="cogs" formId="overheads-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Everything the business spends that is not the direct cost of a sale: rent, insurance, fuel, phones, accounting, admin wages. If it would still be there in a month where you sold nothing, it belongs here rather than in COGS.</p>
        <p>Two lines are filled in for you and cannot be typed over. <b>Leadership Team salaries</b> comes from that module, which already knows when each person starts and how their pay rises. <b>Marketing spend</b> is the Channels &amp; spend budget. Change either at its own step and it changes here — the figure you set stays the figure you set.</p>
        <p><b>On-costs</b> are superannuation, payroll tax and workers&apos; compensation as one percentage of wages. Set it once and it applies to every wage line, so it is never the thing that was forgotten.</p>
        <p>A cost that starts later — a lease you take on in Year 2 — carries its own first-year figure and rises only from the year after.</p>
        <h3>Where this goes</h3>
        <p>Overheads sit below gross profit in the forecast&apos;s profit and loss, and drive your break-even. Year 1 by month → the twelve-month cash flow.</p>
      </>}
    >
      <PendingBridge pending={pending} error={error ?? rows.find((r) => r._error)?._error} />
      <form id="overheads-form" onSubmit={onSubmit} className="hidden" />

      {area === "expenses" && (<>
      <Toolbar>
        <Meta className="ml-0">Total {num(totals[0].total)} in Year 1 · {num(totals[0].wages)} wages{onCost > 0 && <> + {num(totals[0].onCosts)} on-costs</>} · {num(totals[0].other)} everything else</Meta>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          On-costs on wages
          <span className="relative block">
            <Input inputMode="decimal" value={onCostText ?? (onCost ? String(onCost) : "")} placeholder="0"
              onChange={(e) => { setOnCostText(e.target.value); setOnCost(Math.max(0, parseNum(e.target.value))); }}
              onBlur={commitOnCost} className={cn(box, "num w-20 pr-6 text-right")} />
            <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </span>
        </span>
      </Toolbar>

      <Grid>
        <thead><tr><Th>Expense</Th><Th right style={{ width: 120 }}>This year</Th>{YEARS.map((y) => <Th key={y} right style={{ width: 110 }}>Year {y}</Th>)}<Th style={{ width: 80 }} /></tr></thead>
        <tbody>
          {lines.map((r) => {
            const synced = r.source !== "entered";
            const v = valuesFor(r);
            return (
              <GridRow key={r._key} className={cn(r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                <Td>
                  {synced
                    ? <><span className="font-semibold">{r.name}</span>
                        <LinkMark title={`Set on ${SOURCE_LABEL[r.source]} — ${sourceNote(r)}`} onClick={() => router.push(`/plans/${planId}/${SOURCE_STEP[r.source]}`)} />
                        <span className="ml-2 rounded border border-border bg-secondary px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[.04em] text-muted-foreground">from {SOURCE_LABEL[r.source]}</span></>
                    : <NameLink onClick={() => setDlg({ kind: "expense", key: r._key })}>{r.name}</NameLink>}
                  {r.on_cost && <span className="ml-2 text-[11px] text-muted-foreground">+ on-costs</span>}
                  {!synced && r.start_year > 1 && <span className="ml-2 text-[11px] text-muted-foreground">from Year {r.start_year}</span>}
                </Td>
                <Td right className="num text-muted-foreground">{synced ? num(v[0]) : num(r.current_value)}</Td>
                {v.map((x, i) => <Td key={i} right className="num">{num(x)}</Td>)}
                <Td className="whitespace-nowrap text-right">
                  {!synced && <IconButton title="Edit expense" onClick={() => setDlg({ kind: "expense", key: r._key })}>✎</IconButton>}
                  <IconButton title="Edit monthly split" onClick={() => setDlg({ kind: "split", key: r._key })}>▦</IconButton>
                  {!synced && <RemoveButton onClick={() => remove(r)} />}
                </Td>
              </GridRow>
            );
          })}
        </tbody>
        <FootRow>
          <Td>Total overheads{onCost > 0 && <span className="ml-2 font-normal text-muted-foreground">including {onCost}% on-costs</span>}</Td>
          <Td right className="num">{num(thisYear.total)}</Td>
          {totals.map((t) => <Td key={t.year} right className="num">{num(t.total)}</Td>)}
          <Td />
        </FootRow>
      </Grid>
      {onCost > 0 && (
        <div className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          On-costs at {onCost}% add {totals.map((t) => num(t.onCosts)).join(" · ")} across the five years, on wages of {totals.map((t) => num(t.wages)).join(" · ")}.
        </div>
      )}
      <Note>Anything that only happens because you made a sale belongs in COGS, not here — put it in one place or it counts twice.</Note>
      </>)}

      {area === "monthly" && (() => {
        /* Year 1, line by line. Overheads are the costs that arrive whether or not anything sells, so when
           they land is exactly what the twelve-month cash flow turns on — and what the owner manages. */
        const rowsM = lines.map((r) => ({ r, months: overheadMonths(r as Overhead, r.source === "entered" ? null : syncedValues(r.source as "people" | "marketing")) }));
        const withOnCost = rowsM.map(({ r, months }) => {
          const factor = r.on_cost || r.source === "people" ? 1 + onCost / 100 : 1;
          return { r, months: months.map((v) => Math.round(v * factor * 100) / 100) };
        });
        const monthTotals = MONTHS.map((_, i) => withOnCost.reduce((a, l) => a + (l.months[i] ?? 0), 0));
        const grand = monthTotals.reduce((a, b) => a + b, 0);
        return (
          <>
            <Toolbar><Meta className="ml-0">Year 1 overheads by month{onCost > 0 && <>, on-costs included</>} — what leaves the bank, and when. The ▦ icon sets a line&apos;s split.</Meta></Toolbar>
            <Grid>
              <thead><tr><Th style={{ width: "16%" }}>Expense</Th>{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 100 }}>Total</Th><Th style={{ width: 44 }} /></tr></thead>
              <tbody>
                {withOnCost.map(({ r, months }) => (
                  <GridRow key={r._key}>
                    <Td>
                      {r.source !== "entered"
                        ? <><span className="font-semibold">{r.name}</span><LinkMark title={`Set on ${SOURCE_LABEL[r.source]}`} onClick={() => router.push(`/plans/${planId}/${SOURCE_STEP[r.source]}`)} /></>
                        : <NameLink onClick={() => setDlg({ kind: "split", key: r._key })}>{r.name}</NameLink>}
                      {(r.on_cost || r.source === "people") && onCost > 0 && <span className="ml-2 text-[11px] text-muted-foreground">+ on-costs</span>}
                    </Td>
                    {months.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}
                    <Td right className="num font-semibold">{num(months.reduce((a, b) => a + b, 0))}</Td>
                    <Td className="text-right"><IconButton title="Edit monthly split" onClick={() => setDlg({ kind: "split", key: r._key })}>▦</IconButton></Td>
                  </GridRow>
                ))}
                {withOnCost.length === 0 && <tr><Td colSpan={15} className="h-12 text-muted-foreground">Add an expense first.</Td></tr>}
              </tbody>
              {withOnCost.length > 0 && (
                <FootRow><Td>Total</Td>{monthTotals.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}<Td right className="num">{num(grand)}</Td><Td /></FootRow>
              )}
            </Grid>
            <Note>These twelve add to the Year 1 column on the Expenses tab. A line with no split of its own is spread evenly.</Note>
          </>
        );
      })()}

      {open && dlg?.kind === "expense" && <ExpenseDialog key={open._key} r={open} onSave={saveRow} onClose={close} />}
      {open && dlg?.kind === "split" && <SplitDialog key={open._key} r={open} fyEndMonth={fyEndMonth} year1={valuesFor(open)[0]} onSave={saveRow} onClose={close} />}
    </ModuleFrame>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="px-1.5 text-[14px] leading-none text-muted-foreground hover:text-primary">{children}</button>;
}

/* ---------- one typed expense ---------- */
function ExpenseDialog({ r, onSave, onClose }: { r: Row; onSave: (r: Row) => void; onClose: () => void }) {
  const [d, setD] = useState<Row>(r);
  const [text, setText] = useState<Record<string, string>>({});
  const years = enteredByYear(d as Overhead);
  const g = (y: number) => text[y] ?? (d.yearly_change?.[String(y)] ? String(d.yearly_change[String(y)]) : "");
  const setG = (y: number, raw: string) => {
    const next = { ...(d.yearly_change ?? {}) }; next[String(y)] = parseSigned(raw) ?? 0;
    setD((x) => ({ ...x, yearly_change: next })); setText((t) => ({ ...t, [y]: raw }));
  };
  const ok = d.name.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew(r) ? "New expense" : "Expense"}</DialogTitle>
          <DialogDescription>A cost of running the business, whether or not you sell anything that month.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) onSave(d); }}>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2"><label className={label}>What it is</label><Input autoFocus value={d.name} placeholder="e.g. Rent" onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} className={box} /></div>
            <div><label className={label}>Cost a year</label><Input inputMode="decimal" value={d.current_value ? num(d.current_value) : ""} placeholder="0" onChange={(e) => setD((x) => ({ ...x, current_value: parseNum(e.target.value) }))} className={cn(box, "num text-right")} /></div>
            <div><label className={label}>Starts in</label><FieldSelect value={String(d.start_year || 1)} options={START_OPTIONS} onValueChange={(v) => setD((x) => ({ ...x, start_year: Number(v) }))} /></div>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={d.on_cost} onChange={(e) => setD((x) => ({ ...x, on_cost: e.target.checked }))} className="size-3.5 accent-primary" />
            This is wages — add on-costs to it
          </label>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">% change each year</div>
            <div className="grid grid-cols-[90px_repeat(5,1fr)] items-center gap-x-3 gap-y-2">
              <div /> {YEARS.map((y) => <div key={y} className="text-right text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Year {y}</div>)}
              <div className="text-[12.5px] font-semibold">Change</div>
              {YEARS.map((y) => (
                <div key={y}>
                  {y < d.start_year
                    ? <div className={cn(box, "flex items-center justify-end pr-2 text-xs text-muted-foreground/70")}>—</div>
                    : <span className="relative block">
                        <Input inputMode="text" value={g(y)} onChange={(e) => setG(y, e.target.value)} className={cn(box, "num pr-6 text-right")} />
                        <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </span>}
                  <div className="pr-1.5 text-right text-[11px] text-muted-foreground num">{years[y - 1] ? num(years[y - 1]) : "—"}</div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!ok}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- monthly split, for any line including the synced two ---------- */
function SplitDialog({ r, year1, fyEndMonth, onSave, onClose }: { r: Row; year1: number; fyEndMonth: number; onSave: (r: Row) => void; onClose: () => void }) {
  const MONTHS = planMonths(fyEndMonth);
  const MONTH_NAMES = planMonthNames(fyEndMonth);
  const [d, setD] = useState<MonthlyDistribution>(normalizeDistribution(r.monthly_distribution));
  const [text, setText] = useState<Record<string, string>>({});
  const total = distributionTotal(d);
  const ok = Math.abs(total - 100) <= 0.01;
  const months = overheadMonths({ ...(r as Overhead), monthly_distribution: d, current_value: year1, source: "entered", yearly_change: null, start_year: 1 });
  const preset = (nd: MonthlyDistribution) => { setD(nd); setText({}); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Monthly split — {r.name}</DialogTitle>
          <DialogDescription>The share of Year 1 ({num(year1)}) falling in each month. Rent falls evenly; insurance might all land in one.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ ...r, monthly_distribution: d }); }}>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            {MONTHS.map((_, i) => (
              <div key={i}>
                <label className={label}>{MONTH_NAMES[i]}</label>
                <span className="relative block">
                  <Input inputMode="decimal" value={text[i + 1] ?? pct(d[String(i + 1)])}
                    onChange={(e) => { const raw = e.target.value; setText((t) => ({ ...t, [i + 1]: raw })); setD((x) => ({ ...x, [String(i + 1)]: parseSigned(raw) ?? 0 })); }}
                    className={cn(box, "num pr-6 text-right")} />
                  <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </span>
                <div className="mt-0.5 text-right text-[11px] text-muted-foreground num">{num(months[i])}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-border pt-3 text-[13px]">
            <span>{ok
              ? <>Twelve months add to <b className="num text-good">{num(months.reduce((a, b) => a + b, 0))}</b><span className="ml-2 text-muted-foreground">shares total {pct(total)}%</span></>
              : <>Shares total <b className="num text-bad">{pct(total)}%</b><span className="ml-2 text-muted-foreground">the twelve must add up to 100 %</span></>}</span>
            <span className="ml-auto flex gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => preset(evenDistribution())}>Even</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => preset(moderateDistribution())}>Moderate rise</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => preset(rampUpDistribution())}>Ramp-up</Button>
            </span>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!ok}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PendingBridge({ pending, error }: { pending: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : undefined), [pending, error, setNote]);
  return null;
}
