"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import {
  loanSummary, loanByYear, rbfCap, rbfCost, fundingTotals, adequacy, interestByYear, debtByYear,
  type FundingKind, type FundingSource,
} from "@/engine/funding/sources";
import { upsertFunding, deleteFunding, saveOpeningCash, continueFromFunding } from "./actions";
import {
  MONTHS, KIND_LABEL, KIND_CARDS, LOAN_TYPES, REPAYMENT_TYPES, FREQUENCIES, isAssetBacked, loanOf, rbfOf,
  type FundingRow, type LoanType,
} from "./model";

/**
 * Funding — one list, and a straight answer (§6.20).
 *
 * APeX puts five kinds of funding on five tabs and totals them: "Total Funding Raised: $820,108" — a number
 * with nothing to measure it against. Every source lives in one list here, the way a bank reads a plan, and
 * underneath it the twelve months of cash say whether the money actually holds.
 */
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => fmt.format(Number(v) || 0);
const signed = (v: number) => (v < 0 ? `(${fmt.format(Math.abs(v))})` : fmt.format(v));
const parseNum = (s: string) => { const n = Number(s.replace(/[,\s$%]/g, "")); return Number.isFinite(n) ? n : 0; };

type Row = FundingRow & { _key: string };
type Dlg = { kind: "picker" } | { kind: "edit"; key: string } | null;
const STEP = GUIDED_STEPS.find((s) => s.id === "funding")?.step ?? 10;
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const box = "h-8";
const YEAR_OPTIONS = YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }));
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

export type CashInput = { revenueMonths: number[]; cogsMonths: number[]; overheadsMonths: number[]; capexMonths: number[] };

export function FundingModule({ planId, initial, mode, openingCash, cash, year1 }: {
  planId: string; initial: FundingRow[]; mode: "guided" | "advanced";
  openingCash: number; cash: CashInput;
  year1: { revenue: number; cogs: number; overheads: number; depreciation: number };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ ...r, _key: r.id })));
  const [opening, setOpening] = useState(openingCash);
  const [openingText, setOpeningText] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [confirmKey, setConfirm] = useState<string | null>(null);
  const [error, setErr] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const lines = useMemo(() => (draft ? [...rows, draft] : rows), [rows, draft]);
  const sources: FundingSource[] = useMemo(() => lines.map((r) => ({
    id: r.id, kind: r.kind, name: r.name, amount: r.amount,
    start_year: r.start_year, start_month: r.start_month,
    loan: loanOf(r), rbf: rbfOf(r), equity_percent: r.equity_percent,
  })), [lines]);

  const totals = fundingTotals(sources);
  const check = adequacy(sources, {
    openingCash: opening, revenueMonths: cash.revenueMonths, cogsMonths: cash.cogsMonths,
    overheadsMonths: cash.overheadsMonths, capexMonths: cash.capexMonths,
  }, 12);
  const interest = interestByYear(sources);
  const owing = debtByYear(sources);
  const equityGiven = lines.filter((r) => r.kind === "equity").reduce((a, r) => a + (r.equity_percent ?? 0), 0);

  const beginAdd = (kind: FundingKind) => {
    const key = `tmp-${Date.now()}`;
    setDraft({
      _key: key, id: key, kind, name: "", amount: 0, start_year: 1, start_month: 1,
      owner_type: "owner_capital", loan_type: "term_loan", interest_rate: 0, term_months: 60,
      repayment_type: "amortised", payment_frequency: "monthly", residual_value: 0, min_repayment_pct: 0,
      annual_fee: 0, equity_percent: 0, pre_money_valuation: null, dividend_policy: false,
      has_conditions: false, conditions: null, recognition_type: "immediate", recognition_period_months: null,
      repayment_percent: 0, cap_multiple: 1.5, min_monthly_payment: 0,
    });
    setDlg({ kind: "edit", key });
  };

  const save = (next: Row) => {
    setErr(undefined);
    start(async () => {
      const res = await upsertFunding(planId, next);
      if (!res.ok) { setErr(res.error); return; }
      const saved = { ...next, id: res.data!.id };
      setRows((rs) => (rs.some((r) => r._key === next._key) ? rs.map((r) => (r._key === next._key ? saved : r)) : [...rs, saved]));
      setDraft(null); setDlg(null);
      router.refresh();
    });
  };

  const remove = (key: string) => {
    const row = rows.find((r) => r._key === key);
    setConfirm(null);
    if (!row) { setDraft(null); return; }
    start(async () => {
      const res = await deleteFunding(planId, row.kind, row.id);
      if (!res.ok) { setErr(res.error); return; }
      setRows((rs) => rs.filter((r) => r._key !== key));
      router.refresh();
    });
  };

  const commitOpening = () => {
    setOpeningText(null);
    if (opening === openingCash) return;
    start(async () => { const res = await saveOpeningCash(planId, opening); if (!res.ok) setErr(res.error); });
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); start(async () => { await continueFromFunding(planId, "next"); }); };
  const current = dlg?.kind === "edit" ? lines.find((r) => r._key === dlg.key) ?? null : null;
  const toRemove = confirmKey ? lines.find((r) => r._key === confirmKey) ?? null : null;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Funding" subtitle="Where the money comes from, and whether it is enough" mode={mode}
      areas={[{ key: "sources", label: "Sources", count: lines.length }]}
      area="sources" onArea={() => {}} scope={{ label: "This plan" }}
      primaryAction={<Button size="sm" type="button" onClick={() => setDlg({ kind: "picker" })}>+ Funding</Button>}
      footer={<ModuleFooter planId={planId} prevId="overheads" formId="funding-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Every source of money the business brings in: what you put in yourself, loans, investors, grants, revenue-based finance. A lender wants to see the whole picture on one page — so it is one list, not five tabs.</p>
        <p>The row under the list is the point of this step. It runs your sales, costs and overheads forward month by month and says whether the money holds. <b>A plan that runs out of cash in month seven is not a plan</b>, and it is far better to find that here than in front of a bank.</p>
        <p>Adding a loan changes that row immediately — the repayments come straight out of the cash, so you can see what the business can actually carry.</p>
        <p><b>Opening cash</b> is what is in the bank the day the plan starts. For a new business that is usually nothing until the owner puts money in.</p>
        <h3>Where this goes</h3>
        <p>Interest is a cost in the profit and loss. The principal is not — it only moves cash. What is still owed at each year end sits on the balance sheet, and equipment or vehicle finance carries its asset through to Fixed Assets.</p>
      </>}
    >
      <PendingBridge pending={pending} error={error} />
      <form id="funding-form" onSubmit={onSubmit} className="hidden" />

      <Toolbar>
        <Meta className="ml-0">
          {lines.length === 0 ? "No funding yet" : <>
            {num(totals.total)} raised · {num(totals.equity)} equity · {num(totals.debt)} debt
            {totals.grants > 0 && <> · {num(totals.grants)} grants</>}
            {totals.revenueLinked > 0 && <> · {num(totals.revenueLinked)} revenue-based</>}
          </>}
        </Meta>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Cash at bank on day one
          <Input inputMode="decimal" value={openingText ?? (opening ? String(opening) : "")} placeholder="0"
            onChange={(e) => { setOpeningText(e.target.value); setOpening(parseNum(e.target.value)); }}
            onBlur={commitOpening} className={cn(box, "num w-28 text-right")} />
        </span>
      </Toolbar>

      <div className="min-h-0 overflow-auto px-3 pb-3">
        <Grid>
          <thead>
            <tr>
              <Th className="w-[24%]">Source</Th>
              <Th className="w-[13%]">Type</Th>
              <Th right>Amount</Th>
              <Th className="w-[11%]">Arrives</Th>
              <Th className="w-[16%]">What it costs</Th>
              <Th className="w-[22%]">Year 1 effect</Th>
              <Th className="w-[60px]" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <GridRow>
                <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No funding in the plan yet.
                  <div className="mt-1 text-[12px]">If the business runs on its own cash from day one, that is a legitimate answer — the row below still checks it holds.</div>
                </Td>
              </GridRow>
            )}
            {lines.map((r) => <SourceRow key={r._key} r={r} onEdit={() => setDlg({ kind: "edit", key: r._key })} onRemove={() => setConfirm(r._key)} planId={planId} />)}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <FootRow>
                <Td>Total funding</Td><Td />
                <Td right className="num">{num(totals.total)}</Td>
                <Td /><Td />
                <Td className="font-normal text-muted-foreground">
                  {num(interest[0])} interest · {num(owing[0])} still owed at Year 1
                </Td>
                <Td />
              </FootRow>
            </tfoot>
          )}
        </Grid>

        {equityGiven > 0 && (
          <Note>
            Investors hold {Math.round(equityGiven * 100) / 100}% of the business; you keep {Math.round((100 - equityGiven) * 100) / 100}%.
            {" "}Debt still owed at the end of each year: {owing.map(num).join(" · ")}.
          </Note>
        )}

        <CashRow check={check} opening={opening} year1={year1} onAdd={() => setDlg({ kind: "picker" })} />
      </div>

      {dlg?.kind === "picker" && <PickerDialog onPick={(k) => beginAdd(k)} onCancel={() => setDlg(null)} />}

      {current && (
        <SourceDialog
          row={current}
          onCancel={() => { setDlg(null); if (draft && draft._key === current._key) setDraft(null); }}
          onSave={save}
        />
      )}

      {toRemove && (
        <Dialog open onOpenChange={() => setConfirm(null)}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Remove {toRemove.name || KIND_LABEL[toRemove.kind]}?</DialogTitle>
              <DialogDescription>
                {num(toRemove.amount)} comes out of the plan
                {toRemove.kind === "debt" && isAssetBacked(toRemove.loan_type) && <> — and so does the asset it bought, along with its depreciation</>}
                {toRemove.kind === "debt" && !isAssetBacked(toRemove.loan_type) && <>, and its repayments stop</>}
                . The cash check below will move.
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

/* ------------------------------------------------------------------ */

function SourceRow({ r, onEdit, onRemove, planId }: { r: Row; onEdit: () => void; onRemove: () => void; planId: string }) {
  const router = useRouter();
  const loan = loanOf(r);
  const summary = loan ? loanSummary(loan) : null;
  const y1 = loan ? loanByYear(loan)[0] : null;
  const backed = r.kind === "debt" && isAssetBacked(r.loan_type);

  const cost = r.kind === "equity" ? `${r.equity_percent ?? 0}% of the business`
    : r.kind === "grant" ? (r.has_conditions ? "Conditions apply" : "Nothing")
    : r.kind === "revenue_linked" ? `${r.repayment_percent ?? 0}% of sales, capped at ${r.cap_multiple ?? 1.5}×`
    : loan ? `${r.interest_rate ?? 0}% over ${Math.round((r.term_months ?? 60) / 12)} yr` : "Nothing";

  const effect = summary && y1
    ? `${num(summary.payment)}/${summary.frequency === "monthly" ? "mo" : summary.frequency === "weekly" ? "wk" : summary.frequency === "fortnightly" ? "fn" : "qtr"} · ${num(y1.interest)} interest · ${num(y1.closing)} owing`
    : r.kind === "revenue_linked" ? `Repays ${num(rbfCap(r as never))} in all — ${num(rbfCost(r as never))} of cost`
    : r.kind === "equity" ? (r.dividend_policy ? "Dividends payable" : "No repayment")
    : r.kind === "grant" && r.recognition_type === "deferred" ? `Recognised over ${r.recognition_period_months ?? 12} months`
    : "No repayment";

  return (
    <GridRow>
      <Td>
        <span className="inline-flex items-center gap-1">
          <NameLink onClick={onEdit}>{r.name || <span className="text-muted-foreground">Untitled</span>}</NameLink>
          {backed && (
            <LinkMark feeds title="This buys an asset — it is depreciating in Fixed assets. Click to open it."
              onClick={() => router.push(`/plans/${planId}/assets`)} />
          )}
        </span>
      </Td>
      <Td>
        {r.kind === "owner" ? (r.owner_type === "owner_loan" ? "Owner loan" : "Owner capital")
          : r.kind === "debt" ? (LOAN_TYPES.find((t) => t.value === r.loan_type)?.label ?? "Loan")
          : KIND_LABEL[r.kind]}
      </Td>
      <Td right className="num">{num(r.amount)}</Td>
      <Td>{MONTHS[r.start_month - 1]} · Yr {r.start_year}</Td>
      <Td className="text-muted-foreground">{cost}</Td>
      <Td className="text-muted-foreground">{effect}</Td>
      <Td right><RemoveButton onClick={onRemove} title="Remove funding" /></Td>
    </GridRow>
  );
}

/** The whole point of the module: twelve months of cash, and a straight answer under it. */
function CashRow({ check, opening, year1, onAdd }: {
  check: ReturnType<typeof adequacy>; opening: number;
  year1: { revenue: number; cogs: number; overheads: number; depreciation: number }; onAdd: () => void;
}) {
  const trading = year1.revenue > 0 || year1.overheads > 0;
  return (
    <div className="mt-4 rounded border border-input">
      <div className="flex items-center gap-2 border-b border-input bg-[#E9EDF2] px-3 py-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Cash at the end of each month — Year 1</span>
        <span className="ml-auto text-[11.5px] text-muted-foreground">
          Opening {num(opening)} · sales {num(year1.revenue)} · costs {num(year1.cogs + year1.overheads)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <Grid className="min-w-[720px]">
          <thead><tr><Th className="w-[90px]" />{MONTHS.map((m) => <Th key={m} right>{m}</Th>)}</tr></thead>
          <tbody>
            <GridRow>
              <Td className="text-muted-foreground">Closing</Td>
              {check.months.map((p) => (
                <Td key={p.month} right className={cn("num", p.closing < 0 && "font-semibold text-destructive",
                  p.month === check.low.month && p.closing >= 0 && "font-semibold")}>
                  {signed(p.closing)}
                  {p.month === check.low.month && <span aria-hidden className="ml-0.5">▼</span>}
                </Td>
              ))}
            </GridRow>
          </tbody>
        </Grid>
      </div>
      <div className={cn("flex items-center gap-3 border-t border-input px-3 py-2 text-[12.5px]",
        check.covered ? "text-muted-foreground" : "bg-bad-soft")}>
        {!trading ? (
          <span className="text-muted-foreground">Fill in Sales, COGS and Overheads and this will tell you whether the funding covers the year.</span>
        ) : check.covered ? (
          <span>The funding holds all year. The tightest month is {MONTHS[check.low.month - 1]} at {num(check.low.closing)}.</span>
        ) : (
          <>
            <span className="font-semibold text-destructive">
              Short {num(check.shortfall)} in {MONTHS[check.low.month - 1]}.
            </span>
            <span>Another {num(check.shortfall)} of funding — or a later start on the spending — closes it.</span>
            <Button variant="outline" size="sm" type="button" className="ml-auto" onClick={onAdd}>+ Funding</Button>
          </>
        )}
      </div>
    </div>
  );
}

function PendingBridge({ pending, error }: { pending: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : undefined), [pending, error, setNote]);
  return null;
}

/** Guided mode asks the question in plain language before it shows anyone a form (§7.2). */
function PickerDialog({ onPick, onCancel }: { onPick: (k: FundingKind) => void; onCancel: () => void }) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Where is the money coming from?</DialogTitle>
          <DialogDescription>Pick one. You can add as many sources as the plan needs.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          {KIND_CARDS.map((c) => (
            <button key={c.kind} type="button" onClick={() => onPick(c.kind)}
              className="rounded border border-input px-3 py-2 text-left hover:border-primary hover:bg-muted/50">
              <div className="text-[13px] font-semibold">{c.title}</div>
              <div className="text-[12px] text-muted-foreground">{c.blurb}</div>
            </button>
          ))}
        </div>
        <DialogFooter><Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 * One dialog per kind of funding, each showing its own numbers back.  *
 * ------------------------------------------------------------------ */

function SourceDialog({ row, onCancel, onSave }: { row: Row; onCancel: () => void; onSave: (r: Row) => void }) {
  const [d, setD] = useState<Row>(row);
  const set = (patch: Partial<Row>) => setD((x) => ({ ...x, ...patch }));
  const loan = loanOf(d);
  const summary = loan && d.amount > 0 ? loanSummary(loan) : null;
  const per = d.payment_frequency === "weekly" ? "a week" : d.payment_frequency === "fortnightly" ? "a fortnight" : d.payment_frequency === "quarterly" ? "a quarter" : "a month";

  const title = d.kind === "owner" ? "Your own money" : d.kind === "debt" ? "A loan"
    : d.kind === "equity" ? "An investor" : d.kind === "grant" ? "A grant" : "Revenue-based finance";

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{d.name.trim() || title}</DialogTitle>
          <DialogDescription>
            {d.kind === "owner" && "Cash you put in yourself — as capital you do not expect back, or as a loan the business repays you."}
            {d.kind === "debt" && "A bank or finance company. What it costs and what it leaves owing are worked out as you type."}
            {d.kind === "equity" && "Someone buys a share of the business. Nothing is repaid, but you own less of it afterwards."}
            {d.kind === "grant" && "Money you do not pay back. If it carries conditions, say so — a reader will ask."}
            {d.kind === "revenue_linked" && "Money now, repaid as a share of sales until a capped total is reached."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_140px_100px_90px] gap-3">
            <div>
              <span className={label}>
                {d.kind === "debt" ? "Lender" : d.kind === "equity" ? "Investor" : d.kind === "grant" ? "Grant" : d.kind === "revenue_linked" ? "Provider" : "Who"}
              </span>
              <Input autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })}
                placeholder={d.kind === "debt" ? "Citibank" : d.kind === "equity" ? "John Smith" : d.kind === "grant" ? "Export grant" : "Your name"} className={box} />
            </div>
            <div>
              <span className={label}>Amount</span>
              <Input inputMode="decimal" defaultValue={d.amount ? String(d.amount) : ""}
                onBlur={(e) => set({ amount: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
            </div>
            <div>
              <span className={label}>Arrives in</span>
              <FieldSelect value={String(d.start_year)} onValueChange={(v) => set({ start_year: Number(v) })} options={YEAR_OPTIONS} />
            </div>
            <div>
              <span className={label}>Month</span>
              <FieldSelect value={String(d.start_month)} onValueChange={(v) => set({ start_month: Number(v) })} options={MONTH_OPTIONS} />
            </div>
          </div>

          {d.kind === "owner" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className={label}>Put in as</span>
                <FieldSelect value={d.owner_type ?? "owner_capital"} onValueChange={(v) => set({ owner_type: v as Row["owner_type"] })}
                  options={[{ value: "owner_capital", label: "Capital — not repaid" }, { value: "owner_loan", label: "A loan to the business" }]} />
              </div>
              {d.owner_type === "owner_loan" && <>
                <div>
                  <span className={label}>Interest rate</span>
                  <Input inputMode="decimal" defaultValue={d.interest_rate ? String(d.interest_rate) : ""}
                    onBlur={(e) => set({ interest_rate: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
                </div>
                <div>
                  <span className={label}>Repaid over (months)</span>
                  <Input inputMode="numeric" defaultValue={d.term_months ? String(d.term_months) : ""}
                    onBlur={(e) => set({ term_months: parseNum(e.target.value) })} placeholder="60" className={cn(box, "num text-right")} />
                </div>
              </>}
            </div>
          )}

          {d.kind === "debt" && <>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <span className={label}>Kind of loan</span>
                <FieldSelect value={d.loan_type ?? "term_loan"} onValueChange={(v) => set({ loan_type: v as LoanType })} options={LOAN_TYPES} />
              </div>
              <div>
                <span className={label}>Interest rate %</span>
                <Input inputMode="decimal" defaultValue={d.interest_rate ? String(d.interest_rate) : ""}
                  onBlur={(e) => set({ interest_rate: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Term (months)</span>
                <Input inputMode="numeric" defaultValue={d.term_months ? String(d.term_months) : ""}
                  onBlur={(e) => set({ term_months: parseNum(e.target.value) })} placeholder="60" className={cn(box, "num text-right")} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <span className={label}>Repayments</span>
                <FieldSelect value={d.repayment_type ?? "amortised"} onValueChange={(v) => set({ repayment_type: v as Row["repayment_type"] })} options={REPAYMENT_TYPES} />
              </div>
              <div>
                <span className={label}>How often</span>
                <FieldSelect value={d.payment_frequency ?? "monthly"} onValueChange={(v) => set({ payment_frequency: v as Row["payment_frequency"] })} options={FREQUENCIES} />
              </div>
              {d.repayment_type === "pct_of_balance" ? (
                <div>
                  <span className={label}>% of balance</span>
                  <Input inputMode="decimal" defaultValue={d.min_repayment_pct ? String(d.min_repayment_pct) : ""}
                    onBlur={(e) => set({ min_repayment_pct: parseNum(e.target.value) })} placeholder="2" className={cn(box, "num text-right")} />
                </div>
              ) : (
                <div>
                  <span className={label}>Balloon at the end</span>
                  <Input inputMode="decimal" defaultValue={d.residual_value ? String(d.residual_value) : ""}
                    onBlur={(e) => set({ residual_value: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
                </div>
              )}
              <div>
                <span className={label}>Annual fee</span>
                <Input inputMode="decimal" defaultValue={d.annual_fee ? String(d.annual_fee) : ""}
                  onBlur={(e) => set({ annual_fee: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
              </div>
            </div>
            {isAssetBacked(d.loan_type) && (
              <div className="rounded border border-input bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                This buys something the business then owns, so it appears in <b>Fixed assets</b> at {num(d.amount)} and depreciates there.
                What it cost stays tied to this loan; how long it is written off over is set on that step.
              </div>
            )}
          </>}

          {d.kind === "equity" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className={label}>Share of the business %</span>
                <Input inputMode="decimal" defaultValue={d.equity_percent ? String(d.equity_percent) : ""}
                  onBlur={(e) => set({ equity_percent: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Valuation before the money</span>
                <Input inputMode="decimal" defaultValue={d.pre_money_valuation ? String(d.pre_money_valuation) : ""}
                  onBlur={(e) => set({ pre_money_valuation: parseNum(e.target.value) || null })} placeholder="Optional" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Dividends</span>
                <FieldSelect value={d.dividend_policy ? "yes" : "no"} onValueChange={(v) => set({ dividend_policy: v === "yes" })}
                  options={[{ value: "no", label: "None planned" }, { value: "yes", label: "Payable" }]} />
              </div>
            </div>
          )}

          {d.kind === "grant" && <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className={label}>Counted as income</span>
                <FieldSelect value={d.recognition_type ?? "immediate"} onValueChange={(v) => set({ recognition_type: v as Row["recognition_type"] })}
                  options={[{ value: "immediate", label: "All at once" }, { value: "deferred", label: "Spread over time" }]} />
              </div>
              {d.recognition_type === "deferred" && (
                <div>
                  <span className={label}>Over (months)</span>
                  <Input inputMode="numeric" defaultValue={d.recognition_period_months ? String(d.recognition_period_months) : ""}
                    onBlur={(e) => set({ recognition_period_months: parseNum(e.target.value) || 12 })} placeholder="12" className={cn(box, "num text-right")} />
                </div>
              )}
              <div>
                <span className={label}>Conditions</span>
                <FieldSelect value={d.has_conditions ? "yes" : "no"} onValueChange={(v) => set({ has_conditions: v === "yes" })}
                  options={[{ value: "no", label: "None" }, { value: "yes", label: "Yes — say what" }]} />
              </div>
            </div>
            {d.has_conditions && (
              <div>
                <span className={label}>What has to happen</span>
                <Input value={d.conditions ?? ""} onChange={(e) => set({ conditions: e.target.value })}
                  placeholder="Two full-time hires by June, quarterly reporting" className={box} />
              </div>
            )}
          </>}

          {d.kind === "revenue_linked" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className={label}>Share of sales %</span>
                <Input inputMode="decimal" defaultValue={d.repayment_percent ? String(d.repayment_percent) : ""}
                  onBlur={(e) => set({ repayment_percent: parseNum(e.target.value) })} placeholder="7" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Repayment cap (×)</span>
                <Input inputMode="decimal" defaultValue={d.cap_multiple ? String(d.cap_multiple) : ""}
                  onBlur={(e) => set({ cap_multiple: parseNum(e.target.value) || 1.5 })} placeholder="1.5" className={cn(box, "num text-right")} />
              </div>
              <div>
                <span className={label}>Minimum a month</span>
                <Input inputMode="decimal" defaultValue={d.min_monthly_payment ? String(d.min_monthly_payment) : ""}
                  onBlur={(e) => set({ min_monthly_payment: parseNum(e.target.value) })} placeholder="0" className={cn(box, "num text-right")} />
              </div>
            </div>
          )}

          <WorkedOut d={d} summary={summary} per={per} />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="button" onClick={() => onSave(d)} disabled={!d.name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The "worked out for you" line that tested well in mockup v7 (§7.2), on every kind of funding — because a
 * rate and a term mean nothing to most people until they see the payment.
 */
function WorkedOut({ d, summary, per }: { d: Row; summary: ReturnType<typeof loanSummary> | null; per: string }) {
  if (d.amount <= 0) return (
    <div className="rounded border border-input bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
      Put in an amount and this will show what it costs and what it leaves behind.
    </div>
  );

  const body = summary ? (
    <>
      <b>{num(summary.payment)}</b> {per}
      {d.repayment_type === "interest_only" && " in interest, with the principal at the end"}
      {d.repayment_type === "pct_of_balance" && " to start with, falling as the balance does"}.
      {" "}Year 1 costs <b>{num(summary.year1Interest)}</b> in interest and leaves <b>{num(summary.closingYear1)}</b> owing.
      {" "}Over the whole loan the interest comes to <b>{num(summary.totalInterest)}</b>.
      {d.residual_value ? <> A balloon of {num(d.residual_value)} is still due at the end.</> : null}
    </>
  ) : d.kind === "equity" ? (
    <>
      {num(d.amount)} for <b>{d.equity_percent ?? 0}%</b> of the business
      {d.pre_money_valuation ? <> — a {num(d.pre_money_valuation)} valuation before the money, {num(d.pre_money_valuation + d.amount)} after</> : null}.
      {" "}Nothing is repaid{d.dividend_policy ? ", though dividends are payable" : ""}.
    </>
  ) : d.kind === "grant" ? (
    <>
      {num(d.amount)} that is never repaid.
      {d.recognition_type === "deferred"
        ? <> Counted as income over {d.recognition_period_months ?? 12} months — about {num(d.amount / (d.recognition_period_months ?? 12))} a month.</>
        : <> Counted as income the month it arrives.</>}
      {d.has_conditions && <> Conditions apply, so a reader will want them stated in the plan.</>}
    </>
  ) : d.kind === "revenue_linked" ? (
    <>
      {num(d.amount)} now, repaid at <b>{d.repayment_percent ?? 0}%</b> of sales until <b>{num(rbfCap(d as never))}</b> has gone back.
      {" "}That is <b>{num(rbfCost(d as never))}</b> of financing cost
      {d.min_monthly_payment ? <>, with at least {num(d.min_monthly_payment)} a month whatever the sales do</> : null}.
    </>
  ) : (
    <>{num(d.amount)} of your own money in, with nothing owed back to anyone.</>
  );

  return (
    <div className="rounded border border-input bg-muted/40 px-3 py-2 text-[12.5px]">
      <div className="text-[11.5px] font-semibold text-muted-foreground">What that means</div>
      <div className="mt-1">{body}</div>
    </div>
  );
}
