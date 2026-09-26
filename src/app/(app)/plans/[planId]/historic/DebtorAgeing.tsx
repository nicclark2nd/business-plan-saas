"use client";

import { useEffect, useRef, useState, useTransition } from "react";
/* FieldInput, not CellInput: these sit in a form grid, where a borderless cell reads as a label. */
import { Section, FieldGrid, Field, FieldInput } from "@/components/module/FieldGrid";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import { saveAgeing } from "./actions";

type Key = "ar_current" | "ar_30" | "ar_60" | "ar_90";
const BUCKETS: { key: Key; label: string; hint: string }[] = [
  { key: "ar_current", label: "Not yet due", hint: "Invoiced, inside its terms." },
  { key: "ar_30", label: "1–30 days late", hint: "Past its due date by up to a month." },
  { key: "ar_60", label: "31–60 days late", hint: "The ones worth a phone call." },
  { key: "ar_90", label: "Over 60 days late", hint: "The ones a lender assumes will not be paid." },
];

/**
 * THE DEBTORS FIGURE, SPLIT BY AGE (§6.129.3).
 *
 * The balance sheet above holds debtors as one number, and a lender does not lend against one number: 300,000
 * of debtors that are all inside terms and 300,000 of which a third is ninety days late are different
 * businesses. Only the most recent period gets a split, because that is the ledger that exists today.
 *
 * It must add up to the debtors figure it splits, and the screen says by how much it does not rather than
 * refusing to save — a client halfway through four boxes has not made a mistake yet.
 */
export function DebtorAgeing({ planId, receivables, initial, onError, onBusy }: {
  planId: string; receivables: number | null;
  initial: Partial<Record<Key, number | null>>;
  onError: (message: string | null) => void;
  /** Whether a save is running, for the module footer. */
  onBusy?: (busy: boolean) => void;
}) {
  const money = useMoney();
  const [pending, start] = useTransition();
  /*
   * THE FOOTER HEARS ABOUT THIS SAVE (§6.132, open item 40). This part saves on its own schedule, so the
   * module's "Saving…" and "All changes saved" did not know it was mid-save. It reports up rather than
   * writing to the footer itself: two writers to one status slot race, and the footer flickers.
   */
  useEffect(() => { onBusy?.(pending); }, [pending, onBusy]);
  /* Leaving the area mid-save must not leave the footer saying "Saving…" for ever. */
  useEffect(() => () => onBusy?.(false), [onBusy]);
  const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const [vals, setVals] = useState<Record<Key, string>>({
    ar_current: str(initial.ar_current), ar_30: str(initial.ar_30), ar_60: str(initial.ar_60), ar_90: str(initial.ar_90),
  });
  const ref = useRef(vals);
  const edit = (k: Key, v: string) => { const next = { ...ref.current, [k]: v }; ref.current = next; setVals(next); };
  const n = (raw: string) => { const t = raw.trim(); if (!t) return null; const x = Number(t.replace(/[^0-9.]/g, "")); return Number.isFinite(x) ? x : null; };

  const commit = () => start(async () => {
    const r = await saveAgeing(planId, { ar_current: n(ref.current.ar_current), ar_30: n(ref.current.ar_30), ar_60: n(ref.current.ar_60), ar_90: n(ref.current.ar_90) });
    onError(r.ok ? null : r.error);
  });

  const parts = BUCKETS.map((b) => n(vals[b.key]));
  const any = parts.some((p) => p !== null);
  const sum = parts.reduce<number>((t, p) => t + (p ?? 0), 0);
  const gap = receivables === null || !any ? null : Math.round((receivables - sum) * 100) / 100;
  const overdue = sum > 0 ? Math.round(((n(vals.ar_30) ?? 0) + (n(vals.ar_60) ?? 0) + (n(vals.ar_90) ?? 0)) / sum * 1000) / 10 : null;

  return (
    <div onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && commit()}>
      <Section title="How old the debtors are">
        <p className="mb-2 max-w-[86ch] text-[12px] text-muted-foreground">
          The most recent year&apos;s debtors{receivables !== null ? <> of <b className="text-foreground">{money(receivables)}</b></> : null}, split by how
          late each invoice is. Read from your aged debtors report. Financial Capabilities shows it to a lender.
        </p>
        <FieldGrid>
          {BUCKETS.map((b) => (
            <Field key={b.key} label={b.label} span={1} hint={b.hint}>
              <FieldInput money value={vals[b.key]} placeholder="—" disabled={pending}
                onChange={(e) => edit(b.key, e.target.value)} />
            </Field>
          ))}
        </FieldGrid>
        {any && (
          <p className={cn("mt-2 text-[12px]", gap !== null && Math.abs(gap) >= 1 ? "text-warn" : "text-muted-foreground")}>
            {gap !== null && Math.abs(gap) >= 1
              ? <>The split comes to {money(sum)}, which is {money(Math.abs(gap))} {gap > 0 ? "short of" : "more than"} the debtors figure. It should add up to it.</>
              : <>Adds up to the debtors figure.{overdue !== null && <> {overdue}% is past its due date.</>}</>}
          </p>
        )}
      </Section>
    </div>
  );
}
