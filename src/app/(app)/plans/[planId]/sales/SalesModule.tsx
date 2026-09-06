"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, FootRow, Toolbar, Meta, Note, RemoveButton, CellInput, CellSelect, CellTextarea, LinkButton, focusRow } from "@/components/module/DataGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { YEARS, yearlyProjection, revenueByYear, currentSales, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, distributionTotal, monthlySales, type MonthlyDistribution } from "@/engine/sales/projection";
import { upsertProduct, deleteProduct, continueFromSales } from "./actions";
import { LIFECYCLE, MONTHS, type Product } from "./model";

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const parseSigned = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "-" || t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
type AreaKey = "products" | "growth" | "season";
type Row = Product & { _key: string; _dirty?: boolean; _error?: string; _gtext?: Record<string, string>; _mtext?: Record<string, string> };
/** Month shares are stored to four decimals (so presets total exactly 100) but shown to two. */
const pct = (v: number | undefined) => v === undefined || v === null ? "" : String(Math.round(v * 100) / 100);
const STEP = GUIDED_STEPS.find((s) => s.id === "sales")?.step ?? 7;
const blank = (id = "tmp-new-product"): Row => ({ id, _key: id, name: "", description: "", notes: "", lifecycle: null, average_price: 0, units_sold: 0, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null, sort_order: 0 });

export function SalesModule({ planId, initial, mode, initialArea, historicRevenue, historicEnd, productWord }: {
  planId: string; initial: Product[]; mode: "guided" | "advanced"; initialArea: AreaKey; historicRevenue: number | null; historicEnd: string | null; productWord: string;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [rows, setRows] = useState<Row[]>(initial.length ? initial.map((p) => ({ ...p, _key: p.id })) : [blank()]);
  const [pending, start] = useTransition();
  const ref = useRef(rows); useEffect(() => { ref.current = rows; }, [rows]);
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  const edit = (key: string, changes: Partial<Row>, immediate = false) => {
    setRows((xs) => xs.map((x) => (x._key === key ? { ...x, ...changes, _dirty: true, _error: undefined } : x)));
    if (immediate) queueMicrotask(() => commit(key));
  };
  const commit = (key: string) => {
    const r = ref.current.find((x) => x._key === key);
    if (!r || !r._dirty || !r.name.trim()) return;
    setRows((xs) => xs.map((x) => (x._key === key ? { ...x, _dirty: false } : x)));
    start(async () => {
      const res = await upsertProduct(planId, { ...r, id: r.id.startsWith("tmp-") ? undefined : r.id });
      setRows((xs) => xs.map((x) => (x._key === key ? (res.ok ? { ...x, id: res.data!.id } : { ...x, _dirty: true, _error: res.error }) : x)));
    });
  };
  const add = () => { const id = `tmp-${crypto.randomUUID()}`; setRows((xs) => [blank(id), ...xs]); setArea("products"); focusRow(`[data-row="${id}"]`); };
  const remove = (r: Row) => {
    setRows((xs) => { const rest = xs.filter((x) => x._key !== r._key); return rest.length ? rest : [blank(`tmp-${crypto.randomUUID()}`)]; });
    if (!r.id.startsWith("tmp-")) start(async () => { await deleteProduct(planId, r.id); });
  };
  const flush = () => ref.current.forEach((r) => r._dirty && commit(r._key));
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromSales(planId, intent); });
  };

  const named = rows.filter((r) => r.name.trim());
  const totals = useMemo(() => revenueByYear(named), [named]);
  const current = currentSales(named);
  const err = rows.find((r) => r._error)?._error;
  const gap = historicRevenue ? ((current - historicRevenue) / historicRevenue) * 100 : null;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Sales" subtitle={`What you sell, what it earns this year, and how each line grows — this is where the forecast's revenue comes from`} mode={mode}
      areas={[{ key: "products", label: "Products", count: named.length }, { key: "growth", label: "Growth" }, { key: "season", label: "Seasonality" }]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }} scope={{ label: "This plan" }}
      primaryAction={<Button size="sm" type="button" onClick={add}>+ Product</Button>}
      footer={<ModuleFooter planId={planId} prevId="historic" formId="sales-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>One line per thing you sell that a customer would recognise on a quote. Price is the average you actually get; units is how many you did <b>this year</b>. Annual sales calculates — check it against your accounts before you go further.</p>
        <p><b>Growth</b> is a decision, not a default: every year starts at 0 %. Put in what you believe — negative is fine for a line you are winding down. Year 1 grows from this year; each year compounds on the one before. A line that starts later leaves the earlier years at zero.</p>
        <p><b>Seasonality</b> only matters for the first-year cash flow. Leave it even unless your trade genuinely has a quiet season or a product is launching mid-year.</p>
        <h3>Where this goes</h3>
        <p>Revenue by year → the forecast&apos;s top line, break-even and What-If. Year 1 monthly split → the twelve-month cash flow. Products and their notes → the {productWord} section of the report.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={rows.some((r) => r._dirty)} error={err} />
      <form id="sales-form" onSubmit={onSubmit} className="hidden" />

      {area === "products" && (
        <>
          <Toolbar><Meta className="ml-0">{named.length} product{named.length === 1 ? "" : "s"} · this year {num(current)}{historicRevenue !== null && <> · Historic {historicEnd?.slice(0, 4) ?? ""} revenue {num(historicRevenue)}{gap !== null && Math.abs(gap) > 10 && <span className="text-warn"> — {gap > 0 ? "+" : ""}{gap.toFixed(0)}% apart; check price × units</span>}</>}</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "26%" }}>Product</Th><Th style={{ width: 130 }}>Lifecycle</Th><Th right style={{ width: 120 }}>Average price</Th><Th right style={{ width: 110 }}>Units this year</Th><Th right style={{ width: 130 }}>Annual sales</Th><Th style={{ width: 100 }}>Starts</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.map((r) => [
                <tr key={r._key + "a"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className={cn("[&>td]:border-b-0 [&>td]:pt-1.5", r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                  <Td><CellInput value={r.name} placeholder="Product or service" className="font-semibold" onChange={(e) => edit(r._key, { name: e.target.value })} /></Td>
                  <Td><CellSelect value={r.lifecycle} options={LIFECYCLE} placeholder="Stage —" onValueChange={(v) => edit(r._key, { lifecycle: v }, !!r.name.trim())} /></Td>
                  <Td right><CellInput numeric value={r.average_price ? num(r.average_price) : ""} placeholder="0" onChange={(e) => edit(r._key, { average_price: parseNum(e.target.value) })} /></Td>
                  <Td right><CellInput numeric value={r.units_sold ? String(r.units_sold) : ""} placeholder="0" onChange={(e) => edit(r._key, { units_sold: parseNum(e.target.value) })} /></Td>
                  <Td right className="num font-semibold">{num(r.average_price * r.units_sold)}</Td>
                  <Td><CellSelect value={String(r.start_selling_year)} options={YEARS.map((y) => ({ value: String(y), label: y === 1 ? "Now" : `Year ${y}` }))} onValueChange={(v) => edit(r._key, { start_selling_year: Number(v) }, !!r.name.trim())} /></Td>
                  <Td><RemoveButton onClick={() => remove(r)} /></Td>
                </tr>,
                <tr key={r._key + "b"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className={cn("[&>td]:align-top [&>td]:pb-2", r._error && "[&>td]:bg-bad-soft")}>
                  <Td colSpan={3} wrap><div className="mb-0.5 pl-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground">What it is</div><CellTextarea value={r.description ?? ""} placeholder="One or two sentences a lender would understand" onChange={(e) => edit(r._key, { description: e.target.value })} /></Td>
                  <Td colSpan={4} wrap><div className="mb-0.5 pl-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Notes — why they buy it, margin, weaknesses</div><CellTextarea value={r.notes ?? ""} placeholder="e.g. Lower margin than we need; shifting effort to decorative work" onChange={(e) => edit(r._key, { notes: e.target.value })} /></Td>
                </tr>,
              ])}
            </tbody>
            <FootRow><Td colSpan={3}>Total this year</Td><Td right className="num">{named.reduce((a, r) => a + r.units_sold, 0)}</Td><Td right className="num">{num(current)}</Td><Td colSpan={2} /></FootRow>
          </Grid>
          <Note>&quot;Units&quot; is whatever you count: jobs, slabs, hours, subscriptions. Price × units should land near this year&apos;s revenue in Historic — if it doesn&apos;t, something is missing or double-counted.</Note>
        </>
      )}

      {area === "growth" && (
        <>
          <Toolbar><Meta className="ml-0">Year 1 grows from this year; each year compounds on the one before. Blank = 0 %. Negative shrinks the line.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "22%" }}>Product</Th><Th style={{ width: 90 }} /><Th right style={{ width: 110 }}>This year</Th>{YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}</tr></thead>
            <tbody>
              {named.map((r) => {
                const proj = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year);
                const g = (y: number, k: "price" | "units") => r._gtext?.[`${y}${k}`] ?? (r.yearly_growth?.[String(y)]?.[k] != null ? String(r.yearly_growth![String(y)]![k]) : "");
                const setG = (y: number, k: "price" | "units", raw: string) => {
                  const v = parseSigned(raw);
                  const yg = { ...(r.yearly_growth ?? {}) }; yg[String(y)] = { ...(yg[String(y)] ?? {}), [k]: v ?? 0 };
                  edit(r._key, { yearly_growth: yg, _gtext: { ...(r._gtext ?? {}), [`${y}${k}`]: raw } });
                };
                return [
                  <tr key={r._key + "p"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className="[&>td]:border-b-0 [&>td]:h-[30px] [&>td]:pt-1.5">
                    <Td rowSpan={3} className="!border-b border-border align-top pt-2"><span className="font-semibold">{r.name}</span><div className="text-[11.5px] text-muted-foreground">{r.start_selling_year > 1 ? `starts Year ${r.start_selling_year}` : `${num(r.average_price)} × ${r.units_sold}`}</div></Td>
                    <Td className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground">Price %</Td>
                    <Td right className="num text-muted-foreground">{num(r.average_price)}</Td>
                    {YEARS.map((y) => <Td key={y} right><CellInput numeric inputMode="text" value={g(y, "price")} placeholder="0" onChange={(e) => setG(y, "price", e.target.value)} /></Td>)}
                  </tr>,
                  <tr key={r._key + "u"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className="[&>td]:border-b-0 [&>td]:h-[30px]">
                    <Td className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground">Units %</Td>
                    <Td right className="num text-muted-foreground">{r.units_sold}</Td>
                    {YEARS.map((y) => <Td key={y} right><CellInput numeric inputMode="text" value={g(y, "units")} placeholder="0" onChange={(e) => setG(y, "units", e.target.value)} /></Td>)}
                  </tr>,
                  <tr key={r._key + "s"} className="[&>td]:h-[30px] [&>td]:font-semibold">
                    <Td className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground">Sales</Td>
                    <Td right className="num">{num(r.average_price * r.units_sold)}</Td>
                    {proj.map((y) => <Td key={y.year} right className={cn("num", y.sales === 0 && "text-muted-foreground")} title={`${num(y.price)} × ${y.units}`}>{y.sales ? num(y.sales) : "—"}</Td>)}
                  </tr>,
                ];
              })}
            </tbody>
            <FootRow><Td colSpan={2}>Total revenue → forecast</Td><Td right className="num">{num(current)}</Td>{totals.map((t) => <Td key={t.year} right className="num">{num(t.value)}</Td>)}</FootRow>
          </Grid>
          <Note>Hover a Sales figure to see the price and units behind it. Units compound with decimals so a 10 % rise on 36 gives 39.6, not 40.</Note>
        </>
      )}

      {area === "season" && (
        <>
          <Toolbar><Meta className="ml-0">Share of Year 1 sales in each month. Must total 100. Only the first-year cash flow uses this.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "18%" }}>Product</Th>{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 70 }}>Total</Th><Th style={{ width: 200 }} /></tr></thead>
            <tbody>
              {named.map((r) => {
                const d = normalizeDistribution(r.monthly_distribution);
                const total = distributionTotal(d);
                const y1 = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year)[0].sales;
                const months = monthlySales(y1, d);
                const setD = (m: number, raw: string) => { const nd: MonthlyDistribution = { ...d, [String(m)]: parseSigned(raw) ?? 0 }; edit(r._key, { monthly_distribution: nd, _mtext: { ...(r._mtext ?? {}), [m]: raw } }); };
                const preset = (nd: MonthlyDistribution) => edit(r._key, { monthly_distribution: nd, _mtext: {} }, true);
                return [
                  <tr key={r._key + "d"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className="[&>td]:border-b-0 [&>td]:h-[30px] [&>td]:pt-1.5">
                    <Td rowSpan={2} className="!border-b border-border align-top pt-2"><span className="font-semibold">{r.name}</span><div className="text-[11.5px] text-muted-foreground">Year 1 {num(y1)}</div></Td>
                    {MONTHS.map((_, i) => <Td key={i} right><CellInput numeric inputMode="decimal" className="px-1" value={r._mtext?.[i + 1] ?? pct(d[String(i + 1)])} onChange={(e) => setD(i + 1, e.target.value)} /></Td>)}
                    <Td right className={cn("num font-semibold", Math.abs(total - 100) > 0.01 ? "text-bad" : "text-good")}>{pct(total)}%</Td>
                    <Td className="whitespace-nowrap text-xs"><LinkButton onClick={() => preset(evenDistribution())}>Even</LinkButton><span className="mx-1.5 text-border">·</span><LinkButton onClick={() => preset(moderateDistribution())}>Moderate</LinkButton><span className="mx-1.5 text-border">·</span><LinkButton onClick={() => preset(rampUpDistribution())}>Ramp-up</LinkButton></Td>
                  </tr>,
                  <tr key={r._key + "m"} className="[&>td]:h-[26px] [&>td]:text-xs [&>td]:text-muted-foreground">
                    {months.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}
                    <Td right className="num">{num(y1)}</Td><Td />
                  </tr>,
                ];
              })}
            </tbody>
            <FootRow><Td>Year 1 by month</Td>{MONTHS.map((_, i) => <Td key={i} right className="num">{num(named.reduce((a, r) => a + monthlySales(yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year)[0].sales, normalizeDistribution(r.monthly_distribution))[i], 0))}</Td>)}<Td right className="num">{num(totals[0].value)}</Td><Td /></FootRow>
          </Grid>
          <Note>Even = 8.33 % a month. Moderate = a gentle rise through the year. Ramp-up = a launching product, small early months. Type your own if you know your season — the row turns red until it totals 100.</Note>
        </>
      )}
    </ModuleFrame>
  );
}

function PendingBridge({ pending, dirty, error }: { pending: boolean; dirty: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the row" : undefined), [pending, dirty, error, setNote]);
  return null;
}
