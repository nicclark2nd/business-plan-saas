"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, LinkMark, RemoveButton, SortTh, sortRows, type Sort } from "@/components/module/DataGrid";
import { FieldSelect } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { planMonths, planMonthNames } from "@/engine/plan/calendar";
import { ConfirmDelete } from "@/components/module/ConfirmDelete";
import { cn } from "@/lib/utils";
import { YEARS, yearlyProjection, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, monthlySales, hasValue, impliedPct, type Growth, type MonthlyDistribution } from "@/engine/sales/projection";
import { productYears, productYear1Months, productYear1Clients, newClientsYear1, planRevenueByYear, planYear1Months, sourceOf, isLinked, bookNow, monthlyFee, recurring } from "@/engine/sales/product";
import { useMoney } from "@/components/MoneyProvider";
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
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const parseSigned = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "-" || t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
/**
 * Month shares are STORED to four decimals, so they are shown to four. A twelfth is 8.3333, not 8.33 — showing
 * the rounded figure taught people to type it back, and twelve of those add to 99.96 %, not 100.
 */

type Row = Product & { _key: string; _error?: string };
type AreaKey = "products" | "annual" | "monthly";
type Dlg = { kind: "product" | "growth" | "monthly"; key: string } | null;
const STEP = GUIDED_STEPS.find((s) => s.id === "sales")?.step ?? 7;
const isNew = (r: Row) => r.id.startsWith("tmp-");
/** start_selling_year: 1 = now (this year's actuals), 2–6 = plan Year 1–5. */
const num2 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const firstYear = (r: Pick<Row, "start_selling_year">) => Math.min(5, Math.max(0, (r.start_selling_year || 1) - 1));

const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";

export function SalesModule({ planId, initial, mode, initialArea, hasHistory, historicRevenue, historicEnd, productWord, fyEndMonth, currency }: {
  planId: string; initial: Product[]; mode: "guided" | "advanced"; initialArea: AreaKey; hasHistory: boolean | null; historicRevenue: number | null; historicEnd: string | null; productWord: string; fyEndMonth: number; currency: string;
}) {
  const num = useMoney();
  const MONTHS = planMonths(fyEndMonth);          // the plan's own twelve, not January to December
  const startup = hasHistory === false;
  const blank = (): Row => ({ id: `tmp-${crypto.randomUUID()}`, _key: "", name: "", description: "", notes: "", lifecycle: null, average_price: 0, units_sold: 0, start_selling_year: startup ? 2 : 1, yearly_growth: {}, monthly_distribution: null, sort_order: 0, sold_as: "one_off", opening_clients: 0, client_life_months: 12, life_mode: "fixed", monthly_new_clients: null, clients_from_product_id: null });
  const startOptions = [...(startup ? [] : [{ value: "1", label: "Now — selling today" }]), ...YEARS.map((y) => ({ value: String(y + 1), label: `Year ${y}` }))];

  const router = useRouter();
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [rows, setRows] = useState<Row[]>(initial.map((p) => ({ ...p, _key: p.id })));
  const [dlg, setDlg] = useState<Dlg>(null);
  const [draftNew, setDraftNew] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ row: Row; fed: Row[] } | null>(null);
  const [serverErr, setServerErr] = useState<string | undefined>();
  const [sort, setSort] = useState<Sort>(null);
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
  /**
   * A product is never deleted silently (§6.24). It carries a price, units, five years of growth, a monthly
   * split and its COGS cost — and possibly a line that takes its clients from it.
   */
  const askRemove = (r: Row) => {
    const fed = ref.current.filter((x) => x.name.trim() && x.clients_from_product_id === r.id && x._key !== r._key);
    if (!r.name.trim() && isNew(r)) { remove(r); return; }   // an untouched blank row has nothing to lose
    setConfirm({ row: r, fed });                             // fed.length > 0 renders as a refusal, not a warning
  };
  const remove = (r: Row) => {
    setConfirm(null);
    setServerErr(undefined);
    setRows((xs) => xs.filter((x) => x._key !== r._key));
    if (!isNew(r)) start(async () => {
      const res = await deleteProduct(planId, r.id);
      // The server is the gate, not the screen. If it refuses, say why and take the list back from the
      // database rather than trusting whatever the client happened to be holding.
      if (!res.ok) { setServerErr(res.error); router.refresh(); }
    });
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
  const err = serverErr ?? rows.find((r) => r._error)?._error;
  /** "This year" reconciles against Historic — only lines already earning, and for an ongoing line that is its book. */
  const current = named.reduce((a, r) => recurring(r) ? a + bookNow(r) : (firstYear(r) === 0 ? a + r.average_price * r.units_sold : a), 0);
  const gap = historicRevenue ? ((current - historicRevenue) / historicRevenue) * 100 : null;
  const totals = planRevenueByYear(named);
  const open = dlg ? (draftNew && draftNew._key === dlg.key ? draftNew : rows.find((r) => r._key === dlg.key)) ?? null : null;
  const close = () => { setDlg(null); setDraftNew(null); };
  const monthTotals = planYear1Months(named);
  /**
   * The list as displayed. Sorting is a view only — `sort_order` still decides what the report prints,
   * and a third click on a heading puts the plan's own order back (§6.27).
   */
  const view = useMemo(() => sortRows(named, sort, (r, key) => {
    if (key === "name") return r.name.toLowerCase();
    if (key === "current") return recurring(r) ? bookNow(r) : firstYear(r) === 0 ? r.average_price * r.units_sold : -1;
    return years(r)[Number(key) - 1]?.revenue ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [named, sort]);
  const sortLabel = !sort ? null
    : `${sort.key === "name" ? "product" : sort.key === "current" ? (startup ? "base" : "this year") : `Year ${sort.key}`}, ${sort.key === "name" ? (sort.dir === "asc" ? "A to Z" : "Z to A") : sort.dir === "asc" ? "smallest first" : "largest first"}`;


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
            <SortNote sortLabel={sortLabel} onClear={() => setSort(null)} />
          </Toolbar>
          <Grid>
            <thead><tr>
              <SortTh label="Product" sortKey="name" sort={sort} onSort={setSort} />
              <Th style={{ width: 120 }}>Sold as</Th><Th style={{ width: 120 }}>Lifecycle</Th>
              <Th right style={{ width: 130 }}>Price</Th><Th right style={{ width: 130 }}>Units / clients</Th>
              <SortTh right style={{ width: 150 }} label={startup ? "Year 1 sales" : "Sales this year"} sortKey={startup ? "1" : "current"} sort={sort} onSort={setSort} />
              <Th style={{ width: 70 }} />
            </tr></thead>
            <tbody>
              {view.map((r) => (
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
          <Toolbar>
            <Meta className="ml-0">Sales by year. Pencil = growth; calendar = monthly split. Each year starts at 0 % change until you say otherwise.</Meta>
            <SortNote sortLabel={sortLabel} onClear={() => setSort(null)} />
          </Toolbar>
          <Grid>
            <thead><tr>
              <SortTh label="Product" sortKey="name" sort={sort} onSort={setSort} />
              <SortTh right style={{ width: 120 }} label={startup ? "Base" : "Current"} sortKey="current" sort={sort} onSort={setSort} />
              {YEARS.map((y) => <SortTh key={y} right style={{ width: 120 }} label={`Year ${y}`} sortKey={String(y)} sort={sort} onSort={setSort} />)}
              <Th style={{ width: 80 }} />
            </tr></thead>
            <tbody>
              {view.map((r) => {
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
          <Toolbar>
            <Meta className="ml-0">Year 1 sales by month — the twelve months the cash flow uses. Pencil to change a product&apos;s split.</Meta>
            <SortNote sortLabel={sortLabel} onClear={() => setSort(null)} />
          </Toolbar>
          <Grid>
            <thead><tr>
              <SortTh style={{ width: "16%" }} label="Product" sortKey="name" sort={sort} onSort={setSort} />
              {MONTHS.map((m) => <Th key={m} right>{m}</Th>)}
              <SortTh right style={{ width: 100 }} label="Total" sortKey="1" sort={sort} onSort={setSort} />
              <Th style={{ width: 44 }} />
            </tr></thead>
            <tbody>
              {view.map((r) => {
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
      {open && dlg?.kind === "growth" && <GrowthDialog key={open._key} r={open} source={src(open)} startOptions={startOptions} onSave={(r) => { save(r); close(); }} onClose={close} />}
      {confirm && (() => {
        const y1 = productYear1Months(confirm.row, src(confirm.row)).reduce((a, b) => a + b, 0);
        const fed = confirm.fed;
        return (
          <ConfirmDelete
            title={`Delete ${confirm.row.name || "this product"}?`}
            what={<>
              {y1 > 0 && <>It contributes <b>{num(y1)}</b> to Year 1 sales. </>}
              Its price, units, yearly growth, monthly split and cost go with it.
            </>}
            blocked={fed.length > 0 ? (
              <>
                {fed.length === 1 ? <><b>{fed[0].name}</b> takes its clients from this line.</> : <><b>{fed.map((f) => f.name).join(", ")}</b> take their clients from this line.</>}
                {" "}Deleting it would leave {fed.length === 1 ? "that line" : "those lines"} winning clients alone, so {fed.length === 1 ? "its" : "their"} income would change and nothing would say so.
                {" "}Open {fed.length === 1 ? fed[0].name : "each of them"} and either point {fed.length === 1 ? "it" : "them"} somewhere else or delete {fed.length === 1 ? "it" : "them"} first.
              </>
            ) : undefined}
            onCancel={() => setConfirm(null)}
            onConfirm={() => remove(confirm.row)}
          />
        );
      })()}

      {open && dlg?.kind === "monthly" && (recurring(open)
        ? <ClientsDialog key={open._key} r={open} fyEndMonth={fyEndMonth} source={src(open)} onSave={(r) => { save(r); close(); }} onClose={close} />
        : <MonthlyDialog key={open._key} r={open} fyEndMonth={fyEndMonth} currency={currency} others={named.filter((x) => x._key !== open._key && !recurring(x) && x.monthly_distribution)} onSave={(r) => { save(r); close(); }} onClose={close} />)}
    </ModuleFrame>
  );
}

/** Says a sort is only a view, and offers the way back. Nothing about the plan has been reordered. */
function SortNote({ sortLabel, onClear }: { sortLabel: string | null; onClear: () => void }) {
  if (!sortLabel) return null;
  return (
    <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted-foreground">
      Sorted by {sortLabel} — the plan&apos;s own order is unchanged
      <button type="button" onClick={onClear} className="rounded border border-input px-1.5 py-0.5 hover:border-primary hover:text-primary">Plan order</button>
    </span>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="px-1.5 text-[14px] leading-none text-muted-foreground hover:text-primary">{children}</button>;
}

/* ---------- Product dialog (APeX "Product") ---------- */
function ProductDialog({ r, others, onSave, onClose }: { r: Row; others: Row[]; onSave: (r: Row) => void; onClose: () => void }) {
  const num = useMoney();
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
function GrowthDialog({ r, source, startOptions, onSave, onClose }: { r: Row; source: Row | null; startOptions: { value: string; label: string }[]; onSave: (r: Row) => void; onClose: () => void }) {
  const num = useMoney();
  const [d, setD] = useState<Row>(r);
  const [text, setText] = useState<Record<string, string>>({});
  const fy = firstYear(d);
  const proj = productYears(d, source);
  const price = yearlyProjection(d.average_price, d.units_sold, d.yearly_growth, d.start_selling_year);
  const g = (y: number, k: "price" | "units") => text[`${y}${k}`] ?? (d.yearly_growth?.[String(y)]?.[k] ? String(d.yearly_growth![String(y)]![k]) : "");
  const valueKey = (k: "price" | "units"): "priceValue" | "unitsValue" => (k === "price" ? "priceValue" : "unitsValue");
  /** Typing a % means "grow it by this much", so it clears any figure typed outright for that year. */
  const setG = (y: number, k: "price" | "units", raw: string) => {
    const yg: Growth = { ...(d.yearly_growth ?? {}) };
    yg[String(y)] = { ...(yg[String(y)] ?? {}), [k]: parseSigned(raw) ?? 0, [valueKey(k)]: null };
    setD((x) => ({ ...x, yearly_growth: yg }));
    // Drop any text held for the figure box so it falls back to showing what the % works out to,
    // rather than sitting empty as if the year had no price at all.
    setText((t) => { const next = { ...t, [`${y}${k}`]: raw }; delete next[`v${y}${k}`]; return next; });
  };
  /** Typing a figure means "it is exactly this", so the % for that year becomes derived, not stored. */
  const setV = (y: number, k: "price" | "units", raw: string) => {
    const yg: Growth = { ...(d.yearly_growth ?? {}) };
    const parsed = raw.trim() === "" ? null : parseSigned(raw);
    yg[String(y)] = { ...(yg[String(y)] ?? {}), [valueKey(k)]: parsed, ...(parsed === null ? {} : { [k]: null }) };
    setD((x) => ({ ...x, yearly_growth: yg }));
    setText((t) => ({ ...t, [`v${y}${k}`]: raw, [`${y}${k}`]: "" }));
  };
  const vText = (y: number, k: "price" | "units", shown: number) => {
    const t = text[`v${y}${k}`];
    if (t !== undefined) return t;
    const set = d.yearly_growth?.[String(y)]?.[valueKey(k)];
    return set != null ? String(set) : String(Math.round(shown * 100) / 100);
  };
  const cell = (y: number, k: "price" | "units") => {
    if (y <= fy) return <div className={cn(box, "flex items-center justify-end pr-2 text-xs text-muted-foreground/70")}>{y === fy ? "base year" : "—"}</div>;
    const typed = hasValue(d.yearly_growth?.[String(y)], k);
    const shown = k === "price" ? price[y - 1].price : price[y - 1].units;
    const prev = y - 2 >= 0 ? (k === "price" ? price[y - 2].price : price[y - 2].units) : NaN;
    const derived = typed ? impliedPct(prev, shown) : null;
    return (
      <span className="relative block">
        <Input inputMode="text" value={typed ? (derived === null ? "" : String(derived)) : g(y, k)}
          onChange={(e) => setG(y, k, e.target.value)}
          title={typed ? "Worked out from the figure below — type here to grow by a % instead" : undefined}
          className={cn(box, "num pr-6 text-right", typed && "text-muted-foreground/70")} />
        <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </span>
    );
  };
  /** The figure itself, typed straight in. What you put here is what the plan uses — no reverse arithmetic. */
  const valueCell = (y: number, k: "price" | "units", shown: number) => y < fy
    ? <div className="num text-right text-muted-foreground/60">—</div>
    : y === fy
      ? <div className="num text-right text-muted-foreground" title="Set on the product — this is the line's base year">{k === "price" ? num(shown) : shown}</div>
      : <Input inputMode="text" value={vText(y, k, shown)} onChange={(e) => setV(y, k, e.target.value)}
          className={cn("h-7 num px-1.5 text-right", hasValue(d.yearly_growth?.[String(y)], k) && "font-semibold")} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Growth — {d.name}</DialogTitle><DialogDescription>A % change in price and in units for each year. Empty = no change; negative shrinks the line.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
          <div className="grid grid-cols-[1fr_auto] items-end gap-4">
            <div className="rounded border border-border bg-secondary px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
                {fy === 0 ? "Current values" : `Year ${fy} values`}
              </div>
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
            {fy > 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                This line starts in <b>Year {fy}</b>, so the price and units above <i>are</i> its Year {fy} figures — there is nothing before them to grow from, which is why Year {fy} has no box. The first change you can make is <b>Year {fy + 1}</b>.
                {" "}If it is already selling, set <b>Starts selling</b> to <b>Now — selling today</b> and Year 1 becomes a change on today&apos;s figures.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">What that gives</span>
              {!recurring(d) && <span className="text-[11.5px] text-muted-foreground">— or type the price and the number of units straight in, and the % works itself out</span>}
            </div>
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
                  <div className="self-center text-muted-foreground">Price</div>{price.map((p) => <div key={p.year} className="self-center">{valueCell(p.year, "price", p.price)}</div>)}
                  <div className="self-center text-muted-foreground">× Units</div>{price.map((p) => <div key={p.year} className="self-center">{valueCell(p.year, "units", p.units)}</div>)}
                  <div className="self-center font-semibold">= Sales</div>{price.map((p) => <div key={p.year} className="num self-center text-right font-semibold">{p.year < fy ? "—" : num(p.sales)}</div>)}
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
  const num = useMoney();
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
/**
 * Monthly split (§6.28) — how a one-off line falls across the twelve months.
 *
 * This used to be twelve percentage boxes, and it was the hardest screen in the app: nobody thinks
 * "8.33 % of my carports in July", they think "two a month, three in spring, none in July because it
 * rains". Twenty minutes a product, times a range of ten.
 *
 * Three things changed. You can type **percentages, units or the plan's own currency** — whichever the line is easiest to
 * think about — because the split has been stored as *weights* since §6.17, so a typed number is only ever
 * a proportion. Nothing breaks if the annual figure changes afterwards: the same shape distributes the new
 * total exactly. You can **switch a month off** for a wet season or a shutdown, and the rest take the year
 * between them. And you can **copy the shape from another line**, which is where the real time goes on a
 * large range — wet season is wet season whether it is a driveway or a patio.
 */
function MonthlyDialog({ r, fyEndMonth, currency, others, onSave, onClose }: {
  r: Row; fyEndMonth: number; currency: string; others: Row[]; onSave: (r: Row) => void; onClose: () => void;
}) {
  const num = useMoney();
  const MONTHS = planMonths(fyEndMonth);
  const MONTH_NAMES = planMonthNames(fyEndMonth);
  type EntryMode = "units" | "money" | "pct";

  const y1 = yearlyProjection(r.average_price, r.units_sold, r.yearly_growth, r.start_selling_year)[0];
  const yearSales = y1.sales, yearUnits = y1.units;
  /**
   * Per cent is the default for every line, not units (§6.28.1). A default that changes with the line —
   * units when there are units, per cent when there are not — means the dialog opens differently product by
   * product, and a screen used ten times in a row has to open the same way each time. The unit reading is
   * under every box regardless, so nothing is hidden by opening in per cent.
   */
  const [mode, setMode] = useState<EntryMode>("pct");

  /** What the client typed, in whatever unit they chose. Only the proportions matter. */
  const asMode = (pctValue: number, m: EntryMode) =>
    m === "pct" ? Math.round(pctValue * 10000) / 10000
      : m === "units" ? Math.round(yearUnits * (pctValue / 100) * 1000) / 1000
        : Math.round(yearSales * (pctValue / 100));
  const fromStored = (m: EntryMode) => {
    const stored = normalizeDistribution(r.monthly_distribution);
    const out: Record<string, string> = {};
    for (let i = 1; i <= 12; i++) out[String(i)] = String(asMode(num2(stored[String(i)]), m));
    return out;
  };
  const [w, setW] = useState<Record<string, string>>(() => fromStored("pct"));

  const weight = (i: number) => Math.max(0, parseSigned(w[String(i)] ?? "") ?? 0);
  const weightTotal = Array.from({ length: 12 }, (_, i) => weight(i + 1)).reduce((a, b) => a + b, 0);
  const ok = weightTotal > 0;

  /** Weights become the stored percentages only on the way out — what is typed is never rewritten. */
  const asDistribution = (): MonthlyDistribution => {
    const out: MonthlyDistribution = {};
    for (let i = 1; i <= 12; i++) out[String(i)] = Math.round((weight(i) / weightTotal) * 100 * 10000) / 10000;
    return out;
  };

  const monthsMoney = ok ? monthlySales(yearSales, asDistribution()) : Array(12).fill(0);
  const monthsUnits = Array.from({ length: 12 }, (_, i) => (ok ? Math.round(yearUnits * (weight(i + 1) / weightTotal) * 100) / 100 : 0));

  const setMonth = (i: number, raw: string) => setW((x) => ({ ...x, [String(i)]: raw }));
  const switchMode = (m: EntryMode) => {
    if (m === mode) return;
    const dist = ok ? asDistribution() : normalizeDistribution(r.monthly_distribution);
    const out: Record<string, string> = {};
    for (let i = 1; i <= 12; i++) out[String(i)] = String(asMode(num2(dist[String(i)]), m));
    setMode(m); setW(out);
  };
  /** Copy another line's shape wholesale — its off months included, because that is what "same as" means. */
  const applyPct = (dist: MonthlyDistribution) => {
    const out: Record<string, string> = {};
    for (let i = 1; i <= 12; i++) out[String(i)] = String(asMode(num2(dist[String(i)]), mode));
    setW(out);
  };
  /**
   * A preset reshapes the months that trade; it does not bring back the ones switched off (§6.28.3).
   * Turning July off and then reaching for Moderate rise is not a request to start selling in July again —
   * the old behaviour overwrote all twelve and silently undid the decision. With nothing live at all there
   * is nothing to preserve, so a preset fills all twelve, which is what makes Even the way back from empty.
   */
  const applyShape = (dist: MonthlyDistribution) => {
    const off = Array.from({ length: 12 }, (_, i) => weight(i + 1) === 0);
    const anyLive = off.some((x) => !x);
    const out: Record<string, string> = {};
    for (let i = 1; i <= 12; i++) out[String(i)] = anyLive && off[i - 1] ? "0" : String(asMode(num2(dist[String(i)]), mode));
    setW(out);
  };
  /** Off is a real answer — a shutdown, or a trade that cannot pour in the wet. The rest take the year. */
  const toggleMonth = (i: number) => {
    const on = weight(i) > 0;
    if (on) { setMonth(i, "0"); return; }
    const live = Array.from({ length: 12 }, (_, j) => weight(j + 1)).filter((v) => v > 0);
    const avg = live.length ? live.reduce((a, b) => a + b, 0) / live.length : (mode === "pct" ? 8.3333 : mode === "units" ? Math.max(1, Math.round(yearUnits / 12)) : Math.round(yearSales / 12));
    setMonth(i, String(Math.round(avg * 1000) / 1000));
  };

  const unitText = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const suffix = mode === "pct" ? "%" : mode === "units" ? "" : "";

  /**
   * What shape did you just make? (§6.28.2)
   *
   * This slot used to read "Twelve months add to 56,100", which could never say anything else — the split is
   * weights, so the twelve add to the year by construction. A reading that cannot fail is not a check; it is
   * furniture, and it invites the one question it was never answering: *am I short?* The header already
   * carries the year's total and the closing line already promises it holds.
   *
   * So it reads the SHAPE back instead — how much of the year trades, and where the peak and trough sit.
   * Twelve typed boxes do not show a pattern; one sentence does. When the spread is still flat it gives the
   * per-month figure, because "0.9 slabs a month" is the number that tells a builder an even year is fiction.
   */
  const shapeNote = () => {
    const live = Array.from({ length: 12 }, (_, i) => ({ v: weight(i + 1), i })).filter((x) => x.v > 0);
    if (!live.length) return null;
    if (live.length === 1) return `Selling in ${MONTH_NAMES[live[0].i]} only`;
    const trading = live.length === 12 ? "Selling in all twelve months" : `Selling in ${live.length} of the twelve months`;
    const top = live.reduce((a, b) => (b.v > a.v ? b : a));
    const low = live.reduce((a, b) => (b.v < a.v ? b : a));
    // A tolerance, not an equality: a legacy share of 8.3337 against 8.3333 is rounding, not a season.
    if (top.v - low.v <= top.v * 0.005) {
      const each = num(Math.round(yearSales / live.length));
      const per = yearUnits / live.length;
      return `${trading} \u00b7 even at ${each} a month${yearUnits > 0 ? `, ${unitText(per)} ${per === 1 ? "unit" : "units"}` : ""}`;
    }
    return `${trading} \u00b7 busiest ${MONTH_NAMES[top.i]}, quietest ${MONTH_NAMES[low.i]}`;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Monthly split — {r.name}</DialogTitle>
          <DialogDescription>
            How Year 1 falls across the twelve months — {num(yearSales)}{yearUnits > 0 && <> from {unitText(yearUnits)} {yearUnits === 1 ? "unit" : "units"}</>}.
            Only the proportions matter, so type whatever is easiest to think about.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ ...r, monthly_distribution: asDistribution() }); }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">Type in</span>
            <span className="flex rounded border border-input p-0.5">
              {([["pct", "%"], ["units", "Units"], ["money", currency]] as [EntryMode, string][]).map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => switchMode(m)} disabled={m === "units" && yearUnits <= 0}
                  className={cn("rounded px-2.5 py-0.5 text-xs font-semibold disabled:opacity-40",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{lbl}</button>
              ))}
            </span>
            {others.length > 0 && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[11.5px] font-semibold text-muted-foreground">Same as</span>
                <span className="w-[190px]">
                  <FieldSelect value="" placeholder="another product…"
                    options={others.map((o) => ({ value: o._key, label: o.name }))}
                    onValueChange={(v) => { const o = others.find((x) => x._key === v); if (o) applyPct(normalizeDistribution(o.monthly_distribution)); }} />
                </span>
              </span>
            )}
          </div>

          <p className="-mt-1 text-[11.5px] text-muted-foreground">
            Type <b className="num">0</b> in a month — or click its name — to switch it off for a wet season, a shutdown, a month you don&rsquo;t trade. The rest take the year between them.
          </p>

          <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
            {MONTHS.map((_, i) => {
              const off = weight(i + 1) === 0;
              return (
                <div key={i}>
                  <button type="button" onClick={() => toggleMonth(i + 1)} aria-pressed={!off}
                    aria-label={off ? `${MONTH_NAMES[i]} is switched off — bring it back` : `Switch ${MONTH_NAMES[i]} off`}
                    title={off ? `Nothing sold in ${MONTH_NAMES[i]} — click to bring it back` : `Click to switch ${MONTH_NAMES[i]} off`}
                    className="group mb-[3px] flex items-baseline gap-1 text-[11.5px] font-semibold">
                    <span className={cn(off ? "text-muted-foreground/60 line-through" : "text-muted-foreground group-hover:text-foreground")}>{MONTH_NAMES[i]}</span>
                    <span aria-hidden className={cn("text-[13px] leading-none", off ? "text-primary" : "text-muted-foreground/40 group-hover:text-foreground")}>{off ? "+" : "\u00d7"}</span>
                  </button>
                  <span className="relative block">
                    <Input inputMode="decimal" value={w[String(i + 1)] ?? ""} onChange={(e) => setMonth(i + 1, e.target.value)}
                      className={cn(box, "num text-right", suffix && "pr-6", off && "text-muted-foreground/60")} />
                    {suffix && <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
                  </span>
                  <div className="mt-0.5 text-right text-[11px] text-muted-foreground num">
                    {mode === "money"
                      ? <>{yearUnits > 0 ? `${unitText(monthsUnits[i])} units` : ""}</>
                      : <>{num(monthsMoney[i])}{mode === "pct" && yearUnits > 0 ? ` · ${unitText(monthsUnits[i])} units` : ""}</>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[13px]">
            <span className={cn(ok && "text-muted-foreground")}>
              {ok ? shapeNote() : <b className="text-bad">Put a figure in at least one month.</b>}
            </span>
            <span className="ml-auto flex gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => applyShape(evenDistribution())}>Even</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyShape(moderateDistribution())}>Moderate rise</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyShape(rampUpDistribution())}>Ramp-up</Button>
            </span>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            Whatever you type is read as a proportion, so the twelve always add to the year exactly — change the annual figure later and this shape still holds.
          </p>

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
