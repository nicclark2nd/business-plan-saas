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
import { cn } from "@/lib/utils";
import { YEARS } from "@/engine/sales/projection";
import { depreciationByYear, bookValueByYear, assetsByYear, type FixedAsset } from "@/engine/assets/depreciation";
import { upsertAsset, deleteAsset, saveFinancedShape, continueFromAssets } from "./actions";
import { MONTHS, METHODS, CATEGORIES, LIVES, lifeLabel, type AssetRow } from "./model";

/**
 * Fixed Assets — what the business owns and what it writes off (§6.20). One list, one dialog.
 *
 * Two kinds of line. A cash-bought asset is typed here. A financed one belongs to the Funding row that
 * bought it: its cost, its start and its residual come from that loan and cannot be typed over, but how it
 * is written off — the life and the method — is a real accounting choice and stays editable.
 */
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s$]/g, "")); return Number.isFinite(n) ? n : 0; };

type Row = AssetRow & { _key: string; _error?: string };
const STEP = GUIDED_STEPS.find((s) => s.id === "assets")?.step ?? 11;
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";
const YEAR_OPTIONS = YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }));
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));
const LIFE_OPTIONS = LIVES.map((l) => ({ value: String(l.months), label: l.label }));

export function AssetsModule({ planId, initial, mode, lenders }: {
  planId: string; initial: AssetRow[]; mode: "guided" | "advanced"; lenders: Record<string, string>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map((a) => ({ ...a, _key: a.id })));
  const [dlg, setDlg] = useState<{ key: string } | null>(null);
  const [confirmKey, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [error, setErr] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const lines = draft ? [...rows, draft] : rows;
  const totals = assetsByYear(lines.map((r) => r as FixedAsset));
  const financed = lines.filter((r) => r.source === "finance").length;

  const add = () => {
    const key = `tmp-${Date.now()}`;
    setDraft({
      id: key, _key: key, source: "entered", funding_debt_id: null, name: "", category: null,
      purchase_price: 0, residual_value: 0, useful_life_months: 60, method: "straight_line",
      start_year: 1, start_month: 1, notes: null, sort_order: 0,
    });
    setDlg({ key });
  };

  const save = (next: Row) => {
    setErr(undefined);
    start(async () => {
      if (next.source === "finance") {
        const res = await saveFinancedShape(planId, next.id, { name: next.name, method: next.method, useful_life_months: next.useful_life_months });
        if (!res.ok) { setErr(res.error); return; }
        setRows((rs) => rs.map((r) => (r._key === next._key ? next : r)));
      } else {
        const res = await upsertAsset(planId, next);
        if (!res.ok) { setErr(res.error); return; }
        const saved = { ...next, id: res.data!.id };
        setRows((rs) => (rs.some((r) => r._key === next._key) ? rs.map((r) => (r._key === next._key ? saved : r)) : [...rs, saved]));
        setDraft(null);
      }
      setDlg(null);
      router.refresh();
    });
  };

  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    setConfirm(null);
    if (!row) { setDraft(null); return; }
    start(async () => {
      const res = await deleteAsset(planId, row.id);
      if (!res.ok) { setErr(res.error); return; }
      setRows((rs) => rs.filter((r) => r._key !== key));
      router.refresh();
    });
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); start(async () => { await continueFromAssets(planId, "next"); }); };
  const current = dlg ? lines.find((r) => r._key === dlg.key) ?? null : null;
  const toRemove = confirmKey ? lines.find((r) => r._key === confirmKey) ?? null : null;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Fixed assets" subtitle="What the business owns, and what it writes off each year" mode={mode}
      areas={[{ key: "assets", label: "Assets", count: lines.length }]}
      area="assets" onArea={() => {}} scope={{ label: "This plan" }}
      primaryAction={<Button size="sm" type="button" onClick={add}>+ Asset</Button>}
      footer={<ModuleFooter planId={planId} prevId="funding" formId="assets-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Anything the business buys and keeps — a vehicle, machinery, a fit-out, computers. Not stock, and not something used up within the year; those are COGS and Overheads.</p>
        <p><b>Depreciation is an expense that never moves cash.</b> The money left when you bought the asset, or it leaves monthly as loan repayments. Depreciation only spreads the cost across the years the asset earns its keep, so the profit in each year is honest.</p>
        <p>Assets bought with <b>equipment or vehicle finance</b> are already here — they came from the loan on the Funding step, and what they cost belongs to that loan. How long you write one off over is still your call.</p>
        <p><b>Straight line</b> writes the same amount off every year and is what a bank or an SBA reviewer expects. <b>Diminishing value</b> writes more off early, which suits something that loses value fast.</p>
        <h3>Where this goes</h3>
        <p>Depreciation is an expense in the profit and loss. What the assets are still worth is on the balance sheet. Neither of them touches the cash flow.</p>
      </>}
    >
      <PendingBridge pending={pending} error={error} />
      <form id="assets-form" onSubmit={onSubmit} className="hidden" />

      <Toolbar>
        <Meta className="ml-0">
          {lines.length === 0 ? "No assets yet" : <>{num(totals[0].depreciation)} written off in Year 1 · {num(totals[0].bookValue)} still on the books</>}
          {financed > 0 && <> · {financed} bought with finance</>}
        </Meta>
      </Toolbar>

      <div className="min-h-0 overflow-auto px-3 pb-3">
        <Grid>
          <thead>
            <tr>
              <Th className="w-[24%]">Asset</Th>
              <Th className="w-[12%]">Bought</Th>
              <Th right>Cost</Th>
              <Th right>Life</Th>
              {YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}
              <Th right>Still worth</Th>
              <Th className="w-[76px]" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <GridRow>
                <Td colSpan={11} className="py-8 text-center text-muted-foreground">
                  Nothing here yet — and for plenty of businesses that is the right answer.
                  <div className="mt-1 text-[12px]">A service business with a laptop and a phone owns no fixed assets worth forecasting.</div>
                </Td>
              </GridRow>
            )}
            {lines.map((r) => {
              const dep = depreciationByYear(r as FixedAsset);
              const book = bookValueByYear(r as FixedAsset);
              const locked = r.source === "finance";
              return (
                <GridRow key={r._key} className={cn(r._error && "[&>td]:bg-bad-soft")} title={r._error}>
                  <Td>
                    <span className="inline-flex items-center gap-1">
                      <NameLink onClick={() => setDlg({ key: r._key })}>{r.name || <span className="text-muted-foreground">Untitled asset</span>}</NameLink>
                      {locked && (
                        <LinkMark
                          title={`Bought with ${lenders[r.funding_debt_id ?? ""] ?? "finance"} — what it cost belongs to that loan. Click to open Funding.`}
                          onClick={() => router.push(`/plans/${planId}/funding`)}
                        />
                      )}
                    </span>
                    {r.category && <span className="ml-2 text-[11px] text-muted-foreground">{r.category}</span>}
                  </Td>
                  <Td>{MONTHS[r.start_month - 1]} · Yr {r.start_year}</Td>
                  <Td right className="num">{num(r.purchase_price)}</Td>
                  <Td right className="whitespace-nowrap">{lifeLabel(r.useful_life_months)}{r.method === "diminishing" && <span className="ml-1 text-[11px] text-muted-foreground">DV</span>}</Td>
                  {dep.map((d, i) => <Td key={i} right className="num">{d ? num(d) : <span className="text-muted-foreground">—</span>}</Td>)}
                  <Td right className="num">{num(book[4])}</Td>
                  <Td right>
                    <IconButton title={locked ? "How it is written off" : "Edit asset"} onClick={() => setDlg({ key: r._key })}>✎</IconButton>
                    {!locked && <RemoveButton onClick={() => setConfirm(r._key)} title="Remove asset" />}
                  </Td>
                </GridRow>
              );
            })}
          </tbody>
          {lines.length > 0 && (
            <FootRow>
              <Td>Depreciation</Td>
              <Td />
              <Td right className="num">{num(totals.reduce((a, t) => a + t.capex, 0))}</Td>
              <Td />
              {totals.map((t) => <Td key={t.year} right className="num">{num(t.depreciation)}</Td>)}
              <Td right className="num">{num(totals[4].bookValue)}</Td>
              <Td />
            </FootRow>
          )}
        </Grid>

        {lines.length > 0 && (
          <Note>
            Cash out to buy them: {totals.map((t) => num(t.capex)).join(" · ")} across the five years —
            nil for anything bought with finance, whose cash is the loan repayment on the Funding step.
            Depreciation never moves cash; it only lowers the profit and what the assets are worth.
          </Note>
        )}
      </div>

      {current && (
        <AssetDialog
          row={current}
          lender={lenders[current.funding_debt_id ?? ""] ?? "finance"}
          onCancel={() => { setDlg(null); if (draft && draft._key === current._key) setDraft(null); }}
          onSave={save}
        />
      )}

      {toRemove && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Remove {toRemove.name || "this asset"}?</DialogTitle>
              <DialogDescription>
                Its {num(depreciationByYear(toRemove as FixedAsset).reduce((a, b) => a + b, 0))} of depreciation comes out of the forecast, and the {num(toRemove.purchase_price)} it cost stops leaving the bank.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setConfirm(null)}>Keep it</Button>
              <Button variant="destructive" size="sm" type="button" onClick={() => remove(toRemove._key)}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ModuleFrame>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className="px-1.5 text-[14px] leading-none text-muted-foreground hover:text-primary">{children}</button>;
}

function PendingBridge({ pending, error }: { pending: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : undefined), [pending, error, setNote]);
  return null;
}

/** One asset. A financed line shows what it cost as read-only and lets the write-off be chosen. */
function AssetDialog({ row, lender, onCancel, onSave }: { row: Row & { _key: string }; lender: string; onCancel: () => void; onSave: (r: Row) => void }) {
  const [d, setD] = useState<Row>(row);
  const locked = d.source === "finance";
  const set = (patch: Partial<Row>) => setD((x) => ({ ...x, ...patch }));
  const dep = depreciationByYear(d as FixedAsset);
  const book = bookValueByYear(d as FixedAsset);
  const perYear = dep.find((v) => v > 0) ?? 0;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{d.name.trim() || "New asset"}</DialogTitle>
          <DialogDescription>
            {locked
              ? `Bought with ${lender}. What it cost and when it arrived come from that loan — what you call it, and how you write it off, are yours.`
              : "Something the business buys and keeps. Its cost is spread across the years it earns its keep."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_180px] gap-3">
            <div>
              <span className={label}>Name</span>
              <Input autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })}
                placeholder={locked ? "Concrete pump" : "Delivery van"} className={box} />
            </div>
            <div>
              <span className={label}>Category</span>
              <FieldSelect value={d.category ?? ""} onValueChange={(v) => set({ category: v || null })}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Choose" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <span className={label}>What it cost</span>
              <Input inputMode="decimal" disabled={locked} defaultValue={d.purchase_price ? String(d.purchase_price) : ""}
                onBlur={(e) => set({ purchase_price: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
            </div>
            <div>
              <span className={label}>Worth at the end</span>
              <Input inputMode="decimal" disabled={locked} defaultValue={d.residual_value ? String(d.residual_value) : ""}
                onBlur={(e) => set({ residual_value: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
            </div>
            <div>
              <span className={label}>Bought in</span>
              <FieldSelect value={String(d.start_year)} onValueChange={(v) => set({ start_year: Number(v) })} options={YEAR_OPTIONS} />
            </div>
            <div>
              <span className={label}>Month</span>
              <FieldSelect value={String(d.start_month)} onValueChange={(v) => set({ start_month: Number(v) })} options={MONTH_OPTIONS} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Written off over</span>
              <FieldSelect value={String(d.useful_life_months)} onValueChange={(v) => set({ useful_life_months: Number(v) })} options={LIFE_OPTIONS} />
            </div>
            <div>
              <span className={label}>How</span>
              <FieldSelect value={d.method} onValueChange={(v) => set({ method: v as Row["method"] })} options={METHODS} />
            </div>
          </div>

          <div className="rounded border border-input bg-muted/40 p-3">
            <div className="text-[11.5px] font-semibold text-muted-foreground">What that gives</div>
            <Grid className="mt-2">
              <thead><tr><Th /> {YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}</tr></thead>
              <tbody>
                <GridRow><Td>Depreciation</Td>{dep.map((v, i) => <Td key={i} right className="num">{v ? num(v) : "—"}</Td>)}</GridRow>
                <GridRow><Td>Still worth</Td>{book.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}</GridRow>
              </tbody>
            </Grid>
            <div className="mt-2 text-[12px] text-muted-foreground">
              {d.purchase_price > 0
                ? <>{num(perYear)} a year off the profit{d.method === "diminishing" && " to begin with, less as it goes"} — and not a cent out of the bank.{" "}
                    {d.source === "finance" ? "The cash is the loan repayment." : `The ${num(d.purchase_price)} leaves in Year ${d.start_year}.`}</>
                : "Put in what it cost and this fills in."}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="button" onClick={() => onSave(d)} disabled={!d.name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
