"use client";

import { useRef, useState } from "react";
import { Section } from "@/components/module/FieldGrid";
import { Grid, Th, Td, Row as GridRow, CellInput, LinkButton, Note } from "@/components/module/DataGrid";
import { cn } from "@/lib/utils";
import { adjustableMeasures, type Adjustable, type Ranges } from "@/engine/capability/ranges";
import { saveRanges } from "./actions";

/**
 * CAPABILITY RANGES FOR THIS PLAN (§6.140, open item 32).
 *
 * Here and not on Financial Capabilities, because those three tabs are for display (Nic: "THESE THREE TABS
 * ARE FOR DISPLAY - NOT FOR COLLECTING DATA"). The dials read what is set here the way they read the cash
 * floor from Assumptions.
 *
 * Two boxes per measure — the two lines on the dial — with the general range as their placeholders, so an
 * untouched row visibly means "general". Both boxes empty puts the measure back to general. A pair saves
 * when either box is left and only if the first line is below the second; otherwise the row says why and
 * nothing is stored.
 */
const KIND_TITLE: Record<Adjustable["kind"], string> = {
  grow: "Capability to grow", borrow: "Capability to borrow", sell: "Capability to sell",
};
const SUFFIX: Partial<Record<Adjustable["unit"], string>> = { pct: "%", x: "×", days: "d", months: "m" };
const str = (v: number | undefined) => (v === undefined ? "" : String(v));
const num = (raw: string) => { const t = raw.trim(); if (!t) return null; const x = Number(t.replace(/[^0-9.-]/g, "")); return Number.isFinite(x) ? x : NaN; };

export function RangesSection({ planId, initial, start, onError }: {
  planId: string; initial: Ranges;
  /** The module's own save transition, so the footer's "Saving…" and failures cover this too. */
  start: (fn: () => Promise<void>) => void;
  onError: (message: string | null) => void;
}) {
  const measures = adjustableMeasures();
  const [boxes, setBoxes] = useState<Record<string, [string, string]>>(() =>
    Object.fromEntries(measures.map((m) => [m.id, [str(initial[m.id]?.[0]), str(initial[m.id]?.[1])]])));
  const ref = useRef(boxes);
  const saved = useRef<Ranges>(initial);
  const [bad, setBad] = useState<Record<string, string>>({});
  /* A row with one line filled is being typed, not wrong — it says what it is waiting for, quietly. */
  const [waiting, setWaiting] = useState<Record<string, boolean>>({});

  const edit = (key: string, i: 0 | 1, v: string) => {
    const pair: [string, string] = [...ref.current[key]] as [string, string];
    pair[i] = v;
    const next = { ...ref.current, [key]: pair };
    ref.current = next; setBoxes(next);
  };

  const commit = (key: string) => {
    const [ra, rb] = ref.current[key];
    const a = num(ra), b = num(rb);
    let next: Ranges;
    if (a === null && b === null) {
      if (!saved.current[key]) { setBad((x) => ({ ...x, [key]: "" })); return; }
      next = { ...saved.current }; delete next[key];
    } else if (Number.isNaN(a) || Number.isNaN(b)) {
      setBad((x) => ({ ...x, [key]: "Each line has to be a number." })); return;
    } else if (a === null || b === null) {
      setBad((x) => ({ ...x, [key]: "" })); setWaiting((x) => ({ ...x, [key]: true })); return;
    } else if (a >= b) {
      setBad((x) => ({ ...x, [key]: "The first line has to be below the second." })); return;
    } else {
      if (saved.current[key]?.[0] === a && saved.current[key]?.[1] === b) { setBad((x) => ({ ...x, [key]: "" })); return; }
      next = { ...saved.current, [key]: [a, b] };
    }
    setBad((x) => ({ ...x, [key]: "" })); setWaiting((x) => ({ ...x, [key]: false }));
    start(async () => {
      const r = await saveRanges(planId, next);
      if (!r.ok) { onError(r.error); return; }
      onError(null);
      saved.current = next;
    });
  };

  const reset = (key: string) => {
    const next = { ...ref.current, [key]: ["", ""] as [string, string] };
    ref.current = next; setBoxes(next);
    commit(key);
  };

  return (
    <>
      <Section title="Ranges for this plan">
        <p className="max-w-[86ch] text-[12.5px] leading-relaxed text-muted-foreground">
          The dials on <b className="text-foreground">Financial Capabilities</b> judge each measure against a general
          small-business range. If you know what good looks like in this industry, set the two lines here — where
          <i> watch</i> starts, and where the good or weak end starts. Leave a row empty to keep the general range.
        </p>
      </Section>
      {(["grow", "borrow", "sell"] as const).map((kind) => (
        <Section key={kind} title={KIND_TITLE[kind]}>
          <Grid className="min-w-0">
            <thead><tr>
              <Th>Measure</Th>
              <Th right style={{ width: 110 }}>First line</Th>
              <Th right style={{ width: 110 }}>Second line</Th>
              <Th style={{ width: 96 }} />
            </tr></thead>
            <tbody>
              {measures.filter((m) => m.kind === kind).map((m) => {
                const [a, b] = boxes[m.id];
                const own = !!a.trim() || !!b.trim();
                return (
                  <GridRow key={m.id} title={bad[m.id] || undefined} className={cn(bad[m.id] && "[&>td]:bg-bad-soft")}>
                    <Td><span className="font-medium">{m.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {m.lowIsGood ? "Lower is better" : "Higher is better"} · general:{" "}
                        {m.lowIsGood
                          ? <>strong to {m.general[0]}{SUFFIX[m.unit] ?? ""}, watch to {m.general[1]}{SUFFIX[m.unit] ?? ""}</>
                          : <>weak below {m.general[0]}{SUFFIX[m.unit] ?? ""}, watch to {m.general[1]}{SUFFIX[m.unit] ?? ""}</>}
                      </span>
                      {waiting[m.id] && !bad[m.id] && <span className="block text-[11px] text-muted-foreground">Saves once both lines are in.</span>}</Td>
                    <Td right><CellInput numeric suffix={SUFFIX[m.unit]} value={a} placeholder={String(m.general[0])}
                      aria-label={`${m.name}: first line`}
                      onChange={(e) => edit(m.id, 0, e.target.value)} onBlur={() => commit(m.id)} /></Td>
                    <Td right><CellInput numeric suffix={SUFFIX[m.unit]} value={b} placeholder={String(m.general[1])}
                      aria-label={`${m.name}: second line`}
                      onChange={(e) => edit(m.id, 1, e.target.value)} onBlur={() => commit(m.id)} /></Td>
                    <Td className="text-right">{own && <LinkButton onClick={() => reset(m.id)}>Use general</LinkButton>}</Td>
                  </GridRow>
                );
              })}
            </tbody>
          </Grid>
          {measures.filter((m) => m.kind === kind).some((m) => bad[m.id]) && (
            <Note><span className="text-bad">{measures.filter((m) => m.kind === kind && bad[m.id]).map((m) => `${m.name}: ${bad[m.id]}`).join(" ")}</span></Note>
          )}
        </Section>
      ))}
    </>
  );
}
