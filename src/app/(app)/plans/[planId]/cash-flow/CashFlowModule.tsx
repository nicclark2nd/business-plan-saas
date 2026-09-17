"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModuleFrame, ModuleStatusFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, TOTAL_ROW, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { Statement, type StatementRow } from "@/components/module/Statement";
import { MonthlyStatement, GstNote, FacilityStrip, cashShape } from "@/components/module/CashStatement";
import { ChartBox, StatTile, TileRow } from "@/components/chart/core";
import { BarRows, Trend } from "@/components/chart/plots";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type CashFlowYear } from "@/engine/forecast/model";
import type { MonthlyCashFlow } from "@/engine/forecast/monthly";
import type { OverdraftRun } from "@/engine/funding/overdraft";
import type { GstSchedule } from "@/engine/plan/gst";
import type { BridgeLine } from "@/engine/cash/bridge";

type AreaKey = "years" | "months" | "bridge";

/**
 * Cash Flow, its own module (§6.78).
 *
 * The third and last of the three statements to leave Review forecast, after the profit and loss (§6.76)
 * and the balance sheet (§6.77). It is the statement a lender tests hardest — a profitable business that
 * runs out of cash in month seven is the ordinary way a good plan fails — and it had a toolbar, a span
 * toggle and a table.
 *
 * The third area is the one that was never anywhere. The engine has computed a full profit-to-cash bridge
 * for every year since the forecast was written, an invariant has checked it the whole time, and no screen
 * ever showed a line of it. A client handed a loss and a rising bank balance has been given both figures
 * and never the sentence joining them.
 */
export function CashFlowModule({
  planId, mode, cf, monthly, overdraft, bridge, bridgeTotals, netProfit, months, yearLabel, yearLabels,
  reconciled, gst, gstLabel, gstSchedules, gstComponents, initialArea,
}: {
  planId: string; mode: "guided" | "advanced";
  cf: Record<number, CashFlowYear>;
  monthly: MonthlyCashFlow;
  overdraft: OverdraftRun | null;
  bridge: Record<number, BridgeLine[]>;
  bridgeTotals: Record<number, number>;
  netProfit: Record<number, number>;
  months: string[]; yearLabel: string; yearLabels: string[];
  reconciled: boolean;
  gst: { registered: boolean }; gstLabel: string;
  gstSchedules: Record<number, GstSchedule>;
  gstComponents: { label: string; rate: number; frequency: string; reclaimable: boolean }[];
  initialArea: AreaKey;
}) {
  const money = useMoney();
  const signed = (v: number) => (v < 0 ? `(${money(Math.abs(v))})` : money(v));
  const router = useRouter();
  const [area, setArea] = useState<AreaKey>(initialArea);
  /** Which year the bridge explains. The question is asked about a year, so it is answered about one. */
  const [bridgeYear, setBridgeYear] = useState(1);

  const lowestClose = Math.min(...FORECAST_YEARS.map((y) => cf[y].closingCash));
  const lowestYear = FORECAST_YEARS.find((y) => cf[y].closingCash === lowestClose) ?? 1;
  const raised = cf[1].debtProceeds + cf[1].equityRaised;
  const worstOut = monthly.months.reduce((best, m) => (m.netMovement < best.netMovement ? m : best), monthly.months[0]);
  const lines = bridge[bridgeYear];
  /**
   * The chart draws the ADJUSTMENTS, never the profit it starts from.
   *
   * On BNE the profit is (136,681) and the largest adjustment is (21,084) — six times smaller. Put them on
   * one scale and the start bar takes the whole chart while every line that actually explains anything
   * becomes a sliver, which is the §6.76.3 fault again: a chart where the subject is unreadable because
   * something else is on it. The profit and the cash are the first two tiles; the chart's job is the five
   * lines between them.
   */
  const moves = lines.filter((l) => l.kind !== "start");
  const b = { profit: netProfit[bridgeYear], cash: bridgeTotals[bridgeYear] };

  return (
    <ModuleFrame
      group="Forecasts" title="Cash Flow" subtitle="What actually reaches the bank, and when"
      mode={mode}
      areas={[
        { key: "years", label: "The years" },
        { key: "months", label: "Month by month" },
        { key: "bridge", label: "Where the cash went" },
      ]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Operating cash flow</b> is the test. A business whose trading generates cash can survive a bad year; one that only closes up because money was put in has not proved anything yet, and a lender reads the two lines in that order.</p>
        <p><b>Month by month</b> is where a plan fails. The annual column can close on a healthy balance while the bank went below zero in month four — the year total cannot be trusted on its own, which is the whole reason this view exists.</p>
        <p><b>Interest is financing, not operating.</b> Money from selling an asset is investing, never revenue. A grant is operating: it is income the business earned, not money it raised.</p>
        <h3>Where the cash went</h3>
        <p>Profit and cash are different numbers for reasons that are all ordinary: depreciation is a cost no money left for, a sale counted as profit sits in debtors until it is paid, tax is charged in one year and paid in another. That tab lists every one of them for the year you pick, and they add to the operating cash flow above — because they are that figure, taken apart.</p>
      </>}
    >
      {!reconciled && (
        <Note><span className="text-bad">The forecast has a check that is not balancing, so these figures cannot be relied on yet — <b>Review forecast</b> shows which.</span></Note>
      )}

      {area === "years" && (
        <>
          <TileRow>
            <StatTile label="Cash at Year 1 end" value={signed(cf[1].closingCash)} tone={cf[1].closingCash < 0 ? "bad" : undefined}
              sub={`Opened on ${signed(cf[1].openingCash)}`} />
            <StatTile label="Lowest year end" value={signed(lowestClose)} tone={lowestClose < 0 ? "bad" : undefined}
              sub={`Year ${lowestYear}, over ${FORECAST_YEARS.length} years`} />
            <StatTile label="Operating cash flow" value={signed(cf[1].netOperating)} tone={cf[1].netOperating < 0 ? "bad" : undefined}
              sub={cf[1].netOperating < 0 ? "Year 1 trading consumed cash" : "Year 1 trading generated cash"} />
            <StatTile label="Money put in" value={money(raised)}
              sub={`Year 1 · ${money(cf[1].debtProceeds)} borrowed, ${money(cf[1].equityRaised)} invested`} />
          </TileRow>

          {/*
            * One line, and the baseline at nil is the bank going overdrawn — the same reasoning as §6.76.3.
            * There is exactly one question a five-year cash flow is asked, and it is "does it stay above
            * the line". The three flows that make it up are three rows of the table immediately beneath.
            */}
          <ChartBox title="Cash at the end of each year" height={216}
            note="Where the bank balance lands each year. Anything below the line at nil is a year the business cannot fund out of its own account.">
            {(w) => (
              <Trend width={w} height={216} categories={yearLabels}
                values={FORECAST_YEARS.map((y) => cf[y].closingCash)} cross={null} format={money} />
            )}
          </ChartBox>

          <Toolbar>
            <Meta className="ml-0">
              Year 1 closes on {money(cf[1].closingCash)} · lowest close over {FORECAST_YEARS.length} years {money(lowestClose)}
            </Meta>
            {/*
              * The door to Break-Even (§6.68.1) travels with the statement it was put on. This screen says
              * what happens; Break-Even says what has to happen for the business to pay for itself.
              */}
            <button type="button" onClick={() => router.push(`/plans/${planId}/break-even`)}
              className="ml-3 text-[12px] font-semibold text-primary hover:underline">
              Where it starts paying for itself →
            </button>
          </Toolbar>
          {overdraft && <FacilityStrip od={overdraft} num={money} months={months} />}
          <Statement rows={[
            ["Opening cash", (y) => cf[y].openingCash, "head"],
            ["Received from customers", (y) => cf[y].receiptsFromCustomers],
            ["Grants received", (y) => cf[y].grantsReceived],
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
          ]} num={money} />
          <Note>
            Interest is financing, not operating. Money from selling an asset is investing, never revenue. A
            grant is operating: it is income the business earned, not money it raised.
          </Note>
        </>
      )}

      {area === "months" && (
        <>
          <TileRow>
            <StatTile label="Tightest month" value={signed(monthly.low.closingCash)}
              tone={monthly.low.closingCash < 0 ? "bad" : monthly.low.closingCash < cf[1].openingCash / 2 ? "warn" : undefined}
              sub={months[monthly.low.month - 1]} />
            <StatTile label="Months below zero" value={`${monthly.negative.length} of 12`}
              tone={monthly.negative.length > 0 ? "bad" : "good"}
              sub={monthly.negative.length === 0 ? "The bank stays positive all year" : monthly.negative.map((m) => months[m - 1]).join(", ")} />
            <StatTile label="Worst month for cash" value={signed(worstOut.netMovement)}
              tone={worstOut.netMovement < 0 ? "bad" : undefined}
              sub={`${months[worstOut.month - 1]} · movement in the month`} />
            <StatTile label="Year 1 closing cash" value={signed(monthly.total.closingCash)}
              sub="The twelfth month, and the year's own figure" />
          </TileRow>

          <ChartBox title="Cash at the end of each month" height={216}
            note="The bank balance across Year 1. The annual column can close on a healthy figure while this line spends months underwater — that is the whole reason to look at it.">
            {(w) => (
              <Trend width={w} height={216} categories={months.map((m) => m.slice(0, 3))}
                values={monthly.months.map((m) => m.closingCash)} cross={null} format={money} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">{yearLabel} · {cashShape(monthly, months, money)}</Meta></Toolbar>
          {overdraft && <FacilityStrip od={overdraft} num={money} months={months} />}
          <div className="overflow-x-auto">
            <MonthlyStatement monthly={monthly} months={months} num={money} registered={gst.registered} gstLabel={gstLabel} />
          </div>
          <Note>
            The twelve add to Year 1 exactly — the column on the right is the same figure the five-year view
            shows. Debtors, stock and creditors move across the year on their own driver&rsquo;s shape, so a
            busy quarter builds receivables rather than a twelfth arriving each month. Tax is spread the way
            instalments fall; a dividend is taken in the last month, once the year&rsquo;s profit is known.
          </Note>
          {gst.registered && <GstNote components={gstComponents} label={gstLabel} schedule={gstSchedules[1]} months={months} num={money} />}
          {monthly.negative.length > 0 && (
            <div className="mt-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px]">
              <b className="text-bad">The bank account goes below zero</b>
              <span className="ml-2 text-muted-foreground">
                In {monthly.negative.length === 1 ? months[monthly.negative[0] - 1] : `${monthly.negative.length} months — ${monthly.negative.map((m) => months[m - 1]).join(", ")}`}.
                {" "}The year still closes on {money(monthly.total.closingCash)}, which is exactly why the annual column cannot be trusted on its own.
              </span>
            </div>
          )}
        </>
      )}

      {area === "bridge" && (
        <>
          <TileRow>
            <StatTile label="Net profit after tax" value={signed(b.profit)} tone={b.profit < 0 ? "bad" : undefined}
              sub={`Year ${bridgeYear}, where the profit and loss ends`} />
            <StatTile label="Operating cash flow" value={signed(b.cash)} tone={b.cash < 0 ? "bad" : undefined}
              sub="What the trading actually put in the bank" />
            <StatTile label="The difference" value={signed(b.cash - b.profit)}
              sub={b.cash > b.profit ? "Cash ahead of the profit" : b.cash < b.profit ? "Profit ahead of the cash" : "The two agree"} />
            <StatTile label="Lines explaining it" value={String(moves.length)}
              sub="Every one of them below, and they add up" />
          </TileRow>

          {/*
            * BarRows in the bridge's own order, not sorted. It does not sort internally, which is what makes
            * it usable here: a bridge read out of order is not a bridge. Direction carries in the colour —
            * a red bar is cash the profit claimed and the bank never saw.
            */}
          <ChartBox title={`What moved between the profit and the cash in Year ${bridgeYear}`} height={moves.length * 26 + 16}
            note="Each bar is one reason the two figures differ. Red is cash the profit claimed and the bank never saw; blue is the other way round. Together they turn the profit into the cash flow.">
            {(w) => <BarRows width={w} rows={moves.map((l) => ({ label: l.label, value: l.value }))} format={signed} />}
          </ChartBox>

          <Toolbar>
            <Meta className="ml-0">
              Why <b>{signed(b.profit)}</b> of profit is <b>{signed(b.cash)}</b> of cash. Every line is one the
              forecast already computed — this is that figure taken apart, not a second opinion on it.
            </Meta>
            <div className="ml-auto inline-flex overflow-hidden rounded border border-input">
              {FORECAST_YEARS.map((y) => (
                <button key={y} type="button" onClick={() => setBridgeYear(y)} aria-pressed={bridgeYear === y}
                  className={cn("px-2.5 py-1 text-[12px] leading-none",
                    bridgeYear === y ? "bg-primary font-semibold text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary")}>
                  Year {y}
                </button>
              ))}
            </div>
          </Toolbar>
          {/* The figure is the right-hand column, so on a narrow window this scrolls rather than clipping it. */}
          <div className="overflow-x-auto">
          <Grid>
            <thead><tr>
              <Th style={{ width: 260 }} />
              <Th>Why</Th>
              <Th right style={{ width: 150 }}>Effect on cash</Th>
            </tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <GridRow key={l.key} className={cn(i === 0 && "bg-secondary/50")}>
                  <Td className={cn(i === 0 ? "font-semibold" : "text-foreground")}>{l.label}</Td>
                  <Td className="text-muted-foreground">{l.why}</Td>
                  <Td right className={cn("num", i === 0 && "font-semibold", l.value < 0 && "text-bad")}>{signed(l.value)}</Td>
                </GridRow>
              ))}
              <GridRow className={TOTAL_ROW}>
                <Td>Operating cash flow</Td>
                <Td className="text-muted-foreground">The figure on the statement, reached the other way</Td>
                <Td right className={cn("num", b.cash < 0 && "text-bad")}>{signed(b.cash)}</Td>
              </GridRow>
            </tbody>
          </Grid>
          </div>
          <Note>
            None of these is a mistake or a choice — they are what it means to count profit when it is earned
            and cash when it moves. The two that a growing business feels hardest are <b>money owed to
            you</b> and <b>stock</b>: both are the business funding its own growth out of the bank, and both
            are set by the days on <b>Assumptions</b>.
          </Note>
        </>
      )}
    </ModuleFrame>
  );
}
