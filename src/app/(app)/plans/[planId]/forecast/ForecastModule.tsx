"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, TOTAL_ROW, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { useMoney } from "@/components/MoneyProvider";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type CashTiming, type Forecast, type WorkingCapitalDays } from "@/engine/forecast/model";
import { creditorBalance, debtorBalance, inventoryBalance } from "@/engine/forecast/assumptions";
import type { MonthCash, MonthlyCashFlow } from "@/engine/forecast/monthly";
import type { GstSchedule } from "@/engine/plan/gst";
import { planMonths, planYearLabel } from "@/engine/plan/calendar";
import { saveAssumptions } from "./actions";

/**
 * Review forecast (§6.32.3) — profit and loss, cash flow, balance sheet and the assumptions behind them, on
 * one module bar with a reconciliation strip above all four.
 *
 * They are tabs rather than the four separate pages APeX uses, for one reason: **three statements that must
 * agree belong on one screen.** Every fault this project has had was two views of the same number that never
 * met, and the forecast is where that is most expensive. The strip says whether they agree before the client
 * reads a single figure.
 */
type AreaKey = "pnl" | "cash" | "balance" | "assumptions";
const STEP = GUIDED_STEPS.find((s) => s.id === "forecast")?.step ?? 13;
const box = "h-8";

export function ForecastModule({
  planId, mode, forecast, monthly, initialArea, workingCapital, cashTiming, impliedFromHistory, assumptionsSet, fyEndMonth, firstYear, gst, gstLabel, gstSchedules, gstComponents,
}: {
  planId: string; mode: "guided" | "advanced"; forecast: Forecast; monthly: MonthlyCashFlow; initialArea: AreaKey;
  workingCapital: Record<number, WorkingCapitalDays>; cashTiming: Record<number, CashTiming>;
  impliedFromHistory: WorkingCapitalDays | null; assumptionsSet: boolean; fyEndMonth: number; firstYear: number;
  gst: { registered: boolean }; gstLabel: string; gstSchedules: Record<number, GstSchedule>;
  gstComponents: { label: string; rate: number; frequency: string; reclaimable: boolean }[];
}) {
  const num = useMoney();
  const router = useRouter();
  const [area, setArea] = useState<AreaKey>(initialArea);
  /**
   * The area lives in two places and they have to agree (§6.43.1).
   *
   * The module bar switches instantly on client state, with no round trip — which is the point of it, for
   * somebody comparing two statements all afternoon. The left menu deep-links to the same four tabs by name.
   * Those two were fighting: clicking "Cash Flow" in the menu is a navigation within the SAME route, so
   * React kept the component mounted and `useState` kept whatever tab was already showing. The menu item
   * appeared to do nothing.
   *
   * So the URL follows the bar and the bar follows the URL. Both directions are needed, and the first has to
   * go through the ROUTER rather than `history.replaceState`: a shallow URL change leaves Next still
   * believing it is on the old one, so the next menu click to that address is treated as a no-op navigation
   * and the server component never re-renders. The tab switch still feels instant because local state has
   * already moved; the router catches up behind it.
   *
   * Adjusted during render rather than in an effect: React re-runs this component before touching the DOM,
   * so the right tab paints first time instead of flashing the old one.
   */
  const [cameFrom, setCameFrom] = useState(initialArea);
  if (initialArea !== cameFrom) { setCameFrom(initialArea); setArea(initialArea); }
  const goArea = (k: AreaKey) => {
    setArea(k);
    const q = k === "pnl" ? "" : `?area=${k}`;
    startNav(() => router.replace(`/plans/${planId}/forecast${q}`, { scroll: false }));
  };
  // The cash flow is the one statement with two useful spans: the five years a lender reads, and the twelve
  // months that decide whether the business survives to year two.
  const [span, setSpan] = useState<"years" | "months">("years");
  const MONTHS = useMemo(() => planMonths(fyEndMonth), [fyEndMonth]);
  const [pending, start] = useTransition();
  const [, startNav] = useTransition();
  const [wc, setWc] = useState(workingCapital);
  const [ct, setCt] = useState(cashTiming);
  const [err, setErr] = useState<string>();

  const failures = forecast.invariants.filter((i) => !i.passed);
  const pnl = forecast.pnl, cf = forecast.cashFlow, bs = forecast.balanceSheet;

  const save = (nextWc = wc, nextCt = ct) => start(async () => {
    const r = await saveAssumptions(planId, { workingCapital: nextWc, cashTiming: nextCt });
    if (!r.ok) setErr(r.error); else { setErr(undefined); router.refresh(); }
  });
  const setDays = (year: number, key: keyof WorkingCapitalDays, raw: string) => {
    const next = { ...wc, [year]: { ...wc[year], [key]: Math.min(365, Math.max(0, Math.round(Number(raw) || 0))) } };
    setWc(next);
  };
  const setTiming = (year: number, key: keyof CashTiming, raw: string) => {
    const v = Number(raw) || 0;
    const next = { ...ct, [year]: { ...ct[year], [key]: key === "taxPaidPct" ? Math.min(100, Math.max(0, v)) : Math.max(0, v) } };
    setCt(next);
  };

  const revenue = useMemo(() => FORECAST_YEARS.map((y) => pnl[y].revenue), [pnl]);
  const cogs = useMemo(() => FORECAST_YEARS.map((y) => pnl[y].cogs), [pnl]);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Forecasts" title="Review forecast"
      subtitle="Profit, cash and the balance sheet — whether the plan holds together" mode={mode}
      areas={[
        { key: "pnl", label: "Profit & loss" },
        { key: "cash", label: "Cash flow" },
        { key: "balance", label: "Balance sheet" },
        { key: "assumptions", label: "Assumptions", tag: assumptionsSet ? undefined : "not set" },
      ]}
      area={area} onArea={(k) => goArea(k as AreaKey)} scope={{ label: "Five years" }}
      footer={<ModuleFooter planId={planId} prevId="extraordinary" formId="forecast-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Profit &amp; loss</b> — one-off income and costs sit below operating profit and above tax, so a windfall never flatters the trading line and never dodges the tax on it. Selling an asset is not revenue: only the gain or loss against book value appears here.</p>
        <p><b>Cash flow</b> — interest is financing, not operating; asset proceeds are investing. A profitable business that runs out of cash in month seven is the ordinary way a good plan fails, which is why this is the statement a lender tests hardest.</p>
        <p><b>Assumptions</b> — debtor days, creditor days and tax timing. Leave them at zero and the forecast assumes every client pays on the day of the job and every bill is settled the same day. That is not conservative, it is the most optimistic cash flow that can be drawn.</p>
        <h3>Where this goes</h3>
        <p>All three statements → the business plan, where a bank reads them first. The checks above have to pass before the plan is worth printing.</p>
      </>}
    >
      <form id="forecast-form" className="hidden" />
      <Reconciled failures={failures} />
      {err && <Note><span className="text-bad">{err}</span></Note>}

      {area === "pnl" && (
        <>
          <Toolbar><Meta className="ml-0">
            Year 1 revenue {num(pnl[1].revenue)} · gross margin {pnl[1].grossMargin === null ? "—" : `${pnl[1].grossMargin}%`} · net profit {num(pnl[1].netProfit)}
          </Meta></Toolbar>
          <Statement rows={[
            ["Revenue", (y) => pnl[y].revenue, "head"],
            ["Cost of sales", (y) => -pnl[y].cogs],
            ["Gross profit", (y) => pnl[y].grossProfit, "sub"],
            ["Overheads", (y) => -pnl[y].overheads],
            ["Depreciation", (y) => -pnl[y].depreciation],
            ["Operating profit", (y) => pnl[y].operatingProfit, "sub"],
            ["One-off income", (y) => pnl[y].extraordinaryIncome],
            ["One-off costs", (y) => -pnl[y].extraordinaryExpense],
            ["Gain on asset sales", (y) => pnl[y].disposalGainLoss],
            ["Interest", (y) => -pnl[y].interest],
            ["Profit before tax", (y) => pnl[y].profitBeforeTax, "sub"],
            ["Losses brought forward", (y) => -pnl[y].lossRelief],
            ["Taxable profit", (y) => pnl[y].taxableProfit],
            ["Tax", (y) => -pnl[y].tax],
            ["Net profit", (y) => pnl[y].netProfit, "total"],
            ["Dividends", (y) => -pnl[y].dividends],
            ["Retained profit", (y) => pnl[y].retainedProfit, "sub"],
          ]} num={num} />
          <TaxNotes pnl={pnl} num={num} />
        </>
      )}

      {area === "cash" && (
        <>
          <Toolbar>
            <Meta className="ml-0">
              {span === "years"
                ? <>Year 1 closes on {num(cf[1].closingCash)} · lowest close over five years {num(Math.min(...FORECAST_YEARS.map((y) => cf[y].closingCash)))}</>
                : <>{planYearLabel(firstYear, fyEndMonth)} · {cashShape(monthly, MONTHS, num)}</>}
            </Meta>
            <SpanToggle span={span} onSpan={setSpan} />
          </Toolbar>
          {span === "years" ? (
            <Statement rows={[
              ["Opening cash", (y) => cf[y].openingCash, "head"],
              ["Received from customers", (y) => cf[y].receiptsFromCustomers],
              ["One-off receipts", (y) => cf[y].extraordinaryReceipts],
              ["Paid to suppliers and staff", (y) => -cf[y].paidToSuppliersAndEmployees],
              ["One-off payments", (y) => -cf[y].extraordinaryPayments],
              ["Tax paid", (y) => -cf[y].taxPaid],
              ...(gst.registered ? [[`${gstLabel} paid over`, (y: number) => -cf[y].gstRemitted] as StatementRow] : []),
              ["Operating cash flow", (y) => cf[y].netOperating, "sub"],
              ["Assets bought", (y) => -cf[y].capex],
              ["Assets sold", (y) => cf[y].disposalProceeds],
              ["Investing cash flow", (y) => cf[y].netInvesting, "sub"],
              ["Money borrowed", (y) => cf[y].debtProceeds],
              ["Money invested", (y) => cf[y].equityRaised],
              ["Loan repayments", (y) => -cf[y].debtRepaid],
              ["Interest paid", (y) => -cf[y].interestPaid],
              ["Dividends paid", (y) => -cf[y].dividendsPaid],
              ["Financing cash flow", (y) => cf[y].netFinancing, "sub"],
              ["Closing cash", (y) => cf[y].closingCash, "total"],
            ]} num={num} />
          ) : (
            <MonthlyStatement monthly={monthly} months={MONTHS} num={num} registered={gst.registered} gstLabel={gstLabel} />
          )}
          <Note>
            {span === "years"
              ? <>Interest is financing, not operating. Money from selling an asset is investing, never revenue.</>
              : <>
                  The twelve add to Year 1 exactly — the column on the right is the same figure the five-year view shows.
                  Debtors, stock and creditors move across the year on their own driver&rsquo;s shape, so a busy quarter
                  builds receivables rather than a twelfth arriving each month. Tax is spread the way instalments fall;
                  a dividend is taken in the last month, once the year&rsquo;s profit is known.
                </>}
          </Note>
          {gst.registered && <GstNote components={gstComponents} label={gstLabel} schedule={gstSchedules[1]} months={MONTHS} num={num} />}
          {span === "months" && monthly.negative.length > 0 && (
            <div className="mt-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px]">
              <b className="text-bad">The bank account goes below zero</b>
              <span className="ml-2 text-muted-foreground">
                In {monthly.negative.length === 1 ? MONTHS[monthly.negative[0] - 1] : `${monthly.negative.length} months — ${monthly.negative.map((m) => MONTHS[m - 1]).join(", ")}`}.
                {" "}The year still closes on {num(monthly.total.closingCash)}, which is exactly why the annual column cannot be trusted on its own.
              </span>
            </div>
          )}
        </>
      )}

      {area === "balance" && (
        <>
          <Toolbar><Meta className="ml-0">
            {failures.some((f) => f.key === "balance-sheet-equation")
              ? <span className="text-bad">The balance sheet does not balance — see the checks above.</span>
              : <>Balances in every year · Year 5 equity {num(bs[5].equity)}</>}
          </Meta></Toolbar>
          <Statement rows={[
            ["Cash", (y) => bs[y].cash, "head"],
            ["Debtors", (y) => bs[y].accountsReceivable],
            ["Stock and work in progress", (y) => bs[y].inventory],
            ["Prepayments", (y) => bs[y].prepaid],
            ...(gst.registered ? [[`${gstLabel} refund due`, (y: number) => bs[y].gstReceivable] as StatementRow] : []),
            ["Other current assets", (y) => bs[y].otherCurrentAssets],
            ["Current assets", (y) => bs[y].currentAssets, "sub"],
            ["Fixed assets", (y) => bs[y].fixedAssets],
            ["Other non-current assets", (y) => bs[y].otherNonCurrentAssets],
            ["Total assets", (y) => bs[y].totalAssets, "total"],
            ["Creditors", (y) => bs[y].accountsPayable],
            ["Accruals", (y) => bs[y].accrued],
            ["Tax owing", (y) => bs[y].taxPayable],
            ...(gst.registered ? [[`${gstLabel} owing`, (y: number) => bs[y].gstPayable] as StatementRow] : []),
            ["Loans due within a year", (y) => bs[y].debtCurrent],
            ["Other current liabilities", (y) => bs[y].otherCurrentLiabilities],
            ["Current liabilities", (y) => bs[y].currentLiabilities, "sub"],
            ["Loans due later", (y) => bs[y].debtNonCurrent],
            ["Other non-current liabilities", (y) => bs[y].otherNonCurrentLiabilities],
            ["Total liabilities", (y) => bs[y].totalLiabilities, "sub"],
            ["Equity", (y) => bs[y].equity],
            ["Liabilities and equity", (y) => bs[y].totalLiabilitiesAndEquity, "total"],
          ]} num={num} />
        </>
      )}

      {area === "assumptions" && (
        <>
          <Toolbar><Meta className="ml-0">
            {assumptionsSet
              ? <>How fast money comes in and goes out. Every figure on the cash flow moves with these.</>
              : <span className="text-warn">Not set yet — the forecast is using {impliedFromHistory ? "days implied by your history" : "30 days in, 30 days out"}. Check them against how the business actually trades.</span>}
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "28%" }}>Assumption</Th>
              {FORECAST_YEARS.map((y) => <Th key={y} right style={{ width: 130 }}>Year {y}</Th>)}
            </tr></thead>
            <tbody>
              <DaysRow label="Debtor days" hint="How long clients take to pay. Each day holds this much in debtors."
                value={(y) => wc[y].debtorDays} onChange={(y, v) => setDays(y, "debtorDays", v)} onBlur={() => save()}
                worth={(y) => debtorBalance(revenue[y - 1], wc[y].debtorDays)} num={num} pending={pending} />
              <DaysRow label="Stock days" hint="How long stock and work in progress sit before they are sold."
                value={(y) => wc[y].inventoryDays} onChange={(y, v) => setDays(y, "inventoryDays", v)} onBlur={() => save()}
                worth={(y) => inventoryBalance(cogs[y - 1], wc[y].inventoryDays)} num={num} pending={pending} />
              <DaysRow label="Creditor days" hint="How long you take to pay suppliers. Longer is cash in your pocket."
                value={(y) => wc[y].creditorDays} onChange={(y, v) => setDays(y, "creditorDays", v)} onBlur={() => save()}
                worth={(y) => creditorBalance(cogs[y - 1], wc[y].creditorDays)} num={num} pending={pending} />
              <GridRow>
                <Td><b>Tax paid in year</b><span className="ml-2 text-[11.5px] text-muted-foreground">What is left is owed at year end.</span></Td>
                {FORECAST_YEARS.map((y) => (
                  <Td key={y} right>
                    <span className="relative block">
                      <Input inputMode="decimal" disabled={pending} className={cn(box, "num pr-6 text-right")}
                        value={String(ct[y].taxPaidPct)} onChange={(e) => setTiming(y, "taxPaidPct", e.target.value)} onBlur={() => save()} />
                      <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </span>
                  </Td>
                ))}
              </GridRow>
              <MoneyRow label="Prepayments at year end" hint="Paid in advance — insurance, rent, registrations."
                value={(y) => ct[y].prepaidClosing} onChange={(y, v) => setTiming(y, "prepaidClosing", v)} onBlur={() => save()} pending={pending} />
              <MoneyRow label="Accruals at year end" hint="Incurred but not yet billed to you."
                value={(y) => ct[y].accruedClosing} onChange={(y, v) => setTiming(y, "accruedClosing", v)} onBlur={() => save()} pending={pending} />
            </tbody>
          </Grid>
          <Note>
            {impliedFromHistory
              ? <>Your own accounts imply {impliedFromHistory.debtorDays} debtor days, {impliedFromHistory.inventoryDays} stock days and {impliedFromHistory.creditorDays} creditor days. A forecast that assumes better terms than the business has ever achieved is the first thing a lender questions.</>
              : <>With no history to read, these start at ordinary trade terms. They are assumptions, not facts — change them to what you can actually collect and actually pay.</>}
          </Note>
        </>
      )}
    </ModuleFrame>
  );
}

/** Whether the three statements agree, said before any figure is read rather than buried under them. */
function Reconciled({ failures }: { failures: Forecast["invariants"] }) {
  const num = useMoney();
  if (!failures.length) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded border border-good/40 bg-good-soft px-3 py-1.5 text-[12.5px]">
        <b className="text-good">✓ The statements agree</b>
        <span className="text-muted-foreground">The balance sheet balances, profit explains the cash, and each year opens where the last one closed — in all five years.</span>
      </div>
    );
  }
  const byKey = new Map<string, { label: string; years: number[]; worst: number }>();
  for (const f of failures) {
    const e = byKey.get(f.key) ?? { label: f.label, years: [], worst: 0 };
    e.years.push(f.year);
    if (Math.abs(f.difference) > Math.abs(e.worst)) e.worst = f.difference;
    byKey.set(f.key, e);
  }
  return (
    <div className="mb-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px]">
      <b className="text-bad">The statements do not agree</b>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {[...byKey.values()].map((e) => (
          <li key={e.label}>
            {e.label} — fails in {e.years.length === 5 ? "every year" : `Year ${e.years.join(", ")}`}, out by {num(Math.abs(e.worst))} at worst
          </li>
        ))}
      </ul>
    </div>
  );
}

type StatementRow = [string, (y: number) => number, ("head" | "sub" | "total")?];

/** Five years across, one line per row. Money out shows in brackets, the convention a lender reads. */
function Statement({ rows, num }: { rows: StatementRow[]; num: (v: number) => string }) {
  const money = (v: number) => (v < 0 ? `(${num(Math.abs(v))})` : v === 0 ? "—" : num(v));
  return (
    <Grid>
      <thead><tr>
        <Th style={{ width: "30%" }} />
        {FORECAST_YEARS.map((y) => <Th key={y} right style={{ width: 130 }}>Year {y}</Th>)}
      </tr></thead>
      <tbody>
        {rows.map(([label, get, weight]) => weight === "total" ? (
          // A statement's totals are not table footers: Net profit has Dividends under it (§6.40.1).
          <tr key={label} className={TOTAL_ROW}>
            <Td>{label}</Td>
            {FORECAST_YEARS.map((y) => <Td key={y} right className="num">{money(get(y))}</Td>)}
          </tr>
        ) : (
          <GridRow key={label} className={cn(weight === "sub" && "bg-secondary/50")}>
            <Td className={cn(weight ? "font-semibold" : "text-muted-foreground")}>{label}</Td>
            {FORECAST_YEARS.map((y) => {
              const v = get(y);
              return <Td key={y} right className={cn("num", weight && "font-semibold", v < 0 && "text-bad")}>{money(v)}</Td>;
            })}
          </GridRow>
        ))}
      </tbody>
    </Grid>
  );
}

/** A number of days, with what that many days is actually worth underneath it. */
function DaysRow({ label, hint, value, onChange, onBlur, worth, num, pending }: {
  label: string; hint: string; value: (y: number) => number; onChange: (y: number, v: string) => void;
  onBlur: () => void; worth: (y: number) => number; num: (v: number) => string; pending: boolean;
}) {
  return (
    <GridRow>
      <Td><b>{label}</b><span className="ml-2 text-[11.5px] text-muted-foreground">{hint}</span></Td>
      {FORECAST_YEARS.map((y) => (
        <Td key={y} right>
          <Input inputMode="numeric" disabled={pending} className={cn(box, "num text-right")}
            value={String(value(y))} onChange={(e) => onChange(y, e.target.value)} onBlur={onBlur} />
          <div className="mt-0.5 text-right text-[11px] text-muted-foreground num">{num(worth(y))}</div>
        </Td>
      ))}
    </GridRow>
  );
}

function MoneyRow({ label, hint, value, onChange, onBlur, pending }: {
  label: string; hint: string; value: (y: number) => number;
  onChange: (y: number, v: string) => void; onBlur: () => void; pending: boolean;
}) {
  return (
    <GridRow>
      <Td><b>{label}</b><span className="ml-2 text-[11.5px] text-muted-foreground">{hint}</span></Td>
      {FORECAST_YEARS.map((y) => (
        <Td key={y} right>
          <Input inputMode="decimal" disabled={pending} className={cn(box, "num text-right")}
            value={String(value(y))} onChange={(e) => onChange(y, e.target.value)} onBlur={onBlur} />
        </Td>
      ))}
    </GridRow>
  );
}

/** Five years, or the twelve months inside the first one. One statement, two spans. */
function SpanToggle({ span, onSpan }: { span: "years" | "months"; onSpan: (s: "years" | "months") => void }) {
  return (
    <div className="ml-auto inline-flex overflow-hidden rounded border border-input">
      {(["years", "months"] as const).map((k) => (
        <button key={k} type="button" onClick={() => onSpan(k)}
          aria-pressed={span === k}
          className={cn("px-2.5 py-1 text-[12px] leading-none",
            span === k ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-secondary")}>
          {k === "years" ? "Five years" : "Year 1 by month"}
        </button>
      ))}
    </div>
  );
}

/**
 * The twelve months of Year 1, with the year beside them (§6.36). The total column is not decoration: it is
 * the same figure the five-year view shows in its Year 1 column, so the client can see the two agree instead
 * of being told they do.
 */
function MonthlyStatement({ monthly, months, num, registered, gstLabel }: {
  monthly: MonthlyCashFlow; months: string[]; num: (v: number) => string;
  registered: boolean; gstLabel: string;
}) {
  const money = (v: number) => (v < 0 ? `(${num(Math.abs(v))})` : v === 0 ? "—" : num(v));
  const rows: [string, (m: MonthCash) => number, (t: MonthlyCashFlow["total"]) => number, ("head" | "sub" | "total")?][] = [
    ["Opening cash", (m) => m.openingCash, (t) => t.openingCash, "head"],
    ["Received from customers", (m) => m.receiptsFromCustomers, (t) => t.receiptsFromCustomers],
    ["One-off receipts", (m) => m.extraordinaryReceipts, (t) => t.extraordinaryReceipts],
    ["Paid to suppliers and staff", (m) => -m.paidToSuppliersAndEmployees, (t) => -t.paidToSuppliersAndEmployees],
    ["One-off payments", (m) => -m.extraordinaryPayments, (t) => -t.extraordinaryPayments],
    ["Tax paid", (m) => -m.taxPaid, (t) => -t.taxPaid],
    ...(registered
      ? [[`${gstLabel} paid over`, (m: MonthCash) => -m.gstRemitted, (t: MonthlyCashFlow["total"]) => -t.gstRemitted] as typeof rows[number]]
      : []),
    ["Operating cash flow", (m) => m.netOperating, (t) => t.netOperating, "sub"],
    ["Assets bought", (m) => -m.capex, (t) => -t.capex],
    ["Assets sold", (m) => m.disposalProceeds, (t) => t.disposalProceeds],
    ["Investing cash flow", (m) => m.netInvesting, (t) => t.netInvesting, "sub"],
    ["Money borrowed", (m) => m.debtProceeds, (t) => t.debtProceeds],
    ["Money invested", (m) => m.equityRaised, (t) => t.equityRaised],
    ["Loan repayments", (m) => -m.debtRepaid, (t) => -t.debtRepaid],
    ["Interest paid", (m) => -m.interestPaid, (t) => -t.interestPaid],
    ["Dividends paid", (m) => -m.dividendsPaid, (t) => -t.dividendsPaid],
    ["Financing cash flow", (m) => m.netFinancing, (t) => t.netFinancing, "sub"],
    ["Movement in cash", (m) => m.netMovement, (t) => t.netMovement, "sub"],
    ["Closing cash", (m) => m.closingCash, (t) => t.closingCash, "total"],
  ];
  return (
    <Grid className="min-w-[1120px]">
      <thead><tr>
        {/* Thirteen columns do not fit a laptop, so the line name stays put while the year scrolls under it. */}
        <Th style={{ width: 190 }} className="sticky left-0 z-[2] border-r border-input" />
        {months.map((label, i) => (
          <Th key={label + i} right style={{ width: 72 }}
            className={cn(monthly.low.month === i + 1 && "text-foreground")}>
            {label}{monthly.low.month === i + 1 && <span aria-hidden className="ml-0.5">▼</span>}
          </Th>
        ))}
        <Th right style={{ width: 112 }} className="border-l border-input">Year 1</Th>
      </tr></thead>
      <tbody>
        {rows.map(([label, get, total, weight]) => {
          const cells = monthly.months.map((m) => get(m));
          const body = (
            <>
              {/* Opaque, and the table's own white — not the page grey — or the pinned column reads as a band. */}
              <Td className={cn("sticky left-0 z-[1] border-r border-input",
                weight === "sub" || weight === "total" ? "bg-secondary font-semibold" : "bg-card",
                weight === "head" && "font-semibold", !weight && "text-muted-foreground")}>{label}</Td>
              {cells.map((v, i) => (
                <Td key={i} right className={cn("num", weight && "font-semibold",
                  v < 0 && "text-bad",
                  label === "Closing cash" && monthly.months[i].closingCash < 0 && "font-semibold text-destructive")}>
                  {money(v)}
                </Td>
              ))}
              <Td right className={cn("num border-l border-input font-semibold")}>{money(total(monthly.total))}</Td>
            </>
          );
          // A plain row, not GridRow: its hover tint is translucent, and a translucent pinned cell shows the
          // months scrolling underneath it. Nothing on a statement is clickable, so the hover bought nothing.
          return <tr key={label} className={cn(weight === "total" ? TOTAL_ROW : weight === "sub" && "[&>td]:bg-secondary")}>{body}</tr>;
        })}
      </tbody>
    </Grid>
  );
}

/**
 * What the twelve months actually say, in a sentence that cannot come out meaningless. "Tightest in June" is
 * no reading at all when June is simply the last month of a year that falls every single month — that is a
 * business burning cash, and it should be told so.
 */
function cashShape(monthly: MonthlyCashFlow, months: string[], num: (v: number) => string) {
  const closes = monthly.months.map((m) => m.closingCash);
  const falls = closes.every((v, i) => i === 0 || v <= closes[i - 1]);
  const rises = closes.every((v, i) => i === 0 || v >= closes[i - 1]);
  const low = months[monthly.low.month - 1];
  if (falls) return <>down every month, from {num(closes[0])} to {num(closes[11])}</>;
  if (rises) return <>up every month, from {num(closes[0])} to {num(closes[11])}</>;
  return <>closes on {num(monthly.total.closingCash)} · tightest in {low} at {num(monthly.low.closingCash)}</>;
}

/**
 * The two things the profit and loss does that a client did not ask for, said out loud. Both are ordinary
 * law and ordinary tax, and both change the figure they were expecting — so neither gets to be silent.
 */
function TaxNotes({ pnl, num }: { pnl: Forecast["pnl"]; num: (v: number) => string }) {
  const relieved = FORECAST_YEARS.filter((y) => pnl[y].lossRelief > 0);
  const carried = FORECAST_YEARS.filter((y) => pnl[y].lossesCarriedForward > 0);
  const withheld = FORECAST_YEARS.filter((y) => pnl[y].dividendsWithheld > 0);
  if (!relieved.length && !carried.length && !withheld.length) return null;
  const list = (ys: number[]) => (ys.length === 1 ? `Year ${ys[0]}` : `Years ${ys.join(", ")}`);
  return (
    <Note>
      {relieved.length > 0 && (
        <>Losses from earlier years come off the profit in {list(relieved)}, so the tax is charged on what is
          left rather than on the whole year.{" "}</>
      )}
      {carried.length > 0 && (
        <><b>{num(pnl[carried[carried.length - 1]].lossesCarriedForward)}</b> of losses is still unrelieved at
          the end of {list([carried[carried.length - 1]])}.{" "}</>
      )}
      {withheld.length > 0 && (
        <span className="text-warn">
          The dividend policy asks for more than the company has made: {num(withheld.reduce((a, y) => a + pnl[y].dividendsWithheld, 0))}
          {" "}could not be paid across {list(withheld)}, because a dividend can only come out of accumulated
          profit. Set the accumulated profit the business starts with in Plan settings if it has reserves already.
        </span>
      )}
    </Note>
  );
}

/**
 * What the tax is doing to the cash, in a sentence. The figure that surprises a client is never the rate —
 * it is how much of the bank balance was never theirs, and which month it leaves in (§6.38).
 */
function GstNote({ components, label, schedule, months, num }: {
  components: { label: string; rate: number; frequency: string; reclaimable: boolean }[];
  label: string; schedule: GstSchedule | undefined; months: string[]; num: (v: number) => string;
}) {
  if (!schedule || !components.length) return null;
  const due = schedule.months.filter((m) => m.remitted !== 0);
  const refunds = due.filter((m) => m.remitted < 0);
  const owed = schedule.closingPayable;
  const notReclaimed = components.filter((c) => !c.reclaimable);
  const many = components.length > 1;
  /**
   * A monthly filer settles in eleven of the twelve months, and listing them all reads as noise rather than
   * information. Past a handful, say the shape instead of the months (§6.39.1).
   */
  const when = due.length > 4
    ? "every month but the first"
    : due.map((m) => months[m.month - 1]).join(", ");
  return (
    <Note>
      {components.map((c) => `${c.label} at ${c.rate}%, filed ${c.frequency}`).join(" · ")}.{" "}
      {due.length > 0 && <>
        {label} {many ? "settle" : "settles"} in {when}
        {refunds.length > 0 && <> — {refunds.length === 1 ? "one of those is a refund coming back" : `${refunds.length} of those are refunds coming back`}</>}.{" "}
      </>}
      {owed > 0
        ? <><b>{num(owed)}</b> is still owed at the end of Year 1 and is sitting in the bank. It is on the balance sheet as {label} owing, not as cash.</>
        : owed < 0
          ? <><b>{num(-owed)}</b> is owed back to the business at the end of Year 1, shown as a refund due.</>
          : <>Nothing is outstanding at the end of Year 1.</>}
      {notReclaimed.length > 0 && (
        <> {notReclaimed.map((c) => c.label).join(" and ")} {notReclaimed.length === 1 ? "is" : "are"} charged
          on sales but never claimed back on purchases, so what the business pays on its own buying is part
          of the cost rather than a credit.</>
      )}
      {" "}Sales and costs everywhere else in the plan are tax-exclusive, so this has not changed the profit by a cent.
    </Note>
  );
}
