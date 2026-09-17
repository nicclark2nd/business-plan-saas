"use client";

import { useState } from "react";
import { ModuleFrame, ModuleStatusFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row, FootRow, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { useMoney } from "@/components/MoneyProvider";
import { ChartBox, Meter, StatTile, TileRow, compact, type Severity } from "@/components/chart/core";
import { BarRows, Columns, Trend } from "@/components/chart/plots";
import { safetyOf, type BreakEvenYear, type CashCrossover, type ServiceBreakEven } from "@/engine/breakeven/point";
import type { Noun } from "@/engine/plan/vocabulary";
import { cn } from "@/lib/utils";
import { navGroup } from "@/lib/nav";

type AreaKey = "year" | "months" | "service";
export type CashMonthRow = { month: number; netOperating: number; interestPaid: number };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 10) / 10}%`);
const TONE: Record<ReturnType<typeof safetyOf>, Severity> = {
  comfortable: "good", tight: "warn", exposed: "bad", none: "bad",
};
/**
 * What a COLUMN's colour means, which is not quite what the table's does. The table bands the margin of
 * safety three ways and red there means "under 10 %". On the chart red has to mean one thing only: this
 * year does not cover its costs. A year that clears break-even by a whisker is thin, not loss-making, and
 * painting it the same red as a year that loses money tells the client something untrue at a glance.
 */
const columnTone = (y: BreakEvenYear): Severity =>
  y.marginOfSafety === null || y.marginOfSafety < 0 ? "bad"
    : safetyOf(y.marginOfSafety) === "comfortable" ? "good" : "warn";

const SAFETY_WORDS: Record<ReturnType<typeof safetyOf>, string> = {
  comfortable: "Sales could fall this far before the plan stops paying for itself",
  tight: "Not much room — a soft quarter puts this year at break-even",
  exposed: "Very little room before this year stops covering its costs",
  none: "There is no break-even at this margin",
};

export function BreakEvenModule({
  planId, mode, noun, years, services, crossover, months, monthNames, yearLabels, yearEnding, reconciled, initialArea,
}: {
  planId: string; mode: "guided" | "advanced"; noun: Noun;
  years: BreakEvenYear[]; services: ServiceBreakEven[]; crossover: CashCrossover;
  months: CashMonthRow[]; monthNames: string[]; yearLabels: string[]; yearEnding: number;
  reconciled: boolean; initialArea: AreaKey;
}) {
  const money = useMoney();
  const [area, setArea] = useState<AreaKey>(initialArea);
  const y1 = years[0];
  const safety = safetyOf(y1.marginOfSafety);

  return (
    <ModuleFrame
      group={navGroup("break-even")} title="Break-Even" subtitle="What has to be sold before the business stops losing money"
      mode={mode}
      areas={[
        { key: "year", label: "The year" },
        { key: "months", label: "Month by month" },
        { key: "service", label: `By ${noun.one}`, count: services.length },
      ]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>Two break-evens, and they are not the same</h3>
        <p><b>The year</b> is profit. Fixed costs here are overheads, fixed cost of sales, depreciation and interest — so breaking even means covering everything, the bank included.</p>
        <p><b>Month by month</b> is cash: operating cash after interest, adding up through the year. Depreciation is not in it, because it never moved any money, and neither is anything you or a lender put in — an injection in March is not the business breaking even.</p>
        <p>The gap between the two is working capital: the months your customers take to pay, and the stock sitting on the floor.</p>
        <h3>Nothing here is typed</h3>
        <p>Every figure is read from the forecast. To move break-even you change a price on Sales, a cost on COGS, or a line on Overheads — and this follows.</p>
      </>}
    >
      {!reconciled && (
        <div className="border-b border-border bg-warn-soft px-5 py-2 text-[13px] text-warn">
          The forecast has a check that is not balancing, so these figures are built on numbers that do not yet agree. Review forecast shows which.
        </div>
      )}

      {area === "year" && (
        <>
          <TileRow>
            <StatTile label="Break-even revenue" value={y1.breakEvenRevenue === null ? "None" : money(y1.breakEvenRevenue)}
              sub={y1.breakEvenRevenue === null
                ? `Every sale loses money at this margin`
                : `Year 1 · you are planning ${money(y1.revenue)}`} />
            <StatTile label="Margin of safety" value={pct(y1.marginOfSafety)} tone={TONE[safety]}
              sub={SAFETY_WORDS[safety]}>
              <Meter pct={y1.marginOfSafety} severity={TONE[safety]} label={`Margin of safety ${pct(y1.marginOfSafety)}`} />
            </StatTile>
            <StatTile label="Contribution" value={pct(y1.contributionRate)}
              sub="Of every sale, this much is left to pay the fixed costs" />
            <StatTile label="Fixed costs to cover" value={money(y1.fixedCosts)}
              sub="Overheads, fixed cost of sales, depreciation and interest" />
          </TileRow>

          <ChartBox title={`Revenue against break-even · FY${yearEnding} onwards`} height={216}
            note="The bar is what you plan to sell; the rule across it is what you have to sell.">
            {(w) => (
              <Columns width={w} height={216} categories={yearLabels} values={years.map((y) => y.revenue)}
                threshold={years.map((y) => y.breakEvenRevenue)} thresholdLabel="break even"
                format={money} tone={(i) => columnTone(years[i])} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">Every figure comes from the forecast. Fixed costs include depreciation and interest, so this is break-even on profit before tax.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th>Line</Th>{yearLabels.map((l) => <Th key={l} right style={{ width: 130 }}>{l}</Th>)}</tr></thead>
            <tbody>
              <NumberRow label="Revenue" bold values={years.map((y) => money(y.revenue))} />
              <NumberRow label="Variable cost of sales" values={years.map((y) => money(y.variableCosts))} />
              <NumberRow label="Contribution" bold values={years.map((y) => money(y.contribution))} />
              <NumberRow label="Contribution rate" values={years.map((y) => pct(y.contributionRate))} />
              <NumberRow label="Fixed cost of sales" values={years.map((y) => money(y.fixedCogs))} />
              <NumberRow label="Overheads" values={years.map((y) => money(y.overheads))} />
              <NumberRow label="Depreciation" values={years.map((y) => money(y.depreciation))} />
              <NumberRow label="Interest" values={years.map((y) => money(y.interest))} />
              <NumberRow label="Fixed costs" bold values={years.map((y) => money(y.fixedCosts))} />
              <NumberRow label="Total costs" values={years.map((y) => money(y.totalCosts))} />
            </tbody>
            <FootRow>
              <Td>Break-even revenue</Td>
              {years.map((y) => <Td key={y.year} right className="num">{y.breakEvenRevenue === null ? "none" : money(y.breakEvenRevenue)}</Td>)}
            </FootRow>
            <tbody>
              <Row>
                <Td>Margin of safety</Td>
                {years.map((y) => {
                  const s = safetyOf(y.marginOfSafety);
                  return <Td key={y.year} right className={cn("num font-semibold",
                    s === "comfortable" && "text-good", s === "tight" && "text-warn", s !== "comfortable" && s !== "tight" && "text-bad")}>{pct(y.marginOfSafety)}</Td>;
                })}
              </Row>
            </tbody>
          </Grid>
          <Note>Green above 25 %, amber 10–25 %, red below. Those are the conventional bands, not a reading of this business&apos;s own trading — a trade that routinely swings 30 % between seasons is not safe at 26 %.</Note>
        </>
      )}

      {area === "months" && (
        <>
          <TileRow>
            <StatTile label="Breaks even in" tone={crossover.month === null ? "bad" : "good"}
              value={crossover.month === null ? "Not in Year 1" : monthNames[crossover.month - 1]}
              sub={crossover.month === null
                ? "Operating cash does not cover itself inside the twelve months"
                : `Month ${crossover.month} — cumulative operating cash turns positive`} />
            <StatTile label="Deepest point" value={money(crossover.lowest.value)} tone={crossover.lowest.value < 0 ? "warn" : undefined}
              sub={`${monthNames[crossover.lowest.month - 1]} — what has to be funded before it turns`} />
            <StatTile label="Operating cash, the year" value={money(crossover.cumulative[crossover.cumulative.length - 1] ?? 0)}
              sub="After interest, before anything you or a lender put in" />
            <StatTile label="Holds?" value={crossover.month === null ? "—" : crossover.fallsBack ? "Falls back" : "Yes"}
              tone={crossover.fallsBack ? "warn" : undefined}
              sub={crossover.month === null ? "It does not turn inside Year 1"
                : crossover.fallsBack ? "It crosses, then drops below again later in the year"
                : "Once it turns it stays turned"} />
          </TileRow>

          <ChartBox title="Cumulative operating cash, after interest"
            note="Money in from trading, less money out — added up from the first month.">
            {(w) => (
              <Trend width={w} categories={monthNames.map((m) => m.slice(0, 3))} values={crossover.cumulative}
                cross={crossover.month} format={money} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">This is cash, not profit: depreciation is not in it, and money put in by an owner or a lender is not either.</Meta></Toolbar>
          <div className="overflow-x-auto">
            <Grid className="min-w-[1080px]">
              <thead><tr>
                {/* Thirteen columns do not fit a laptop, so the line name stays put while the year scrolls under it. */}
                <Th style={{ width: 180 }} className="sticky left-0 z-[2] border-r border-input" />
                {monthNames.map((m, i) => (
                  <Th key={m + i} right style={{ width: 72 }}
                    className={cn(crossover.month === i + 1 && "text-good")}>{m.slice(0, 3)}</Th>
                ))}
                <Th right style={{ width: 104 }} className="border-l border-input">Year 1</Th>
              </tr></thead>
              <tbody>
                <MonthRow label="Operating cash" values={months.map((m) => m.netOperating)} money={money} />
                <MonthRow label="Interest paid" values={months.map((m) => -m.interestPaid)} money={money} />
                <MonthRow label="Net" bold values={months.map((m) => m.netOperating - m.interestPaid)} money={money} />
              </tbody>
              <FootRow>
                <Td className="sticky left-0 z-[2] border-r border-input">Cumulative</Td>
                {crossover.cumulative.map((v, i) => (
                  <Td key={i} right className={cn("num", v < 0 ? "text-bad" : "text-good")}>{money(v)}</Td>
                ))}
                <Td right className="num border-l border-input">
                  {money(crossover.cumulative[crossover.cumulative.length - 1] ?? 0)}
                </Td>
              </FootRow>
            </Grid>
          </div>
          <Note>These twelve are the same months the cash flow shows on Review forecast — the operating section of it, with interest taken off.</Note>
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
              <ChartBox title={`What one ${noun.one} leaves behind`} height={services.length * 26 + 16}
                note={`Price less the cost to deliver it — per job, or per client for a year.`}>
                {(w) => <BarRows width={w} rows={services.map((s) => ({ label: s.name, value: s.contribution }))} format={money} />}
              </ChartBox>

              <Toolbar><Meta className="ml-0">
                Each line is measured in what it is actually sold in, and they are never added together — a house slab and a foot path are not the same unit.
              </Meta></Toolbar>
              <Grid>
                <thead><tr>
                  <Th style={{ width: 260 }}>{noun.head}</Th>
                  <Th style={{ width: 110 }}>Sold in</Th>
                  <Th right style={{ width: 110 }}>Planned</Th>
                  <Th right style={{ width: 120 }}>Price</Th>
                  <Th right style={{ width: 120 }}>Cost</Th>
                  <Th right style={{ width: 130 }}>Leaves behind</Th>
                  <Th right style={{ width: 90 }}>Rate</Th>
                  <Th right style={{ width: 170 }}>On this alone</Th>
                </tr></thead>
                <tbody>
                  {services.map((s) => (
                    <Row key={s.id || s.name}>
                      <Td className="max-w-0 truncate" title={s.name}>{s.name}</Td>
                      <Td className="text-muted-foreground">{s.unit === "client" ? "client-years" : "jobs"}</Td>
                      <Td right className="num">{s.planned}</Td>
                      <Td right className="num">{money(s.price)}</Td>
                      <Td right className="num">{money(s.cost)}</Td>
                      <Td right className={cn("num font-semibold", s.contribution < 0 && "text-bad")}>{money(s.contribution)}</Td>
                      <Td right className="num text-muted-foreground">{pct(s.contributionRate)}</Td>
                      <Td right className="num">
                        {s.aloneToBreakEven === null
                          ? <span className="text-bad">never</span>
                          : <>{s.aloneToBreakEven} {s.unit === "client" ? "clients" : "jobs"}</>}
                      </Td>
                    </Row>
                  ))}
                </tbody>
              </Grid>
              <Note>
                <b>On this alone</b> is how many of that one line would carry the whole {money(years[0].fixedCosts)} fixed base by itself.
                It is deliberately a what-if: fixed costs cannot be split between {noun.many} without inventing a share nobody agreed to.
                A line that loses money on every sale never gets there, however many are sold.
              </Note>
            </>
          )}
        </>
      )}
    </ModuleFrame>
  );
}

function NumberRow({ label, values, bold }: { label: string; values: string[]; bold?: boolean }) {
  return (
    <Row className={cn(bold && "[&>td]:font-semibold")}>
      <Td>{label}</Td>
      {values.map((v, i) => <Td key={i} right className="num">{v}</Td>)}
    </Row>
  );
}

/** Twelve months and the year they must add to, so the two are checked by looking rather than by trusting. */
function MonthRow({ label, values, money, bold }: {
  label: string; values: number[]; money: (v: number) => string; bold?: boolean;
}) {
  return (
    <Row className={cn(bold && "[&>td]:font-semibold")}>
      <Td className="sticky left-0 z-[2] border-r border-input bg-card">{label}</Td>
      {values.map((v, i) => <Td key={i} right className="num">{money(v)}</Td>)}
      <Td right className="num border-l border-input">{money(values.reduce((a, b) => a + b, 0))}</Td>
    </Row>
  );
}

export { compact };
