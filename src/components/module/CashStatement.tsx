"use client";

/**
 * The cash flow's own furniture (§6.78).
 *
 * The twelve-month statement, the tax note and the facility strip were written inside ForecastModule when
 * the cash flow was a tab on it. The cash flow is its own module now, and Review forecast still needs none
 * of them — so rather than leave four components in a file that no longer renders them, they move here,
 * where the module that uses them can import them and a second module could too.
 *
 * Same rule §6.76 applied to `Statement`: the moment two files would need the same rows is the moment to
 * extract them, and a component left behind in the file it was born in is a paste waiting to happen.
 */
import { Grid, Th, Td, TOTAL_ROW, Note } from "@/components/module/DataGrid";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS } from "@/engine/forecast/model";
import type { MonthCash, MonthlyCashFlow } from "@/engine/forecast/monthly";
import type { OverdraftRun } from "@/engine/funding/overdraft";
import type { GstSchedule } from "@/engine/plan/gst";

/**
 * The twelve months of Year 1, with the year beside them (§6.36). The total column is not decoration: it is
 * the same figure the five-year view shows in its Year 1 column, so the client can see the two agree instead
 * of being told they do.
 */
export function MonthlyStatement({ monthly, months, num, registered, gstLabel }: {
  monthly: MonthlyCashFlow; months: string[]; num: (v: number) => string;
  registered: boolean; gstLabel: string;
}) {
  const money = (v: number) => (v < 0 ? `(${num(Math.abs(v))})` : v === 0 ? "—" : num(v));
  const rows: [string, (m: MonthCash) => number, (t: MonthlyCashFlow["total"]) => number, ("head" | "sub" | "total")?][] = [
    ["Opening cash", (m) => m.openingCash, (t) => t.openingCash, "head"],
    ["Received from customers", (m) => m.receiptsFromCustomers, (t) => t.receiptsFromCustomers],
    ["Grants received", (m) => m.grantsReceived, (t) => t.grantsReceived],
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
export function cashShape(monthly: MonthlyCashFlow, months: string[], num: (v: number) => string) {
  const closes = monthly.months.map((m) => m.closingCash);
  const falls = closes.every((v, i) => i === 0 || v <= closes[i - 1]);
  const rises = closes.every((v, i) => i === 0 || v >= closes[i - 1]);
  const low = months[monthly.low.month - 1];
  if (falls) return <>down every month, from {num(closes[0])} to {num(closes[11])}</>;
  if (rises) return <>up every month, from {num(closes[0])} to {num(closes[11])}</>;
  return <>closes on {num(monthly.total.closingCash)} · tightest in {low} at {num(monthly.low.closingCash)}</>;
}

/**
 * What the tax is doing to the cash, in a sentence. The figure that surprises a client is never the rate —
 * it is how much of the bank balance was never theirs, and which month it leaves in (§6.38).
 */
export function GstNote({ components, label, schedule, months, num }: {
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

/**
 * What the facility actually did (§6.72.2).
 *
 * The engine has known all of this since the sweep was wired in and no screen said a word: how deep the
 * business goes, when, what it costs, and whether the limit was enough. A facility used silently is no
 * better than one modelled wrongly — the whole reason to put an overdraft in a plan is to find out.
 *
 * It sits on the cash flow rather than on Funding because that is the statement it changes, and because
 * Funding builds its own Year 1 cash check and has never run the five-year forecast.
 */
export function FacilityStrip({ od, num, months }: { od: OverdraftRun; num: (v: number) => string; months: string[] }) {
  const cost = od.totalInterest + od.totalFees;
  const drew = od.peak.month > 0 && od.peak.drawn > 0;
  const name = od.facilities.length === 1 ? od.facilities[0].name : `${od.facilities.length} facilities`;
  return (
    <div className="border-b border-border px-5 py-2.5 text-[12.5px]">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground">Limit <b className="num text-foreground">{num(od.limit)}</b></span>
        {/* "Deepest never drawn" is not a sentence. A facility that was never used has no deepest point. */}
        {drew && (
          <span className="text-muted-foreground">
            Deepest <b className="num text-foreground">{num(od.peak.drawn)}</b> in {months[(od.peak.month - 1) % 12]} of Year {Math.ceil(od.peak.month / 12)}
          </span>
        )}
        <span className="text-muted-foreground">Costs <b className="num text-foreground">{num(cost)}</b> over five years</span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-muted-foreground">
        <span>Owing at each year end:</span>
        {FORECAST_YEARS.map((y) => (
          <span key={y} className="num">Y{y} <b className={cn(od.byYear[y].closingDrawn > 0 ? "text-foreground" : "text-faint")}>{num(od.byYear[y].closingDrawn)}</b></span>
        ))}
      </div>
      {od.short.length > 0 ? (
        /* The number a lender reaches for. Not "check your facility" — by how much, and from when. */
        <div className="mt-1.5 text-bad">
          <b>The facility is not big enough.</b> Even drawn to its limit the plan is still short — by{" "}
          <b className="num">{num(Math.max(...od.months.map((m) => m.shortfall)))}</b> at its worst, in{" "}
          {od.short.length === 1 ? "one month" : `${od.short.length} months`}, from month {od.short[0]}.
        </div>
      ) : drew ? (
        <div className="mt-1.5 text-muted-foreground">
          The limit covers every month of the plan, with <b className="num text-foreground">{num(od.limit - od.peak.drawn)}</b> to spare at the deepest point.
        </div>
      ) : (
        <div className="mt-1.5 text-muted-foreground">Never drawn on — the plan pays its own way every month{cost > 0 ? ", though the facility still costs its fee" : ""}.</div>
      )}
    </div>
  );
}
