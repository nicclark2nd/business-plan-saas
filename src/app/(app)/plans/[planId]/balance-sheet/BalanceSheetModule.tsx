"use client";

import { useState } from "react";
import { ModuleFrame, ModuleStatusFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, TOTAL_ROW, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { Statement, type StatementRow } from "@/components/module/Statement";
import { ChartBox, Meter, StatTile, TileRow, type Severity } from "@/components/chart/core";
import { Lines, Trend } from "@/components/chart/plots";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type BalanceSheetYear } from "@/engine/forecast/model";
import type { Strength, WorkingCapitalMonth } from "@/engine/balance/lines";
import { navGroup } from "@/lib/nav";

type AreaKey = "years" | "working" | "strength";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const times = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);

/**
 * A ratio is not a grade, and this app does not hand out grades. But 1.0 on the current ratio is not an
 * opinion — below it, what falls due inside the year is more than what is there to meet it, and a lender
 * will say so on the first page. That one line earns a colour. Nothing else here does.
 */
const coverTone = (v: number | null): Severity | undefined =>
  v === null ? undefined : v < 1 ? "bad" : v < 1.2 ? "warn" : undefined;

/**
 * Balance Sheet, its own module (§6.77).
 *
 * The same move the profit and loss got in §6.76, for the same reason: it was a tab with a one-line toolbar
 * and a table on it, and it is the statement that says whether the business owns more than it owes. Tiles,
 * a chart, and two readings the annual table cannot give — where the money sits while the year runs, and
 * whether what is owned covers what is owed.
 *
 * What is deliberately NOT here is a month-by-month balance sheet. The monthly engine carries cash, debtors,
 * stock and creditors and nothing else; fixed assets, tax, equity and GST are annual. Twelve columns of a
 * statement that has to balance would need eight of those twelve rows invented, and a statement that
 * balances because figures were invented to make it balance is worse than no statement (§6.49). So the
 * monthly reading is the part that is genuinely monthly, and it is labelled as working capital, not as a
 * balance sheet.
 */
export function BalanceSheetModule({
  planId, mode, bs, strength, wcMonths, cycleDays, days, monthNames, yearLabels, reconciled, balances,
  gst, gstLabel, initialArea,
}: {
  planId: string; mode: "guided" | "advanced";
  bs: Record<number, BalanceSheetYear>;
  strength: Strength[];
  wcMonths: WorkingCapitalMonth[];
  cycleDays: number;
  days: { debtorDays: number; inventoryDays: number; creditorDays: number };
  monthNames: string[]; yearLabels: string[];
  reconciled: boolean; balances: boolean;
  gst: { registered: boolean }; gstLabel: string;
  initialArea: AreaKey;
}) {
  const money = useMoney();
  /** Brackets for money out, the same habit the statement below the tiles has always had (§6.76). */
  const signed = (v: number) => (v < 0 ? `(${money(Math.abs(v))})` : money(v));
  const [area, setArea] = useState<AreaKey>(initialArea);

  const y1 = bs[1], y5 = bs[5];
  const s1 = strength[0], s5 = strength[strength.length - 1];
  const tiedUpNow = wcMonths[wcMonths.length - 1]?.tiedUp ?? 0;
  const peak = wcMonths.reduce((best, m) => (m.tiedUp > best.tiedUp ? m : best), wcMonths[0]);

  return (
    <ModuleFrame
      group={navGroup("balance-sheet")} title="Balance Sheet" subtitle="What the business owns, what it owes, and what is left over"
      mode={mode}
      areas={[
        { key: "years", label: "The years" },
        { key: "working", label: "Working capital" },
        { key: "strength", label: "Strength" },
      ]}
      area={area} onArea={(k) => setArea(k as AreaKey)} scope={{ label: "This plan" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Net assets</b> is what would be left if the business stopped, sold what it owns and paid what it owes. Growing net assets across five years is the plan earning its keep; shrinking net assets while revenue grows is the plan spending someone else&apos;s money to do it.</p>
        <p><b>Working capital</b> is the only part of a balance sheet that moves week to week. Money owed to you and stock on the shelf are cash you have lent to your own trading; money you owe suppliers is cash they have lent to you. The gap is what the business has to fund out of the bank.</p>
        <p><b>The current ratio</b> is the first thing a lender divides: what is there to meet what falls due inside the year. Below 1.0 there is not enough, and the plan needs either slower payments out, faster payments in, or a facility.</p>
        <h3>Why there are no monthly columns</h3>
        <p>The forecast tracks cash, debtors, stock and creditors month by month. Everything else on this statement — fixed assets, tax, equity — belongs to a year. A monthly balance sheet would have to invent the rest to make each column balance, so the monthly view here shows the four that are real and stops.</p>
      </>}
    >
      {!reconciled && (
        <Note><span className="text-bad">The forecast has a check that is not balancing, so these figures cannot be relied on yet — <b>Review forecast</b> shows which.</span></Note>
      )}

      {area === "years" && (
        <>
          <TileRow>
            <StatTile label="Net assets" value={signed(s1.netAssets)} tone={s1.netAssets < 0 ? "bad" : undefined}
              sub={`Year 1 · ${signed(s5.netAssets)} by Year ${FORECAST_YEARS.length}`} />
            <StatTile label="Total assets" value={money(y1.totalAssets)} sub={`${money(y1.currentAssets)} of it current`} />
            <StatTile label="Total liabilities" value={money(y1.totalLiabilities)}
              sub={`${money(y1.currentLiabilities)} falls due inside the year`} />
            <StatTile label="Cash at year end" value={signed(y1.cash)} tone={y1.cash < 0 ? "bad" : undefined}
              sub={`${signed(y5.cash)} by Year ${FORECAST_YEARS.length}`} />
          </TileRow>

          {/*
            * Three lines, and the GAP is the fourth thing (§6.77). Assets against liabilities, with equity
            * drawn under both: the distance between the top two lines is the bottom one, so a plan where
            * the borrowing grows as fast as the business shows as two lines that never separate — which is
            * the single most useful thing a five-year balance sheet can say, and no column of figures says
            * it at a glance.
            */}
          <ChartBox title="What is owned, what is owed, and what is left" height={216}
            note="Total assets against total liabilities, with equity below. The gap between the first two lines is the third — a widening gap is the plan building something that belongs to the business.">
            {(w) => (
              <Lines width={w} height={216} categories={yearLabels} format={money}
                series={[
                  { label: "Total assets", values: FORECAST_YEARS.map((y) => bs[y].totalAssets) },
                  { label: "Total liabilities", values: FORECAST_YEARS.map((y) => bs[y].totalLiabilities) },
                  { label: "Equity", values: FORECAST_YEARS.map((y) => bs[y].equity) },
                ]} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">
            {balances
              ? <>Balances in every year · Year {FORECAST_YEARS.length} equity {money(y5.equity)}</>
              : <span className="text-bad">The balance sheet does not balance — <b>Review forecast</b> shows which check is failing.</span>}
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
            ["Grant income not yet earned", (y) => bs[y].deferredIncomeCurrent],
            ["Other current liabilities", (y) => bs[y].otherCurrentLiabilities],
            ["Current liabilities", (y) => bs[y].currentLiabilities, "sub"],
            ["Loans due later", (y) => bs[y].debtNonCurrent],
            ["Grant income earned after next year", (y) => bs[y].deferredIncomeNonCurrent],
            ["Other non-current liabilities", (y) => bs[y].otherNonCurrentLiabilities],
            ["Total liabilities", (y) => bs[y].totalLiabilities, "sub"],
            ["Equity", (y) => bs[y].equity],
            ["Liabilities and equity", (y) => bs[y].totalLiabilitiesAndEquity, "total"],
          ]} num={money} />
        </>
      )}

      {area === "working" && (
        <>
          <TileRow>
            <StatTile label="Tied up in trading" value={signed(tiedUpNow)}
              sub="Debtors and stock, less what you owe suppliers" />
            <StatTile label="Owed to you" value={money(y1.accountsReceivable)}
              sub={`${days.debtorDays} debtor days · ${pct(y1.totalAssets > 0 ? (y1.accountsReceivable / y1.totalAssets) * 100 : null)} of everything owned`} />
            <StatTile label="Owed by you" value={money(y1.accountsPayable)}
              sub={`${days.creditorDays} creditor days on suppliers`} />
            <StatTile label="Cash cycle" value={`${cycleDays} days`} tone={cycleDays > 90 ? "warn" : undefined}
              sub={`${days.debtorDays} in, ${days.inventoryDays} in stock, ${days.creditorDays} out`} />
          </TileRow>

          {/*
            * ONE line, for the reason §6.76.3 settled on the profit and loss: debtors, stock and creditors
            * on one pair of axes is three series two orders of magnitude apart, and the two small ones lie
            * flat on the floor pretending to be zero. The headline is the NET — what the business has to
            * fund — and the three components are the table directly beneath, where they can be read
            * exactly rather than measured off a chart.
            */}
          <ChartBox title="Cash tied up in trading, month by month" height={216}
            note="Money owed to you plus stock on hand, less what you owe suppliers. Every dollar of this is cash the business has lent to its own trading and cannot spend.">
            {(w) => (
              <Trend width={w} height={216} categories={monthNames.map((m) => m.slice(0, 3))}
                values={wcMonths.map((m) => m.tiedUp)} cross={null} format={money} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">
            Year 1, month by month. The twelfth column is where the balance sheet above starts Year 2, so
            these and the statement are the same figures read at different dates.
          </Meta></Toolbar>
          <div className="overflow-x-auto">
            <Grid className="min-w-[1250px]">
              <thead><tr>
                {/* 220, not the 180 the profit and loss uses: "Stock and work in progress" is the longest
                    line name in the product and it was clipping to "Stock and work in pro…" (§6.73.2). */}
                <Th style={{ width: 220 }} className="sticky left-0 z-[2] border-r border-input" />
                {monthNames.map((m, i) => <Th key={m + i} right style={{ width: 86 }}>{m.slice(0, 3)}</Th>)}
                <Th right style={{ width: 104 }} className="border-l border-input">Year 1</Th>
              </tr></thead>
              <tbody>
                {([
                  ["Debtors", (m: WorkingCapitalMonth) => m.debtors, undefined],
                  ["Stock and work in progress", (m: WorkingCapitalMonth) => m.stock, undefined],
                  ["Creditors", (m: WorkingCapitalMonth) => -m.creditors, undefined],
                  ["Tied up in trading", (m: WorkingCapitalMonth) => m.tiedUp, "total"],
                ] as [string, (m: WorkingCapitalMonth) => number, "total" | undefined][]).map(([label, get, weight]) => {
                  const cell = (v: number) => (v < 0 ? `(${money(Math.abs(v))})` : v === 0 ? "—" : money(v));
                  /**
                   * The closing column is the year END, not a sum. These are BALANCES: adding twelve
                   * month-end debtor figures together would produce a number that means nothing and looks
                   * like a total, which is the §6.19 footer mistake in a different costume.
                   */
                  const close = get(wcMonths[wcMonths.length - 1]);
                  return (
                    <GridRow key={label} className={cn(weight === "total" && TOTAL_ROW)}>
                      <Td className={cn("sticky left-0 z-[1] border-r border-input bg-card", weight ? "font-semibold" : "text-muted-foreground")}>{label}</Td>
                      {wcMonths.map((m) => {
                        const v = get(m);
                        return <Td key={m.month} right className={cn("num", weight && "font-semibold", v < 0 && "text-bad")}>{cell(v)}</Td>;
                      })}
                      <Td right className={cn("num border-l border-input font-semibold", close < 0 && "text-bad")}>{cell(close)}</Td>
                    </GridRow>
                  );
                })}
              </tbody>
            </Grid>
          </div>
          <Note>
            The closing column is the balance at <b>year end</b>, not the twelve months added up — these are
            balances, and a total of balances would mean nothing. Tied up in trading peaks at{" "}
            <b>{money(peak.tiedUp)}</b> in {monthNames[peak.month - 1]}. The days behind all of this are yours
            to change on <b>Assumptions</b>, and every figure here moves when they do.
          </Note>
        </>
      )}

      {area === "strength" && (
        <>
          <TileRow>
            <StatTile label="Current ratio" value={times(s1.currentRatio)} tone={coverTone(s1.currentRatio)}
              sub={`${money(s1.currentAssets)} against ${money(s1.currentLiabilities)} due inside the year`}>
              <Meter pct={s1.currentRatio === null ? null : Math.max(0, Math.min(100, (s1.currentRatio / 2) * 100))}
                severity={coverTone(s1.currentRatio) ?? "accent"} label={`Current ratio ${times(s1.currentRatio)}`} />
            </StatTile>
            <StatTile label="Gearing" value={pct(s1.gearing)}
              sub="Borrowings as a share of borrowings plus equity" />
            <StatTile label="Net debt" value={signed(s1.netDebt)}
              sub={s1.netDebt < 0 ? "More cash than borrowings" : `${money(s1.totalDebt)} owed, ${money(s1.cash)} in the bank`} />
            <StatTile label="Net assets" value={signed(s1.netAssets)} tone={s1.netAssets < 0 ? "bad" : undefined}
              sub={`${signed(s5.netAssets)} by Year ${FORECAST_YEARS.length}`} />
          </TileRow>

          <ChartBox title="Borrowed against owned" height={216}
            note="Borrowings and equity, side by side across five years. Where equity crosses above the debt, the business has become worth more than it owes.">
            {(w) => (
              <Lines width={w} height={216} categories={yearLabels} format={money}
                series={[
                  { label: "Borrowings", values: strength.map((s) => s.totalDebt) },
                  { label: "Equity", values: strength.map((s) => s.equity) },
                ]} />
            )}
          </ChartBox>

          <Toolbar><Meta className="ml-0">
            Every figure here is division on two lines of the statement. <b>Nothing on this tab is a new
            assumption</b> — change a number on the balance sheet and these follow it.
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "30%" }} />
              {strength.map((s) => <Th key={s.year} right style={{ width: 130 }}>Year {s.year}</Th>)}
            </tr></thead>
            <tbody>
              <GridRow>
                <Td className="text-muted-foreground">Current ratio</Td>
                {strength.map((s) => (
                  <Td key={s.year} right className={cn("num", coverTone(s.currentRatio) === "bad" && "text-bad")}>{times(s.currentRatio)}</Td>
                ))}
              </GridRow>
              <GridRow>
                <Td className="text-muted-foreground">Quick ratio, stock excluded</Td>
                {strength.map((s) => <Td key={s.year} right className="num">{times(s.quickRatio)}</Td>)}
              </GridRow>
              <GridRow className="bg-secondary/50">
                <Td className="font-semibold">Working capital</Td>
                {strength.map((s) => (
                  <Td key={s.year} right className={cn("num font-semibold", s.netWorkingCapital < 0 && "text-bad")}>{signed(s.netWorkingCapital)}</Td>
                ))}
              </GridRow>
              <GridRow>
                <Td className="text-muted-foreground">Borrowings</Td>
                {strength.map((s) => <Td key={s.year} right className="num">{money(s.totalDebt)}</Td>)}
              </GridRow>
              <GridRow>
                <Td className="text-muted-foreground">Cash</Td>
                {strength.map((s) => <Td key={s.year} right className={cn("num", s.cash < 0 && "text-bad")}>{signed(s.cash)}</Td>)}
              </GridRow>
              <GridRow>
                <Td className="text-muted-foreground">Net debt</Td>
                {strength.map((s) => <Td key={s.year} right className="num">{signed(s.netDebt)}</Td>)}
              </GridRow>
              <GridRow>
                <Td className="text-muted-foreground">Gearing</Td>
                {strength.map((s) => <Td key={s.year} right className="num">{pct(s.gearing)}</Td>)}
              </GridRow>
              <GridRow className={TOTAL_ROW}>
                <Td>Net assets</Td>
                {strength.map((s) => (
                  <Td key={s.year} right className={cn("num", s.netAssets < 0 && "text-bad")}>{signed(s.netAssets)}</Td>
                ))}
              </GridRow>
            </tbody>
          </Grid>
          <Note>
            These are tests, not verdicts. A current ratio under <b>1.0</b> says what falls due inside the
            year is more than what is there to meet it — a lender will raise it, and the answers are slower
            payments out, faster payments in, or a facility on <b>Funding</b>. Gearing has no right number:
            what matters is whether the business can service the interest, which the profit and loss answers.
          </Note>
        </>
      )}
    </ModuleFrame>
  );
}
