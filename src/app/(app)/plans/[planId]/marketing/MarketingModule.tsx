"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Grid, Th, Td, Row, FootRow, Toolbar, Meta, Note, RemoveButton, CellInput, CellSelect, CellTextarea, focusRow } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldTextarea } from "@/components/module/FieldGrid";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { ConfirmDelete } from "@/components/module/ConfirmDelete";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/MoneyProvider";
import { customerNoun, productNoun } from "@/engine/plan/vocabulary";
import { formatMonth } from "../people/model";
import { saveMarket, saveMarketFigures, upsertRow, deleteRow, continueFromMarketing, type RowKind } from "./actions";
import { MARKET_FIELDS, POSITION_ONE_LINER, BRAND_FIELDS, salesFields, SALES_KEYS, SPEND_KINDS, SPEND_LABEL, type Market, type MarketingData, type Spend, type Evidence, type SpendKind, type Segment, type Customer, MAX_CUSTOMERS } from "./model";
import { acquisitionByYear } from "@/engine/marketing/acquisition";
import type { AnyProduct } from "@/engine/sales/product";
import { GoalDialog } from "@/components/goals/GoalDialog";
import { deleteGoal, saveGoal, setGoalStatus } from "../goals/actions";
import { STATUSES, type Goal, type GoalStatus, type Person } from "../goals/model";
import { useSaveOnce } from "@/lib/saveOnce";
import { DraftField, type Drafting } from "@/components/module/DraftField";
import { useRouter } from "next/navigation";

const TONE: Record<GoalStatus, string> = {
  not_started: "bg-secondary text-muted-foreground",
  in_progress: "bg-accent text-primary",
  done: "bg-good-soft text-good",
  at_risk: "bg-warn-soft text-warn",
};

type AreaKey = "market" | "spend" | "research" | "brand" | "sales" | "actions";
type WithMeta<T> = T & { _dirty?: boolean };

export function MarketingModule({ planId, initial, mode, initialArea, customerWord, productWord, actions, people, products, drafting = {} }: {
  planId: string; initial: MarketingData; mode: "guided" | "advanced"; initialArea: AreaKey; customerWord: string;
  /** plan_settings.product_type, for the plan's own word for one sale (§6.31.1). */
  productWord: string | null;
  /**
   * The plan's MARKETING goals (§6.60) — not a second list. A marketing action with an owner and a date is
   * a quarterly goal, so this screen and the Goals step are two windows onto the same rows.
   */
  actions: Goal[]; people: Person[];
  /** The plan's sales lines, so this screen can say what a customer costs to win (§6.61). */
  products: AnyProduct[];
  /**
   * What the server decided each narrative box may offer (§6.109). Absent key = no button by design,
   * null = draftable but drafting is off. This module keeps no list of its own.
   */
  drafting?: Drafting;
}) {
  const num = useMoney();
  const router = useRouter();
  const once = useSaveOnce();
  const [acts, setActs] = useState<Goal[]>(actions);
  const [editing, setEditing] = useState<{ goal?: Goal } | null>(null);
  const [killAction, setKillAction] = useState<Goal | null>(null);
  // The plan can move underneath an open screen (§6.43.2) — a goal edited on the Goals step lands here.
  const [actsFrom, setActsFrom] = useState(actions);
  if (actions !== actsFrom) { setActsFrom(actions); setActs(actions); }
  const ownerName = (id: string | null) => people.find((p) => p.id === id)?.name || "";
  /*
   * WHEN, AS A DATE (§6.125). A marketing action used to be filed in one of the plan's quarters; the ladder
   * replaced quarters with a single 90-day period and a due date on each goal, so this reads the date it
   * carries rather than translating a quarter number back into months.
   */
  const whenLabel = (g: Goal) => g.milestone_date ?? "No date";
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [kill, setKill] = useState<{ id: string; channel: string; budget: number } | null>(null);
  const [market, setMarket] = useState<Market>(initial.market);
  const [marketDirty, setMarketDirty] = useState(false);
  // An empty grid starts with one blank row ready to type in (it only saves once its first column is filled).
  // The starter row has a fixed id so server and client render the same HTML; rows added later get random ids.
  const blankSpend = (id = "tmp-new-spend"): WithMeta<Spend> => ({ id, kind: "advertising", approach: "", annual_budget: 0, sort_order: 0 });
  const blankEvidence = (id = "tmp-new-evidence"): WithMeta<Evidence & { when_text: string }> => ({ id, source: "", method: "", finding: "", decision: "", occurred_on: null, when_text: "", sort_order: 0 });
  const blankSegment = (id = "tmp-new-segment"): WithMeta<Segment> => ({ id, name: "", profile: "", cares_about: "", revenue_share: null, sort_order: 0 });
  const blankCustomer = (id = "tmp-new-customer"): WithMeta<Customer & { ends_text: string }> => ({ id, name: "", revenue_share: null, contract_ends_on: null, assignable: null, ends_text: "", sort_order: 0 });
  const [rows, setRows] = useState<{ spend: WithMeta<Spend>[]; evidence: WithMeta<Evidence & { when_text: string }>[]; segments: WithMeta<Segment>[]; customers: WithMeta<Customer & { ends_text: string }>[] }>({
    spend: initial.spend.length ? initial.spend : [blankSpend()],
    evidence: initial.evidence.length ? initial.evidence.map((e) => ({ ...e, when_text: formatMonth(e.occurred_on) })) : [blankEvidence()],
    segments: initial.segments.length ? initial.segments : [blankSegment()],
    customers: initial.customers.length ? initial.customers.map((c) => ({ ...c, ends_text: formatMonth(c.contract_ends_on) })) : [blankCustomer()],
  });
  /*
   * RETENTION AND PIPELINE (§6.129.3). Raw strings, parsed on the way out, with the ref written on every
   * edit — the fault that dropped one of two quickly-filled boxes on Assumptions is not being rebuilt here.
   */
  const pctStr = (v: number | null) => (v === null ? "" : String(v));
  const [figs, setFigs] = useState({ retention: pctStr(initial.figures.customer_retention_pct), pipeline: pctStr(initial.figures.weighted_pipeline) });
  const figsRef = useRef(figs);
  const editFig = (k: "retention" | "pipeline", v: string) => { const next = { ...figsRef.current, [k]: v }; figsRef.current = next; setFigs(next); };
  const figNum = (raw: string) => { const t = raw.trim(); if (!t) return null; const x = Number(t.replace(/[^0-9.]/g, "")); return Number.isFinite(x) ? x : null; };
  /** Keyed per row and per area, so several failures are several messages (§6.98). */
  const errors = useSaveErrors();
  const [pending, start] = useTransition();
  const marketRef = useRef(market); useEffect(() => { marketRef.current = market; }, [market]);
  const rowsRef = useRef(rows); useEffect(() => { rowsRef.current = rows; }, [rows]);
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  // ----- market (one record): saves when focus leaves the area -----
  const commitMarket = () => {
    if (!marketDirty) return;
    setMarketDirty(false);
    start(async () => {
      const r = await saveMarket(planId, marketRef.current);
      if (!r.ok) { errors.raise({ key: "market", message: r.error, label: "The market" }); setMarketDirty(true); }
      else errors.clear("market");
    });
  };

  const commitFig = (k: "retention" | "pipeline") => start(async () => {
    const v = figNum(figsRef.current[k]);
    const r = await saveMarketFigures(planId, k === "retention" ? { customer_retention_pct: v } : { weighted_pipeline: v });
    if (!r.ok) errors.raise({ key: `fig:${k}`, message: r.error, label: k === "retention" ? "Customer retention" : "Pipeline" });
    else errors.clear(`fig:${k}`);
  });

  // ----- row grids: one request per row, when focus leaves it; selects save at once -----
  type AnyRow = { id: string; _dirty?: boolean } & Record<string, unknown>;
  type GridKind = Exclude<RowKind, "competitors">;
  const list = (k: GridKind) => rowsRef.current[k] as unknown as AnyRow[];
  const setList = (k: GridKind, fn: (xs: AnyRow[]) => AnyRow[]) => setRows((r) => ({ ...r, [k]: fn(r[k] as unknown as AnyRow[]) }));
  const edit = (k: GridKind, id: string, changes: Record<string, unknown>, immediate = false) => {
    setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, ...changes, _dirty: true } : x)));
    if (immediate) queueMicrotask(() => commit(k, id));
  };
  const commit = (k: GridKind, id: string) => {
    const row = list(k).find((x) => x.id === id);
    if (!row || !row._dirty) return;
    setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: false } : x)));
    const payload: Record<string, unknown> = { ...row, id: id.startsWith("tmp-") ? undefined : id };
    if (k === "evidence") payload.occurred_on = row.when_text;      // the action parses "Mar 2026"
    if (k === "customers") payload.contract_ends_on = row.ends_text;
    start(async () => {
      const r = await upsertRow(planId, k, payload);
      if (!r.ok) {
        errors.raise({ key: `${k}:${id}`, message: r.error, label: k === "spend" ? "Marketing spend" : k === "evidence" ? "Evidence" : k === "customers" ? "Customer" : "Segment" });
        setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: true } : x)));
        return;
      }
      errors.clear(`${k}:${id}`);
      setList(k, (xs) => xs.map((x) => (x.id === id ? {
        ...x, id: r.data!.id,
        ...(k === "evidence" && r.data!.occurred_on !== undefined ? { occurred_on: r.data!.occurred_on, when_text: formatMonth(r.data!.occurred_on) } : {}),
        ...(k === "customers" && r.data!.occurred_on !== undefined ? { contract_ends_on: r.data!.occurred_on, ends_text: formatMonth(r.data!.occurred_on) } : {}),
      } : x)));
    });
  };
  const add = (k: GridKind, blank: Record<string, unknown>) => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    setList(k, (xs) => [{ id: tmp, sort_order: 0, ...blank }, ...xs]);
    focusRow(`[data-row="${tmp}"]`);
  };
  /**
   * A spend line feeds the Marketing total that Overheads locks in, so it asks first (§6.24). A piece of
   * evidence is a line of text and still goes on one click — a dialog there only teaches people to
   * click through dialogs.
   */
  const askRemoveSpend = (id: string) => {
    const r = (list("spend") as AnyRow[]).find((x) => x.id === id) as { channel?: string; annual_budget?: number } | undefined;
    if (!r || (!r.channel?.trim() && id.startsWith("tmp-"))) { remove("spend", id); return; }
    setKill({ id, channel: r.channel ?? "", budget: Number(r.annual_budget ?? 0) });
  };
  const remove = (k: GridKind, id: string) => {
    setKill(null);
    /* The blank that replaces the last row is THIS grid's blank — it used to hand segments an evidence row. */
    const blankFor = (g: GridKind): AnyRow => {
      const tmp = `tmp-${crypto.randomUUID()}`;
      return (g === "spend" ? blankSpend(tmp) : g === "evidence" ? blankEvidence(tmp) : g === "segments" ? blankSegment(tmp) : blankCustomer(tmp)) as unknown as AnyRow;
    };
    setList(k, (xs) => { const rest = xs.filter((x) => x.id !== id); return rest.length ? rest : [blankFor(k)]; });
    if (!id.startsWith("tmp-")) start(async () => { await deleteRow(planId, k, id); });
  };
  const flush = () => { commitMarket(); (["spend", "evidence", "segments", "customers"] as GridKind[]).forEach((k) => list(k).forEach((r) => r._dirty && commit(k, r.id))); };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromMarketing(planId, intent); });
  };

  const written = [...MARKET_FIELDS, POSITION_ONE_LINER].filter((f) => (market[f.key as keyof Market] ?? "").trim()).length;

  /**
   * The six promotion categories APeX forced every business to consider (§6.61).
   *
   * §6.13 called that rigidity a fault and replaced it with an empty grid, which threw the baby out: a
   * concreter who has never thought about customer retention does not add a retention row, and the plan
   * then looks finished. Rigid was wrong; SILENT is worse. So the ones with no row are offered as faint
   * suggestions, the way the SWOT step offers lines drawn from the plan (§6.14) — one click to take one,
   * and nothing enters the grid without it. Distribution is left out of the count: a business with no
   * separate route to market is not missing anything.
   */
  const usedKinds = new Set(rows.spend.filter((r) => r.approach.trim()).map((r) => r.kind));
  const missingKinds = (SPEND_KINDS as readonly SpendKind[]).filter((k) => k !== "distribution" && !usedKinds.has(k));

  /** What a customer costs to win — the plan's own spend over the plan's own count (§6.61). */
  const spendTotal = rows.spend.reduce((a, s) => a + (Number(s.annual_budget) || 0), 0);
  const acquisition = acquisitionByYear(products, Array(5).fill(spendTotal));
  const anyDirty = marketDirty || (["spend", "evidence", "segments", "customers"] as GridKind[]).some((k) => (rows[k] as AnyRow[]).some((r) => r._dirty));
  const plural = customerNoun(customerWord).many.toLowerCase();
  /** What this plan calls one sale (§6.31.1): a job, a treatment, a client. Nobody wins a "job" in software. */
  const one = productNoun(productWord).one.toLowerCase();
  /** Segment shares are a rough split and optional — but if they are given, they should add up. */
  const shareTotal = Math.round(rows.segments.reduce((a, sg) => a + (Number(sg.revenue_share) || 0), 0));

  /** One field list, three tabs (§6.61) — every narrative box on this module saves the same way. */
  const narrative = (fields: readonly { key: string; label: string; hint: string; placeholder: string }[]) => (
    <FieldGrid>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} span={3} hint={f.hint}>
          <FieldTextarea value={market[f.key as keyof Market] ?? ""} placeholder={f.placeholder} className="min-h-[84px]"
            onChange={(e) => { setMarket((m) => ({ ...m, [f.key]: e.target.value })); setMarketDirty(true); }} />
          {/*
            ONE LINE, EVERY NARRATIVE BOX ON THE MODULE (§6.109). The button appears where the server said
            it may; where it may not, nothing appears at all. There is no list here of which fields those
            are, so this screen cannot drift out of step with what the drafter will actually accept.

            A draft lands in the BOX, not in the database — `setMarketDirty` is the same thing typing does,
            so the module's own save runs on the module's own terms.
          */}
          <DraftField planId={planId} field={f} offer={drafting[f.key]} value={market[f.key as keyof Market] ?? ""}
            onUse={(text) => { setMarket((m) => ({ ...m, [f.key]: text })); setMarketDirty(true); }} />
        </Field>
      ))}
    </FieldGrid>
  );

  return (
    <ModuleFrame
      step={3} total={GUIDED_STEPS.length} group={navGroup("marketing")} title="Marketing" subtitle={`Who your ${plural} are and what you will spend to win them`} mode={mode}
      errors={errors}
      areas={[
        { key: "market", label: "Market", count: written },
        { key: "spend", label: "Channels & spend", count: rows.spend.filter((r) => r.approach.trim()).length,
          ...(missingKinds.length ? { tag: `${missingKinds.length} not considered` } : {}) },
        { key: "research", label: "Research", count: rows.evidence.filter((r) => r.source.trim()).length },
        { key: "brand", label: "Brand", count: BRAND_FIELDS.filter((f) => (market[f.key as keyof Market] ?? "").trim()).length },
        { key: "sales", label: "Sales process", count: SALES_KEYS.filter((k) => (market[k] ?? "").trim()).length },
        { key: "actions", label: "Actions", count: acts.length },
      ]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }}
      scope={{ label: "This plan" }}
      primaryAction={
        area === "market" ? <Button size="sm" type="button" onClick={() => add("segments", { name: "", profile: "", cares_about: "", revenue_share: null })}>+ Segment</Button>
        : area === "spend" ? <Button size="sm" type="button" onClick={() => add("spend", { kind: "advertising", approach: "", annual_budget: 0 })}>+ Channel</Button>
        : area === "research" ? <Button size="sm" type="button" onClick={() => add("evidence", { source: "", method: "", finding: "", decision: "", occurred_on: null, when_text: "" })}>+ Research</Button>
        : area === "actions" ? <Button size="sm" type="button" onClick={() => setEditing({})}>+ Action</Button>
        : undefined}
      footer={<ModuleFooter planId={planId} moduleId="marketing" formId="marketing-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Specific beats big. &quot;Builders within 90 minutes of Wollongong&quot; is a market; &quot;the construction industry&quot; is not. Name the {customerWord}, the area and roughly how many.</p>
                <p>Channels &amp; spend: only the channels you will actually use, with a real annual number. The total feeds Overheads as a locked &quot;Marketing&quot; line — don&apos;t enter it again there.</p>
        <p>Evidence is how you show the numbers weren&apos;t invented: a survey you ran, a report you read, approvals data from council. Three rows from a real business beats a page of prose.</p>
        <h3>Where this goes</h3>
        <p><b>Market</b> → the market analysis section of every report; competitors are the next step. <b>Channels &amp; spend</b> → marketing strategy section and Overheads. <b>Evidence</b> → appendix, and the SBA / grant &quot;market research&quot; question.</p>
        <h3>Actions</h3>
        <p>An action with a name on it and a date is a <b>goal</b> — so the Actions tab is not a second list. These are the Marketing goals from step {GUIDED_STEPS.find((s) => s.id === "goals")?.step}, shown here where the marketing is planned. Add one here and it is there; change it there and it is here. One list, two windows.</p>
        <p>Status saves on the spot, because that is the one field a review meeting changes.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={anyDirty} />
      <form id="marketing-form" onSubmit={onSubmit} className="hidden" />

      {area === "market" && (
        <>
          {/*
            Who you sell to is a GRID (§6.62). One row reads like the single box it replaces; a business with
            a commercial arm and a residential one stops describing both in one paragraph.
          */}
          <Toolbar><Meta className="ml-0">
            One row for each kind of buyer. Most businesses have one or two — if you catch yourself writing
            &quot;and also&quot; in a row, that is a second segment.
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "22%" }}>Who you sell to</Th>
              <Th>What they have in common</Th>
              <Th>What they care about</Th>
              <Th right style={{ width: 110 }}>Share of sales</Th>
              <Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {rows.segments.map((sg) => (
                <Row key={sg.id} data-row={sg.id} onBlur={(e) => left(e) && commit("segments", sg.id)} className={cn(errors.forKey(`segments:${sg.id}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`segments:${sg.id}`)}>
                  <Td wrap><CellTextarea value={sg.name} placeholder="e.g. Residential builders" onChange={(e) => edit("segments", sg.id, { name: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={sg.profile ?? ""} placeholder="e.g. Licensed, 3–25 staff, $2–12M turnover, within 90 minutes" onChange={(e) => edit("segments", sg.id, { profile: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={sg.cares_about ?? ""} placeholder="e.g. Never holding up their other trades. Pays more to avoid a callback." onChange={(e) => edit("segments", sg.id, { cares_about: e.target.value })} /></Td>
                  <Td right><CellInput numeric suffix="%" value={sg.revenue_share === null ? "" : String(sg.revenue_share)} placeholder="—"
                    onChange={(e) => edit("segments", sg.id, { revenue_share: e.target.value.trim() === "" ? null : Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></Td>
                  <Td><RemoveButton onClick={() => remove("segments", sg.id)} /></Td>
                </Row>
              ))}
            </tbody>
            {shareTotal > 0 && (
              <FootRow>
                <Td colSpan={3}>{shareTotal === 100 ? "All of your sales are accounted for" : `Shares add to ${shareTotal}%`}</Td>
                <Td right className={cn("num", shareTotal !== 100 && "text-warn")}>{shareTotal}%</Td>
                <Td />
              </FootRow>
            )}
          </Grid>
          <Note>Share of sales is optional — it is a rough split, not a forecast. The forecast comes from your Sales lines.</Note>

          {/*
            THE LARGEST CUSTOMERS BY NAME (§6.129.3). The segments above say what KIND of buyer; a buyer's
            adviser asks WHICH ones, and what share each holds, before anything else. Five at most — this is
            concentration, not a customer list, and a sixth customer is by definition not a concentration risk.
          */}
          <Toolbar>
            <Meta className="ml-0">
              Your largest {plural}, up to {MAX_CUSTOMERS}. A buyer asks who they are, what share of sales each holds, and
              whether their contracts pass to a new owner. Read on Financial Capabilities.
            </Meta>
            <Button size="sm" variant="outline" type="button" className="ml-auto"
              disabled={rows.customers.filter((c) => !c.id.startsWith("tmp-") || c.name.trim()).length >= MAX_CUSTOMERS}
              onClick={() => add("customers", { name: "", revenue_share: null, contract_ends_on: null, assignable: null, ends_text: "" })}>
              + Customer
            </Button>
          </Toolbar>
          <Grid>
            <thead><tr>
              <Th>Customer</Th>
              <Th right style={{ width: 120 }}>Share of sales</Th>
              <Th style={{ width: 150 }}>Contract ends</Th>
              <Th style={{ width: 190 }}>Passes to a new owner?</Th>
              <Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {rows.customers.map((c) => (
                <Row key={c.id} data-row={c.id} onBlur={(e) => left(e) && commit("customers", c.id)}
                  className={cn(errors.forKey(`customers:${c.id}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`customers:${c.id}`)}>
                  <Td><CellInput value={c.name} placeholder="e.g. Metricon Homes" onChange={(e) => edit("customers", c.id, { name: e.target.value })} /></Td>
                  <Td right><CellInput numeric suffix="%" value={c.revenue_share === null ? "" : String(c.revenue_share)} placeholder="—"
                    onChange={(e) => edit("customers", c.id, { revenue_share: e.target.value.trim() === "" ? null : Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></Td>
                  <Td><CellInput value={c.ends_text} placeholder="e.g. Mar 2027, or blank"
                    onChange={(e) => edit("customers", c.id, { ends_text: e.target.value })} /></Td>
                  <Td>
                    <CellSelect value={c.assignable === true ? "yes" : c.assignable === false ? "no" : "unknown"}
                      options={[{ value: "unknown", label: "Not checked" }, { value: "yes", label: "Yes, it can be assigned" }, { value: "no", label: "No — ends on a sale" }]}
                      onValueChange={(v) => edit("customers", c.id, { assignable: v === "yes" ? true : v === "no" ? false : null }, !!c.name.trim())} />
                  </Td>
                  <Td><RemoveButton onClick={() => remove("customers", c.id)} /></Td>
                </Row>
              ))}
            </tbody>
          </Grid>

          <div className="mt-2">
            <Section title="Keeping them">
              <FieldGrid>
                <Field label="Customer retention %" span={2} error={errors.forKey("fig:retention")}
                  hint={`Of the ${plural} you had a year ago, how many are still buying. Leave it empty if you do not know — a guess here is read as a fact.`}>
                  <CellInput numeric suffix="%" value={figs.retention} placeholder="Not said"
                    onChange={(e) => editFig("retention", e.target.value)} onBlur={() => commitFig("retention")} />
                </Field>
              </FieldGrid>
            </Section>
          </div>

          <div onBlur={(e) => left(e) && commitMarket()} className="mt-4">
            <Section title="The market">{narrative(MARKET_FIELDS)}</Section>
            <Section title="Position">{narrative([POSITION_ONE_LINER])}</Section>
          </div>
        </>
      )}

      {area === "brand" && (
        <div onBlur={(e) => left(e) && commitMarket()}>
          <Toolbar><Meta className="ml-0">What the business stands for, how it sounds, how it looks. Your <b>purpose</b> and <b>brand promise</b> are step 1 — this is what a customer meets. <span className="text-faint">Optional: plenty of good plans skip it.</span></Meta></Toolbar>
          <Section title="Brand">{narrative(BRAND_FIELDS)}</Section>
        </div>
      )}

      {area === "sales" && (
        <div onBlur={(e) => left(e) && commitMarket()}>
          <Toolbar><Meta className="ml-0">Marketing brings them to the door. This is what happens next — and it is the half most plans leave out.</Meta></Toolbar>
          <Section title="Winning the work">{narrative(salesFields(one))}</Section>
          {/*
            THE PIPELINE, AS ONE NUMBER (§6.129.3). Weighted, because a list of quotes at face value is a wish
            list: a $200,000 quote you will probably lose is worth less than a $50,000 one you will probably win.
            Read against next year's growth on Financial Capabilities.
          */}
          <Section title="Work in the pipeline">
            <FieldGrid>
              <Field label="Weighted value of quoted work" span={2} error={errors.forKey("fig:pipeline")}
                hint="Each open quote times your honest chance of winning it, added up. A $100,000 quote at a one-in-four chance counts as $25,000.">
                <CellInput money value={figs.pipeline} placeholder="Not said"
                  onChange={(e) => editFig("pipeline", e.target.value)} onBlur={() => commitFig("pipeline")} />
              </Field>
            </FieldGrid>
          </Section>
        </div>
      )}

      {area === "spend" && (
        <>
          <Toolbar><Meta className="ml-0">Only the channels you will use. The total feeds Overheads as a locked Marketing line.</Meta></Toolbar>
          <Grid>
            {/* 220 clipped "Customer retention & loyalty" — the longest label decides this column, not the header (§6.62.1). */}
            <thead><tr><Th style={{ width: 248 }}>Type</Th><Th>Approach</Th><Th right style={{ width: 140 }}>Annual budget</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.spend.map((s) => (
                <Row key={s.id} data-row={s.id} onBlur={(e) => left(e) && commit("spend", s.id)} className={cn(errors.forKey(`spend:${s.id}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`spend:${s.id}`)}>
                  <Td><CellSelect value={s.kind} options={SPEND_KINDS.map((k) => ({ value: k, label: SPEND_LABEL[k] }))} onValueChange={(v) => edit("spend", s.id, { kind: v as SpendKind }, !!s.approach.trim())} /></Td>
                  <Td wrap><CellTextarea value={s.approach} placeholder="e.g. Google Ads on 'concreter Wollongong'; referral fee to builders" onChange={(e) => edit("spend", s.id, { approach: e.target.value })} /></Td>
                  <Td right><CellInput numeric value={s.annual_budget ? num(s.annual_budget) : ""} placeholder="0" onChange={(e) => edit("spend", s.id, { annual_budget: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></Td>
                  <Td><RemoveButton onClick={() => askRemoveSpend(s.id)} /></Td>
                </Row>
              ))}
            </tbody>
            <FootRow><Td colSpan={2}>Total → Overheads (Marketing)</Td><Td right className="num">{num(spendTotal)}</Td><Td /></FootRow>
          </Grid>

          {/* Rigid was wrong; silent is worse (§6.61). Offered, never added without the click. */}
          {missingKinds.length > 0 && (
            <div className="mt-3 rounded border border-dashed border-border px-3 py-2.5">
              <div className="text-[11.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
                Not considered yet
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Nothing here is compulsory — plenty of businesses use three of the six. But a plan that never
                mentions {missingKinds.length === 1 ? "this one" : "these"} has not decided against {missingKinds.length === 1 ? "it" : "them"}, it has forgotten {missingKinds.length === 1 ? "it" : "them"}.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingKinds.map((k) => (
                  <button key={k} type="button"
                    onClick={() => add("spend", { kind: k, approach: "", annual_budget: 0 })}
                    className="rounded-full border border-input px-2.5 py-0.5 text-[11.5px] text-muted-foreground hover:border-primary hover:text-primary">
                    + {SPEND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* One marketing KPI that is arithmetic rather than a wish (§6.61). */}
          {spendTotal > 0 && (
            <div className="mt-3 rounded border border-input bg-secondary px-3 py-2.5">
              <div className="text-[11.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
                What a {customerWord} costs to win
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
                {acquisition.map((a) => (
                  <div key={a.year} className="text-[13px]">
                    <span className="text-muted-foreground">Year {a.year} </span>
                    {a.costPerWin === null
                      ? <span className="text-muted-foreground">—</span>
                      : <><b className="num">{num(a.costPerWin)}</b> <span className="text-[11.5px] text-muted-foreground">({Math.round(a.won)} won)</span></>}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                This year&apos;s marketing spend divided by the new jobs and ongoing {plural} the plan wins that year —
                your own figures, not a benchmark. A line whose {plural} come from another line is left out, so a
                maintenance plan built on your own jobs does not count the same {customerWord} twice.
              </p>
            </div>
          )}

          <Note>Annual figures for Year 1; later years follow the Overheads growth assumption unless you change them there. If your spend is lumpy — a campaign in March, a trade show in August — set its month-by-month shape on the <b>Marketing</b> line in Overheads, and the cash flow will follow it.</Note>
        </>
      )}

      {area === "actions" && (
        <>
          <Toolbar><Meta className="ml-0">
            What gets done, by whom, by when. These are the plan&apos;s <b>Marketing goals</b> — the same
            rows step {GUIDED_STEPS.find((g) => g.id === "goals")?.step} shows, not a second list.
          </Meta></Toolbar>
          {acts.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground">
              Nothing owned yet.
              <div className="mt-1 text-[12px]">A strategy nobody is accountable for is a strategy that does not happen. Give one of the channels above a name and a quarter.</div>
            </div>
          ) : (
            <Grid>
              <thead><tr>
                <Th>What will be done</Th>
                <Th style={{ width: 130 }}>When</Th>
                <Th style={{ width: 150 }}>Owner</Th>
                <Th style={{ width: 150 }}>Status</Th>
                <Th style={{ width: 36 }} />
              </tr></thead>
              <tbody>
                {acts.map((g) => (
                  <Row key={g.id}>
                    <Td wrap>
                      <button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setEditing({ goal: g })}>{g.title}</button>
                    </Td>
                    <Td className={cn(!g.milestone_date && "text-muted-foreground")}>{whenLabel(g)}</Td>
                    <Td className={cn(!g.owner_person_id && "text-muted-foreground")}>{ownerName(g.owner_person_id) || "Nobody yet"}</Td>
                    {/* The one field a review meeting changes, so it saves without opening the dialog (§6.7). */}
                    <Td>
                      <CellSelect value={g.status} options={STATUSES.map((st) => ({ value: st.key, label: st.label }))}
                        className={cn("w-full", TONE[g.status])}
                        onValueChange={(v) => {
                          const status = v as GoalStatus;
                          setActs((xs) => xs.map((x) => (x.id === g.id ? { ...x, status } : x)));
                          start(async () => { await setGoalStatus(planId, g.id, status); router.refresh(); });
                        }} />
                    </Td>
                    <Td><RemoveButton onClick={() => setKillAction(g)} /></Td>
                  </Row>
                ))}
              </tbody>
            </Grid>
          )}
          <Note>Owners come from your Leadership Team. Everything here also appears under Goals, with the other five areas beside it.</Note>
        </>
      )}

      {area === "research" && (
        <>
          <Toolbar><Meta className="ml-0">The question, how you answered it, what it showed — and what you will do about it. That last column is the only one that changes anything.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "22%" }}>What you wanted to know</Th><Th style={{ width: "20%" }}>How you looked</Th><Th>What it showed</Th><Th style={{ width: "22%" }}>What you&apos;ll do</Th><Th style={{ width: 110 }}>When</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.evidence.map((ev) => (
                <Row key={ev.id} data-row={ev.id} onBlur={(e) => left(e) && commit("evidence", ev.id)} className={cn(errors.forKey(`evidence:${ev.id}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`evidence:${ev.id}`)}>
                  <Td wrap><CellTextarea value={ev.source} placeholder="e.g. How long do builders wait for a slab — and would they pay to wait less?" onChange={(e) => edit("evidence", ev.id, { source: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={ev.method ?? ""} placeholder="e.g. Phone survey of 40 builders, over two weeks" onChange={(e) => edit("evidence", ev.id, { method: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={ev.finding ?? ""} placeholder="e.g. 31 of 40 had waited >3 weeks in the last year; 26 would pay 5–8% more for a guaranteed date" onChange={(e) => edit("evidence", ev.id, { finding: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={ev.decision ?? ""} placeholder="e.g. Guarantee a 10-day pour and charge 6% for it" onChange={(e) => edit("evidence", ev.id, { decision: e.target.value })} /></Td>
                  <Td><CellInput value={ev.when_text} placeholder="month year" onChange={(e) => edit("evidence", ev.id, { when_text: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => remove("evidence", ev.id)} /></Td>
                </Row>
              ))}
            </tbody>
          </Grid>
        </>
      )}
      {kill && (
        <ConfirmDelete
          title={`Delete ${kill.channel.trim() || "this channel"}?`}
          what={<>{kill.budget > 0 && <>{num(kill.budget)} a year comes out of the marketing budget, </>}and the Marketing spend line in Overheads drops to match.</>}
          onCancel={() => setKill(null)}
          onConfirm={() => remove("spend", kill.id)}
        />
      )}

      {/* One dialog for a 90-day goal, wherever it is written (§6.60) — the same one the Goals step opens. */}
      {editing && (
        <GoalDialog
          area="marketing" goal={editing.goal} people={people} pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => start(once(async () => {
            const r = await saveGoal(planId, { ...input, id: editing.goal?.id, horizon: "ninety", area: "marketing" });
            if (!r.ok) { errors.raise({ key: "goal", message: r.error, label: "Goal" }); return; }
            errors.clear("goal"); setEditing(null); router.refresh();
          }))}
        />
      )}

      {killAction && (
        <ConfirmDelete
          title={`Remove "${killAction.title}"?`}
          what={<>It goes from here and from your Goals, and off the dashboard for {whenLabel(killAction)}. The marketing spend it relates to stays.</>}
          onCancel={() => setKillAction(null)}
          onConfirm={() => start(once(async () => {
            const r = await deleteGoal(planId, killAction.id);
            if (!r.ok) { errors.raise({ key: "goal", message: r.error, label: "Quarterly goal" }); return; }
            errors.clear("goal");
            setActs((xs) => xs.filter((x) => x.id !== killAction.id));
            setKillAction(null); router.refresh();
          }))}
        />
      )}
    </ModuleFrame>
  );
}

/** STATUS ONLY (§6.98) — a failed save travels on its own channel and is shown in red, not in this grey. */
function PendingBridge({ pending, dirty }: { pending: boolean; dirty: boolean }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the field" : undefined), [pending, dirty, setNote]);
  return null;
}
