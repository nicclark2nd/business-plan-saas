"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, LinkButton, RemoveButton } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldInput, FieldTextarea, FieldSelect } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { YEARS, yearlyProjection, revenueByYear, currentSales, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, distributionTotal, monthlySales, type MonthlyDistribution } from "@/engine/sales/projection";
import { upsertProduct, deleteProduct, continueFromSales } from "./actions";
import { LIFECYCLE, MONTHS, type Product } from "./model";

/**
 * Sales — list → record (§6.16, fourth cut). The list is an index of products; a product opens as one page that
 * shows the working the way a planner would on paper: sells for × units, the % change each year, what that gives.
 * No grid of numbers across products — that is Review forecast's job.
 */
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const parseSigned = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "-" || t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const pct = (v: number | undefined) => v === undefined || v === null ? "" : String(Math.round(v * 100) / 100);

type Row = Product & { _key: string; _dirty?: boolean; _error?: string; _gtext?: Record<string, string>; _mtext?: Record<string, string> };
const STEP = GUIDED_STEPS.find((s) => s.id === "sales")?.step ?? 7;
const isNew = (r: Row) => r.id.startsWith("tmp-");
const undescribed = (r: Row) => !(r.description ?? "").trim();
/** start_selling_year: 1 = now (this year's actuals), 2–6 = plan Year 1–5. */
const firstYear = (r: Pick<Row, "start_selling_year">) => Math.min(5, Math.max(0, (r.start_selling_year || 1) - 1));
type Preset = "even" | "moderate" | "rampup" | "custom";
const PRESETS: { value: Preset; label: string }[] = [{ value: "even", label: "Even through the year" }, { value: "moderate", label: "Moderate — a gentle rise" }, { value: "rampup", label: "Ramp-up — launching, small early months" }, { value: "custom", label: "Custom — I know my season" }];
const same = (a: MonthlyDistribution, b: MonthlyDistribution) => MONTHS.every((_, i) => Math.abs((a[String(i + 1)] ?? 0) - (b[String(i + 1)] ?? 0)) < 0.001);
const presetOf = (d: MonthlyDistribution | null | undefined): Preset => {
  if (!d) return "even";
  const n = normalizeDistribution(d);
  return same(n, evenDistribution()) ? "even" : same(n, moderateDistribution()) ? "moderate" : same(n, rampUpDistribution()) ? "rampup" : "custom";
};

export function SalesModule({ planId, initial, mode, hasHistory, historicRevenue, historicEnd, productWord }: {
  planId: string; initial: Product[]; mode: "guided" | "advanced"; hasHistory: boolean | null; historicRevenue: number | null; historicEnd: string | null; productWord: string;
}) {
  const startup = hasHistory === false;                         // no accounts yet → nothing is "now"; lines start in Year 1
  const blank = (id: string): Row => ({ id, _key: id, name: "", description: "", notes: "", lifecycle: null, average_price: 0, units_sold: 0, start_selling_year: startup ? 2 : 1, yearly_growth: {}, monthly_distribution: null, sort_order: 0 });
  const startOptions = [...(startup ? [] : [{ value: "1", label: "Now" }]), ...YEARS.map((y) => ({ value: String(y + 1), label: `Year ${y}` }))];
  const baseWord = (r: Row) => (firstYear(r) === 0 ? "this year" : `in Year ${firstYear(r)}`);

  const [rows, setRows] = useState<Row[]>(initial.map((p) => ({ ...p, _key: p.id })));
  const [open, setOpen] = useState<string | null>(null);        // the product record on screen, or the list
  const [customSeason, setCustomSeason] = useState<Record<string, boolean>>({});
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
  const flush = () => ref.current.forEach((r) => r._dirty && commit(r._key));
  const add = () => { flush(); const id = `tmp-${crypto.randomUUID()}`; setRows((xs) => [...xs, blank(id)]); setOpen(id); setTimeout(() => document.querySelector<HTMLInputElement>("#product-name")?.focus(), 0); };
  const remove = (r: Row) => {
    setRows((xs) => xs.filter((x) => x._key !== r._key));
    if (open === r._key) setOpen(null);
    if (!isNew(r)) start(async () => { await deleteProduct(planId, r.id); });
  };
  const show = (key: string | null) => { flush(); setRows((xs) => xs.filter((x) => x.name.trim() || x._key === key)); setOpen(key); };   // abandoned blank records vanish
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromSales(planId, intent); });
  };

  const named = rows.filter((r) => r.name.trim());
  const record = rows.find((r) => r._key === open);
  const err = rows.find((r) => r._error)?._error;
  const current = currentSales(named);
  const gap = historicRevenue ? ((current - historicRevenue) / historicRevenue) * 100 : null;
  const totals = revenueByYear(named);
  const toWrite = named.filter(undescribed).length;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Sales" subtitle="What you sell, what each line earns and how it grows — this is where the forecast's revenue comes from" mode={mode}
      areas={[{ key: "products", label: "Products", count: named.length, tag: toWrite ? `${toWrite} to describe` : undefined }]}
      area="products" onArea={() => show(null)}
      scope={{ label: record ? record.name || "New product" : "All products", onClear: record ? () => show(null) : undefined }}
      primaryAction={<Button size="sm" type="button" onClick={add}>+ Product</Button>}
      footer={<ModuleFooter planId={planId} prevId="historic" formId="sales-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>One product for each thing you sell that a customer would recognise on a quote. Open it and fill the page top to bottom: what it is, what it sells for, how many you sell, and how that changes each year. The bottom of the page shows the working — price × units = sales, year by year — so you can see what your numbers add up to before anyone else does.</p>
        <p><b>Sells for</b> is the average you actually get, not the list price. <b>Units</b> is whatever you count: jobs, slabs, hours, subscriptions.</p>
        <p><b>Change each year</b> is a decision, not a default: an empty box is 0 %. Put in what you believe — negative is fine for a line you are winding down. {startup ? "Year 2 changes from Year 1; each year builds on the one before." : "Year 1 changes from this year; each year builds on the one before."}</p>
        <p><b>Seasonality</b> only matters for the first-year cash flow. Leave it even unless your trade genuinely has a quiet season or the line is launching mid-year.</p>
        <h3>Where this goes</h3>
        <p>Sales by year → the forecast&apos;s top line, break-even and What-If. The Year 1 monthly split → the twelve-month cash flow. What it is and why they buy it → the {productWord} section of the report.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={rows.some((r) => r._dirty)} error={err} />
      <form id="sales-form" onSubmit={onSubmit} className="hidden" />

      {!record && (
        <>
          <Toolbar>
            <Meta className="ml-0">
              {named.length ? <>{named.length} product{named.length === 1 ? "" : "s"} · {startup ? "Year 1" : "this year"} {num(startup ? totals[0].value : current)}</> : "No products yet"}
              {!startup && historicRevenue !== null && gap !== null && named.length > 0 && (Math.abs(gap) > 10
                ? <span className="text-warn"> · {gap > 0 ? "+" : ""}{gap.toFixed(0)}% against Historic {historicEnd?.slice(0, 4) ?? ""} revenue {num(historicRevenue)} — a line is missing or a price × units is off</span>
                : <> · within {Math.abs(gap).toFixed(0)}% of Historic {historicEnd?.slice(0, 4) ?? ""} revenue</>)}
            </Meta>
          </Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "26%" }}>Product</Th><Th style={{ width: 130 }}>Lifecycle</Th><Th right style={{ width: 120 }}>Sells for</Th><Th right style={{ width: 110 }}>Units</Th><Th right style={{ width: 130 }}>{startup ? "Year 1" : "This year"}</Th><Th right style={{ width: 130 }}>Year 5</Th><Th /><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {named.map((r) => {
                const fy = firstYear(r); const p = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year);
                const setUp = r.average_price > 0 && r.units_sold > 0;
                const firstCol = startup ? p[0].sales : fy === 0 ? r.average_price * r.units_sold : 0;
                return (
                  <GridRow key={r._key} className={cn(r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                    <Td className="relative">
                      {undescribed(r) && <i title="No description for the plan yet" className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-warn" />}
                      <NameLink onClick={() => show(r._key)}>{r.name}</NameLink>
                    </Td>
                    <Td className="text-muted-foreground">{LIFECYCLE.find((l) => l.value === r.lifecycle)?.label ?? "—"}</Td>
                    <Td right className="num">{setUp ? num(r.average_price) : "—"}</Td>
                    <Td right className="num">{setUp ? r.units_sold : "—"}</Td>
                    <Td right className="num">{setUp && (startup || fy === 0) ? num(firstCol) : "—"}</Td>
                    <Td right className="num font-semibold">{setUp ? num(p[4].sales) : "—"}</Td>
                    <Td className="text-xs text-muted-foreground">{!setUp ? <LinkButton onClick={() => show(r._key)}>Not set up yet</LinkButton> : fy > 0 && !startup ? `from Year ${fy}` : fy > 1 ? `from Year ${fy}` : ""}</Td>
                    <Td><RemoveButton onClick={() => remove(r)} /></Td>
                  </GridRow>
                );
              })}
              {named.length === 0 && <tr><Td colSpan={8} className="h-12 text-muted-foreground">Add your first product — what you sell, what it sells for, how many. <LinkButton onClick={add}>+ Product</LinkButton></Td></tr>}
            </tbody>
            {named.length > 0 && <FootRow><Td colSpan={4}>Total</Td><Td right className="num">{num(startup ? totals[0].value : current)}</Td><Td right className="num">{num(totals[4].value)}</Td><Td colSpan={2} /></FootRow>}
          </Grid>
          <Note>Click a product to open it. Everything about that line — description, price, units, growth, season — is on its page.</Note>
        </>
      )}

      {record && (
        <ProductRecord key={record._key} r={record} rows={named} startup={startup} startOptions={startOptions} baseWord={baseWord(record)} productWord={productWord}
          custom={customSeason[record._key] ?? presetOf(record.monthly_distribution) === "custom"} setCustom={(v) => setCustomSeason((c) => ({ ...c, [record._key]: v }))}
          edit={edit} commit={commit} left={left} onShow={show} onRemove={() => remove(record)} />
      )}
    </ModuleFrame>
  );
}

function ProductRecord({ r, rows, startup, startOptions, baseWord, custom, setCustom, edit, commit, left, onShow, onRemove }: {
  r: Row; rows: Row[]; startup: boolean; startOptions: { value: string; label: string }[]; baseWord: string; productWord: string; custom: boolean; setCustom: (v: boolean) => void;
  edit: (key: string, c: Partial<Row>, immediate?: boolean) => void; commit: (key: string) => void; left: (e: React.FocusEvent<HTMLElement>) => boolean;
  onShow: (key: string | null) => void; onRemove: () => void;
}) {
  const k = r._key;
  const fy = firstYear(r);
  const proj = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year);
  const idx = rows.findIndex((x) => x._key === k); const prev = idx > 0 ? rows[idx - 1] : null; const next = idx >= 0 && idx < rows.length - 1 ? rows[idx + 1] : null;
  const g = (y: number, kind: "price" | "units") => r._gtext?.[`${y}${kind}`] ?? (r.yearly_growth?.[String(y)]?.[kind] != null && r.yearly_growth![String(y)]![kind] !== 0 ? String(r.yearly_growth![String(y)]![kind]) : "");
  const setG = (y: number, kind: "price" | "units", raw: string) => {
    const v = parseSigned(raw);
    const yg = { ...(r.yearly_growth ?? {}) }; yg[String(y)] = { ...(yg[String(y)] ?? {}), [kind]: v ?? 0 };
    edit(k, { yearly_growth: yg, _gtext: { ...(r._gtext ?? {}), [`${y}${kind}`]: raw } });
  };
  const d = normalizeDistribution(r.monthly_distribution);
  const total = distributionTotal(d);
  const y1 = proj[0].sales;
  const months = monthlySales(y1, d);
  const setD = (m: number, raw: string) => { const nd: MonthlyDistribution = { ...d, [String(m)]: parseSigned(raw) ?? 0 }; edit(k, { monthly_distribution: nd, _mtext: { ...(r._mtext ?? {}), [m]: raw } }); };
  const choosePreset = (p: Preset) => {
    if (p === "custom") { setCustom(true); return; }
    setCustom(false);
    edit(k, { monthly_distribution: p === "even" ? evenDistribution() : p === "moderate" ? moderateDistribution() : rampUpDistribution(), _mtext: {} }, true);
  };
  const preset: Preset = custom ? "custom" : presetOf(r.monthly_distribution);
  const save = (e: React.FocusEvent<HTMLElement>) => { if (left(e)) commit(k); };
  const yearHead = (extra?: React.ReactNode) => <thead><tr><Th style={{ width: 200 }}>{extra}</Th>{YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}</tr></thead>;
  const cellBox = "h-8 w-full num text-right pr-6";

  return (
    <div className="pb-6">
      <div className="flex items-center gap-3 border-b border-border px-5 py-2.5" onBlur={save}>
        <Input id="product-name" value={r.name} placeholder="Product or service name" onChange={(e) => edit(k, { name: e.target.value })} className="h-8 w-[360px] text-[15px] font-semibold" />
        {!isNew(r) && <LinkButton onClick={onRemove} className="text-muted-foreground hover:text-bad">Remove</LinkButton>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Button size="sm" variant="outline" type="button" disabled={!prev} onClick={() => prev && onShow(prev._key)}>‹ {prev ? prev.name : "Prev"}</Button>
          <Button size="sm" variant="outline" type="button" disabled={!next} onClick={() => next && onShow(next._key)}>{next ? next.name : "Next"} ›</Button>
          <Button size="sm" variant="outline" type="button" onClick={() => onShow(null)}>All products</Button>
        </span>
      </div>

      <div onBlur={save}>
        <Section title="About this line">
          <FieldGrid>
            <Field label="What it is" span={3} hint="One or two plain sentences a lender would understand"><FieldTextarea value={r.description ?? ""} placeholder="e.g. Reinforced concrete slabs for new homes, poured and finished by our own crew" onChange={(e) => edit(k, { description: e.target.value })} /></Field>
            <Field label="Why they buy it, margin, weaknesses" span={2}><FieldTextarea value={r.notes ?? ""} placeholder="e.g. Builders choose us on turnaround; margin is thin — shifting effort to decorative work" onChange={(e) => edit(k, { notes: e.target.value })} /></Field>
            <Field label="Lifecycle" hint="Where the line sits today"><FieldSelect value={r.lifecycle} options={LIFECYCLE} placeholder="Choose —" onValueChange={(v) => edit(k, { lifecycle: v }, !!r.name.trim())} /></Field>
          </FieldGrid>
        </Section>
      </div>

      <div onBlur={save}>
        <Section title="What it sells for">
          <FieldGrid>
            <Field label="Sells for" hint="Average you actually get"><FieldInput numeric value={r.average_price ? num(r.average_price) : ""} placeholder="0" onChange={(e) => edit(k, { average_price: parseNum(e.target.value) })} /></Field>
            <Field label={`Units sold ${baseWord}`} hint="Jobs, slabs, hours — whatever you count"><FieldInput numeric value={r.units_sold ? String(r.units_sold) : ""} placeholder="0" onChange={(e) => edit(k, { units_sold: parseNum(e.target.value) })} /></Field>
            <Field label="Starts selling" hint={startup ? "Year 1 is the first year of the plan" : "Now = you sell it today"}><FieldSelect value={String(r.start_selling_year || 1)} options={startOptions} onValueChange={(v) => edit(k, { start_selling_year: Number(v) }, !!r.name.trim())} /></Field>
            <Field label=" " span={3}><div className="flex h-8 items-center text-[13px]"><span className="text-muted-foreground">= sales {baseWord}</span><span className="num ml-3 text-[15px] font-semibold">{num(r.average_price * r.units_sold)}</span></div></Field>
          </FieldGrid>
        </Section>
      </div>

      <div onBlur={save}>
        <Section title="Change each year" tail={<span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Empty = no change · negative shrinks the line</span>}>
          <Grid>
            {yearHead()}
            <tbody>
              <tr>
                <Td className="text-[12px] font-semibold">Price change</Td>
                {YEARS.map((y) => y <= fy ? <Td key={y} right className="text-muted-foreground/60">{y === fy ? "starts" : "—"}</Td> : (
                  <Td key={y} right><span className="relative block"><Input inputMode="text" value={g(y, "price")} placeholder="" onChange={(e) => setG(y, "price", e.target.value)} className={cellBox} /><span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></span></Td>
                ))}
              </tr>
              <tr>
                <Td className="text-[12px] font-semibold">Units change</Td>
                {YEARS.map((y) => y <= fy ? <Td key={y} right className="text-muted-foreground/60">{y === fy ? "starts" : "—"}</Td> : (
                  <Td key={y} right><span className="relative block"><Input inputMode="text" value={g(y, "units")} placeholder="" onChange={(e) => setG(y, "units", e.target.value)} className={cellBox} /><span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></span></Td>
                ))}
              </tr>
            </tbody>
          </Grid>
        </Section>
      </div>

      <Section title="What that gives">
        <Grid>
          {yearHead(<span className="normal-case tracking-normal">Sells for × units = sales</span>)}
          <tbody>
            <tr><Td className="text-[12px] text-muted-foreground">Sells for</Td>{proj.map((p) => p.year < fy ? <Td key={p.year} right className="text-muted-foreground/60">—</Td> : <Td key={p.year} right className="num">{num(p.price)}</Td>)}</tr>
            <tr><Td className="text-[12px] text-muted-foreground">× Units</Td>{proj.map((p) => p.year < fy ? <Td key={p.year} right className="text-muted-foreground/60">—</Td> : <Td key={p.year} right className="num">{p.units}</Td>)}</tr>
            <tr className="[&>td]:border-t-2 [&>td]:border-input [&>td]:bg-secondary [&>td]:font-bold"><Td>= Sales</Td>{proj.map((p) => p.year < fy ? <Td key={p.year} right className="text-muted-foreground/60">—</Td> : <Td key={p.year} right className="num">{num(p.sales)}</Td>)}</tr>
          </tbody>
        </Grid>
        {!startup && fy === 0 && <p className="mt-2 text-xs text-muted-foreground">This year: {num(r.average_price)} × {r.units_sold} = {num(r.average_price * r.units_sold)}. Year 1 is next year.</p>}
      </Section>

      <div onBlur={save}>
        <Section title="Seasonality — Year 1 by month">
          {fy > 1 ? <p className="text-[13px] text-muted-foreground">Starts in Year {fy} — nothing in the first-year cash flow.</p> : (
            <>
              <FieldGrid>
                <Field label="Pattern" span={2}><FieldSelect value={preset} options={PRESETS} onValueChange={(v) => choosePreset(v as Preset)} /></Field>
                <Field label=" " span={4}><div className="flex h-8 items-center text-[13px] text-muted-foreground">Only the first-year cash flow uses this. Year 1 sales {num(y1)}.</div></Field>
              </FieldGrid>
              {preset === "custom" && (
                <div className="mt-3">
                  <Grid>
                    <thead><tr><Th style={{ width: 120 }} />{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 80 }}>Total</Th></tr></thead>
                    <tbody>
                      <tr>
                        <Td className="text-[12px] font-semibold">Share %</Td>
                        {MONTHS.map((_, i) => <Td key={i} right className="px-1"><Input inputMode="decimal" value={r._mtext?.[i + 1] ?? pct(d[String(i + 1)])} onChange={(e) => setD(i + 1, e.target.value)} className="h-8 w-full num text-right px-1.5" /></Td>)}
                        <Td right className={cn("num font-semibold", Math.abs(total - 100) > 0.01 ? "text-bad" : "text-good")}>{pct(total)}%</Td>
                      </tr>
                      <tr className="[&>td]:text-xs [&>td]:text-muted-foreground"><Td>Sales</Td>{months.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}<Td right className="num">{num(y1)}</Td></tr>
                    </tbody>
                  </Grid>
                  {Math.abs(total - 100) > 0.01 && <p className="mt-1.5 text-xs text-bad">The twelve months must add up to 100 %.</p>}
                </div>
              )}
              {preset !== "custom" && <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground">{MONTHS.map((m, i) => <span key={m}>{m} <span className="num text-foreground">{num(months[i])}</span></span>)}</div>}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

function PendingBridge({ pending, dirty, error }: { pending: boolean; dirty: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the field" : undefined), [pending, dirty, error, setNote]);
  return null;
}
