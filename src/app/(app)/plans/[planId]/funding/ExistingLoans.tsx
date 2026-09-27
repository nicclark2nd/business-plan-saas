"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { FieldSelect } from "@/components/module/FieldGrid";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { loanByYear, loanSummary } from "@/engine/funding/sources";
import type { ExistingDebt, ExistingDebtTerms } from "@/engine/funding/existing";

/**
 * THE LOANS ALREADY OWED WHEN THE PLAN STARTS (§6.150).
 *
 * The balance is Historic's and is only shown. The three terms are worked out from the accounts and each
 * says where it came from; the client changes one only when the accounts got it wrong, and can put the
 * worked-out figure back. Nothing here is asked for twice (SaaS_Requirements §0) — the one thing ever
 * asked is the rate, and only when last year's interest paid is not in Historic.
 */
const LINK = "font-medium text-primary underline-offset-2 hover:underline";
const label = "mb-[3px] block text-[11.5px] font-semibold text-muted-foreground";
const REPAY = [
  { value: "amortised", label: "Paid down each month" },
  { value: "interest_only", label: "Interest only" },
];

export function ExistingLoans({ planId, debt, worked, terms, onChange }: {
  planId: string;
  /** What the forecast carries: the worked-out terms with the client's changes in place. */
  debt: ExistingDebt;
  /** The same, with no changes — what "Use the Historic figure" puts back. */
  worked: ExistingDebt;
  terms: ExistingDebtTerms;
  onChange: (next: ExistingDebtTerms) => void;
}) {
  const num = useMoney();
  const [rateText, setRateText] = useState<string | null>(null);
  const [termText, setTermText] = useState<string | null>(null);
  const loan = debt.source?.loan ?? null;
  const y1 = loan ? loanByYear(loan)[0] : null;
  const payment = loan ? loanSummary(loan).payment : null;

  const parse = (s: string) => { const t = s.replace(/[,\s%]/g, ""); if (t === "") return null; const v = Number(t); return Number.isFinite(v) ? v : undefined; };
  const commitRate = () => {
    if (rateText === null) return;
    const v = parse(rateText); setRateText(null);
    if (v === undefined || v === (terms.interest_rate ?? null)) return;
    onChange({ ...terms, interest_rate: v });
  };
  const commitTerm = () => {
    if (termText === null) return;
    const v = parse(termText); setTermText(null);
    if (v === undefined || v === (terms.term_months ?? null)) return;
    onChange({ ...terms, term_months: v === null ? null : Math.trunc(v) });
  };
  const reset = (k: keyof ExistingDebtTerms) => onChange({ ...terms, [k]: null });

  return (
    <div className={cn("mx-2 mb-3 mt-1 rounded-md border px-4 py-3", debt.source ? "border-border" : "border-warn/40 bg-warn-soft")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold">Loans already owed when the plan starts</h3>
        <span className="text-xs text-muted-foreground">
          <span className="num font-semibold text-foreground">{num(debt.total)}</span> from{" "}
          <Link className={LINK} href={`/plans/${planId}/historic`}>Historic</Link>
          {debt.current > 0 && <> · {num(debt.current)} due within 12 months</>}
        </span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <span className={label}>Interest rate</span>
          <div className="flex items-center gap-1.5">
            <Input inputMode="decimal" className="num h-8 w-24 text-right"
              value={rateText ?? (debt.rate.value === null ? "" : String(debt.rate.value))}
              placeholder={debt.rate.value === null ? "e.g. 8.5" : undefined}
              onChange={(e) => setRateText(e.target.value)} onBlur={commitRate}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            <span className="text-xs text-muted-foreground">% a year</span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {debt.rate.from === "entered"
              ? <>Your figure.{worked.rate.value !== null
                  ? <> Historic works out {worked.rate.value}%. <button type="button" className={LINK} onClick={() => reset("interest_rate")}>Use the Historic figure</button></>
                  : null}</>
              : debt.rate.from === "historic"
                ? <>Worked out: {num(debt.rate.interestPaid ?? 0)} of interest paid last year on about {num(debt.rate.averageBalance ?? 0)} owed.</>
                : <span className="text-warn">Last year&apos;s interest paid is not in Historic, so the rate cannot be worked out. Add what the bank charges.</span>}
          </p>
        </div>

        <div>
          <span className={label}>Time left to repay</span>
          <div className="flex items-center gap-1.5">
            <Input inputMode="numeric" className="num h-8 w-24 text-right"
              value={termText ?? (debt.term.value === null ? "" : String(debt.term.value))}
              placeholder={debt.term.value === null ? "months" : undefined}
              onChange={(e) => setTermText(e.target.value)} onBlur={commitTerm}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            <span className="text-xs text-muted-foreground">months</span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {debt.term.from === "entered"
              ? <>Your figure.{worked.term.value !== null
                  ? <> Historic works out {worked.term.value} months. <button type="button" className={LINK} onClick={() => reset("term_months")}>Use the Historic figure</button></>
                  : null}</>
              : debt.term.from === "historic"
                ? <>Worked out: {num(debt.current)} of the {num(debt.total)} falls due within a year.</>
                : <>Nothing falls due within a year, so it is treated as running past Year 5.</>}
          </p>
        </div>

        <div>
          <span className={label}>How it is repaid</span>
          <FieldSelect value={debt.repayment.value} options={REPAY} className="w-full max-w-52"
            onValueChange={(v) => { if (v !== terms.repayment_type) onChange({ ...terms, repayment_type: v as "amortised" | "interest_only" }); }} />
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {debt.repayment.from === "entered"
              ? <>Your choice. <button type="button" className={LINK} onClick={() => reset("repayment_type")}>Use the Historic reading</button></>
              : debt.current > 0 ? <>Some of it falls due this year, so it is being paid down.</> : <>None of it falls due this year, so it reads as interest only.</>}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {loan && y1
          ? <>Year 1: about {num(payment ?? 0)} a month to the bank · {num(y1.interest)} of interest in the year · {num(y1.closing)} still owed at the year end.
              {" "}It is already in the business, so it adds no cash — the forecast charges its interest and takes its repayments.</>
          : <span className="text-warn">Until the rate is in, the forecast carries this debt flat: no interest and no repayments.</span>}
      </p>
    </div>
  );
}
