"use client";

/**
 * The two pictures on the dashboard (§6.69).
 *
 * The dashboard was a mockup that was never wired: five KPI tiles hard-coded to an em dash, a "Cash runway"
 * panel that said "Not yet", and no forecast loaded at all. A plan thirteen steps of fifteen complete, with
 * five years of statements that agree, opened on a page of placeholders.
 *
 * Both charts read the SAME run every other screen reads (§6.67), so the dashboard cannot disagree with
 * Review forecast about a figure it is showing larger.
 *
 * Client-side only because the chart kit measures its own width; the page that uses this stays a server
 * component and hands down finished numbers.
 */
import { ChartBox, type Severity } from "@/components/chart/core";
import { Columns, Trend } from "@/components/chart/plots";
import { useMoney } from "@/components/MoneyProvider";

const BARE = "border-b-0 px-0 py-0";

/** Closing cash, month by month through Year 1 — the line an owner actually worries about. */
export function CashChart({ months, values }: { months: string[]; values: number[] }) {
  const money = useMoney();
  return (
    <ChartBox title="" height={168} className={BARE}>
      {(w) => <Trend width={w} height={168} categories={months} values={values} format={money} />}
    </ChartBox>
  );
}

/**
 * PROFIT BEFORE TAX, MONTH BY MONTH (§6.124).
 *
 * Beside cash, because neither answers the other's question. A business can be liquid and losing money all
 * year — SEQ Concreting never drops below zero in the bank and still loses 136,681 — and an owner who sees
 * only the cash line has no idea.
 *
 * COLUMNS, NOT A LINE, and that is the whole reason this is not a second `Trend`. Profit crosses zero, and
 * zero is a THRESHOLD, not a point on a trend: a line through it reads as a slope where what matters is
 * which side of it each month sits on. Columns put every month on one side or the other and colour it.
 */
export function ProfitChart({ months, values }: { months: string[]; values: number[] }) {
  const money = useMoney();
  return (
    <ChartBox title="" height={168} className={BARE}>
      {(w) => (
        <Columns width={w} height={168} categories={months} values={values} format={money}
          tone={(i): Severity => (values[i] < 0 ? "bad" : "good")} />
      )}
    </ChartBox>
  );
}

/** What you plan to sell, against what you have to sell. */
export function RevenueChart({ labels, revenue, breakEven }: {
  labels: string[]; revenue: number[]; breakEven: (number | null)[];
}) {
  const money = useMoney();
  const tone = (i: number): Severity => {
    const be = breakEven[i];
    // No break-even at all is the worst case, not a missing one: every extra sale is losing money.
    if (be === null) return "bad";
    return revenue[i] >= be ? "good" : "warn";
  };
  return (
    <ChartBox title="" height={196} className={BARE}>
      {(w) => (
        <Columns width={w} height={196} categories={labels} values={revenue}
          threshold={breakEven} thresholdLabel="break even" format={money} tone={tone} />
      )}
    </ChartBox>
  );
}
