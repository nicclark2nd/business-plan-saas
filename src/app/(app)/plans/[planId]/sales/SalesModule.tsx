"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, LinkMark, RemoveButton } from "@/components/module/DataGrid";
import { FieldSelect } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { planMonths } from "@/engine/plan/calendar";
import { cn } from "@/lib/utils";
import { YEARS, yearlyProjection, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, distributionTotal, monthlySales, type Growth, type MonthlyDistribution } from "@/engine/sales/projection";
import { productYears, productYear1Months, productYear1Clients, newClientsYear1, planRevenueByYear, planYear1Months, sourceOf, isLinked, bookNow, monthlyFee, recurring } from "@/engine/sales/product";
import { upsertProduct, deleteProduct, continueFromSales } from "./actions";
import { LIFECYCLE, LIFE_MODE, SOLD_AS, type Product } from "./model";

/**
 * Sales — APeX's shape, rebuilt (§6.16, fifth cut): three read-only lists on the module bar and three dialogs.
 *   Products            → Product dialog (name, what it is, why they buy it, lifecycle, and the sales baseline)
 *   Annual projections  → Growth dialog (current values, start year, % change per year, what that gives)
 *   Monthly projections → Monthly dialog (a one-off line splits the year by %; an ongoing line wins clients by month)
 * Lists never hold inputs; a dialog is a form with Save and Cancel.
 * A line is sold either as a one-off job or as an ongoing client who keeps paying (§6.17) — the second earns
 * from ACTIVE clients, so its year is nothing like price x units and its monthly dialog counts clients, not per cent.
 */
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const parseSigned = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "-" || t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
/**
 * Month shares are STORED to four decimals, so they are shown to four. A twelfth is 8.3333, not 8.33 — showing
 * the rounded figure taught people to type it back, and twelve of those add to 99.96 %, not 100.
 */
const pct = (v: number | undefined) => v === undefined || v === null ? "" : String(Math.round(v * 10000) / 10000);

type Row = Product & { _key: string; _error?: string };
type AreaKey = "products" | "annual" | "monthly";
type Dlg = { kind: "product" | "growth" | "monthly"; key: string } | null;
const STEP = GUIDED_STEPS.find((s) => s.id === "sales")?.step ?? 7;
const isNew = (r: Row) => r.id.startsWith("tmp-");
/** start_selling_year: 1 = now (this year's actuals), 2–6 = plan Year 1–5. */
const firstYear = (r: Pick<Row, "start_selling_year">) => Math.min(5, Math.max(0, (r.start_selling_year || 1) - 1));
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";

export function SalesModule({ planId, initial, mode, initialArea, hasHistory, historicRevenue, historicEnd, productWord, fyEndMonth }: {
  planId: string; initial: Product[]; mode: "guided" | "advanced"; initialArea: AreaKey; hasHistory: boolean | null; historicRevenue: number | null; historicEnd: string | null; productWord: string; fyEndMonth: number;
}) {
  const MONTHS = planMonths(fyEndMonth);          // the plan's own twelve, not January to December
  const startup = hasHistory === false;
  const blank = (): Row => ({ id: `tmp-${crypto.randomUUID()}`, _key: "", name: "", description: "", notes: "", lifecycle: null, average_price: 0, units_sold: 0, start_selling_year: startup ? 2 : 1, yearly_growth: {}, monthly_distribution: null, sort_order: 0, sold_as: "one_off", opening_clients: 0, client_life_months: 12, life_mode: "fixed", monthly_new_clients: null, clients_from_product_id: null });
  const startOptions = [...(startup ? [] : [{ value: "1", label: "Now — selling today" }]), ...YEARS.map((y) => ({ value: String(y + 1), label: `Year ${y}` }))];

  const [area, setArea] = useState<AreaKey>(initialArea);
  const [rows, setRows] = useState<Row[]>(initial.map((p) => ({ ...p, _key: p.id })));
  const [dlg, setDlg] = useState<Dlg>(null);
  const [draftNew, setDraftNew] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ row: Row; fed: Row[] } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef(rows); useEffect(() => { ref.current = rows; }, [rows]);

  /** Save one row (from a dialog's Save). New rows are appended first so the list shows them straight away. */
  const save = (r: Row) => {
    const key = r._key || r.id;
    const row = { ...r, _key: key, _error: undefined };
    setRows((xs) => (xs.some((x) => x._key === key) ? xs.map((x) => (x._key === key ? row : x)) : [...xs, row]));
    start(async () => {
      const res = await upsertProduct(planId, { ...row, id: isNew(row) ? undefined : row.id });
      setRows((xs) => xs.map((x) => (x._key === key ? (res.ok ? { ...x, id: res.data!.id } : { ...x, _error: res.error }) : x)));
    });
  };
  /** Nothing that feeds another line is deleted silently — the line it feeds would quietly detach. */
  const askRemove = (r: Row) => {
    const fed = ref.current.filter((x) => x.name.trim() && x.clients_from_product_id === r.id && x._key !== r._key);
    if (fed.length) { setConfirm({ row: r, fed }); return; }
    remove(r);
  };
  const remove = (r: Row) => {
    setConfirm(null);
    setRows((xs) => xs.filter((x) => x._key !== r._key).map((x) => (x.clients_from_product_id === r.id ? { ...x, clients_from_product_id: null } : x)));
    if (!isNew(r)) start(async () => { await deleteProduct(planId, r.id); });
  };
  const add = () => { const b = blank(); setDraftNew({ ...b, _key: b.id }); setDlg({ kind: "product", key: b.id }); };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    start(async () => { await continueFromSales(planId, intent); });
  };

  const named = rows.filter((r) => r.name.trim());
  /** The line a row takes its clients from, and that row's numbers with the link resolved. */
  const src = (r: Row) => sourceOf(r, named) as Row | null;
  const years = (r: Row) => productYears(r, src(r));
  /** The lines that take their clients from this one — shown on the source, and guarded before deleting it. */
  const fedBy = (r: Row) => named.filter((x) => x.clients_from_product_id === r.id);
  /** The chain, both ways round: on the line that follows, and on the line that feeds. */
  const mark = (r: Row) => {
    const source = src(r);
    if (source) return <LinkMark title={`Clients come from ${source.name} — every one sold becomes a client here. Click to open it.`} onClick={() => setDlg({ kind: "product", key: source._key })} />;
    const fed = fedBy(r);
    if (fed.length) return <LinkMark feeds title={`Feeds ${fed.map((f) => f.name).join(", ")} — every one sold becomes a client there. Click to open it.`} onClick={() => setDlg({ kind: "product", key: fed[0]._key })} />;
    return null;
  };
  const err = rows.find((r) => r._error)?._error;
  /** "This year" reconciles against Historic — only lines already earning, and for an ongoing line that is its book. */
  const current = named.reduce((a, r) => recurring(r) ? a + bookNow(r) : (firstYear(r) === 0 ? a + r.average_price * r.units_sold : a), 0);
  const gap = historicRevenue ? ((current - historicRevenue) / historicRevenue) * 100 : null;
  const totals = planRevenueByYear(named);
  const open = dlg ? (draftNew && draftNew._key === dlg.key ? draftNew : rows.find((r) => r._key === dlg.key)) ?? null : null;
  const close = () => { setDlg(null); setDraftNew(null); };
  const monthTotals = planYear1Months(named);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Sales" subtitle="What you sell, what each line earns and how it grows — this is where the forecast's revenue comes from" mode={mode}
      areas={[{ key: "products", label: "Products", count: named.length }, { key: "annual", label: "Annual projections" }, { key: "monthly", label: "Monthly projections" }]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "All products" }}
      primaryAction={<Button size="sm" type="button" onClick={add}>+ Product</Button>}
      footer={<ModuleFooter planId={planId} prevId="historic" formId="sales-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Products</b> — one line for each thing you sell that a customer would recognise on a quote. Open a product to describe it and set what it sells for and how many you sell{startup ? " in Year 1" : " this year"}; annual sales calculates. Check the total against your accounts before you go further.</p>
        <p><b>Annual projections</b> — five years of sales per product. The pencil opens the growth dialog: a % change in price and in units for each year, an empty box is 0 %, negative is fine for a line you are winding down, and the dialog shows what the numbers become before you save.</p>
        <p><b>Monthly projections</b> — how Year 1 falls across the twelve months. Only the first-year cash flow uses it. Leave it even unless your trade genuinely has a quiet season or a line is launching mid-year.</p>
        <h3>Where this goes</h3>
        <p>Sales by year → the forecast&apos;s top line, break-even and What-If. Year 1 by month → the twelve-month cash flow. Descriptions → the {productWord} section of the report.</p>
      </>}
    >
      <PendingBridge pending={pending} error={err} />
      <form id="sales-form" onSubmit={onSubmit} className="hidden" />

      {area === "products" && (
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
            <thead><tr><Th>Product</Th><Th style={{ width: 120 }}>Sold as</Th><Th style={{ width: 120 }}>Lifecycle</Th><Th right style={{ width: 130 }}>Price</Th><Th right style={{ width: 130 }}>Units / clients</Th><Th right style={{ width: 150 }}>{startup ? "Year 1 sales" : "Sales this year"}</Th><Th style={{ width: 70 }} /></tr></thead>
            <tbody>
              {named.map((r) => (
                <GridRow key={r._key} className={cn(r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                  <Td><NameLink onClick={() => setDlg({ kind: "product", key: r._key })}>{r.name}</NameLink>{mark(r)}{firstYear(r) > 0 && <span className="ml-2 text-xs text-muted-foreground">from Year {firstYear(r)}</span>}</Td>
                  <Td className="text-muted-foreground">{recurring(r) ? "Ongoing client" : "One-off job"}</Td>
                  <Td className="text-muted-foreground">{LIFECYCLE.find((l) => l.value === r.lifecycle)?.label ?? "—"}</Td>
                  <Td right className="num">{recurring(r) ? <>{num(monthlyFee(r))}<span className="text-[11px] text-muted-foreground">/mo</span></> : num(r.average_price)}</Td>
                  <Td right className="num">{recurring(r) ? <>{r.opening_clients || 0} + {Number((years(r)[0].newClients ?? 0).toFixed(2))} new</> : r.units_sold}</Td>
                  <Td right className="num font-semibold">{num(years(r)[0].revenue)}</Td>
                  <Td className="whitespace-nowrap text-right"><IconButton title="Edit product" onClick={() => setDlg({ kind: "product", key: r._key })}>✎</IconButton><RemoveButton onClick={() => askRemove(r)} /></Td>
                </GridRow>
              ))}
              {named.length === 0 && <tr><Td colSpan={7} className="h-12 text-muted-foreground">Add your first product — what you sell, what it sells for, how many.</Td></tr>}
            </tbody>
            {named.length > 0 && <FootRow><Td colSpan={5}>Total</Td><Td right className="num">{num(named.reduce((a, r) => a + years(r)[0].revenue, 0))}</Td><Td /></FootRow>}
          </Grid>
          <Note>Click a product to open it. Growth and the monthly split are on the next two tabs.</Note>
        </>
      )}

      {area === "annual" && (
        <>
          <Toolbar><Meta className="ml-0">Sales by year. Pencil = growth; calendar = monthly split. Each year starts at 0 % change until you say otherwise.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th>Product</Th><Th right style={{ width: 120 }}>{startup ? "Base" : "Current"}</Th>{YEARS.map((y) => <Th key={y} right style={{ width: 120 }}>Year {y}</Th>)}<Th style={{ width: 80 }} /></tr></thead>
            <tbody>
              {named.map((r) => {
                const fy = firstYear(r); const p = years(r);
                return (
                  <GridRow key={r._key}>
                    <Td><NameLink onClick={() => setDlg({ kind: "growth", key: r._key })}>{r.name}</NameLink>{mark(r)}{recurring(r) && !isLinked(r) && <span className="ml-2 text-xs text-muted-foreground">ongoing</span>}</Td>
                    <Td right className="num text-muted-foreground">{recurring(r) ? num(bookNow(r)) : fy === 0 || startup ? num(r.average_price * r.units_sold) : `Year ${fy}`}</Td>
                    {p.map((y) => <Td key={y.year} right className={cn("num", y.year < fy && "text-muted-foreground/60")} title={y.clients !== undefined ? `${y.clients} clients at the end of the year` : ""}>{y.year < fy ? "—" : num(y.revenue)}</Td>)}
                    <Td className="whitespace-nowrap text-right"><IconButton title="Edit growth" onClick={() => setDlg({ kind: "growth", key: r._key })}>✎</IconButton><IconButton title="Edit monthly split" onClick={() => setDlg({ kind: "monthly", key: r._key })}>▦</IconButton></Td>
                  </GridRow>
                );
              })}
              {named.length === 0 && <tr><Td colSpan={8} className="h-12 text-muted-foreground">Add products first.</Td></tr>}
            </tbody>
            {named.length > 0 && <FootRow><Td>Total revenue → forecast</Td><Td right className="num">{num(startup ? 0 : current)}</Td>{totals.map((t) => <Td key={t.year} right className="num">{num(t.value)}</Td>)}<Td /></FootRow>}
          </Grid>
        </>
      )}

      {area === "monthly" && (
        <>
          <Toolbar><Meta className="ml-0">Year 1 sales by month — the twelve months the cash flow uses. Pencil to change a product&apos;s split.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "16%" }}>Product</Th>{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 100 }}>Total</Th><Th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {named.map((r) => {
                const fy = firstYear(r);
                const months = productYear1Months(r, src(r));
                const y1 = months.reduce((a, b) => a + b, 0);
                return (
                  <GridRow key={r._key}>
                    <Td><NameLink onClick={() => setDlg({ kind: "monthly", key: r._key })}>{r.name}</NameLink>{mark(r)}</Td>
                    {fy > 1 ? <Td colSpan={13} className="text-muted-foreground">Starts in Year {fy} — nothing in the first-year cash flow.</Td>
                      : <>{months.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}<Td right className="num font-semibold">{num(y1)}</Td></>}
                    <Td className="text-right">{fy <= 1 && <IconButton title="Edit monthly split" onClick={() => setDlg({ kind: "monthly", key: r._key })}>✎</IconButton>}</Td>
                  </GridRow>
                );
              })}
              {named.length === 0 && <tr><Td colSpan={15} className="h-12 text-muted-foreground">Add products first.</Td></tr>}
            </tbody>
            {named.length > 0 && <FootRow><Td>Total</Td>{monthTotals.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}<Td right className="num">{num(totals[0].value)}</Td><Td /></FootRow>}
          </Grid>
        </>
      )}

      {open && dlg?.kind === "product" && <ProductDialog key={open._key} r={open} others={named.filter((x) => x._key !== open._key && !x.clients_from_product_id && !isNew(x))} onSave={(r) => { save(r); close(); }} onClose={close} />}
      {open && dlg?.kind === "growth" && <GrowthDialog key={open._key} r={open} source={src(open)} startup={startup} startOptions={startOptions} onSave={(r) => { save(r); close(); }} onClose={close} />}
      {confirm && (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete {confirm.row.name}?</DialogTitle>
              <DialogDescription>
                {confirm.fed.length === 1 ? <><b>{confirm.fed[0].name}</b> takes its clients from this line.</> : <><b>{confirm.fed.map((f) => f.name).join(", ")}</b> take their clients from this line.</>}
                {" "}Delete it and {confirm.fed.length === 1 ? "that line goes" : "those lines go"} back to winning clients on {confirm.fed.length === 1 ? "its" : "their"} own — the numbers will change.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>Keep it</Button>
              <Button type="button" onClick={() => remove(confirm.row)}>Delete {confirm.row.name}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {open && dlg?.kind === "monthly" && (recurring(open)
        ? <ClientsDialog key={open._key} r={open} fyEndMonth={fyEndMonth} source={src(open)} onSave={(r) => { save(r); close(); }} onClose={close} />
        : <MonthlyDialog key={open._key} r={open} fyEndMonth={fyEndMonth} onSave={(r) => { save(r); close(); }} onClose={close} />)}
    </ModuleFrame>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="px-1.5 text-[14px] leading-none text-muted-foreground hover:text-primary">{children}</button>;
}

/* ---------- Product dialog (APeX "Product") ---------- */
function ProductDialog({ r, others, onSave, onClose }: { r: Row; others: Row[]; onSave: (r: Row) => void; onClose: () => void }) {
  const [d, setD] = useState<Row>(r);
  const set = (c: Partial<Row>) => setD((x) => ({ ...x, ...c }));
  const ok = d.name.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{isNew(r) ? "New product" : "Product"}</DialogTitle><DialogDescription>What you sell, in a lender&apos;s words, and what it earns. A <b>one-off job</b> is invoiced when you deliver it; an <b>ongoing client</b> keeps paying you every month.</DialogDescription></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (ok) onSave(d); }}>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2"><label className={label}>Name</label><Input autoFocus value={d.name} placeholder="Product or service" onChange={(e) => set({ name: e.target.value })} className={box} /></div>
            <div><label className={label}>Sold as</label><FieldSelect value={d.sold_as} options={SOLD_AS} onValueChange={(v) => set({ sold_as: v as Row["sold_as"] })} /></div>
            <div><label className={label}>Lifecycle</label><FieldSelect value={d.lifecycle} options={LIFECYCLE} placeholder="Choose —" onValueChange={(v) => set({ lifecycle: v })} /></div>
          </div>
          <div><label className={label}>What it is</label><Textarea value={d.description ?? ""} placeholder="One or two plain sentences — e.g. Reinforced concrete slabs for new homes, poured and finished by our own crew" onChange={(e) => set({ description: e.target.value })} className="min-h-[64px]" /></div>
          <div><label className={label}>Why they buy it, margin, weaknesses</label><Textarea value={d.notes ?? ""} placeholder="e.g. Builders choose us on turnaround; margin is thin — shifting effort to decorative work" onChange={(e) => set({ notes: e.target.value })} className="min-h-[64px]" /></div>
          <div className="border-t border-border pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Product sales baseline</div>
            {d.sold_as === "recurring" ? (
              <>
                <div className="grid grid-cols-5 gap-3">
                  <div><label className={label}>Fee a client a month</label><Input inputMode="decimal" value={d.average_price ? num(d.average_price / 12) : ""} placeholder="0" onChange={(e) => set({ average_price: parseNum(e.target.value) * 12 })} className={cn(box, "num text-right")} /></div>
                  <div><label className={cn(label, "whitespace-nowrap")}>Clients you have</label><Input inputMode="decimal" value={d.opening_clients ? String(d.opening_clients) : ""} placeholder="0" onChange={(e) => set({ opening_clients: parseNum(e.target.value) })} className={cn(box, "num text-right")} /></div>
                  <div><label className={label}>New clients a year</label>
                    {d.clients_from_product_id
                      ? <div className={cn(box, "flex items-center justify-end rounded border border-border bg-secondary px-2.5 text-muted-foreground")}>from that line</div>
                      : <Input inputMode="decimal" value={d.units_sold ? String(d.units_sold) : ""} placeholder="0" onChange={(e) => set({ units_sold: parseNum(e.target.value) })} className={cn(box, "num text-right")} />}
                  </div>
                  <div className="col-span-2">
                    <label className={label}>A client stays (months)</label>
                    <div className="flex gap-2">
                      <Input inputMode="decimal" value={d.client_life_months ? String(d.client_life_months) : ""} placeholder="12" onChange={(e) => set({ client_life_months: parseNum(e.target.value) })} className={cn(box, "num w-16 text-right")} />
                      <FieldSelect value={d.life_mode} options={LIFE_MODE} onValueChange={(v) => set({ life_mode: v as Row["life_mode"] })} className="flex-1" />
                    </div>
                  </div>
                </div>
                {others.length > 0 && (
                  <div className="mt-3 grid grid-cols-5 gap-3">
                    <div className="col-span-2">
                      <label className={label}>New clients come from</label>
                      <FieldSelect value={d.clients_from_product_id ?? "self"} options={[{ value: "self", label: "I win them myself" }, ...others.map((o) => ({ value: o.id, label: o.name }))]}
                        onValueChange={(v) => set({ clients_from_product_id: v === "self" ? null : v })} />
                    </div>
                    <div className="col-span-3 self-end pb-1.5 text-[11.5px] text-muted-foreground">
                      {d.clients_from_product_id
                        ? <>Every {others.find((o) => o.id === d.clients_from_product_id)?.name} sold becomes a client here, from the month it sells — a royalty following licence sales, support following a software sale, a membership following a joining fee.</>
                        : <>Use this when a line earns from something another line sells.</>}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {num(d.average_price / 12)} a month is {num(d.average_price)} a year per client{d.client_life_months ? `, over ${d.client_life_months} month${d.client_life_months === 1 ? "" : "s"}` : ""}.
                  {d.opening_clients > 0 && <> Your book is worth <b className="text-foreground">{num(bookNow(d))}</b> a year today.</>}
                  {" "}An ongoing line earns from the clients on your books, so its first year is not price × clients — when you win them decides that, on the Monthly projections tab.
                </p>
              </>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                <div><label className={label}>Average price</label><Input inputMode="decimal" value={d.average_price ? num(d.average_price) : ""} placeholder="0" onChange={(e) => set({ average_price: parseNum(e.target.value) })} className={cn(box, "num text-right")} /></div>
                <div><label className={label}>Base units sold (per year)</label><Input inputMode="decimal" value={d.units_sold ? String(d.units_sold) : ""} placeholder="0" onChange={(e) => set({ units_sold: parseNum(e.target.value) })} className={cn(box, "num text-right")} /></div>
                <div><label className={label}>Base annual sales</label><div className={cn(box, "num flex items-center justify-end rounded border border-border bg-secondary px-2.5 font-semibold")}>{num(d.average_price * d.units_sold)}</div></div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-1"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!ok}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Growth dialog (APeX "Edit Growth Rates") ---------- */
function GrowthDialog({ r, source, startup, startOptions, onSave, onClose }: { r: Row; source: Row | null; startup: boolean; startOptions: { value: string; label: string }[]; onSave: (r: Row) => void; onClose: () => void }) {
  const [d, setD] = useState<Row>(r);
  const [text, setText] = useState<Record<string, string>>({});
  const fy = firstYear(d);
  const proj = productYears(d, source);
  const price = yearlyProjection(d.average_price, d.units_sold, d.yearly_growth, d.start_selling_year);
  const g = (y: number, k: "price" | "units") => text[`${y}${k}`] ?? (d.yearly_growth?.[String(y)]?.[k] ? String(d.yearly_growth![String(y)]![k]) : "");
  const setG = (y: number, k: "price" | "units", raw: string) => {
    const yg: Growth = { ...(d.yearly_growth ?? {}) }; yg[String(y)] = { ...(yg[String(y)] ?? {}), [k]: parseSigned(raw) ?? 0 };
    setD((x) => ({ ...x, yearly_growth: yg })); setText((t) => ({ ...t, [`${y}${k}`]: raw }));
  };
  const cell = (y: number, k: "price" | "units") => y <= fy
    ? <div className={cn(box, "flex items-center justify-end pr-2 text-xs text-muted-foreground/70")}>{y === fy ? "starts" : "—"}</div>
    : <span className="relative block"><Input inputMode="text" value={g(y, k)} onChange={(e) => setG(y, k, e.target.value)} className={cn(box, "num pr-6 text-right")} /><span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></span>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Growth — {d.name}</DialogTitle><DialogDescription>A % change in price and in units for each year. Empty = no change; negative shrinks the line.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
          <div className="grid grid-cols-[1fr_auto] items-end gap-4">
            <div className="rounded border border-border bg-secondary px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{startup ? "Base values" : "Current values"}</div>
              {recurring(d)
                ? <div className="mt-1 flex gap-8 text-[13px]"><span>Fee <b className="num">{num(monthlyFee(d))}</b>/mo</span><span>On the books <b className="num">{d.opening_clients || 0}</b></span><span>Worth <b className="num">{num(bookNow(d))}</b> a year</span></div>
                : <div className="mt-1 flex gap-8 text-[13px]"><span>Price <b className="num">{num(d.average_price)}</b></span><span>Units <b className="num">{d.units_sold}</b></span><span>Sales <b className="num">{num(d.average_price * d.units_sold)}</b></span></div>}
            </div>
            <div className="w-[220px]"><label className={label}>Starts selling</label><FieldSelect value={String(d.start_selling_year || 1)} options={startOptions} onValueChange={(v) => setD((x) => ({ ...x, start_selling_year: Number(v) }))} /></div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">% change each year</div>
            <div className="grid grid-cols-[110px_repeat(5,1fr)] items-center gap-x-3 gap-y-2">
              <div /> {YEARS.map((y) => <div key={y} className="text-right text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Year {y}</div>)}
              <div className="text-[12.5px] font-semibold">Price</div>{YEARS.map((y) => <div key={y}>{cell(y, "price")}</div>)}
              <div className="text-[12.5px] font-semibold">{recurring(r) ? "Clients" : "Units"}</div>
              {source
                ? <div className="col-span-5 self-center text-[12px] text-muted-foreground">Follows {source.name} — change the growth on that line.</div>
                : YEARS.map((y) => <div key={y}>{cell(y, "units")}</div>)}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">What that gives</div>
            <div className="grid grid-cols-[110px_repeat(5,1fr)] gap-x-3 gap-y-1.5 rounded border border-border px-3 py-2 text-[13px]">
              <div /> {YEARS.map((y) => <div key={y} className="text-right text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Year {y}</div>)}
              {recurring(d) ? (
                <>
                  <div className="text-muted-foreground">New clients</div>{proj.map((p) => <div key={p.year} className="num text-right">{p.year < fy ? "—" : Number((p.newClients ?? 0).toFixed(2))}</div>)}
                  <div className="text-muted-foreground">On the books</div>{proj.map((p) => <div key={p.year} className="num text-right">{p.year < fy ? "—" : Number((p.clients ?? 0).toFixed(2))}</div>)}
                  <div className="font-semibold">= Sales</div>{proj.map((p) => <div key={p.year} className="num text-right font-semibold">{p.year < fy ? "—" : num(p.revenue)}</div>)}
                </>
              ) : (
                <>
                  <div className="text-muted-foreground">Price</div>{price.map((p) => <div key={p.year} className="num text-right">{p.year < fy ? "—" : num(p.price)}</div>)}
                  <div className="text-muted-foreground">× Units</div>{price.map((p) => <div key={p.year} className="num text-right">{p.year < fy ? "—" : p.units}</div>)}
                  <div className="font-semibold">= Sales</div>{price.map((p) => <div key={p.year} className="num text-right font-semibold">{p.year < fy ? "—" : num(p.sales)}</div>)}
                </>
              )}
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Clients-won dialog — the ongoing line's answer to the monthly split (§6.17) ---------- */
function ClientsDialog({ r, source, fyEndMonth, onSave, onClose }: { r: Row; source: Row | null; fyEndMonth: number; onSave: (r: Row) => void; onClose: () => void }) {
  const MONTHS = planMonths(fyEndMonth);
  const [d, setD] = useState<Record<string, number>>(() => {
    const src = r.monthly_new_clients ?? {};
    const any = MONTHS.some((_, i) => Number(src[String(i + 1)]) > 0);
    return Object.fromEntries(MONTHS.map((_, i) => [String(i + 1), any ? Number(src[String(i + 1)]) || 0 : 0]));
  });
  const [text, setText] = useState<Record<string, string>>({});
  const arriving = source ? newClientsYear1(r, source) : null;
  const won = arriving ? arriving.reduce((a, b) => a + b, 0) : MONTHS.reduce((a, _, i) => a + (d[String(i + 1)] || 0), 0);
  const draft: Row = source ? r : { ...r, monthly_new_clients: d, units_sold: won };
  const months = productYear1Months(draft, source);
  const active = productYear1Clients(draft, source);
  const year1 = months.reduce((a, b) => a + b, 0);
  const runRate = (active[11] ?? 0) * monthlyFee(r) * 12;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Clients won — {r.name}</DialogTitle>
          <DialogDescription>{source
            ? <>Every <b>{source.name}</b> sold becomes a client here, from the month it sells. Change the timing on that line&apos;s monthly split.</>
            : <>How many new clients you win in each month of the first year. They keep paying from the month they join, so when you win them decides what the year earns.</>}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
          {r.opening_clients > 0 && <p className="-mb-1 text-[12.5px] text-muted-foreground">Starting with <b className="text-foreground">{r.opening_clients}</b> {r.opening_clients === 1 ? "client" : "clients"} already on the books.</p>}
          <div className="grid grid-cols-4 gap-x-4 gap-y-3">
            {MONTHS.map((m, i) => (
              <div key={i}>
                <label className={label}>{m}</label>
                {arriving
                  ? <div className={cn(box, "num flex items-center justify-end rounded border border-border bg-secondary px-2.5")}>{Number(arriving[i].toFixed(2))}</div>
                  : <Input inputMode="decimal" value={text[i + 1] ?? (d[String(i + 1)] ? String(d[String(i + 1)]) : "")} placeholder="0"
                      onChange={(e) => { const raw = e.target.value; setText((t) => ({ ...t, [i + 1]: raw })); setD((x) => ({ ...x, [String(i + 1)]: Math.max(0, parseNum(raw)) })); }}
                      className={cn(box, "num text-right")} />}
                <div className="mt-0.5 flex justify-between text-[11px] text-muted-foreground"><span>{(active[i] ?? 0).toFixed(1).replace(/\.0$/, "")} on</span><span className="num">{num(months[i])}</span></div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-3 text-[13px]">
            <span>New clients <b className="num">{Number(won.toFixed(2))}</b>{source && <span className="text-muted-foreground"> from {source.name}</span>}</span>
            <span>Year 1 sales <b className="num">{num(year1)}</b></span>
            <span className="text-muted-foreground">Run rate at December <b className="num text-foreground">{num(runRate)}</b></span>
          </div>
          <p className="-mt-2 text-[11.5px] text-muted-foreground">A client stays {r.client_life_months} months {r.life_mode === "fixed" ? "as a set programme" : "on average"} — change that on the product.</p>
          <DialogFooter>{source
            ? <Button type="button" onClick={onClose}>Close</Button>
            : <><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></>}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Monthly dialog (APeX "Monthly Sales Distribution") ---------- */
function MonthlyDialog({ r, fyEndMonth, onSave, onClose }: { r: Row; fyEndMonth: number; onSave: (r: Row) => void; onClose: () => void }) {
  const MONTHS = planMonths(fyEndMonth);
  const [d, setD] = useState<MonthlyDistribution>(normalizeDistribution(r.monthly_distribution));
  const [text, setText] = useState<Record<string, string>>({});
  const total = distributionTotal(d);
  const ok = Math.abs(total - 100) <= 0.01;
  const y1 = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year)[0].sales;
  const months = monthlySales(y1, d);
  const preset = (nd: MonthlyDistribution) => { setD(nd); setText({}); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Monthly split — {r.name}</DialogTitle><DialogDescription>The share of Year 1 sales ({num(y1)}) in each month. The twelve must add up to 100 %.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ ...r, monthly_distribution: d }); }}>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            {MONTHS.map((_, i) => (
              <div key={i}>
                <label className={label}>{MONTH_NAMES[i]}</label>
                <span className="relative block"><Input inputMode="decimal" value={text[i + 1] ?? pct(d[String(i + 1)])} onChange={(e) => { const raw = e.target.value; setText((t) => ({ ...t, [i + 1]: raw })); setD((x) => ({ ...x, [String(i + 1)]: parseSigned(raw) ?? 0 })); }} className={cn(box, "num pr-6 text-right")} /><span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></span>
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
