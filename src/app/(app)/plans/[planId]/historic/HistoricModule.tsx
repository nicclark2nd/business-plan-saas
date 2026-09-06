"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Toolbar, Meta, Note, CellInput, RemoveButton } from "@/components/module/DataGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { deriveFromComponents, periodRatios, periodsFromTemplate, COMPONENT_INPUTS, TEMPLATE_ROWS, type PeriodField, type PeriodInput, type TemplateSheet } from "@/engine/historic/derive";
import { savePeriod, importPeriods, deletePeriod, setHasHistory, continueFromHistoric } from "./actions";
import { PNL_LINES, BS_LINES, type Period, type LineDef } from "./model";

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const money = (v: number) => (v < 0 ? `(${fmt.format(-v)})` : fmt.format(v));
const parseNum = (s: string) => { const t = s.replace(/[,\s]/g, "").replace(/^\((.*)\)$/, "-$1"); const n = Number(t); return Number.isFinite(n) ? n : 0; };
const PERIODS = [1, 2, 3, 4] as const;
type AreaKey = "pnl" | "bs" | "import";
type Col = { n: number; present: boolean; period_end_text: string; period_length: number; input: PeriodInput; _dirty?: boolean; _error?: string; source: string | null };
const STEP = GUIDED_STEPS.find((s) => s.id === "historic")?.step ?? 6;

const endText = (iso: string | null, fyEnd: number) => {
  if (!iso) return "";
  const [y, m] = iso.split("-").map(Number);
  return m === fyEnd ? String(y) : `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
};

export function HistoricModule({ planId, initial, hasHistory, mode, initialArea, fyEndMonth }: {
  planId: string; initial: Period[]; hasHistory: boolean | null; mode: "guided" | "advanced"; initialArea: AreaKey; fyEndMonth: number;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [cols, setCols] = useState<Col[]>(() => PERIODS.map((n) => {
    const p = initial.find((x) => x.period_number === n);
    const input: PeriodInput = {}; if (p) for (const f of COMPONENT_INPUTS) input[f] = p[f];
    return { n, present: !!p, period_end_text: endText(p?.period_end ?? null, fyEndMonth), period_length: p?.period_length ?? 12, input, source: p?.source ?? null };
  }));
  const [newBusiness, setNewBusiness] = useState(hasHistory === false);
  const [pending, start] = useTransition();
  const ref = useRef(cols); useEffect(() => { ref.current = cols; }, [cols]);
  const derived = useMemo(() => cols.map((c) => deriveFromComponents(c.input)), [cols]);

  const edit = (n: number, changes: Partial<Col>) => setCols((cs) => cs.map((c) => (c.n === n ? { ...c, ...changes, _dirty: true, _error: undefined } : c)));
  const editValue = (n: number, f: PeriodField, raw: string) => setCols((cs) => cs.map((c) => (c.n === n ? { ...c, input: { ...c.input, [f]: parseNum(raw) }, _dirty: true, _error: undefined } : c)));
  const commit = (n: number) => {
    const c = ref.current.find((x) => x.n === n);
    if (!c || !c._dirty) return;
    const hasData = !!c.period_end_text.trim() || Object.values(c.input).some((v) => v);
    if (!hasData) return;
    setCols((cs) => cs.map((x) => (x.n === n ? { ...x, _dirty: false } : x)));
    start(async () => {
      const r = await savePeriod(planId, n, { ...c.input, period_end_text: c.period_end_text, period_length: c.period_length });
      setCols((cs) => cs.map((x) => (x.n === n ? (r.ok ? { ...x, present: true, source: "manual", period_end_text: endText(r.data!.period_end, fyEndMonth) } : { ...x, _dirty: true, _error: r.error }) : x)));
    });
  };
  /** Focus left this column entirely (moved to another column, or off the grid). */
  const leftCol = (e: React.FocusEvent<HTMLElement>, n: number) => (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>("[data-col]")?.dataset.col !== String(n);
  const clear = (n: number) => {
    setCols((cs) => cs.map((c) => (c.n === n ? { n, present: false, period_end_text: "", period_length: 12, input: {}, source: null } : c)));
    start(async () => { await deletePeriod(planId, n); });
  };
  const flush = () => ref.current.forEach((c) => c._dirty && commit(c.n));
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromHistoric(planId, intent); });
  };
  const toggleNewBusiness = () => { const v = !newBusiness; setNewBusiness(v); start(async () => { await setHasHistory(planId, v ? false : (ref.current.some((c) => c.present) ? true : null)); }); };

  const presentCount = cols.filter((c) => c.present).length;
  const err = cols.find((c) => c._error)?._error;
  const latest = derived[0];

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Financials" title="Historic" subtitle="Up to four years of accounts, newest first — the latest is where the forecast starts" mode={mode}
      areas={[{ key: "pnl", label: "Profit & loss", count: presentCount }, { key: "bs", label: "Balance sheet", count: presentCount }, { key: "import", label: "Import" }]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }} scope={{ label: "This plan" }}
      primaryAction={<Button size="sm" type="button" variant={newBusiness ? "secondary" : "outline"} aria-pressed={newBusiness} onClick={toggleNewBusiness}>{newBusiness ? "✓ New business — no accounts yet" : "New business — no accounts yet"}</Button>}
      footer={<ModuleFooter planId={planId} prevId="swot" formId="historic-form" />}
      help={<>
        <h3>What to enter</h3>
        <p>Type the lines on your accountant&apos;s statements; the bold lines calculate. Period 1 is your most recent year — it becomes the opening position every forecast starts from. Older years are optional but show a lender the trend.</p>
        <p>Have the statements as a file? <b>Import</b> takes the standard template — totals in, everything else derived — and loads all four years at once.</p>
        <p>New business with no accounts? Press the button top right. The opening position then comes from Funding.</p>
        <h3>Where this goes</h3>
        <p>Opening balance sheet for the forecast; debtor, stock and creditor days become the working-capital defaults; the four-year trend appears in every report and on the dashboard.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={cols.some((c) => c._dirty)} error={err} />
      <form id="historic-form" onSubmit={onSubmit} className="hidden" />

      {newBusiness && <div className="flex items-center gap-3 border-b border-border bg-warn-soft px-5 py-2 text-[13px]"><i className="size-2 rounded-full bg-warn" />Marked as a new business — this step counts as complete and the forecast opens from Funding. You can still enter figures below if you have any.</div>}

      {(area === "pnl" || area === "bs") && (
        <>
          <Toolbar><Meta className="ml-0">{presentCount ? `${presentCount} period${presentCount === 1 ? "" : "s"} entered.` : "Nothing yet."} Enter the plain lines; bold lines calculate. Brackets mean negative.</Meta></Toolbar>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-[1] [&>th]:border-b [&>th]:border-input [&>th]:bg-secondary [&>th]:px-3 [&>th]:py-[7px] [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[.05em] [&>th]:text-muted-foreground">
                  <th style={{ width: 280 }} className="!pl-5">Line</th>
                  {cols.map((c) => <th key={c.n} className="!text-right">Period {c.n}{c.n === 1 && <span className="ml-1.5 normal-case tracking-normal text-primary">· opening position</span>}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-secondary/40">
                  <td className="py-1 pl-5 text-muted-foreground">Period end <span className="text-[11px]">(year, or month year)</span></td>
                  {cols.map((c) => <td key={c.n} data-col={c.n} className="px-3 py-1" onBlur={(e) => leftCol(e, c.n) && commit(c.n)}><CellInput value={c.period_end_text} placeholder={c.n === 1 ? "e.g. 2026" : ""} className="text-right" onChange={(e) => edit(c.n, { period_end_text: e.target.value })} /></td>)}
                </tr>
                <tr className="border-b border-border bg-secondary/40">
                  <td className="py-1 pl-5 text-muted-foreground">Period length <span className="text-[11px]">(months)</span></td>
                  {cols.map((c) => <td key={c.n} data-col={c.n} className="px-3 py-1" onBlur={(e) => leftCol(e, c.n) && commit(c.n)}><CellInput numeric inputMode="numeric" value={String(c.period_length)} onChange={(e) => edit(c.n, { period_length: Math.max(1, Math.min(24, Number(e.target.value.replace(/\D/g, "")) || 12)) })} /></td>)}
                </tr>
                {(area === "pnl" ? PNL_LINES : BS_LINES).map((line) => <LineRow key={line.field} line={line} cols={cols} derived={derived} onEdit={editValue} onCommit={commit} leftCol={leftCol} />)}
              </tbody>
              <tfoot>
                {(area === "pnl"
                  ? [["Gross margin %", (i: number) => `${periodRatios(derived[i], cols[i].period_length).grossMarginPct}%`], ["Net margin %", (i: number) => `${periodRatios(derived[i], cols[i].period_length).netMarginPct}%`]]
                  : [["Debtor days", (i: number) => String(periodRatios(derived[i], cols[i].period_length).debtorDays)], ["Inventory days", (i: number) => String(periodRatios(derived[i], cols[i].period_length).inventoryDays)], ["Creditor days", (i: number) => String(periodRatios(derived[i], cols[i].period_length).creditorDays)], ["Current ratio", (i: number) => periodRatios(derived[i], cols[i].period_length).currentRatio.toFixed(2)]]
                ).map(([label, f]) => (
                  <tr key={label as string} className="[&>td]:border-t [&>td]:border-border [&>td]:bg-secondary [&>td]:px-3 [&>td]:py-[5px] [&>td]:text-xs">
                    <td className="!pl-5 font-semibold uppercase tracking-[.04em] text-muted-foreground">{label as string}</td>
                    {cols.map((c, i) => <td key={c.n} className="num text-right text-muted-foreground">{c.present || Object.values(c.input).some(Boolean) ? (f as (i: number) => string)(i) : "—"}</td>)}
                  </tr>
                ))}
                <tr className="[&>td]:px-3 [&>td]:py-1.5">
                  <td />
                  {cols.map((c) => <td key={c.n} className="text-right">{c.present && <RemoveButton title={`Clear period ${c.n}`} onClick={() => clear(c.n)} />}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
          <Note>{area === "bs" ? <>Equity is assets minus liabilities, so the sheet always balances. If your accountant&apos;s equity figure differs, one of the lines above is different from theirs. Period 1 debtor / inventory / creditor days ({latest && presentCount ? `${periodRatios(latest, cols[0].period_length).debtorDays} / ${periodRatios(latest, cols[0].period_length).inventoryDays} / ${periodRatios(latest, cols[0].period_length).creditorDays}` : "—"}) become the forecast&apos;s working-capital defaults.</> : <>Extraordinary items: positive for one-off income, negative for a one-off expense. Dividends include owner drawings taken from profit.</>}</Note>
        </>
      )}

      {area === "import" && <ImportArea planId={planId} onLoaded={() => window.location.reload()} />}
    </ModuleFrame>
  );
}

function LineRow({ line, cols, derived, onEdit, onCommit, leftCol }: {
  line: LineDef; cols: Col[]; derived: ReturnType<typeof deriveFromComponents>[];
  onEdit: (n: number, f: PeriodField, raw: string) => void; onCommit: (n: number) => void; leftCol: (e: React.FocusEvent<HTMLElement>, n: number) => boolean;
}) {
  return (
    <tr className={cn("border-b border-border", line.calc && "bg-secondary/60")} title={line.help}>
      <td className={cn("py-0 pl-5 pr-3 h-8", line.indent && "pl-8", line.strong && "font-semibold", line.calc && "text-foreground")}>{line.label}</td>
      {cols.map((c, i) => (
        <td key={c.n} data-col={c.n} className={cn("px-3 py-0 text-right", c._error && "bg-bad-soft")} title={c._error} onBlur={(e) => leftCol(e, c.n) && onCommit(c.n)}>
          {line.calc
            ? <span className={cn("num inline-block h-7 leading-7 pr-1.5", line.strong && "font-semibold", derived[i][line.field] < 0 && "text-bad")}>{money(derived[i][line.field])}</span>
            : <CellInput numeric value={c.input[line.field] ? money(c.input[line.field] as number) : ""} placeholder="0" onChange={(e) => onEdit(c.n, line.field, e.target.value)} />}
        </td>
      ))}
    </tr>
  );
}

/** Upload the standard template (totals in, components derived). Parsed in the browser; four columns, newest first. */
function ImportArea({ planId, onLoaded }: { planId: string; onLoaded: () => void }) {
  const [sheet, setSheet] = useState<TemplateSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const preview = useMemo(() => (sheet ? periodsFromTemplate(sheet) : null), [sheet]);

  const onFile = async (file: File | undefined) => {
    setError(undefined); setSheet(null);
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) { setError("Choose an .xlsx or .xls file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Spreadsheets up to 10 MB."); return; }
    setFileName(file.name);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellFormula: false, cellHTML: false, sheetRows: 200 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) { setError("No readable worksheet in that file."); return; }
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    const rows: Record<string, (number | null)[]> = {};
    let periodEnd: (string | number | null)[] = [null, null, null, null], periodLength: (number | null)[] = [null, null, null, null];
    for (const r of grid) {
      const label = typeof r?.[0] === "string" ? r[0].trim() : null; if (!label) continue;
      const vals = [1, 2, 3, 4].map((i) => { const v = r[i]; return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v.replace(/[,\s]/g, ""))) ? Number(v.replace(/[,\s]/g, "")) : null; });
      if (label === "Period End") periodEnd = [1, 2, 3, 4].map((i) => (r[i] as string | number | null) ?? null);
      else if (label === "Period Length") periodLength = vals;
      else if (label in TEMPLATE_ROWS) rows[label] = vals;
    }
    if (!Object.keys(rows).length) { setError("That doesn't look like the template — no known line labels in column A. Download the template below and fill it in."); return; }
    setSheet({ periodEnd, periodLength, rows });
  };
  const load = () => { if (!preview) return; start(async () => {
    const r = await importPeriods(planId, preview.map((p) => ({ period_number: p.period_number, period_end: p.period_end, period_length: p.period_length, present: p.present, input: Object.fromEntries(Object.entries(TEMPLATE_ROWS).map(([label, f]) => [f, sheet!.rows[label]?.[p.period_number - 1] ?? undefined])) })));
    if (!r.ok) setError(r.error); else onLoaded();
  }); };
  const download = async () => {
    const XLSX = await import("xlsx");
    const labels = ["Period End", "Period Length", "Profit & Loss", "Revenue", "Gross Margin", "Net Profit After Tax", "Other Information", "Depreciation & Amortisation", "Interest Paid", "Tax Paid", "Extraordinary Income_Expenses", "Dividends Paid", "Balance Sheet", "Total Assets", "Cash", "Accounts Receivable", "Inventory_WIP", "Total Current Assets", "Fixed Assets", "Liabilities", "Total Liabilities", "Accounts Payable", "Total Current Liabilities", "Funding", "Bank Loans - Current", "Bank Loans - Non Current"];
    const aoa = [["Category", "Period 1", "Period 2", "Period 3", "Period 4"], ...labels.map((l) => [l, ...(l === "Period Length" ? [12, 12, 12, 12] : ["", "", "", ""])])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Historic"); XLSX.writeFile(wb, "PlanWell_Historic_Template.xlsx");
  };

  const show: { label: string; field: PeriodField }[] = [{ label: "Revenue", field: "revenue" }, { label: "Gross margin", field: "gross_margin" }, { label: "Overheads (derived)", field: "overheads" }, { label: "Net profit after tax", field: "net_profit" }, { label: "Cash", field: "cash" }, { label: "Total assets", field: "total_assets" }, { label: "Total liabilities", field: "total_liabilities" }, { label: "Equity (derived)", field: "equity" }];
  return (
    <>
      <Toolbar>
        <label className="inline-flex cursor-pointer items-center gap-2"><input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /><span className="inline-flex h-7 items-center rounded border border-input bg-card px-2.5 text-xs font-semibold hover:bg-secondary">Choose file…</span><span className="text-xs text-muted-foreground">{fileName || "Period 1 is the newest year."}</span></label>
        <Button type="button" size="sm" variant="outline" onClick={download}>Download template</Button>
        <Meta>Totals in, everything else derived. Loading replaces all four periods.</Meta>
      </Toolbar>
      {error && <div className="border-b border-border bg-bad-soft px-5 py-2 text-[13px] text-bad">{error}</div>}
      {preview ? (
        <>
          <table className="w-full table-fixed border-collapse text-[13px]">
            <thead><tr className="[&>th]:border-b [&>th]:border-input [&>th]:bg-secondary [&>th]:px-3 [&>th]:py-[7px] [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[.05em] [&>th]:text-muted-foreground">
              <th style={{ width: 280 }} className="!pl-5">Line</th>{preview.map((p) => <th key={p.period_number} className="!text-right">Period {p.period_number}<div className="normal-case tracking-normal">{p.present ? String(p.period_end ?? "") : "empty"}</div></th>)}
            </tr></thead>
            <tbody>{show.map((s) => (
              <tr key={s.field} className={cn("border-b border-border", s.label.includes("derived") && "bg-secondary/60")}><td className="h-8 pl-5">{s.label}</td>{preview.map((p) => <td key={p.period_number} className={cn("num px-3 text-right", p.values[s.field] < 0 && "text-bad")}>{p.present ? money(p.values[s.field]) : "—"}</td>)}</tr>
            ))}</tbody>
          </table>
          <div className="flex items-center gap-3 px-5 py-3"><Button type="button" size="sm" onClick={load} disabled={pending}>{pending ? "Loading…" : `Load ${preview.filter((p) => p.present).length} period${preview.filter((p) => p.present).length === 1 ? "" : "s"} into the plan`}</Button><span className="text-xs text-muted-foreground">Replaces anything already entered in Historic.</span></div>
        </>
      ) : (
        <Note>Choose the filled-in template to see what will load before anything changes. Column A holds the line names, columns B–E the four periods, newest first.</Note>
      )}
    </>
  );
}

function PendingBridge({ pending, dirty, error }: { pending: boolean; dirty: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the column" : undefined), [pending, dirty, error, setNote]);
  return null;
}
