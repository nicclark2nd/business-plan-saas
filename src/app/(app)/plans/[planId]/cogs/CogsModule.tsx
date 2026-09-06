"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, LinkMark, RemoveButton } from "@/components/module/DataGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { YEARS, evenDistribution, moderateDistribution, rampUpDistribution, normalizeDistribution, distributionTotal, type MonthlyDistribution } from "@/engine/sales/projection";
import { sourceOf, recurring, monthlyFee, type AnyProduct } from "@/engine/sales/product";
import { productCostYears, unitCostByYear, fixedCostByYear, fixedCostMonths, planCogsByYear, currentCost } from "@/engine/cogs/direct";
import { saveProductCost, upsertFixedCogs, deleteFixedCogs, continueFromCogs } from "./actions";
import { MONTHS, MONTH_NAMES, type CostedProduct, type FixedCogs } from "./model";

/**
 * COGS — the direct cost of what you sell (§6.18). Two lists, three dialogs, nothing typed into a list.
 *   By product   → Cost dialog: what it costs, cost rises per year, and the year-by-year economics that follow.
 *   Fixed costs  → Item dialog (name, annual cost, yearly rises) and a Monthly split dialog.
 * A cost follows how the line is SOLD: per job for a one-off, per client per month for an ongoing client.
 * APeX's Combined and Monthly tabs are dropped — they hold no inputs; those views belong to Review forecast.
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
const pctText = (v: number | null | undefined) => v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}%`;

type AreaKey = "products" | "fixed";
type Dlg = { kind: "cost"; key: string } | { kind: "item" | "split"; key: string } | null;
type FixRow = FixedCogs & { _key: string; _error?: string };
const STEP = GUIDED_STEPS.find((s) => s.id === "cogs")?.step ?? 8;
const isNew = (r: FixRow) => r.id.startsWith("tmp-");
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";

export function CogsModule({ planId, products, fixed, mode, initialArea, historicRevenue, historicCogs, historicEnd }: {
  planId: string; products: CostedProduct[]; fixed: FixedCogs[]; mode: "guided" | "advanced"; initialArea: AreaKey;
  historicRevenue: number | null; historicCogs: number | null; historicEnd: string | null;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [rows, setRows] = useState<CostedProduct[]>(products);
  const [items, setItems] = useState<FixRow[]>(fixed.map((f) => ({ ...f, _key: f.id })));
  const [dlg, setDlg] = useState<Dlg>(null);
  const [draftNew, setDraftNew] = useState<FixRow | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef(rows); useEffect(() => { ref.current = rows; }, [rows]);

  const src = (p: CostedProduct) => sourceOf(p, rows as AnyProduct[]) as CostedProduct | null;
  /** The same chain as Sales, both ways round — a linked line's cost still follows the clients it inherits. */
  const mark = (p: CostedProduct) => {
    const source = src(p);
    if (source) return <LinkMark title={`Clients come from ${source.name} — every one sold becomes a client here. Click to open its cost.`} onClick={() => setDlg({ kind: "cost", key: source.id })} />;
    const fed = rows.filter((x) => x.clients_from_product_id === p.id && x.name.trim());
    if (fed.length) return <LinkMark feeds title={`Feeds ${fed.map((f) => f.name).join(", ")}. Click to open its cost.`} onClick={() => setDlg({ kind: "cost", key: fed[0].id })} />;
    return null;
  };
  const priced = rows.filter((p) => p.name.trim());
  const costed = priced.filter((p) => p.cost_per_unit > 0).length;

  const saveCost = (p: CostedProduct) => {
    setRows((xs) => xs.map((x) => (x.id === p.id ? p : x)));
    start(async () => {
      const res = await saveProductCost(planId, { id: p.id, cost_per_unit: p.cost_per_unit, yearly_cost_increase: p.yearly_cost_increase });
      if (!res.ok) setErr(res.error);
    });
  };
  const saveItem = (f: FixRow) => {
    const key = f._key || f.id;
    setItems((xs) => (xs.some((x) => x._key === key) ? xs.map((x) => (x._key === key ? { ...f, _key: key } : x)) : [...xs, { ...f, _key: key }]));
    start(async () => {
      const res = await upsertFixedCogs(planId, { ...f, id: isNew(f) ? undefined : f.id });
      setItems((xs) => xs.map((x) => (x._key === key ? (res.ok ? { ...x, id: res.data!.id, _error: undefined } : { ...x, _error: res.error }) : x)));
    });
  };
  const removeItem = (f: FixRow) => {
    setItems((xs) => xs.filter((x) => x._key !== f._key));
    if (!isNew(f)) start(async () => { await deleteFixedCogs(planId, f.id); });
  };
  const addItem = () => {
    const id = `tmp-${crypto.randomUUID()}`;
    setDraftNew({ id, _key: id, item_name: "", annual_cost: 0, yearly_growth_rates: null, monthly_distribution: null, sort_order: 0 });
    setDlg({ kind: "item", key: id });
  };
  const [error, setErr] = useState<string | undefined>();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    start(async () => { await continueFromCogs(planId, intent); });
  };

  const totals = planCogsByYear(priced, items, (p) => src(p as CostedProduct));
  const currentVariable = priced.reduce((a, p) => a + currentCost(p), 0);
  const currentFixed = items.reduce((a, f) => a + Number(f.annual_cost || 0), 0);
  const currentTotal = currentVariable + currentFixed;
  const histMargin = historicRevenue && historicCogs !== null ? ((historicRevenue - historicCogs) / historicRevenue) * 100 : null;
  const gap = histMargin !== null && totals[0].margin !== null ? totals[0].margin - histMargin : null;
  const openItem = dlg && dlg.kind !== "cost" ? (draftNew && draftNew._key === dlg.key ? draftNew : items.find((x) => x._key === dlg.key)) ?? null : null;
  const openProduct = dlg?.kind === "cost" ? rows.find((p) => p.id === dlg.key) ?? null : null;
  const close = () => { setDlg(null); setDraftNew(null); };

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="COGS" subtitle="What each sale costs you to deliver — the gap between this and your prices is your gross profit" mode={mode}
      areas={[{ key: "products", label: "By product", count: priced.length, tag: priced.length - costed > 0 ? `${priced.length - costed} without a cost` : undefined },
              { key: "fixed", label: "Fixed costs", count: items.filter((i) => i.item_name.trim()).length }]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "All products" }}
      primaryAction={area === "fixed" ? <Button size="sm" type="button" onClick={addItem}>+ Fixed cost</Button> : undefined}
      footer={<ModuleFooter planId={planId} prevId="sales" formId="cogs-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>By product</b> — the cost of delivering one sale, and nothing else. Materials, subcontractors, freight, merchant fees: anything you would not spend if you did not make the sale. A cost follows the way the line is sold — a one-off job costs per job, an ongoing client costs for every month they stay. A line with no direct cost at all, like a royalty, is left at zero and says so.</p>
        <p><b>Fixed costs</b> are production costs that do not move with volume — a production wage, a yard, plant hire. If it would still be there with no sales at all and it is not part of making the product, it belongs in Overheads instead, or you will count it twice.</p>
        <p>Cost rises work like price rises: an empty box is 0 %, and a line that starts later carries its own first-year cost and rises from the year after.</p>
        <h3>Where this goes</h3>
        <p>Gross profit → the forecast&apos;s profit and loss and your break-even. Year 1 by month → the twelve-month cash flow. Margin by product → the report, where a lender looks first.</p>
      </>}
    >
      <PendingBridge pending={pending} error={error ?? items.find((i) => i._error)?._error} />
      <form id="cogs-form" onSubmit={onSubmit} className="hidden" />

      {area === "products" && (
        <>
          <Toolbar>
            <Meta className="ml-0">
              {priced.length ? <>Gross margin {pctText(totals[0].margin)} in Year 1 · COGS {num(totals[0].total)} on revenue {num(totals[0].revenue)}</> : "No products yet — add them on Sales"}
              {gap !== null && (Math.abs(gap) > 5
                ? <span className="text-warn"> · {gap > 0 ? "+" : ""}{Math.round(gap)} points against your {historicEnd?.slice(0, 4) ?? ""} margin of {pctText(histMargin)} — a cost is missing or a price is optimistic</span>
                : <> · in line with your {historicEnd?.slice(0, 4) ?? ""} margin of {pctText(histMargin)}</>)}
            </Meta>
          </Toolbar>
          <Grid>
            <thead><tr><Th>Product</Th><Th style={{ width: 130 }}>Sold as</Th><Th right style={{ width: 130 }}>Cost</Th><Th right style={{ width: 140 }}>COGS Year 1</Th><Th right style={{ width: 150 }}>Gross profit</Th><Th right style={{ width: 100 }}>Margin</Th><Th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {priced.map((p) => {
                const y = productCostYears(p, src(p))[0];
                const missing = p.cost_per_unit <= 0;
                return (
                  <GridRow key={p.id}>
                    <Td className="relative">
                      {missing && <i title="No direct cost set" className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-warn" />}
                      <NameLink onClick={() => setDlg({ kind: "cost", key: p.id })}>{p.name}</NameLink>{mark(p)}
                    </Td>
                    <Td className="text-muted-foreground">{recurring(p) ? "Ongoing client" : "One-off job"}</Td>
                    <Td right className="num">{missing ? <span className="text-muted-foreground">—</span> : recurring(p) ? <>{num(p.cost_per_unit / 12)}<span className="text-[11px] text-muted-foreground">/mo</span></> : num(p.cost_per_unit)}</Td>
                    <Td right className="num">{num(y.cost)}</Td>
                    <Td right className="num font-semibold">{num(y.grossProfit)}</Td>
                    <Td right className={cn("num", y.margin !== null && y.margin < 0 && "text-bad")}>{pctText(y.margin)}</Td>
                    <Td className="text-right"><IconButton title="Edit cost" onClick={() => setDlg({ kind: "cost", key: p.id })}>✎</IconButton></Td>
                  </GridRow>
                );
              })}
              {priced.length === 0 && <tr><Td colSpan={7} className="h-12 text-muted-foreground">Add products on the Sales step first — their costs are set here.</Td></tr>}
            </tbody>
            {priced.length > 0 && (
              <FootRow>
                <Td colSpan={3}>Total{items.length > 0 && <span className="ml-2 font-normal text-muted-foreground">variable only — fixed costs are on the next tab</span>}</Td>
                <Td right className="num">{num(totals[0].variable)}</Td>
                <Td right className="num">{num(totals[0].revenue - totals[0].variable)}</Td>
                <Td right className="num">{pctText(totals[0].revenue ? ((totals[0].revenue - totals[0].variable) / totals[0].revenue) * 100 : null)}</Td>
                <Td />
              </FootRow>
            )}
          </Grid>
          <Note>Click a product to set what it costs you and how that cost rises. Products themselves are added on Sales.</Note>
        </>
      )}

      {area === "fixed" && (
        <>
          <Toolbar><Meta className="ml-0">Production costs that do not move with volume. If it would be there with no sales at all, it belongs in Overheads instead.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th>Cost</Th><Th right style={{ width: 130 }}>This year</Th>{YEARS.map((y) => <Th key={y} right style={{ width: 110 }}>Year {y}</Th>)}<Th style={{ width: 70 }} /></tr></thead>
            <tbody>
              {items.filter((f) => f.item_name.trim()).map((f) => {
                const y = fixedCostByYear(f);
                return (
                  <GridRow key={f._key} className={cn(f._error && "[&>td]:bg-bad-soft")} title={f._error}>
                    <Td><NameLink onClick={() => setDlg({ kind: "item", key: f._key })}>{f.item_name}</NameLink></Td>
                    <Td right className="num text-muted-foreground">{num(f.annual_cost)}</Td>
                    {y.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}
                    <Td className="whitespace-nowrap text-right">
                      <IconButton title="Edit cost" onClick={() => setDlg({ kind: "item", key: f._key })}>✎</IconButton>
                      <IconButton title="Edit monthly split" onClick={() => setDlg({ kind: "split", key: f._key })}>▦</IconButton>
                      <RemoveButton onClick={() => removeItem(f)} />
                    </Td>
                  </GridRow>
                );
              })}
              {items.filter((f) => f.item_name.trim()).length === 0 && <tr><Td colSpan={8} className="h-12 text-muted-foreground">Nothing here yet — many businesses have none, and that is a fine answer.</Td></tr>}
            </tbody>
            {items.filter((f) => f.item_name.trim()).length > 0 && (
              <FootRow><Td>Total</Td><Td right className="num">{num(currentFixed)}</Td>{totals.map((t) => <Td key={t.year} right className="num">{num(t.fixed)}</Td>)}<Td /></FootRow>
            )}
          </Grid>
          <Note>Each cost carries its own yearly rises and its own split across the twelve months — the ▦ icon.</Note>
        </>
      )}

      <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
        Total COGS {num(currentTotal)} this year → {totals.map((t) => `${num(t.total)}`).join(" · ")} · gross margin {totals.map((t) => pctText(t.margin)).join(" · ")}
      </div>

      {openProduct && <CostDialog key={openProduct.id} p={openProduct} source={src(openProduct)} onSave={(p) => { saveCost(p); close(); }} onClose={close} />}
      {openItem && dlg?.kind === "item" && <ItemDialog key={openItem._key} f={openItem} onSave={(f) => { saveItem(f); close(); }} onClose={close} />}
      {openItem && dlg?.kind === "split" && <SplitDialog key={openItem._key} f={openItem} onSave={(f) => { saveItem(f); close(); }} onClose={close} />}
    </ModuleFrame>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="px-1.5 text-[14px] leading-none text-muted-foreground hover:text-primary">{children}</button>;
}

/* ---------- Cost dialog (APeX "Cost Details", per product) ---------- */
function CostDialog({ p, source, onSave, onClose }: { p: CostedProduct; source: CostedProduct | null; onSave: (p: CostedProduct) => void; onClose: () => void }) {
  const [d, setD] = useState<CostedProduct>(p);
  const [text, setText] = useState<Record<string, string>>({});
  const ongoing = recurring(d);
  const years = productCostYears(d, source);
  const costs = unitCostByYear(d);
  const g = (y: number) => text[y] ?? (d.yearly_cost_increase?.[String(y)] ? String(d.yearly_cost_increase[String(y)]) : "");
  const setG = (y: number, raw: string) => {
    const next = { ...(d.yearly_cost_increase ?? {}) }; next[String(y)] = parseSigned(raw) ?? 0;
    setD((x) => ({ ...x, yearly_cost_increase: next })); setText((t) => ({ ...t, [y]: raw }));
  };
  const unit = ongoing ? d.cost_per_unit / 12 : d.cost_per_unit;
  const price = ongoing ? monthlyFee(d) : d.average_price;
  const marginNow = price ? ((price - unit) / price) * 100 : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cost — {d.name}</DialogTitle>
          <DialogDescription>
            {ongoing
              ? <>What it costs you to look after one client each month, and how that rises. Sells for <b>{num(price)}</b> a month.</>
              : <>What it costs you to deliver one, and how that rises. Sells for <b>{num(price)}</b>.</>}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={label}>{ongoing ? "Cost a client a month" : "Cost per unit"}</label>
              <Input autoFocus inputMode="decimal" value={unit ? num(unit) : ""} placeholder="0"
                onChange={(e) => { const v = parseNum(e.target.value); setD((x) => ({ ...x, cost_per_unit: ongoing ? v * 12 : v })); }}
                className={cn(box, "num text-right")} />
            </div>
            <div><label className={label}>{ongoing ? "Sells for a month" : "Sells for"}</label><div className={cn(box, "num flex items-center justify-end rounded border border-border bg-secondary px-2.5 text-muted-foreground")}>{num(price)}</div></div>
            <div><label className={label}>Gross profit each</label><div className={cn(box, "num flex items-center justify-end rounded border border-border bg-secondary px-2.5 font-semibold")}>{num(price - unit)}</div></div>
            <div><label className={label}>Margin</label><div className={cn(box, "num flex items-center justify-end rounded border border-border bg-secondary px-2.5 font-semibold", marginNow !== null && marginNow < 0 && "text-bad")}>{pctText(marginNow)}</div></div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">% cost rise each year</div>
            <div className="grid grid-cols-[110px_repeat(5,1fr)] items-center gap-x-3 gap-y-2">
              <div /> {YEARS.map((y) => <div key={y} className="text-right text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Year {y}</div>)}
              <div className="text-[12.5px] font-semibold">Cost</div>
              {YEARS.map((y) => (
                <div key={y}>
                  <span className="relative block">
                    <Input inputMode="text" value={g(y)} onChange={(e) => setG(y, e.target.value)} className={cn(box, "num pr-6 text-right")} />
                    <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </span>
                  <div className="pr-1.5 text-right text-[11px] text-muted-foreground num">{num(ongoing ? costs[y - 1] / 12 : costs[y - 1])}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">What that gives</div>
            <div className="grid grid-cols-[110px_repeat(5,1fr)] gap-x-3 gap-y-1.5 rounded border border-border px-3 py-2 text-[13px]">
              <div /> {YEARS.map((y) => <div key={y} className="text-right text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Year {y}</div>)}
              <div className="text-muted-foreground">{ongoing ? "Client-months" : "Units"}</div>{years.map((y) => <div key={y.year} className="num text-right">{y.volume || "—"}</div>)}
              <div className="text-muted-foreground">Revenue</div>{years.map((y) => <div key={y.year} className="num text-right">{num(y.revenue)}</div>)}
              <div className="text-muted-foreground">COGS</div>{years.map((y) => <div key={y.year} className="num text-right">{num(y.cost)}</div>)}
              <div className="font-semibold">Gross profit</div>{years.map((y) => <div key={y.year} className="num text-right font-semibold">{num(y.grossProfit)}</div>)}
              <div className="font-semibold">Margin</div>{years.map((y) => <div key={y.year} className={cn("num text-right font-semibold", y.margin !== null && y.margin < 0 && "text-bad")}>{pctText(y.margin)}</div>)}
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">Fixed production costs and overheads are not in this margin — they sit below gross profit.</p>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Fixed cost item ---------- */
function ItemDialog({ f, onSave, onClose }: { f: FixRow; onSave: (f: FixRow) => void; onClose: () => void }) {
  const [d, setD] = useState<FixRow>(f);
  const [text, setText] = useState<Record<string, string>>({});
  const years = fixedCostByYear(d);
  const g = (y: number) => text[y] ?? (d.yearly_growth_rates?.[String(y)] ? String(d.yearly_growth_rates[String(y)]) : "");
  const setG = (y: number, raw: string) => {
    const next = { ...(d.yearly_growth_rates ?? {}) }; next[String(y)] = parseSigned(raw) ?? 0;
    setD((x) => ({ ...x, yearly_growth_rates: next })); setText((t) => ({ ...t, [y]: raw }));
  };
  const ok = d.item_name.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew(f) ? "New fixed cost" : "Fixed cost"}</DialogTitle>
          <DialogDescription>A production cost that does not move with how much you sell — a production wage, a yard, plant hire.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) onSave(d); }}>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className={label}>What it is</label><Input autoFocus value={d.item_name} placeholder="e.g. Production wages" onChange={(e) => setD((x) => ({ ...x, item_name: e.target.value }))} className={box} /></div>
            <div><label className={label}>Cost a year</label><Input inputMode="decimal" value={d.annual_cost ? num(d.annual_cost) : ""} placeholder="0" onChange={(e) => setD((x) => ({ ...x, annual_cost: parseNum(e.target.value) }))} className={cn(box, "num text-right")} /></div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">% rise each year</div>
            <div className="grid grid-cols-[90px_repeat(5,1fr)] items-center gap-x-3 gap-y-2">
              <div /> {YEARS.map((y) => <div key={y} className="text-right text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Year {y}</div>)}
              <div className="text-[12.5px] font-semibold">Rise</div>
              {YEARS.map((y) => (
                <div key={y}>
                  <span className="relative block">
                    <Input inputMode="text" value={g(y)} onChange={(e) => setG(y, e.target.value)} className={cn(box, "num pr-6 text-right")} />
                    <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </span>
                  <div className="pr-1.5 text-right text-[11px] text-muted-foreground num">{num(years[y - 1])}</div>
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

/* ---------- Fixed cost monthly split ---------- */
function SplitDialog({ f, onSave, onClose }: { f: FixRow; onSave: (f: FixRow) => void; onClose: () => void }) {
  const [d, setD] = useState<MonthlyDistribution>(normalizeDistribution(f.monthly_distribution));
  const [text, setText] = useState<Record<string, string>>({});
  const total = distributionTotal(d);
  const ok = Math.abs(total - 100) <= 0.01;
  const y1 = fixedCostByYear(f)[0];
  const months = fixedCostMonths({ ...f, monthly_distribution: d });
  const preset = (nd: MonthlyDistribution) => { setD(nd); setText({}); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Monthly split — {f.item_name}</DialogTitle><DialogDescription>The share of Year 1 ({num(y1)}) falling in each month. The twelve must add up to 100 %.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ ...f, monthly_distribution: d }); }}>
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
