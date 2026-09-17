"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Toolbar, Meta, RemoveButton, CellInput, CellSelect, CellTextarea, focusRow } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldTextarea } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { ConfirmDelete } from "@/components/module/ConfirmDelete";
import { cn } from "@/lib/utils";
import { saveMarket, upsertRow, deleteRow } from "../marketing/actions";
import { POSITION_FIELDS, COMPETITOR_KIND, COMPETITOR_REACH, COMPETITOR_PRICING, COMPETITOR_THREAT, type Position, type Competitor } from "../marketing/model";
import { continueFromCompetitors } from "./actions";

type AreaKey = "competitors" | "position";
type Row_ = Competitor & { _dirty?: boolean; _error?: string };
const STEP = GUIDED_STEPS.find((s) => s.id === "competitors")?.step ?? 4;

const proseLabel = "mb-0.5 pl-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground";

export function CompetitorsModule({ planId, initialPosition, initialCompetitors, mode, initialArea, customerWord }: {
  planId: string; initialPosition: Position; initialCompetitors: Competitor[]; mode: "guided" | "advanced"; initialArea: AreaKey; customerWord: string;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [kill, setKill] = useState<{ id: string; name: string } | null>(null);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [positionDirty, setPositionDirty] = useState(false);
  const blank = (id = "tmp-new-competitor"): Row_ => ({ id, name: "", kind: "direct", reach: null, pricing: null, threat: "medium", strengths: "", weaknesses: "", how_we_win: "", sort_order: 0 });
  const [rows, setRows] = useState<Row_[]>(initialCompetitors.length ? initialCompetitors : [blank()]);   // empty grid starts with a blank row
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const posRef = useRef(position); useEffect(() => { posRef.current = position; }, [position]);
  const rowsRef = useRef(rows); useEffect(() => { rowsRef.current = rows; }, [rows]);
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  const commitPosition = () => {
    if (!positionDirty) return;
    setPositionDirty(false);
    start(async () => { const r = await saveMarket(planId, posRef.current); if (!r.ok) { setError(r.error); setPositionDirty(true); } });
  };
  const edit = (id: string, changes: Partial<Competitor>, immediate = false) => {
    setRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...changes, _dirty: true, _error: undefined } : x)));
    if (immediate) queueMicrotask(() => commit(id));
  };
  const commit = (id: string) => {
    const row = rowsRef.current.find((x) => x.id === id);
    if (!row || !row._dirty) return;
    setRows((xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: false } : x)));
    start(async () => {
      const r = await upsertRow(planId, "competitors", { ...row, id: id.startsWith("tmp-") ? undefined : id });
      if (!r.ok) { setRows((xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: true, _error: r.error } : x))); return; }
      setRows((xs) => xs.map((x) => (x.id === id ? { ...x, id: r.data!.id } : x)));
    });
  };
  const add = () => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    setRows((xs) => [blank(tmp), ...xs]);
    setArea("competitors"); focusRow(`[data-row="${tmp}"]`);
  };
  /** A competitor carries the whole SBA comparison — never dropped silently (§6.24). */
  const askRemove = (id: string) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r || (!r.name?.trim() && id.startsWith("tmp-"))) { remove(id); return; }
    setKill({ id, name: r.name ?? "" });
  };
  const remove = (id: string) => {
    setKill(null);
    setRows((xs) => { const rest = xs.filter((x) => x.id !== id); return rest.length ? rest : [blank(`tmp-${crypto.randomUUID()}`)]; });
    if (!id.startsWith("tmp-")) start(async () => { await deleteRow(planId, "competitors", id); });
  };
  const flush = () => { commitPosition(); rowsRef.current.forEach((r) => r._dirty && commit(r.id)); };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromCompetitors(planId, intent); });
  };

  const positioned = POSITION_FIELDS.filter((f) => position[f.key].trim()).length;
  const named = rows.filter((r) => r.name.trim());
  const direct = named.filter((r) => r.kind === "direct").length, indirect = named.length - direct;
  const rowError = rows.find((r) => r._error)?._error;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Market" title="Competitors" subtitle={`Who else a ${customerWord} would consider, how they compare, and why they choose you`} mode={mode}
      areas={[{ key: "competitors", label: "Competitors", count: rows.filter((r) => r.name.trim()).length }, { key: "position", label: "Our position", count: positioned }]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }}
      scope={{ label: "This plan" }}
      primaryAction={area === "competitors" ? <Button size="sm" type="button" onClick={add}>+ Competitor</Button> : undefined}
      footer={<ModuleFooter planId={planId} moduleId="competitors" formId="competitors-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Three or four <b>direct</b> rivals — the ones a {customerWord} actually rings for a second quote — and at least one <b>indirect</b> one that solves the same problem a different way. Honest strengths: a lender trusts &quot;cheaper and faster than us&quot; more than a list of flaws.</p>
        <p>Type, reach, pricing and threat are one click each. The report turns them into the comparison table lenders expect, with your business as the first column — you never draw the table yourself.</p>
        <p><b>Our position</b> is the part banks and the SBA read hardest: the exact reason a {customerWord} picks you, what stops that being copied next week, and what could change the field. Rough is fine; specific beats grand.</p>
        <h3>Where this goes</h3>
        <p>Competitive analysis section of every report; the comparison matrix in bank, SBA and investor templates. &quot;What could change&quot; pre-fills the Threats quadrant in SWOT.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={positionDirty || rows.some((r) => r._dirty)} error={error ?? rowError} />
      <form id="competitors-form" onSubmit={onSubmit} className="hidden" />

      {area === "competitors" && (
        <>
          <Toolbar><Meta className="ml-0">{named.length ? <>{direct} direct · {indirect} indirect{indirect === 0 ? " — add one indirect rival: someone who solves the same problem another way" : ""}</> : "One block per rival: facts on the first line, your words on the second."}</Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "22%" }}>Competitor</Th><Th style={{ width: "15%" }}>Type</Th><Th style={{ width: "15%" }}>Reach</Th><Th style={{ width: "20%" }}>Pricing vs us</Th><Th style={{ width: "15%" }}>Threat</Th><Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {rows.map((c) => [
                <tr key={c.id + "a"} data-row={c.id} onBlur={(e) => left(e) && commit(c.id)} className={cn("[&>td]:border-b-0 [&>td]:pt-2", c._error && "[&>td]:bg-bad-soft")} title={c._error}>
                  <Td><CellInput value={c.name} placeholder="Name" className="font-semibold" onChange={(e) => edit(c.id, { name: e.target.value })} /></Td>
                  <Td><CellSelect value={c.kind} options={COMPETITOR_KIND} onValueChange={(v) => edit(c.id, { kind: v as Competitor["kind"] }, !!c.name.trim())} /></Td>
                  <Td><CellSelect value={c.reach} options={COMPETITOR_REACH} placeholder="Reach —" onValueChange={(v) => edit(c.id, { reach: v }, !!c.name.trim())} /></Td>
                  <Td><CellSelect value={c.pricing} options={COMPETITOR_PRICING} placeholder="Pricing —" onValueChange={(v) => edit(c.id, { pricing: v }, !!c.name.trim())} /></Td>
                  <Td><CellSelect value={c.threat} options={COMPETITOR_THREAT} className={cn("font-semibold", c.threat === "critical" || c.threat === "high" ? "text-bad" : c.threat === "medium" ? "text-warn" : "text-good")} onValueChange={(v) => edit(c.id, { threat: v as Competitor["threat"] }, !!c.name.trim())} /></Td>
                  <Td><RemoveButton onClick={() => askRemove(c.id)} /></Td>
                </tr>,
                /*
                 * The three written columns are NOT part of the facts grid (\u00a76.62.2).
                 *
                 * They used to be three colSpan={2} cells across the six fact columns, which put them on
                 * column boundaries by arithmetic and on the wrong headings by meaning: "Where they're weak"
                 * sat directly under REACH and "How we win" under THREAT. Two unrelated things sharing a
                 * vertical line reads as a mistake even when every cell is in the right place.
                 *
                 * Even thirds alone did not fix it: the blocks only moved 34px and 61px, which reads as a
                 * near-miss and looks sloppier than a clean collision. So the band stops pretending to be
                 * part of the grid at all - it is one tinted panel, indented, with its own rules between
                 * the thirds. It spans the fact columns deliberately instead of accidentally, and it
                 * stacks below 1180px rather than becoming three unreadable ribbons.
                 */
                <tr key={c.id + "b"} data-row={c.id} onBlur={(e) => left(e) && commit(c.id)} className={cn(c._error && "[&>td]:bg-bad-soft")}>
                  <Td colSpan={6} wrap className="pb-2.5 pt-0">
                    <div className="grid grid-cols-3 gap-x-0 gap-y-3 rounded-[3px] border-l-2 border-input bg-secondary/60 py-2 pl-3.5 pr-3 max-[1180px]:grid-cols-1">
                      <div className="min-w-0 pr-5">
                        <div className={proseLabel}>What they do well</div>
                        <CellTextarea value={c.strengths ?? ""} placeholder="Reputation, market position, what clients say they like"
                          onChange={(e) => edit(c.id, { strengths: e.target.value })} />
                      </div>
                      <div className="min-w-0 border-border pr-5 min-[1181px]:border-l min-[1181px]:pl-5">
                        <div className={proseLabel}>Where they&apos;re weak</div>
                        <CellTextarea value={c.weaknesses ?? ""} placeholder="What their reviews complain about; where they can&apos;t follow"
                          onChange={(e) => edit(c.id, { weaknesses: e.target.value })} />
                      </div>
                      <div className="min-w-0 border-border min-[1181px]:border-l min-[1181px]:pl-5">
                        <div className={proseLabel}>How we win</div>
                        <CellTextarea value={c.how_we_win ?? ""} placeholder="The specific reason a client picks you over them"
                          onChange={(e) => edit(c.id, { how_we_win: e.target.value })} />
                      </div>
                    </div>
                  </Td>
                </tr>,
              ])}
            </tbody>
          </Grid>
        </>
      )}

      {area === "position" && (
        <div onBlur={(e) => left(e) && commitPosition()}>
          <Toolbar><Meta className="ml-0">{positioned} of 3 written. This is the competitive-advantage section a lender reads hardest.</Meta></Toolbar>
          <Section title="Our position">
            <FieldGrid>
              {POSITION_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} span={6} hint={f.hint}>
                  <FieldTextarea value={position[f.key]} placeholder={f.placeholder} className="min-h-[72px]"
                    onChange={(e) => { setPosition((p) => ({ ...p, [f.key]: e.target.value })); setPositionDirty(true); setError(undefined); }} />
                </Field>
              ))}
            </FieldGrid>
          </Section>
        </div>
      )}
      {kill && (
        <ConfirmDelete
          title={`Delete ${kill.name.trim() || "this competitor"}?`}
          what={<>Everything recorded against them goes too — how they compare on price, quality and service, and the notes behind it. They will drop out of the plan&apos;s competitor section.</>}
          onCancel={() => setKill(null)}
          onConfirm={() => remove(kill.id)}
        />
      )}
    </ModuleFrame>
  );
}

function PendingBridge({ pending, dirty, error }: { pending: boolean; dirty: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the field" : undefined), [pending, dirty, error, setNote]);
  return null;
}
