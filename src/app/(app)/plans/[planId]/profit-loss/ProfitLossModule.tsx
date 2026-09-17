"use client";

import { useState } from "react";
import { ModuleFrame, ModuleStatusFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, TOTAL_ROW, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { Statement, TaxNotes } from "@/components/module/Statement";
import { ChartBox, Meter, StatTile, TileRow, type Severity } from "@/components/chart/core";
import { BarRows, Lines, Trend } from "@/components/chart/plots";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type PnlYear } from "@/engine/forecast/model";
import type { PnlMonth, ServiceProfit } from "@/engine/pnl/lines";
import type { Noun } from "@/engine/plan/vocabulary";

type AreaKey = "year" | "months" | "service";

const pct = (v: number | null) => (v === null ? "\u2014" : `${v.toFixed(1)}%`);
/** A margin is not a status, but a loss is. Only the sign earns a colour. */
const tone = (v: number): Severity | undefined => (v < 0 ? "bad" : undefined);

/**
 * Profit & Loss, its own module (§6.76).
 *
 * It was a tab on Review forecast: a one-line toolbar and a five-year table, no tiles, no chart, no way to
 * see when inside a year the profit happens or which line earns it — the least developed screen in the app
 * and the statement a lender opens first. Break-Even, one menu item away, had all of it.
 *
 * §6.32.3 put the three statements on one module bar because "three statements that must agree belong on
 * one screen". The guarantee there was never the adjacency, it was the CHECK: the reconciliation strip
 * above every tab, saying whether they agree before a figure is read. So the strip travels here too, and
 * §6.32.3 keeps what it was actually protecting.
 */
export function ProfitLossModule({
  planId, mode, noun, pnl, months, services, monthNames, yearLabels, reconciled, initialArea,
}: {
  planId: string; mode: "guided" | "advanced"; noun: Noun;
  pnl: Record<number, PnlYear>;
  months: PnlMonth[]; services: ServiceProfit[];
  monthNames: string[]; yearLabels: string[]; reconciled: boolean; initialArea: AreaKey;
}) {
  const money = useMoney();
  /**
   * Money out in brackets — the convention a lender reads, and the one the statement below these tiles has
   * always used. A tile saying -87,248 above a table saying (87,248) is one screen with two habits.
   */
  const signed = (v: number) => (v < 0 ? `(${money(Math.abs(v))})` : money(v));
  const [area, setArea] = useState<AreaKey>(initialArea);
  const y1 = pnl[1];
  const worstMonth = months.reduce((best, m) => (m.operatingProfit < best.operatingProfit ? m : best), months[0]);
  const monthsInProfit = months.filter((m) => m.operatingProfit > 0).length;

  return (
    <ModuleFrame
      group="Forecasts" title="Profit &amp; Loss" subtitle="What the business earns, what it costs, and what is left"
      mode={mode}
      areas={[
        { key: "year", label: "The year" },
        { key: "months", label: "Month by month" },
        { key: "service", label: `By ${noun.one}`, count: services.length },
      ]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Gross margin</b> is the line a lender tests first: what is left of every dollar after the cost of delivering it. It is the one figure that says whether the business model works at all, before a single overhead is argued about.</p>
        <p><b>Month by month</b> stops at operating profit on purpose. Tax is charged on a year, loss relief is given against a year, a dividend is declared once — spreading them across twelve months would mean inventing twelve figures from one.</p>
        <p><b>By {noun.one}</b> stops at gross profit, for the same kind of reason: overheads cannot be split across lines without inventing a basis nobody agreed to. What a line earns above the cost of delivering it is the honest end of that table.</p>
        <h3>Where this goes</h3>
        <p>The profit and loss in every report, and the figures the break-even and the cash flow are both built from. If the reconciliation strip above says the statements agree, this and the cash flow are two readings of one plan rather than two plans.</p>
      </>}
    >
      {!reconciled && (
        <Note><span className="text-bad">The forecast has a check that is not balancing, so these figures cannot be relied on yet — <b>Review forecast</b> shows which.</span></Note>
      )}

      {area === "year" && (
        <>
          <TileRow>
            <StatTile label="Revenue" value={money(y1.revenue)} sub={`Year 1 · ${yearLabels.length} years planned`} />
            <StatTile label="Gross margin" value={pct(y1.grossMargin)} tone={y1.grossMargin !== null && y1.grossMargin < 0 ? "bad" : undefined}
              sub={`${money(y1.grossProfit)} after the cost of sales`}>
              <Meter pct={y1.grossMargin === null ? null : Math.max(0, Math.min(100, y1.grossMargin))}
                severity={y1.grossMargin !== null && y1.grossMargin < 0 ? "bad" : "accent"} label={`Gross margin ${pct(y1.grossMargin)}`} />
            </StatTile>
            <StatTile label="Operating profit" value={signed(y1.operatingProfit)} tone={tone(y1.operatingProfit)}
              sub="Trading, before one-offs, interest and tax" />
            <StatTile label="Net profit" value={signed(y1.netProfit)} tone={tone(y1.netProfit)}
              sub={y1.netProfit < 0 ? "A loss in Year 1" : "After tax"} />
          </TileRow>

          <ChartBox title="Revenue, gross profit and net profit" height={216}
            note="The gap between the lines is the cost story: revenue that grows while the bottom line flattens shows here before it shows anywhere else.">
            {(w) => (
              <Lines width={w} height={216} categories={yearLabels} format={money}
                series={[
                  { label: "Revenue", values: FORECAST_YEARS.map((y) => pnl[y].revenue) },
                  { label: "Gross profit", values: FORECAST_YEARS.map((y) => pnl[y].grossProfit) },
                  { label: "Net profit", values: FORECAST_YEARS.map((y) => pnl[y].netProfit) },
                ]} />
            )}
          </ChartBox>

          <Statement rows={[
            ["Revenue", (y) => pnl[y].revenue, "head"],
            ["Cost of sales", (y) => -pnl[y].cogs],
            ["Gross profit", (y) => pnl[y].grossProfit, "sub"],
            ["Overheads", (y) => -pnl[y].overheads],
            ["Depreciation", (y) => -pnl[y].depreciation],
            ["Operating profit", (y) => pnl[y].operatingProfit, "sub"],
            ["Grant income", (y) => pnl[y].grantIncome],
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
          ]} num={money} />
          <TaxNotes pnl={pnl} num={money} />
        </>
      )}

      {area === "months" && (
        <>
          <TileRow>
            <StatTile label="Months in profit" value={`${monthsInProfit} of 12`}
              tone={monthsInProfit === 0 ? "bad" : monthsInProfit < 6 ? "warn" : "good"}
              sub="Operating profit above nil" />
            <StatTile label="Worst month" value={signed(worstMonth.operatingProfit)} tone={tone(worstMonth.operatingProfit)}
              sub={monthNames[worstMonth.month - 1]} />
            <StatTile label="Year 1 revenue" value={money(y1.revenue)} sub="The twelve months below add to this" />
            <StatTile label="Year 1 operating profit" value={signed(y1.operatingProfit)} tone={tone(y1.operatingProfit)}
              sub="Trading only — tax and one-offs are annual" />
          </TileRow>

          {/*
            * ONE line, and the zero baseline does the rest (§6.76.3).
            *
            * This has now been three shapes. Two lines made the reader measure the gap themselves. Bars
            * with a cost rule borrowed Break-Even's form, and it did not travel: that chart has five bars
            * whose thresholds genuinely differ, this one has twelve near-identical pairs — on a plan with
            * an even monthly split the rule sits a hair above every bar and the whole thing reads as noise.
            *
            * The tab is about one number. Every tile above says so: months in profit, worst month, the
            * year's operating profit. So the chart says the same one thing, and `Trend` fills between the
            * line and nil — which on a profit line means the shaded area below zero IS the loss. Revenue is
            * the first row of the table directly beneath and does not need drawing twice.
            */}
          <ChartBox title="Operating profit by month" height={216}
            note="Revenue less the cost of sales, overheads and depreciation, in the month each falls. Anything below the line at nil is a month that cost more than it earned.">
            {(w) => (
              <Trend width={w} height={216} categories={monthNames.map((m) => m.slice(0, 3))}
                values={months.map((m) => m.operatingProfit)} cross={null} format={money} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">
            Year 1, month by month, down to <b>operating profit</b>. Tax, one-offs and dividends belong to a
            year and are not split across it — the five-year table above carries those.
          </Meta></Toolbar>
          {/* Thirteen columns do not fit a laptop, so the line name stays put while the year scrolls under it. */}
          <div className="overflow-x-auto">
            <Grid className="min-w-[1250px]">
              <thead><tr>
                <Th style={{ width: 180 }} className="sticky left-0 z-[2] border-r border-input" />
                {monthNames.map((m, i) => <Th key={m + i} right style={{ width: 86 }}>{m.slice(0, 3)}</Th>)}
                <Th right style={{ width: 104 }} className="border-l border-input">Year 1</Th>
              </tr></thead>
              <tbody>
                {([
                  ["Revenue", (m: PnlMonth) => m.revenue, "head"],
                  ["Cost of sales", (m: PnlMonth) => -m.cogs, undefined],
                  ["Gross profit", (m: PnlMonth) => m.grossProfit, "sub"],
                  ["Overheads", (m: PnlMonth) => -m.overheads, undefined],
                  ["Depreciation", (m: PnlMonth) => -m.depreciation, undefined],
                  ["Operating profit", (m: PnlMonth) => m.operatingProfit, "total"],
                ] as [string, (m: PnlMonth) => number, "head" | "sub" | "total" | undefined][]).map(([label, get, weight]) => {
                  const total = months.reduce((a, m) => a + get(m), 0);
                  const cell = (v: number) => (v < 0 ? `(${money(Math.abs(v))})` : v === 0 ? "—" : money(v));
                  return (
                    <GridRow key={label} className={cn(weight === "total" && TOTAL_ROW, weight === "sub" && "bg-secondary/50")}>
                      <Td className={cn("sticky left-0 z-[1] border-r border-input bg-card", weight ? "font-semibold" : "text-muted-foreground", weight === "sub" && "bg-secondary/50")}>{label}</Td>
                      {months.map((m) => {
                        const v = get(m);
                        return <Td key={m.month} right className={cn("num", weight && "font-semibold", v < 0 && "text-bad")}>{cell(v)}</Td>;
                      })}
                      <Td right className={cn("num border-l border-input font-semibold", total < 0 && "text-bad")}>{cell(total)}</Td>
                    </GridRow>
                  );
                })}
              </tbody>
            </Grid>
          </div>
        </>
      )}

      {area === "service" && (
        <>
          {services.length === 0 ? (
            <div className="px-5 py-10 text-[13px] text-muted-foreground">
              Nothing is selling in Year 1 yet. Add {noun.many} on Sales and set what they cost on COGS, and this fills in.
            </div>
          ) : (
            <>
              <TileRow>
                <StatTile label={`${noun.many} selling`} value={String(services.filter((s) => s.revenue > 0).length)}
                  sub={`of ${services.length} on the plan`} />
                <StatTile label="Best margin" value={pct(services.reduce((b, s) => (s.margin !== null && (b === null || s.margin > b) ? s.margin : b), null as number | null))}
                  sub={services.filter((s) => s.margin !== null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))[0]?.name ?? "—"} />
                <StatTile label="Earns the most" value={signed(services[0]?.grossProfit ?? 0)} sub={services[0]?.name ?? "—"} />
                <StatTile label="Losing money" value={String(services.filter((s) => s.grossProfit < 0).length)}
                  tone={services.some((s) => s.grossProfit < 0) ? "bad" : undefined}
                  sub={services.some((s) => s.grossProfit < 0) ? "Costs more to deliver than it earns" : "None — every line covers its own cost"} />
              </TileRow>

              <ChartBox title={`What each ${noun.one} line earns above its own cost`} height={services.length * 26 + 16}
                note="Gross profit in Year 1. Overheads are not split across lines, so this is where the table stops.">
                {(w) => <BarRows width={w} rows={services.map((s) => ({ label: s.name, value: s.grossProfit }))} format={money} />}
              </ChartBox>

              <Toolbar><Meta className="ml-0">
                Revenue less the cost of delivering it, line by line. <b>Overheads are deliberately not allocated</b> — splitting rent and wages across {noun.many} needs a basis nobody agreed to, so this table stops at gross profit rather than inventing one.
              </Meta></Toolbar>
              <Grid>
                <thead><tr>
                  <Th style={{ width: 280 }}>{noun.head}</Th>
                  <Th right style={{ width: 130 }}>Revenue</Th>
                  <Th right style={{ width: 130 }}>Cost of sales</Th>
                  <Th right style={{ width: 130 }}>Gross profit</Th>
                  <Th right style={{ width: 100 }}>Margin</Th>
                  <Th right style={{ width: 120 }}>Share of gross</Th>
                </tr></thead>
                <tbody>
                  {services.map((s) => (
                    <GridRow key={s.id ?? s.name}>
                      <Td>{s.name}{s.ongoing && <span className="ml-2 text-[11px] text-muted-foreground">ongoing</span>}</Td>
                      <Td right className="num">{money(s.revenue)}</Td>
                      <Td right className="num">{money(s.cogs)}</Td>
                      <Td right className={cn("num font-semibold", s.grossProfit < 0 && "text-bad")}>{money(s.grossProfit)}</Td>
                      <Td right className={cn("num", s.margin !== null && s.margin < 0 && "text-bad")}>{pct(s.margin)}</Td>
                      <Td right className="num text-muted-foreground">{pct(s.shareOfGross)}</Td>
                    </GridRow>
                  ))}
                  <GridRow className={TOTAL_ROW}>
                    <Td>Total</Td>
                    <Td right className="num">{money(services.reduce((a, s) => a + s.revenue, 0))}</Td>
                    <Td right className="num">{money(services.reduce((a, s) => a + s.cogs, 0))}</Td>
                    <Td right className="num">{money(services.reduce((a, s) => a + s.grossProfit, 0))}</Td>
                    <Td right className="num" />
                    <Td right className="num" />
                  </GridRow>
                </tbody>
              </Grid>
              <Note>
                This total is the <b>variable</b> cost of sales only. A fixed cost of sales — a yard, a production wage — belongs to no single {noun.one}, so it sits in the year&apos;s figures and not on any line here.
              </Note>
            </>
          )}
        </>
      )}
    </ModuleFrame>
  );
}
