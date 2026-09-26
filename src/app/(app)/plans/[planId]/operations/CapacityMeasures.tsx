"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Grid, Th, Td, Row, Toolbar, Meta, RemoveButton, CellInput } from "@/components/module/DataGrid";
import { Meter } from "@/components/chart/core";
import { cn } from "@/lib/utils";
import { deleteCapacityMeasure, upsertCapacityMeasure } from "./actions";
import { useSerialSave } from "@/lib/serialSave";

export type CapacityMeasure = { id: string; name: string; pct_used: number | null };
const MAX = 6;

/**
 * THE NUMBERS UNDER THE CAPACITY PROSE (§6.129.3).
 *
 * The three boxes above say, in words, what limits the business and how it will be lifted. This says how
 * close to the limit it is, in figures the Capability to grow tab can draw. Kept in its own component
 * because it saves on its own terms — one row at a time, as the row is left — and the prose above it saves
 * when the area is left, and one save path for both would have to be two things at once.
 */
export function CapacityMeasures({ planId, initial, onError }: {
  planId: string; initial: CapacityMeasure[];
  onError: (key: string, message: string | null) => void;
}) {
  type Line = { uid: string; id?: string; name: string; pct: string };
  const [pending, start] = useTransition();
  const [lines, setLines] = useState<Line[]>(() => initial.map((m) => ({ uid: m.id, id: m.id, name: m.name, pct: m.pct_used === null ? "" : String(m.pct_used) })));
  /* Written on every edit, never after the render — two rows filled quickly must both save (§6.129). */
  const ref = useRef(lines);
  const set = (next: Line[]) => { ref.current = next; setLines(next); };
  const edit = (uid: string, patch: Partial<Line>) => set(ref.current.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const serial = useSerialSave();
  /* Each box saves as it is left, queued per row — see useSerialSave for why both halves of that matter. */
  const commit = (uid: string) => start(() => serial(uid, async () => {
    const l = ref.current.find((x) => x.uid === uid);          // read when this save's turn comes, not before
    if (!l || !l.name.trim()) return;                           // nameless is not saveable; say nothing yet
    const raw = l.pct.trim() === "" ? null : Number(l.pct.replace(/[^0-9.]/g, ""));
    const r = await upsertCapacityMeasure(planId, { id: l.id, name: l.name, pct_used: raw === null || Number.isFinite(raw) ? raw : null });
    if (!r.ok) { onError(`capacity:${uid}`, r.error); return; }
    onError(`capacity:${uid}`, null);
    edit(uid, { id: r.data.id });
  }));
  const remove = (uid: string) => {
    const l = ref.current.find((x) => x.uid === uid);
    set(ref.current.filter((x) => x.uid !== uid));
    if (l?.id) start(async () => { const r = await deleteCapacityMeasure(planId, l.id!); if (!r.ok) onError(`capacity:${uid}`, r.error); });
  };
  const add = () => { if (ref.current.length < MAX) set([...ref.current, { uid: crypto.randomUUID(), name: "", pct: "" }]); };

  const tone = (p: number | null) => (p === null ? "accent" : p >= 90 ? "bad" : p >= 75 ? "warn" : "good");

  return (
    <div className="mt-2">
      <Toolbar>
        <Meta className="ml-0">
          What the business depends on to deliver, and how much of it is used now. Up to {MAX}. Read by the
          &ldquo;Can the business execute it?&rdquo; panel on Financial Capabilities.
        </Meta>
        <Button size="sm" variant="outline" type="button" className="ml-auto" onClick={add} disabled={pending || lines.length >= MAX}>
          + Measure
        </Button>
      </Toolbar>
      {lines.length ? (
        <Grid className="min-w-0">
          <thead><tr>
            <Th>What it is</Th>
            <Th right style={{ width: 130 }}>Used now</Th>
            <Th style={{ width: 200 }} />
            <Th style={{ width: 36 }} />
          </tr></thead>
          <tbody>
            {lines.map((l) => {
              const p = l.pct.trim() === "" ? null : Number(l.pct.replace(/[^0-9.]/g, ""));
              return (
                <Row key={l.uid}>
                  <Td><CellInput value={l.name} placeholder="e.g. Concrete pump, crew hours, yard space"
                    onChange={(e) => edit(l.uid, { name: e.target.value })} onBlur={() => commit(l.uid)} /></Td>
                  <Td right><CellInput numeric suffix="%" value={l.pct} placeholder="—"
                    onChange={(e) => edit(l.uid, { pct: e.target.value })} onBlur={() => commit(l.uid)} /></Td>
                  <Td>
                    <div className={cn(p === null && "opacity-40")}>
                      <Meter pct={p === null || !Number.isFinite(p) ? null : Math.min(100, p)} severity={tone(p)} label={l.name} />
                    </div>
                  </Td>
                  <Td><RemoveButton onClick={() => remove(l.uid)} /></Td>
                </Row>
              );
            })}
          </tbody>
        </Grid>
      ) : (
        <p className="px-5 pb-3 text-[12.5px] text-muted-foreground">
          None yet. Start with the one thing that would stop the business taking on more work next month.
        </p>
      )}
    </div>
  );
}
