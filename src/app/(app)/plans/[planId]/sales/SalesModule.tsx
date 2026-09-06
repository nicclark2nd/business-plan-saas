"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, RemoveButton, CellInput, CellSelect, CellTextarea, LinkButton, focusRow } from "@/components/module/DataGrid";
import { Input } from "@/components/ui/input";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { YEARS, yearlyProjection, revenueByYear, currentSales, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, distributionTotal, monthlySales, type MonthlyDistribution } from "@/engine/sales/projection";
import { upsertProduct, deleteProduct, continueFromSales } from "./actions";
import { LIFECYCLE, MONTHS, type Product } from "./model";

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const parseSigned = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "-" || t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
type AreaKey = "products" | "sales" | "season";
type Row = Product & { _key: string; _dirty?: boolean; _error?: string; _gtext?: Record<string, string>; _mtext?: Record<string, string> };
/** Month shares are stored to four decimals (so presets total exactly 100) but shown to two. */
const pct = (v: number | undefined) => v === undefined || v === null ? "" : String(Math.round(v * 100) / 100);
const STEP = GUIDED_STEPS.find((s) => s.id === "sales")?.step ?? 7;
const blank = (id = "tmp-new-product"): Row => ({ id, _key: id, name: "", description: "", notes: "", lifecycle: null, average_price: 0, units_sold: 0, start_selling_year: 1, yearly_growth: {}, monthly_distribution: null, sort_order: 0 });
const isNew = (r: Row) => r.id.startsWith("tmp-");
const undescribed = (r: Row) => !(r.description ?? "").trim();
/** start_selling_year: 1 = now (this year's actuals), 2–6 = plan Year 1–5. The column that holds the base price and units. */
const START_OPTIONS = [{ value: "1", label: "Now" }, ...YEARS.map((y) => ({ value: String(y + 1), label: `Year ${y}` }))];
const COLS = [0, ...YEARS] as const;            // 0 = this year
const firstYear = (r: Row) => Math.min(5, Math.max(0, (r.start_selling_year || 1) - 1));
const lab = "text-right text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground";

export function SalesModule({ planId, initial, mode, initialArea, historicRevenue, historicEnd, productWord }: {
  planId: string; initial: Product[]; mode: "guided" | "advanced"; initialArea: AreaKey; historicRevenue: number | null; historicEnd: string | null; productWord: string;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [rows, setRows] = useState<Row[]>(initial.length ? initial.map((p) => ({ ...p, _key: p.id })) : [blank()]);
  const [scope, setScope] = useState<string | null>(null);   // one product's _key, or all
  const [q, setQ] = useState("");
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
      const res = await upsertProduct(planId, { ...r, id: isNew(r) ? undefined : r.id });
      setRows((xs) => xs.map((x) => (x._key === key ? (res.ok ? { ...x, id: res.data!.id } : { ...x, _dirty: true, _error: res.error }) : x)));
    });
  };
  const add = () => { const id = `tmp-${crypto.randomUUID()}`; setRows((xs) => [blank(id), ...xs]); setScope(null); setQ(""); setArea("products"); focusRow(`[data-row="${id}"]`); };
  const remove = (r: Row) => {
    setRows((xs) => { const rest = xs.filter((x) => x._key !== r._key); return rest.length ? rest : [blank(`tmp-${crypto.randomUUID()}`)]; });
    if (scope === r._key) setScope(null);
    if (!isNew(r)) start(async () => { await deleteProduct(planId, r.id); });
  };
  const flush = () => ref.current.forEach((r) => r._dirty && commit(r._key));
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromSales(planId, intent); });
  };

  const named = rows.filter((r) => r.name.trim());
  const scoped = rows.find((r) => r._key === scope);
  const needle = q.trim().toLowerCase();
  const visible = rows.filter((r) => (scope ? r._key === scope : true) && (!needle || isNew(r) || r.name.toLowerCase().includes(needle)));
  const visibleNamed = visible.filter((r) => r.name.trim());
  const current = currentSales(named);
  const err = rows.find((r) => r._error)?._error;
  const gap = historicRevenue ? ((current - historicRevenue) / historicRevenue) * 100 : null;
  const toWrite = named.filter(undescribed).length;
  const shownTotals = revenueByYear(visibleNamed);

  /** Product cell: a link to scope to it once saved; editable while new or scoped (Leadership Team pattern). */
  const nameCell = (r: Row, top = false) => (
    <Td className="relative">
      {!isNew(r) && undescribed(r) && <i title="No description for the plan yet" className={cn("absolute left-2 size-1.5 rounded-full bg-warn", top ? "top-[17px]" : "top-1/2 -translate-y-1/2")} />}
      {!isNew(r) && scope !== r._key
        ? <NameLink onClick={() => setScope(r._key)}>{r.name}</NameLink>
        : <CellInput value={r.name} placeholder="Product or service" className="font-semibold" onChange={(e) => edit(r._key, { name: e.target.value })} />}
    </Td>
  );

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Sales" subtitle={`What you sell, what each line earns and how it grows — this is where the forecast's revenue comes from`} mode={mode}
      areas={[{ key: "products", label: "Products", count: named.length, tag: toWrite ? `${toWrite} to describe` : undefined }, { key: "sales", label: "Sales" }, { key: "season", label: "Seasonality" }]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }}
      scope={{ label: scoped ? scoped.name || "New product" : "All products", onClear: scope ? () => setScope(null) : undefined }}
      primaryAction={<Button size="sm" type="button" onClick={add}>+ Product</Button>}
      footer={<ModuleFooter planId={planId} prevId="historic" formId="sales-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Products</b> — one line per thing you sell that a customer would recognise on a quote. What it is and why they buy it print in the {productWord} section of the report; a lender should understand each line without knowing your trade. Lifecycle is where the line sits today — &quot;Decline&quot; reads very differently from &quot;Growth&quot;, so be honest.</p>
        <p><b>Sales</b> — for a line you sell now, price and units are <b>this year&apos;s</b> actuals and Year 1 grows from them. For a line that starts later, pick the year it starts and put the price and units you expect <b>in that year</b>; growth begins the year after. Every growth year starts at 0 % — a decision, not a default. Negative is fine for a line you are winding down.</p>
        <p><b>Seasonality</b> only matters for the first-year cash flow. Leave it even unless your trade genuinely has a quiet season or a product is launching mid-year.</p>
        <p>Click a product name to work on that one line across every area; clear the chip to see them all.</p>
        <h3>Where this goes</h3>
        <p>Revenue by year → the forecast&apos;s top line, break-even and What-If. Year 1 monthly split → the twelve-month cash flow. Products and their notes → the report.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={rows.some((r) => r._dirty)} error={err} />
      <form id="sales-form" onSubmit={onSubmit} className="hidden" />

      {area === "products" && (
        <>
          <Toolbar>
            <Meta className="ml-0">{named.length} product{named.length === 1 ? "" : "s"}{toWrite ? ` · ${toWrite} without a description` : named.length ? " · all described" : ""}</Meta>
            {named.length > 10 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a product" className="ml-auto h-7 w-56 text-[13px]" />}
          </Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "17%" }}>Product</Th><Th style={{ width: 140 }}>Lifecycle</Th><Th>What it is</Th><Th>Why they buy it, margin, weaknesses</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {visible.map((r) => (
                <GridRow key={r._key} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className={cn("[&>td]:align-top [&>td]:py-1.5", r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                  {nameCell(r, true)}
                  <Td><CellSelect value={r.lifecycle} options={LIFECYCLE} placeholder="Stage —" onValueChange={(v) => edit(r._key, { lifecycle: v }, !!r.name.trim())} /></Td>
                  <Td wrap><CellTextarea value={r.description ?? ""} placeholder="e.g. Reinforced concrete slabs for new homes, poured and finished by our own crew" onChange={(e) => edit(r._key, { description: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={r.notes ?? ""} placeholder="e.g. Builders choose us on turnaround; margin is thin — shifting effort to decorative work" onChange={(e) => edit(r._key, { notes: e.target.value })} /></Td>
                  <Td className="pt-2"><RemoveButton onClick={() => remove(r)} /></Td>
                </GridRow>
              ))}
            </tbody>
          </Grid>
          <Note>One or two plain sentences each. The numbers live on the Sales tab.</Note>
        </>
      )}

      {area === "sales" && (
        <>
          <Toolbar>
            <Meta className="ml-0">
              This year {num(current)}
              {historicRevenue !== null && gap !== null && (Math.abs(gap) > 10
                ? <span className="text-warn"> · {gap > 0 ? "+" : ""}{gap.toFixed(0)}% against Historic {historicEnd?.slice(0, 4) ?? ""} revenue {num(historicRevenue)} — check price × units</span>
                : <> · within {Math.abs(gap).toFixed(0)}% of Historic {historicEnd?.slice(0, 4) ?? ""} revenue</>)}
              {" "}· growth years start at 0 %; negative shrinks the line
            </Meta>
            {named.length > 10 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a product" className="ml-auto h-7 w-56 text-[13px]" />}
          </Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "17%" }}>Product</Th><Th style={{ width: 100 }}>Starts</Th><Th right style={{ width: 70 }}>Line</Th><Th right>This year</Th>{YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}</tr></thead>
            <tbody>
              {visibleNamed.map((r) => {
                const fy = firstYear(r);
                const proj = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year);
                const g = (y: number, k: "price" | "units") => r._gtext?.[`${y}${k}`] ?? (r.yearly_growth?.[String(y)]?.[k] != null ? String(r.yearly_growth![String(y)]![k]) : "");
                const setG = (y: number, k: "price" | "units", raw: string) => {
                  const v = parseSigned(raw);
                  const yg = { ...(r.yearly_growth ?? {}) }; yg[String(y)] = { ...(yg[String(y)] ?? {}), [k]: v ?? 0 };
                  edit(r._key, { yearly_growth: yg, _gtext: { ...(r._gtext ?? {}), [`${y}${k}`]: raw } });
                };
                const dash = <Td right className="text-muted-foreground/60">—</Td>;
                const priceCell = (c: number) => c < fy ? dash
                  : c === fy ? <Td right><CellInput numeric value={r.average_price ? num(r.average_price) : ""} placeholder="price" onChange={(e) => edit(r._key, { average_price: parseNum(e.target.value) })} /></Td>
                  : <Td right><CellInput numeric inputMode="text" value={g(c, "price")} placeholder="0 %" onChange={(e) => setG(c, "price", e.target.value)} /></Td>;
                const unitsCell = (c: number) => c < fy ? dash
                  : c === fy ? <Td right><CellInput numeric value={r.units_sold ? String(r.units_sold) : ""} placeholder="units" onChange={(e) => edit(r._key, { units_sold: parseNum(e.target.value) })} /></Td>
                  : <Td right><CellInput numeric inputMode="text" value={g(c, "units")} placeholder="0 %" onChange={(e) => setG(c, "units", e.target.value)} /></Td>;
                const salesCell = (c: number) => {
                  if (c < fy) return <Td right className="text-muted-foreground/60">—</Td>;
                  const y = c === 0 ? { price: r.average_price, units: r.units_sold, sales: r.average_price * r.units_sold } : proj[c - 1];
                  return <Td right className="num" title={`${num(y.price)} × ${y.units}`}>{num(y.sales)}</Td>;
                };
                return [
                  <tr key={r._key + "p"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className={cn("[&>td]:border-b-0 [&>td]:h-[30px] [&>td]:pt-1.5", r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                    <Td rowSpan={3} className="!border-b border-border align-top pt-2 relative">
                      {undescribed(r) && <i title="No description for the plan yet" className="absolute left-2 top-[17px] size-1.5 rounded-full bg-warn" />}
                      <NameLink onClick={() => setScope(r._key)}>{r.name}</NameLink>
                      <div className="text-[11.5px] text-muted-foreground">{fy === 0 ? "selling now" : `from Year ${fy}`}</div>
                    </Td>
                    <Td rowSpan={3} className="!border-b border-border align-top pt-1"><CellSelect value={String(r.start_selling_year || 1)} options={START_OPTIONS} onValueChange={(v) => edit(r._key, { start_selling_year: Number(v) }, true)} /></Td>
                    <Td className={lab}>Price</Td>
                    {COLS.map((c) => <Fragment key={c}>{priceCell(c)}</Fragment>)}
                  </tr>,
                  <tr key={r._key + "u"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className={cn("[&>td]:border-b-0 [&>td]:h-[30px]", r._error && "[&>td]:bg-bad-soft")}>
                    <Td className={lab}>Units</Td>
                    {COLS.map((c) => <Fragment key={c}>{unitsCell(c)}</Fragment>)}
                  </tr>,
                  <tr key={r._key + "s"} className="[&>td]:h-[30px] [&>td]:font-semibold">
                    <Td className={lab}>Sales</Td>
                    {COLS.map((c) => <Fragment key={c}>{salesCell(c)}</Fragment>)}
                  </tr>,
                ];
              })}
              {visibleNamed.length === 0 && <tr><Td colSpan={9} className="text-muted-foreground">Add products first — each one gets its price, units and growth here.</Td></tr>}
            </tbody>
            <FootRow><Td colSpan={3}>{scope ? scoped?.name : "Total revenue → forecast"}</Td><Td right className="num">{num(currentSales(visibleNamed))}</Td>{shownTotals.map((t) => <Td key={t.year} right className="num">{num(t.value)}</Td>)}</FootRow>
          </Grid>
          <Note>Price and units sit in the year they belong to — this year for a line you sell now, the start year for a new one. The years after take a growth %. Hover a Sales figure to see the price and units behind it; units compound with decimals so a 10 % rise on 36 gives 39.6, not 40.</Note>
        </>
      )}

      {area === "season" && (
        <>
          <Toolbar><Meta className="ml-0">Share of Year 1 sales in each month. Must total 100. Only the first-year cash flow uses this.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "17%" }}>Product</Th>{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 70 }}>Total</Th><Th style={{ width: 200 }} /></tr></thead>
            <tbody>
              {visibleNamed.map((r) => {
                const d = normalizeDistribution(r.monthly_distribution);
                const total = distributionTotal(d);
                const y1 = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year)[0].sales;
                const months = monthlySales(y1, d);
                const setD = (m: number, raw: string) => { const nd: MonthlyDistribution = { ...d, [String(m)]: parseSigned(raw) ?? 0 }; edit(r._key, { monthly_distribution: nd, _mtext: { ...(r._mtext ?? {}), [m]: raw } }); };
                const preset = (nd: MonthlyDistribution) => edit(r._key, { monthly_distribution: nd, _mtext: {} }, true);
                if (firstYear(r) > 1) return (
                  <tr key={r._key}><Td><NameLink onClick={() => setScope(r._key)}>{r.name}</NameLink></Td><Td colSpan={14} className="text-muted-foreground">Starts in Year {firstYear(r)} — nothing in the first-year cash flow.</Td></tr>
                );
                return [
                  <tr key={r._key + "d"} data-row={r._key} onBlur={(e) => left(e) && commit(r._key)} className="[&>td]:border-b-0 [&>td]:h-[30px] [&>td]:pt-1.5">
                    <Td rowSpan={2} className="!border-b border-border align-top pt-2"><NameLink onClick={() => setScope(r._key)}>{r.name}</NameLink><div className="text-[11.5px] text-muted-foreground">Year 1 {num(y1)}</div></Td>
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
            <FootRow><Td>Year 1 by month</Td>{MONTHS.map((_, i) => <Td key={i} right className="num">{num(visibleNamed.reduce((a, r) => a + monthlySales(yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year)[0].sales, normalizeDistribution(r.monthly_distribution))[i], 0))}</Td>)}<Td right className="num">{num(shownTotals[0].value)}</Td><Td /></FootRow>
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
