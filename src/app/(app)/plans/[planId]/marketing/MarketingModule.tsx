"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row, FootRow, Toolbar, Meta, Note, RemoveButton, CellInput, CellSelect, CellTextarea, focusRow } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldTextarea } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { formatMonth } from "../people/model";
import { saveMarket, upsertRow, deleteRow, continueFromMarketing, type RowKind } from "./actions";
import { MARKET_FIELDS, POSITION_FIELDS, SPEND_KINDS, SPEND_LABEL, COMPETITOR_KIND, COMPETITOR_REACH, COMPETITOR_PRICING, COMPETITOR_THREAT, type Market, type Position, type MarketingData, type Competitor, type Spend, type Evidence, type SpendKind } from "./model";

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
type AreaKey = "market" | "competitors" | "spend" | "evidence";
type WithMeta<T> = T & { _dirty?: boolean; _error?: string };

export function MarketingModule({ planId, initial, mode, initialArea, customerWord }: {
  planId: string; initial: MarketingData; mode: "guided" | "advanced"; initialArea: AreaKey; customerWord: string;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [market, setMarket] = useState<Market & Position>({ ...initial.market, ...initial.position });
  const [marketDirty, setMarketDirty] = useState(false);
  const [rows, setRows] = useState<{ competitors: WithMeta<Competitor>[]; spend: WithMeta<Spend>[]; evidence: WithMeta<Evidence & { when_text: string }>[] }>({
    competitors: initial.competitors, spend: initial.spend, evidence: initial.evidence.map((e) => ({ ...e, when_text: formatMonth(e.occurred_on) })),
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const marketRef = useRef(market); useEffect(() => { marketRef.current = market; }, [market]);
  const rowsRef = useRef(rows); useEffect(() => { rowsRef.current = rows; }, [rows]);
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  // ----- market (one record): saves when focus leaves the area -----
  const commitMarket = () => {
    if (!marketDirty) return;
    setMarketDirty(false);
    start(async () => { const r = await saveMarket(planId, marketRef.current); if (!r.ok) { setError(r.error); setMarketDirty(true); } });
  };

  // ----- row grids: one request per row, when focus leaves it; selects save at once -----
  type AnyRow = { id: string; _dirty?: boolean; _error?: string } & Record<string, unknown>;
  const list = (k: RowKind) => rowsRef.current[k] as unknown as AnyRow[];
  const setList = (k: RowKind, fn: (xs: AnyRow[]) => AnyRow[]) => setRows((r) => ({ ...r, [k]: fn(r[k] as unknown as AnyRow[]) }));
  const edit = (k: RowKind, id: string, changes: Record<string, unknown>, immediate = false) => {
    setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, ...changes, _dirty: true, _error: undefined } : x)));
    if (immediate) queueMicrotask(() => commit(k, id));
  };
  const commit = (k: RowKind, id: string) => {
    const row = list(k).find((x) => x.id === id);
    if (!row || !row._dirty) return;
    setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: false } : x)));
    const payload: Record<string, unknown> = { ...row, id: id.startsWith("tmp-") ? undefined : id };
    if (k === "evidence") payload.occurred_on = row.when_text;      // the action parses "Mar 2026"
    start(async () => {
      const r = await upsertRow(planId, k, payload);
      if (!r.ok) { setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: true, _error: r.error } : x))); return; }
      setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, id: r.data!.id, ...(k === "evidence" && r.data!.occurred_on !== undefined ? { occurred_on: r.data!.occurred_on, when_text: formatMonth(r.data!.occurred_on) } : {}) } : x)));
    });
  };
  const add = (k: RowKind, blank: Record<string, unknown>) => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    setList(k, (xs) => [{ id: tmp, sort_order: 0, ...blank }, ...xs]);
    focusRow(`[data-row="${tmp}"]`);
  };
  const remove = (k: RowKind, id: string) => {
    setList(k, (xs) => xs.filter((x) => x.id !== id));
    if (!id.startsWith("tmp-")) start(async () => { await deleteRow(planId, k, id); });
  };
  const flush = () => { commitMarket(); (["competitors", "spend", "evidence"] as RowKind[]).forEach((k) => list(k).forEach((r) => r._dirty && commit(k, r.id))); };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromMarketing(planId, intent); });
  };

  const written = MARKET_FIELDS.filter((f) => market[f.key].trim()).length;
  const positioned = POSITION_FIELDS.filter((f) => market[f.key].trim()).length;
  const spendTotal = rows.spend.reduce((a, s) => a + (Number(s.annual_budget) || 0), 0);
  const anyDirty = marketDirty || (["competitors", "spend", "evidence"] as RowKind[]).some((k) => (rows[k] as AnyRow[]).some((r) => r._dirty));
  const rowError = (["competitors", "spend", "evidence"] as RowKind[]).flatMap((k) => rows[k] as AnyRow[]).find((r) => r._error)?._error;
  const plural = customerWord.endsWith("s") ? customerWord : customerWord + "s";

  return (
    <ModuleFrame
      step={3} total={GUIDED_STEPS.length} group="Market" title="Marketing" subtitle={`Who your ${plural} are, who else wants them, and what you will spend to win them`} mode={mode}
      areas={[
        { key: "market", label: "Market", count: written },
        { key: "competitors", label: "Competitors", count: rows.competitors.length + positioned },
        { key: "spend", label: "Channels & spend", count: rows.spend.length },
        { key: "evidence", label: "Evidence", count: rows.evidence.length },
      ]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }}
      scope={{ label: "This plan" }}
      primaryAction={
        area === "competitors" ? <Button size="sm" type="button" onClick={() => add("competitors", { name: "", kind: "direct", reach: null, pricing: null, threat: "medium", strengths: "", weaknesses: "", how_we_win: "" })}>+ Competitor</Button>
        : area === "spend" ? <Button size="sm" type="button" onClick={() => add("spend", { kind: "advertising", approach: "", annual_budget: 0 })}>+ Channel</Button>
        : area === "evidence" ? <Button size="sm" type="button" onClick={() => add("evidence", { source: "", finding: "", occurred_on: null, when_text: "" })}>+ Evidence</Button>
        : undefined}
      footer={<ModuleFooter planId={planId} prevId="people" formId="marketing-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Specific beats big. &quot;Builders within 90 minutes of Wollongong&quot; is a market; &quot;the construction industry&quot; is not. Name the {customerWord}, the area and roughly how many.</p>
        <p>Competitors: three or four direct rivals and at least one indirect one (solves the same problem a different way). Type, reach, pricing and threat are one click each and become the comparison table in the report. &quot;Our position&quot; is the SBA&apos;s competitive-advantage section: your edge, what stops it being copied, and what could change.</p>
        <p>Channels &amp; spend: only the channels you will actually use, with a real annual number. The total feeds Overheads as a locked &quot;Marketing&quot; line — don&apos;t enter it again there.</p>
        <p>Evidence is how you show the numbers weren&apos;t invented: a survey you ran, a report you read, approvals data from council. Three rows from a real business beats a page of prose.</p>
        <h3>Where this goes</h3>
        <p><b>Market</b> and <b>Competitors</b> → the market analysis section of every report. <b>Channels &amp; spend</b> → marketing strategy section and Overheads. <b>Evidence</b> → appendix, and the SBA / grant &quot;market research&quot; question.</p>
        <p>Marketing actions with owners and dates live under <b>Goals</b>.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={anyDirty} error={error ?? rowError} />
      <form id="marketing-form" onSubmit={onSubmit} className="hidden" />

      {area === "market" && (
        <div onBlur={(e) => left(e) && commitMarket()}>
          <Toolbar><Meta className="ml-0">{written} of 4 written — all on this page. Rough is fine; you can polish later.</Meta></Toolbar>
          <Section title="Market">
            <FieldGrid>
              {MARKET_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} span={3} hint={f.hint}>
                  <FieldTextarea value={market[f.key]} placeholder={f.placeholder} className="min-h-[84px]"
                    onChange={(e) => { setMarket((m) => ({ ...m, [f.key]: e.target.value })); setMarketDirty(true); setError(undefined); }} />
                </Field>
              ))}
            </FieldGrid>
          </Section>
        </div>
      )}

      {area === "competitors" && (
        <>
          <div onBlur={(e) => left(e) && commitMarket()}>
            <Toolbar><Meta className="ml-0">Direct and indirect rivals, how they compare, and why a {customerWord} picks you. The report builds the comparison table from this grid.</Meta></Toolbar>
            <Section title="Our position">
              <FieldGrid>
                {POSITION_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} span={2} hint={f.hint}>
                    <FieldTextarea value={market[f.key]} placeholder={f.placeholder} className="min-h-[64px]"
                      onChange={(e) => { setMarket((m) => ({ ...m, [f.key]: e.target.value })); setMarketDirty(true); setError(undefined); }} />
                  </Field>
                ))}
              </FieldGrid>
            </Section>
          </div>
          <Section title="Competitors"><span /></Section>
          <Grid>
            <thead><tr>
              <Th style={{ width: 150 }}>Competitor</Th><Th style={{ width: 96 }}>Type</Th><Th style={{ width: 104 }}>Reach</Th><Th style={{ width: 130 }}>Pricing vs us</Th><Th style={{ width: 100 }}>Threat</Th>
              <Th>What they do well</Th><Th>Where they&apos;re weak</Th><Th>How we win</Th><Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {rows.competitors.length === 0 && <tr><Td colSpan={9} className="py-6 text-center text-muted-foreground">No competitors yet. Add the two or three a {customerWord} would compare you with — and one indirect one that solves the same problem another way.</Td></tr>}
              {rows.competitors.map((c) => (
                <Row key={c.id} data-row={c.id} onBlur={(e) => left(e) && commit("competitors", c.id)} className={cn("[&>td]:align-top [&>td]:pt-[6px]", c._error && "[&>td]:bg-bad-soft")} title={c._error}>
                  <Td><CellInput value={c.name} placeholder="Name" onChange={(e) => edit("competitors", c.id, { name: e.target.value })} /></Td>
                  <Td><CellSelect value={c.kind} options={COMPETITOR_KIND} onValueChange={(v) => edit("competitors", c.id, { kind: v }, !!c.name.trim())} /></Td>
                  <Td><CellSelect value={c.reach} options={COMPETITOR_REACH} placeholder="—" onValueChange={(v) => edit("competitors", c.id, { reach: v }, !!c.name.trim())} /></Td>
                  <Td><CellSelect value={c.pricing} options={COMPETITOR_PRICING} placeholder="—" onValueChange={(v) => edit("competitors", c.id, { pricing: v }, !!c.name.trim())} /></Td>
                  <Td><CellSelect value={c.threat} options={COMPETITOR_THREAT} className={cn("font-semibold", c.threat === "critical" || c.threat === "high" ? "text-bad" : c.threat === "medium" ? "text-warn" : "text-good")} onValueChange={(v) => edit("competitors", c.id, { threat: v }, !!c.name.trim())} /></Td>
                  <Td wrap><CellTextarea value={c.strengths ?? ""} placeholder="Reputation, market position, what clients say they like" onChange={(e) => edit("competitors", c.id, { strengths: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={c.weaknesses ?? ""} placeholder="What their reviews complain about; where they can't follow" onChange={(e) => edit("competitors", c.id, { weaknesses: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={c.how_we_win ?? ""} placeholder="The specific reason a client picks you over them" onChange={(e) => edit("competitors", c.id, { how_we_win: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => remove("competitors", c.id)} /></Td>
                </Row>
              ))}
            </tbody>
          </Grid>
        </>
      )}

      {area === "spend" && (
        <>
          <Toolbar><Meta className="ml-0">Only the channels you will use. The total feeds Overheads as a locked Marketing line.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: 220 }}>Type</Th><Th>Approach</Th><Th right style={{ width: 140 }}>Annual budget</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.spend.length === 0 && <tr><Td colSpan={4} className="py-6 text-center text-muted-foreground">No channels yet. Add each way you reach {plural}, with what it costs a year.</Td></tr>}
              {rows.spend.map((s) => (
                <Row key={s.id} data-row={s.id} onBlur={(e) => left(e) && commit("spend", s.id)} className={cn(s._error && "[&>td]:bg-bad-soft")} title={s._error}>
                  <Td><CellSelect value={s.kind} options={SPEND_KINDS.map((k) => ({ value: k, label: SPEND_LABEL[k] }))} onValueChange={(v) => edit("spend", s.id, { kind: v as SpendKind }, !!s.approach.trim())} /></Td>
                  <Td wrap><CellTextarea value={s.approach} placeholder="e.g. Google Ads on 'concreter Wollongong'; referral fee to builders" onChange={(e) => edit("spend", s.id, { approach: e.target.value })} /></Td>
                  <Td right><CellInput numeric value={s.annual_budget ? fmt.format(s.annual_budget) : ""} placeholder="0" onChange={(e) => edit("spend", s.id, { annual_budget: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></Td>
                  <Td><RemoveButton onClick={() => remove("spend", s.id)} /></Td>
                </Row>
              ))}
            </tbody>
            <FootRow><Td colSpan={2}>Total → Overheads (Marketing)</Td><Td right className="num">{fmt.format(spendTotal)}</Td><Td /></FootRow>
          </Grid>
          <Note>Annual figures for Year 1. Later years follow the Overheads growth assumption unless you change them there.</Note>
        </>
      )}

      {area === "evidence" && (
        <>
          <Toolbar><Meta className="ml-0">What you did or read, and what it showed. This answers the &quot;market research&quot; question in grant and SBA templates.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "30%" }}>Source or method</Th><Th>What it showed</Th><Th style={{ width: 120 }}>When</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.evidence.length === 0 && <tr><Td colSpan={4} className="py-6 text-center text-muted-foreground">No evidence yet. A survey, a report, council data, a trial — anything that backs the Market numbers.</Td></tr>}
              {rows.evidence.map((ev) => (
                <Row key={ev.id} data-row={ev.id} onBlur={(e) => left(e) && commit("evidence", ev.id)} className={cn(ev._error && "[&>td]:bg-bad-soft")} title={ev._error}>
                  <Td wrap><CellTextarea value={ev.source} placeholder="e.g. Phone survey of 40 builders" onChange={(e) => edit("evidence", ev.id, { source: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={ev.finding ?? ""} placeholder="e.g. 31 of 40 had waited >3 weeks for a slab in the last year" onChange={(e) => edit("evidence", ev.id, { finding: e.target.value })} /></Td>
                  <Td><CellInput value={ev.when_text} placeholder="month year" onChange={(e) => edit("evidence", ev.id, { when_text: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => remove("evidence", ev.id)} /></Td>
                </Row>
              ))}
            </tbody>
          </Grid>
        </>
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
