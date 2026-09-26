"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/module/MoneyInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, RemoveButton } from "@/components/module/DataGrid";
import { FieldSelect } from "@/components/module/FieldGrid";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { planMonths } from "@/engine/plan/calendar";
import { cn } from "@/lib/utils";
import { useSaveOnce } from "@/lib/saveOnce";
import { NoneToList } from "@/components/module/NoneToList";
import { YEARS } from "@/engine/sales/projection";
import { useMoney } from "@/components/MoneyProvider";
import {
  disposalBookValueByYear, extraordinaryByYear, extraordinaryMonths, extraordinaryTotals, isDisposal,
  type ExtraordinaryItem,
} from "@/engine/extraordinary/items";
import { bookValueAtDisposal } from "@/engine/assets/depreciation";
import { upsertExtraordinary, deleteExtraordinary, continueFromExtraordinary } from "./actions";
import { CATEGORIES, EXAMPLES, type ExtraordinaryRow, type SoldAsset } from "./model";

/**
 * What a sale actually puts into profit (§6.56).
 *
 * A one-off that names an asset is not 50,000 of income. The machine was on the books at something, and
 * only the proceeds above that book value are a gain — below it, a loss. This is the same computation the
 * forecast runs (`disposalBookValueByYear`), reading the same asset, so the number on this screen and the
 * "Gain on asset sales" line on Review forecast are one figure, not two.
 */
function bookValueOf(item: { source_asset_id?: string | null; year: number; month: number }, assets: SoldAsset[]) {
  const asset = assets.find((a) => a.id === item.source_asset_id);
  if (!asset) return 0;
  const sold = (Math.max(1, item.year) - 1) * 12 + (Math.max(1, item.month) - 1);
  return bookValueAtDisposal({ ...asset, sold_in_month: sold });
}

/**
 * One-off income & costs (§6.23) — the P&L's extraordinary items, in plain words.
 *
 * Money in or out that has nothing to do with trading. Every item lands in a plan year 1–5, so unlike APeX
 * there is no date a client can pick that the forecast then silently drops.
 */
type Num = (v: number | null | undefined) => string;
/** Money out reads in brackets, the accounting convention every lender expects. */
const signedWith = (num: Num) => (v: number) => (v < 0 ? `(${num(Math.abs(v))})` : v > 0 ? num(v) : "—");
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s$]/g, "")); return Number.isFinite(n) ? n : 0; };

type AreaKey = "items" | "monthly";
type Row = ExtraordinaryRow & { _key: string };
const STEP = GUIDED_STEPS.find((s) => s.id === "extraordinary")?.step ?? 12;
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";
const YEAR_OPTIONS = YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }));

export function ExtraordinaryModule({ planId, initial, mode, assets, fyEndMonth, saidNone }: {
  planId: string; initial: ExtraordinaryRow[]; mode: "guided" | "advanced";
  assets: SoldAsset[]; fyEndMonth: number; saidNone: boolean;
}) {
  const num = useMoney();
  const signedText = signedWith(num);
  const MONTHS = planMonths(fyEndMonth);
  const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));
  const [area, setArea] = useState<AreaKey>("items");
  const [rows, setRows] = useState<Row[]>(initial.map((x) => ({ ...x, _key: x.id })));
  const [dlg, setDlg] = useState<{ key: string } | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [confirmKey, setConfirm] = useState<string | null>(null);
  /** Keyed failures that survive a keystroke and clear only on a save that works (§6.98). */
  const errors = useSaveErrors();
  const [pending, start] = useTransition();
  const once = useSaveOnce();

  const lines = useMemo(() => (draft ? [...rows, draft] : rows), [rows, draft]);
  const named = lines.filter((r) => r.description.trim() || r === draft);
  const years = extraordinaryByYear(named as ExtraordinaryItem[]);
  /** What the sold assets were carrying, so the net line below is what reaches profit and not the cheque. */
  const bookValues = disposalBookValueByYear(named as ExtraordinaryItem[], assets);
  const profitNet = years.map((y, i) => Math.round((y.net - bookValues[i]) * 100) / 100);
  const soldBookValue = bookValues.reduce((a, b) => a + b, 0);
  const profitTotal = Math.round(profitNet.reduce((a, b) => a + b, 0) * 100) / 100;
  const totals = extraordinaryTotals(named as ExtraordinaryItem[]);
  const assetName = (id: string | null) => assets.find((a) => a.id === id)?.name ?? null;

  const add = () => {
    const key = `tmp-${Date.now()}`;
    setDraft({ id: key, _key: key, description: "", category: "expense", amount: 0, year: 1, month: 1, source_asset_id: null, notes: null, sort_order: 0 });
    setDlg({ key });
  };

  const save = (next: Row) => {
    start(once(async () => {
      const res = await upsertExtraordinary(planId, next);
      if (!res.ok) { errors.raise({ key: "one-off", message: res.error, label: "One-off income & costs" }); return; }
      /* Cleared HERE, by the save that worked — never by the next keystroke or the next attempt (§6.98). */
      errors.clear("one-off");
      const saved = { ...next, id: res.data!.id };
      setRows((rs) => (rs.some((r) => r._key === next._key) ? rs.map((r) => (r._key === next._key ? saved : r)) : [...rs, saved]));
      setDraft(null); setDlg(null);
    }));
  };

  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    setConfirm(null);
    if (!row) { setDraft(null); return; }
    start(async () => {
      const res = await deleteExtraordinary(planId, row.id);
      if (!res.ok) { errors.raise({ key: "one-off", message: res.error, label: "One-off income & costs" }); return; }
      errors.clear("one-off");
      setRows((rs) => rs.filter((r) => r._key !== key));
    });
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); start(async () => { await continueFromExtraordinary(planId, "next"); }); };
  const current = dlg ? lines.find((r) => r._key === dlg.key) ?? null : null;
  const toRemove = confirmKey ? lines.find((r) => r._key === confirmKey) ?? null : null;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("extraordinary")} title="One-off income &amp; costs"
      subtitle="Money in or out that has nothing to do with trading" mode={mode}
      errors={errors}
      areas={[{ key: "items", label: "One-offs", count: named.length }, { key: "monthly", label: "Monthly projections" }]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      primaryAction={area === "items" ? <Button size="sm" type="button" onClick={add}>+ One-off</Button> : undefined}
      footer={<ModuleFooter planId={planId} moduleId="extraordinary" formId="extraordinary-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Anything that hits the bank once and will not happen again next year: an insurance settlement, money from selling a vehicle or machine, a fit-out, the legal cost of setting up a new site, a feasibility study, a redundancy payout.</p>
        <p><b>Keep it out of Sales and Overheads.</b> An insurance payout is not revenue and a one-off fit-out is not rent. Putting them there would flatter or wreck the margins a lender reads, which is exactly why the profit and loss keeps them on their own line underneath the trading result.</p>
        <p>Everything here lands in a plan year, so nothing you enter can quietly fall outside the forecast. If a one-off is genuinely in the past, it belongs in Historic instead.</p>
        <p><b>Sold an asset?</b> Say which one. The money then shows as an investing activity rather than as cash the business earned from trading — and that is the honest way for it to appear.</p>
        <h3>Where this goes</h3>
        <p>A single net line in the profit and loss, below operating profit and above interest and tax — so these are taxed. In the cash flow they sit on their own, split between what came in and what went out.</p>
      </>}
    >
      <PendingBridge pending={pending} />
      <form id="extraordinary-form" onSubmit={onSubmit} className="hidden" />

      {area === "items" && (<>
        <Toolbar>
          <Meta className="ml-0">
            {named.length === 0 ? "Nothing here yet" : <>
              {/* The headline is what reaches PROFIT, not what passes through the bank: a sale counts at its gain (§6.56). */}
              {num(totals.income)} in · {num(totals.expense)} out · <b className={cn(profitTotal < 0 && "text-destructive")}>{profitTotal < 0 ? `${num(-profitTotal)} net cost` : `${num(profitTotal)} net gain`}</b> to profit
              {totals.disposalProceeds > 0 && <> · {num(totals.disposalProceeds)} of it from selling assets, worth {num(soldBookValue)} on the books</>}
            </>}
          </Meta>
        </Toolbar>

        <div className="min-h-0 overflow-auto px-3 pb-3">
          <Grid>
            <thead>
              <tr>
                <Th className="w-[34%]">What it is</Th>
                <Th className="w-[10%]">Type</Th>
                <Th className="w-[14%]">When</Th>
                <Th right>Amount</Th>
                <Th right>Effect on the year</Th>
                <Th className="w-[70px]" />
              </tr>
            </thead>
            <tbody>
              {named.length === 0 && (
                <GridRow>
                  <Td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Most plans have a few, and they are easy to forget.
                    <div className="mt-1 text-[12px]">{EXAMPLES.slice(0, 5).join(" · ")}</div>
                    {/* So say it, rather than leaving the step unfinished for being true (§6.57.1). */}
                    <NoneToList planId={planId} step="extraordinary" said={saidNone}
                      say="Nothing one-off in the next five years"
                      unsay="You have said there are no one-offs, so this step is done." />
                  </Td>
                </GridRow>
              )}
              {named.map((r) => {
                const disposal = isDisposal(r as ExtraordinaryItem);
                return (
                  <GridRow key={r._key}>
                    <Td>
                      <NameLink onClick={() => setDlg({ key: r._key })}>{r.description || <span className="text-muted-foreground">Untitled</span>}</NameLink>
                      {disposal && <span className="ml-2 text-[11px] text-muted-foreground">sold {assetName(r.source_asset_id) ?? "an asset"}</span>}
                    </Td>
                    <Td className={cn(r.category === "expense" ? "text-muted-foreground" : "")}>{r.category === "income" ? "Money in" : "Money out"}</Td>
                    <Td>{MONTHS[r.month - 1]} · Yr {r.year}</Td>
                    <Td right className="num">{num(r.amount)}</Td>
                    {(() => {
                      // A sale's effect on profit is the gain over book value, never the whole cheque (§6.56).
                      const effect = disposal ? r.amount - bookValueOf(r, assets) : (r.category === "income" ? r.amount : -r.amount);
                      return (
                        <Td right className={cn("num", effect < 0 && "text-destructive")}
                            title={disposal ? `${num(r.amount)} in, less the ${num(bookValueOf(r, assets))} it was worth on the books` : undefined}>
                          {signedText(effect)}
                        </Td>
                      );
                    })()}
                    <Td right>
                      <IconButton title="Edit" onClick={() => setDlg({ key: r._key })}>✎</IconButton>
                      <RemoveButton onClick={() => setConfirm(r._key)} title="Remove one-off" />
                    </Td>
                  </GridRow>
                );
              })}
            </tbody>
          </Grid>

          {named.length > 0 && (
            <div className="mt-4 rounded border border-input">
              <div className="border-b border-input bg-[#E9EDF2] px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                What it does to each year
              </div>
              <Grid>
                <thead><tr><Th className="w-[24%]" />{YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}</tr></thead>
                <tbody>
                  <GridRow><Td className="text-muted-foreground">Money in</Td>{years.map((y) => <Td key={y.year} right className="num">{y.income ? num(y.income) : "—"}</Td>)}</GridRow>
                  <GridRow><Td className="text-muted-foreground">Money out</Td>{years.map((y) => <Td key={y.year} right className="num">{y.expense ? `(${num(y.expense)})` : "—"}</Td>)}</GridRow>
                  {soldBookValue > 0 && (
                    <GridRow>
                      <Td className="text-muted-foreground">Less what the sold assets were worth</Td>
                      {bookValues.map((b, i) => <Td key={i} right className="num">{b ? `(${num(b)})` : "—"}</Td>)}
                    </GridRow>
                  )}
                </tbody>
                <FootRow>
                  <Td>Net, below operating profit</Td>
                  {profitNet.map((v, i) => <Td key={i} right className={cn("num", v < 0 && "text-destructive")}>{signedText(v)}</Td>)}
                </FootRow>
              </Grid>
              {totals.disposalProceeds > 0 && (
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  {num(totals.disposalProceeds)} of the money in is proceeds from selling assets. In the cash flow that is an investing activity, not cash earned from trading; and in the profit and loss only the {signedText(totals.disposalProceeds - soldBookValue)} above what those assets were worth on the books appears at all. Each one also stops depreciating the month it goes.
                </div>
              )}
            </div>
          )}

          <Note>These are taxed: the net line sits below operating profit and above tax. Anything that already happened belongs in Historic, not here.</Note>
        </div>
      </>)}

      {area === "monthly" && (() => {
        const byYear = YEARS.map((y) => ({ year: y, months: extraordinaryMonths(named as ExtraordinaryItem[], y) }));
        return (
          <div className="min-h-0 overflow-auto px-3 pb-3">
            <Toolbar><Meta className="ml-0">Every one-off in the month it lands. These are lumpy by nature — the month is the point of them, and it is what the cash flow turns on.</Meta></Toolbar>
            <Grid>
              <thead><tr><Th style={{ width: "14%" }} />{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 100 }}>Total</Th></tr></thead>
              <tbody>
                {byYear.map(({ year, months }) => (
                  <GridRow key={year}>
                    <Td>Year {year}</Td>
                    {months.map((v, i) => (
                      <Td key={i} right className={cn("num", v < 0 && "text-destructive")}>{signedText(v)}</Td>
                    ))}
                    <Td right className={cn("num font-semibold", years[year - 1].net < 0 && "text-destructive")}>{signedText(years[year - 1].net)}</Td>
                  </GridRow>
                ))}
                {named.length === 0 && <tr><Td colSpan={14} className="h-12 text-muted-foreground">Nothing to show yet.</Td></tr>}
              </tbody>
            </Grid>
            <Note>Money out is shown in brackets. Each row&apos;s twelve months add to that year&apos;s net line on the One-offs tab.</Note>
          </div>
        );
      })()}

      {current && (
        <ItemDialog
          row={current} assets={assets} monthOptions={MONTH_OPTIONS}
          onCancel={() => { setDlg(null); if (draft && draft._key === current._key) setDraft(null); }}
          onSave={save} pending={pending}
        />
      )}

      {toRemove && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Remove {toRemove.description || "this one-off"}?</DialogTitle>
              <DialogDescription>
                {isDisposal(toRemove as ExtraordinaryItem) ? (
                  <>
                    {num(toRemove.amount)} comes out of the cash flow for {MONTHS[toRemove.month - 1]}, and the {num(toRemove.amount - bookValueOf(toRemove, assets))} of gain comes out of Year {toRemove.year}&apos;s profit.
                    {" "}{assetName(toRemove.source_asset_id) ?? "The asset"} goes back on the books and starts depreciating again.
                  </>
                ) : (
                  <>{num(toRemove.amount)} {toRemove.category === "income" ? "comes out of" : "goes back into"} Year {toRemove.year}&apos;s profit, and out of the cash flow for {MONTHS[toRemove.month - 1]}.</>
                )}
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

/** STATUS ONLY (§6.98) — a failed save travels on its own channel and is shown in red, not in this grey. */
function PendingBridge({ pending }: { pending: boolean }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(pending ? "Saving…" : undefined), [pending, setNote]);
  return null;
}

function ItemDialog({ row, assets, monthOptions, pending, onCancel, onSave }: {
  row: Row; assets: SoldAsset[];
  monthOptions: { value: string; label: string }[];
  pending: boolean; onCancel: () => void; onSave: (r: Row) => void;
}) {
  const num = useMoney();
  const [d, setD] = useState<Row>(row);
  const set = (patch: Partial<Row>) => setD((x) => ({ ...x, ...patch }));
  const income = d.category === "income";
  // Naming an asset changes what this line IS: proceeds, not income — and only the gain over book is profit.
  const sale = income && !!d.source_asset_id;
  const book = sale ? bookValueOf(d, assets) : 0;
  const gain = Math.round((d.amount - book) * 100) / 100;
  const soldName = assets.find((a) => a.id === d.source_asset_id)?.name ?? "It";

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{d.description.trim() || "A one-off"}</DialogTitle>
          <DialogDescription>
            Money in or out that will not repeat next year. If it already happened, it belongs in Historic instead.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <span className={label}>What it is</span>
            <Input autoFocus value={d.description} onChange={(e) => set({ description: e.target.value })}
              placeholder="Insurance settlement — vehicle write-off" className={box} />
            {!d.description.trim() && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => set({ description: ex })}
                    className="rounded-full border border-input px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary">{ex}</button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <span className={label}>Type</span>
              <FieldSelect value={d.category} onValueChange={(v) => set({ category: v as Row["category"], source_asset_id: v === "income" ? d.source_asset_id : null })} options={CATEGORIES} />
            </div>
            <div>
              <span className={label}>Amount</span>
              <MoneyInput defaultValue={d.amount ? String(d.amount) : ""}
                onBlur={(e) => set({ amount: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
            </div>
            <div>
              <span className={label}>Happens in</span>
              <FieldSelect value={String(d.year)} onValueChange={(v) => set({ year: Number(v) })} options={YEAR_OPTIONS} />
            </div>
            <div>
              <span className={label}>Month</span>
              <FieldSelect value={String(d.month)} onValueChange={(v) => set({ month: Number(v) })} options={monthOptions} />
            </div>
          </div>

          {income && assets.length > 0 && (
            <div>
              <span className={label}>Is this from selling something the business owns?</span>
              <FieldSelect value={d.source_asset_id ?? ""} onValueChange={(v) => set({ source_asset_id: v || null })}
                options={[{ value: "", label: "No — it is not a sale" }, ...assets.map((a) => ({ value: a.id, label: a.name }))]} />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Naming the asset puts the money in investing activities instead of counting it as cash the business earned from trading.
              </p>
            </div>
          )}

          <div className="rounded border border-input bg-muted/40 px-3 py-2 text-[12.5px]">
            <div className="text-[11.5px] font-semibold text-muted-foreground">What that means</div>
            <div className="mt-1">
              {d.amount > 0 ? (sale ? (
                <>
                  <b>{num(d.amount)}</b> arrives in <b>{monthOptions[d.month - 1]?.label}</b>, as an investing activity rather than trading income.
                  {" "}{soldName} is on the books at <b>{num(book)}</b> the month it goes, so Year {d.year} profit
                  {gain >= 0 ? <> goes up by the <b>{num(gain)}</b> gain</> : <> comes down by the <b>{num(-gain)}</b> loss</>}
                  {" "}— not by the whole {num(d.amount)}. It stops depreciating from that month.
                  {" "}The gain is taxed with the rest of the year&apos;s profit.
                </>
              ) : (
                <>
                  Year {d.year} profit {income ? <>goes up by <b>{num(d.amount)}</b></> : <>comes down by <b>{num(d.amount)}</b></>}, and the cash
                  {income ? " arrives " : " leaves "} in <b>{monthOptions[d.month - 1]?.label}</b>.
                  {" "}It is taxed with the rest of the year&apos;s profit.
                </>
              )) : "Put in an amount and this will show what it does."}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="button" onClick={() => onSave(d)} disabled={pending || !d.description.trim()}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
