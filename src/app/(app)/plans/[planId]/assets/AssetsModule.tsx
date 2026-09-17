"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GstToggle, GstFreeTag } from "@/components/module/GstToggle";
import { useGst } from "@/components/GstProvider";

import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, FootRow, Toolbar, Meta, Note, NameLink, LinkMark, RemoveButton } from "@/components/module/DataGrid";
import { FieldSelect } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { planMonths } from "@/engine/plan/calendar";
import { cn } from "@/lib/utils";
import { useSaveOnce } from "@/lib/saveOnce";
import { NoneToList } from "@/components/module/NoneToList";
import { YEARS } from "@/engine/sales/projection";
import { depreciationByYear, depreciationMonths, bookValueByYear, assetsByYear, type FixedAsset } from "@/engine/assets/depreciation";
import { useMoney } from "@/components/MoneyProvider";
import { upsertAsset, deleteAsset, saveFinancedShape, continueFromAssets } from "./actions";
import { upsertFunding } from "../funding/actions";
import { METHODS, CATEGORIES, LIVES, lifeLabel, type AssetRow } from "./model";

/**
 * Fixed Assets — what the business owns and what it writes off (§6.20). One list, one dialog.
 *
 * Two kinds of line. A cash-bought asset is typed here. A financed one belongs to the Funding row that
 * bought it: its cost, its start and its residual come from that loan and cannot be typed over, but how it
 * is written off — the life and the method — is a real accounting choice and stays editable.
 */
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s$]/g, "")); return Number.isFinite(n) ? n : 0; };

type AreaKey = "assets" | "monthly";
type Row = AssetRow & { _key: string; _error?: string };
const STEP = GUIDED_STEPS.find((s) => s.id === "assets")?.step ?? 11;
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";
const YEAR_OPTIONS = YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }));
/** Not a plan year, which is exactly the point: it was here before Year 1 started (§6.55). */
const OWNED = "owned";
/** The dropdown offers the plan's months in the plan's order; the value is the slot, 1–12. */
const monthOptions = (fyEndMonth: number) => planMonths(fyEndMonth).map((m, i) => ({ value: String(i + 1), label: m }));
const LIFE_OPTIONS = LIVES.map((l) => ({ value: String(l.months), label: l.label }));

export type AssetCash = {
  /** What Historic said the plant was worth on the last balance sheet — the total these items sit inside. */
  openingFixedAssets: number;
  openingCash: number;
  /** What the bank holds at the end of each plan year, with these purchases already in it. */
  closing: number[];
  /** Paid to suppliers for assets that year, and borrowed that year — a financed one is roughly a wash. */
  spent: number[]; borrowed: number[];
  lowMonth: { month: number; closingCash: number };
  negativeMonths: number[];
  reconciled: boolean;
};

export function AssetsModule({ planId, initial, mode, lenders, cash, fyEndMonth, saidNone }: {
  planId: string; initial: AssetRow[]; mode: "guided" | "advanced"; lenders: Record<string, string>;
  cash: AssetCash; fyEndMonth: number; saidNone: boolean;
}) {
  const gst = useGst();
  const num = useMoney();
  const MONTHS = planMonths(fyEndMonth);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map((a) => ({ ...a, _key: a.id })));
  /**
   * The plan can move underneath an open screen (§6.43.2). It does so on this one by design now: saying
   * "paid with finance" writes a loan, and the loan writes the asset on the server — so without this the
   * list sat there unchanged until the client navigated away and back, and the thing they had just created
   * appeared to have gone nowhere.
   */
  const [cameFrom, setCameFrom] = useState(initial);
  if (initial !== cameFrom) { setCameFrom(initial); setRows(initial.map((a) => ({ ...a, _key: a.id }))); }
  const [area, setArea] = useState<AreaKey>("assets");
  const [dlg, setDlg] = useState<{ key: string } | null>(null);
  const [confirmKey, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [error, setErr] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const once = useSaveOnce();

  const lines = draft ? [...rows, draft] : rows;
  const totals = assetsByYear(lines.map((r) => r as FixedAsset));
  const financed = lines.filter((r) => r.source === "finance").length;
  // What the client has itemised OUT of the opening lump, valued as they said it is worth today (§6.55).
  const ownedListed = lines.filter((r) => r.already_owned).reduce((a, r) => a + (Number(r.purchase_price) || 0), 0);

  const add = () => {
    const key = `tmp-${Date.now()}`;
    setDraft({
      id: key, _key: key, source: "entered", funding_debt_id: null, name: "", category: null,
      purchase_price: 0, residual_value: 0, useful_life_months: 60, method: "straight_line",
      start_year: 1, start_month: 1, already_owned: false, notes: null, gst_applies: true, sort_order: 0,
    });
    setDlg({ key });
  };

  const save = (next: Row) => {
    setErr(undefined);
    start(once(async () => {
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
    }));
  };

  /**
   * "Paid with: finance" on this screen writes a LOAN, and the loan makes the asset (§6.52). It goes through
   * the same action the Funding step uses rather than a second writer of its own, so there is one way a
   * financed asset can come into being however the client got here — which is what makes it impossible to
   * describe one purchase twice.
   */
  const buyOnFinance = (a: Row, f: Finance) => {
    setErr(undefined);
    start(once(async () => {
      const res = await upsertFunding(planId, {
        kind: "debt",
        name: f.lender.trim() || a.name.trim(),
        loan_type: a.category === "Vehicle" ? "vehicle_finance" : "equipment_finance",
        amount: Math.max(0, a.purchase_price - f.deposit),
        deposit: f.deposit,
        interest_rate: f.rate,
        term_months: f.term,
        repayment_type: "amortised",
        payment_frequency: "monthly",
        residual_value: a.residual_value,
        start_year: a.start_year,
        start_month: a.start_month,
      }, { assetName: a.name.trim() });
      if (!res.ok) { setErr(res.error); return; }
      setDraft(null); setDlg(null);
      router.refresh();
    }));
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
      areas={[{ key: "assets", label: "Assets", count: lines.length }, { key: "monthly", label: "Monthly projections" }]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      primaryAction={area === "assets" ? <Button size="sm" type="button" onClick={add}>+ Asset</Button> : undefined}
      footer={<ModuleFooter planId={planId} moduleId="assets" formId="assets-form" />}
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

      {area === "assets" && (<>
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
                  {/* So say it, rather than leaving the step unfinished for being true (§6.57.1). */}
                  <NoneToList planId={planId} step="assets" said={saidNone}
                    say="The business owns no fixed assets"
                    unsay="You have said the business owns no fixed assets, so this step is done." />
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
                      <GstFreeTag registered={gst.registered} label={gst.label} applies={r.gst_applies !== false} />
                      {locked && (
                        <LinkMark
                          title={`Bought with ${lenders[r.funding_debt_id ?? ""] ?? "finance"} — what it cost belongs to that loan. Click to open Funding.`}
                          onClick={() => router.push(`/plans/${planId}/funding`)}
                        />
                      )}
                    </span>
                    {r.category && <span className="ml-2 text-[11px] text-muted-foreground">{r.category}</span>}
                  </Td>
                  <Td className={cn(r.already_owned && "text-muted-foreground")}>
                    {r.already_owned ? "Already owned" : <>{MONTHS[r.start_month - 1]} · Yr {r.start_year}</>}
                    {typeof r.sold_in_month === "number" && (
                      <div className="text-[11px] text-muted-foreground">
                        Sold {MONTHS[r.sold_in_month % 12]} · Yr {Math.floor(r.sold_in_month / 12) + 1}
                      </div>
                    )}
                  </Td>
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

        {cash.openingFixedAssets > 0 && (
          /*
           * The bargain §6.41.3 struck with working-capital days, struck again here: Historic's figure is the
           * total and stays authoritative, the client itemises as much of it as they need, and whatever has
           * not been itemised is named out loud rather than sitting there silently not depreciating.
           */
          <Note>
            Your last balance sheet put the business&apos;s plant at <b>{num(cash.openingFixedAssets)}</b>.{" "}
            {ownedListed > 0
              ? <>You have listed <b>{num(ownedListed)}</b> of it above, which now wears out year by year.{" "}</>
              : <>None of it is listed above, so <b>none of it wears out</b> in this plan.{" "}</>}
            {cash.openingFixedAssets - ownedListed > 0.5 && (
              <>The remaining <b>{num(cash.openingFixedAssets - ownedListed)}</b> is not broken down, so it carries no
                depreciation and cannot be sold. List anything you mean to write off or sell — you do not have to list it all.</>
            )}
          </Note>
        )}

        {lines.length > 0 && <CanAfford cash={cash} fyEndMonth={fyEndMonth} />}

        {lines.length > 0 && (
          <Note>
            Paid to suppliers for them: {totals.map((t) => num(t.capex)).join(" · ")} across the five years —
            the whole price of each, financed or not (§6.40). What a financed one borrows comes straight back
            in on the Funding step the same year, so the business is only out the deposit and then the
            repayments. Depreciation never moves cash; it only lowers the profit and what the assets are worth.
          </Note>
        )}
        </div>
      </>)}

      {area === "monthly" && (() => {
        /* Depreciation lands every month whether or not anyone notices it — this is where the owner sees it
           against the twelve months the rest of the plan is managed by. */
        const rowsM = lines.map((r) => ({ r, months: depreciationMonths(r as FixedAsset).slice(0, 12) }));
        const monthTotals = MONTHS.map((_, i) => rowsM.reduce((a, l) => a + (l.months[i] ?? 0), 0));
        const grand = monthTotals.reduce((a, b) => a + b, 0);
        return (
          <div className="min-h-0 overflow-auto px-3 pb-3">
            <Toolbar><Meta className="ml-0">Year 1 depreciation by month. It lowers the profit and what the assets are worth — it never moves cash.</Meta></Toolbar>
            <Grid>
              <thead><tr><Th style={{ width: "16%" }}>Asset</Th>{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}<Th right style={{ width: 100 }}>Total</Th><Th style={{ width: 44 }} /></tr></thead>
              <tbody>
                {rowsM.map(({ r, months }) => (
                  <GridRow key={r._key}>
                    <Td>
                      <NameLink onClick={() => setDlg({ key: r._key })}>{r.name || "Untitled asset"}</NameLink>
                      {r.source === "finance" && <LinkMark title={`Bought with ${lenders[r.funding_debt_id ?? ""] ?? "finance"}`} onClick={() => router.push(`/plans/${planId}/funding`)} />}
                    </Td>
                    {months.map((v, i) => <Td key={i} right className="num">{v ? num(v) : <span className="text-muted-foreground">—</span>}</Td>)}
                    <Td right className="num font-semibold">{num(months.reduce((a, b) => a + b, 0))}</Td>
                    <Td className="text-right"><IconButton title="How it is written off" onClick={() => setDlg({ key: r._key })}>✎</IconButton></Td>
                  </GridRow>
                ))}
                {rowsM.length === 0 && <tr><Td colSpan={15} className="h-12 text-muted-foreground">No assets yet.</Td></tr>}
              </tbody>
              {rowsM.length > 0 && (
                <FootRow><Td>Depreciation</Td>{monthTotals.map((v, i) => <Td key={i} right className="num">{num(v)}</Td>)}<Td right className="num">{num(grand)}</Td><Td /></FootRow>
              )}
            </Grid>
            <Note>An asset bought part-way through the year only depreciates from the month it arrives, so its twelve do not fill.</Note>
          </div>
        );
      })()}

      {current && (
        <AssetDialog
          row={current}
          lender={lenders[current.funding_debt_id ?? ""] ?? "finance"}
          fyEndMonth={fyEndMonth}
          onCancel={() => { setDlg(null); if (draft && draft._key === current._key) setDraft(null); }}
          onSave={save} onFinance={buyOnFinance} pending={pending}
        />
      )}

      {toRemove && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Remove {toRemove.name || "this asset"}?</DialogTitle>
              <DialogDescription>
                Its {num(depreciationByYear(toRemove as FixedAsset).reduce((a, b) => a + b, 0))} of depreciation comes out of the forecast
                {toRemove.already_owned
                  ? ", and the opening balance sheet goes back to carrying it as part of the lump."
                  : <>, and the {num(toRemove.purchase_price)} it cost stops leaving the bank.</>}
                {typeof toRemove.sold_in_month === "number" && " The one-off that sold it will no longer be a sale, so its money moves back to ordinary income."}
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
export type Finance = { lender: string; deposit: number; rate: number; term: number };

/**
 * Can the business actually afford these? (§6.53)
 *
 * An asset bought in a projected year takes its price out of the bank in that year — the forecast has always
 * said so, and this screen never did. A client could put a 425,000 excavator here against 21,315 of cash and
 * see nothing at all, because the only place it showed was Review forecast, three steps further on and after
 * they had stopped thinking about assets.
 *
 * Every figure is READ from the forecast, never recomputed. A second answer to "does the money hold" is the
 * fault this app has paid for more than once, and Funding already owns that question for Year 1 by month.
 */
function CanAfford({ cash, fyEndMonth }: { cash: AssetCash; fyEndMonth: number }) {
  const num = useMoney();
  const MONTHS = planMonths(fyEndMonth);
  const signed = (v: number) => (v < 0 ? `(${num(Math.abs(v))})` : num(v));
  const shortYear = cash.closing.findIndex((v) => v < 0);
  const tightest = cash.closing.reduce((best, v, i) => (v < cash.closing[best] ? i : best), 0);
  const holds = shortYear === -1 && cash.negativeMonths.length === 0;
  const spentTotal = cash.spent.reduce((a, b) => a + b, 0);
  // What the assets had already taken out by the time the bank runs short, and the last year they took it.
  const spentBefore = shortYear === -1 ? 0 : cash.spent.slice(0, shortYear).reduce((a, b) => a + b, 0);
  const lastSpend = shortYear === -1 ? -1 : cash.spent.slice(0, shortYear).reduce((b, v, i) => (v > 0 ? i : b), -1);

  return (
    <div className="mt-4 rounded border border-input">
      <div className="flex items-center gap-2 border-b border-input bg-[#E9EDF2] px-3 py-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cash at the end of each year, with these purchases in it
        </span>
        <span className="ml-auto text-[11.5px] text-muted-foreground">Opening {num(cash.openingCash)}</span>
      </div>
      <Grid>
        <thead><tr><Th className="w-[160px]" />{YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}</tr></thead>
        <tbody>
          <GridRow>
            <Td className="text-muted-foreground">Paid for assets</Td>
            {cash.spent.map((v, i) => <Td key={i} right className="num">{v ? num(v) : "—"}</Td>)}
          </GridRow>
          <GridRow>
            <Td className="text-muted-foreground">Closing cash</Td>
            {cash.closing.map((v, i) => (
              <Td key={i} right className={cn("num", v < 0 && "font-semibold text-destructive", i === tightest && v >= 0 && "font-semibold")}>
                {signed(v)}{i === tightest && <span aria-hidden className="ml-0.5">▼</span>}
              </Td>
            ))}
          </GridRow>
        </tbody>
      </Grid>
      <div className={cn("border-t border-input px-3 py-2 text-[12.5px]", holds ? "text-muted-foreground" : "bg-bad-soft")}>
        {!cash.reconciled ? (
          <span className="text-warn">The forecast has a check that is not balancing, so these figures cannot be relied on yet — Review forecast shows which.</span>
        ) : shortYear !== -1 ? (
          <>
            <span className="font-semibold text-destructive">
              The bank goes below zero in Year {shortYear + 1}, at {signed(cash.closing[shortYear])}.
            </span>
            <span className="ml-1">
              {cash.spent[shortYear] > 0
                ? <>These purchases take {num(cash.spent[shortYear])} out that year. Buy later, put it on finance, or raise more on Funding.</>
                /*
                 * Money spent in an EARLIER year is money that is not in the bank in this one. Saying
                 * "not these purchases, nothing is bought that year" was true and useless: on BNE Concreting
                 * it cleared the assets of a Year 2 overdraft that the Year 1 spend is most of the reason for.
                 * The claim made here is the one that can be proved — what left, and when — not a verdict on
                 * cause, because the year has other things in it too.
                 */
                : spentBefore > 0
                  ? <>{num(spentBefore)} went out for assets in Year {lastSpend + 1}, which is money that is not in the bank now. Buying later, or on finance, keeps it here longer.</>
                  : <>No assets are bought by then, so the gap is elsewhere in the plan.</>}
            </span>
          </>
        ) : cash.negativeMonths.length > 0 ? (
          <>
            <span className="font-semibold text-destructive">
              Year 1 closes on {num(cash.closing[0])}, but the bank goes below zero in{" "}
              {cash.negativeMonths.length === 1 ? MONTHS[cash.negativeMonths[0] - 1] : `${cash.negativeMonths.length} months`}.
            </span>
            <span className="ml-1">A year that closes well can still be short in the middle of it. Funding shows the twelve months.</span>
          </>
        ) : (
          <>
            The plan carries them. {spentTotal > 0 ? <>{num(spentTotal)} goes out for assets across the five years, and the</> : <>The</>}{" "}
            tightest year closes on {num(cash.closing[tightest])}; the tightest month of Year 1 is {MONTHS[cash.lowMonth.month - 1]} at {num(cash.lowMonth.closingCash)}.
            <span className="ml-1">Money borrowed to buy one comes back in the same year, so a financed asset barely moves this row — its repayments do.</span>
          </>
        )}
      </div>
    </div>
  );
}

function AssetDialog({ row, lender, fyEndMonth, pending, onCancel, onSave, onFinance }: {
  row: Row & { _key: string }; lender: string; fyEndMonth: number; pending: boolean;
  onCancel: () => void; onSave: (r: Row) => void; onFinance: (r: Row, f: Finance) => void;
}) {
  const gst = useGst();
  const num = useMoney();
  const MONTH_OPTIONS = monthOptions(fyEndMonth);
  const [d, setD] = useState<Row>(row);
  const locked = d.source === "finance";
  /**
   * The question this screen never asked (§6.52). An asset bought in a projected year was paid for somehow,
   * and the only way to say "on finance" used to be to not type it here at all and enter a loan on Funding
   * instead — which nobody would guess, and which let the same purchase be described twice: once as a cash
   * asset, once as a loan that makes its own asset. Two vans, double the capex, one van's worth of borrowing.
   */
  const isNew = row.id.startsWith("tmp-");
  /**
   * Something the business already owns (§6.55). It is not bought in a plan year, so it has no purchase
   * month and no way of being paid for — what it is worth NOW and what is LEFT of its life are the only two
   * numbers it has, and it depreciates from the first month of the plan like everything else.
   */
  const ownedNow = d.already_owned === true;
  const [paidWith, setPaidWith] = useState<"cash" | "finance">("cash");
  const [fin, setFin] = useState<Finance>({ lender: "", deposit: 0, rate: 0, term: 60 });
  const financing = isNew && !ownedNow && paidWith === "finance";
  const borrowed = Math.max(0, d.purchase_price - fin.deposit);
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

          {isNew && !ownedNow && (
            <div className="grid grid-cols-[220px_1fr] items-end gap-3">
              <div>
                <span className={label}>Paid with</span>
                <FieldSelect value={paidWith} onValueChange={(v) => setPaidWith(v as "cash" | "finance")}
                  options={[
                    { value: "cash", label: "Money the business has" },
                    { value: "finance", label: "Equipment or vehicle finance" },
                  ]} />
              </div>
              <div className="pb-1 text-[12px] text-muted-foreground">
                {financing
                  ? <>A loan is set up on <b>Funding</b> for you — do not add it there as well.</>
                  : <>Cash the business already has, including money it borrowed as a term loan or an owner put in.</>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div>
              <span className={label}>{ownedNow ? "What it is worth now" : "What it cost"}</span>
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
              <FieldSelect
                value={ownedNow ? OWNED : String(d.start_year)}
                onValueChange={(v) => set(v === OWNED
                  ? { already_owned: true, start_year: 1, start_month: 1 }
                  : { already_owned: false, start_year: Number(v) })}
                options={locked ? YEAR_OPTIONS : [{ value: OWNED, label: "Already owned" }, ...YEAR_OPTIONS]} />
            </div>
            <div>
              <span className={label}>Month</span>
              {ownedNow
                ? <div className={cn(box, "flex items-center pl-2 text-[11px] text-muted-foreground/70")}>before the plan</div>
                : <FieldSelect value={String(d.start_month)} onValueChange={(v) => set({ start_month: Number(v) })} options={MONTH_OPTIONS} />}
            </div>
          </div>

          {financing && (
            <div className="grid grid-cols-4 gap-3 rounded border border-input bg-muted/40 p-3">
              <div>
                <span className={label}>Lender</span>
                <Input value={fin.lender} onChange={(e) => setFin((f) => ({ ...f, lender: e.target.value }))}
                  placeholder="Westpac" className={box} />
              </div>
              <div>
                <span className={label}>Paid up front</span>
                <Input inputMode="decimal" defaultValue={fin.deposit ? String(fin.deposit) : ""}
                  onBlur={(e) => setFin((f) => ({ ...f, deposit: parseNum(e.target.value) }))} placeholder="0" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Interest rate %</span>
                <Input inputMode="decimal" defaultValue={fin.rate ? String(fin.rate) : ""}
                  onBlur={(e) => setFin((f) => ({ ...f, rate: parseNum(e.target.value) }))} placeholder="7" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Term (months)</span>
                <Input inputMode="numeric" defaultValue={String(fin.term)}
                  onBlur={(e) => setFin((f) => ({ ...f, term: parseNum(e.target.value) || 60 }))} placeholder="60" className={cn(box, "num text-right")} />
              </div>
              <div className="col-span-4 text-[12px] text-muted-foreground">
                Borrowing <b>{num(borrowed)}</b> of the {num(d.purchase_price)} it costs
                {fin.deposit ? <>, with {num(fin.deposit)} of your own money down</> : null}. Monthly, principal and interest.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>{ownedNow ? "Years left in it" : "Written off over"}</span>
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
                    {ownedNow
                      ? <>No cash moves — it was paid for before the plan began, and the opening balance sheet is already carrying it. What changes is that it now wears out instead of sitting there forever.</>
                      : locked || financing
                        ? <>The {num(d.purchase_price)} is paid to the supplier in Year {d.start_year} and the lender puts most of it back the same day, so what the business is really out is the deposit, then the repayments.</>
                        : <>The {num(d.purchase_price)} leaves in Year {d.start_year}.</>}</>
                : "Put in what it cost and this fills in."}
            </div>
          </div>
        </div>

        <GstToggle registered={gst.registered} label={gst.label} kind="purchase" className="px-1"
          checked={d.gst_applies !== false} onChange={(v) => setD((x) => ({ ...x, gst_applies: v }))} />
        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="button" onClick={() => (financing ? onFinance(d, fin) : onSave(d))}
            disabled={pending || !d.name.trim() || (financing && d.purchase_price <= 0)}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
