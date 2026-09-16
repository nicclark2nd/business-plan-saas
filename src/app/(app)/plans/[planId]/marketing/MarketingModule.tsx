"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row, FootRow, Toolbar, Meta, Note, RemoveButton, CellInput, CellSelect, CellTextarea, focusRow } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldTextarea } from "@/components/module/FieldGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { ConfirmDelete } from "@/components/module/ConfirmDelete";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/MoneyProvider";
import { customerNoun } from "@/engine/plan/vocabulary";
import { formatMonth } from "../people/model";
import { saveMarket, upsertRow, deleteRow, continueFromMarketing, type RowKind } from "./actions";
import { MARKET_FIELDS, CUSTOMER_FIELDS, POSITION_ONE_LINER, BRAND_FIELDS, SALES_FIELDS, SPEND_KINDS, SPEND_LABEL, type Market, type MarketingData, type Spend, type Evidence, type SpendKind } from "./model";
import { acquisitionByYear } from "@/engine/marketing/acquisition";
import type { AnyProduct } from "@/engine/sales/product";
import { QuarterlyGoalDialog, type QuarterChoice } from "@/components/goals/QuarterlyGoalDialog";
import { deleteGoal, saveQuarterlyGoal, setGoalStatus } from "../goals/actions";
import { STATUSES, type Goal, type GoalStatus, type Person } from "../goals/model";
import { useSaveOnce } from "@/lib/saveOnce";
import { useRouter } from "next/navigation";

const TONE: Record<GoalStatus, string> = {
  not_started: "bg-secondary text-muted-foreground",
  in_progress: "bg-accent text-primary",
  done: "bg-good-soft text-good",
  at_risk: "bg-warn-soft text-warn",
};

type AreaKey = "market" | "spend" | "research" | "brand" | "sales" | "actions";
type WithMeta<T> = T & { _dirty?: boolean; _error?: string };

export function MarketingModule({ planId, initial, mode, initialArea, customerWord, actions, people, quarters, thisQuarter, products }: {
  planId: string; initial: MarketingData; mode: "guided" | "advanced"; initialArea: AreaKey; customerWord: string;
  /**
   * The plan's MARKETING goals (§6.60) — not a second list. A marketing action with an owner and a date is
   * a quarterly goal, so this screen and the Goals step are two windows onto the same rows.
   */
  actions: Goal[]; people: Person[]; quarters: QuarterChoice[]; thisQuarter: { planYear: number; quarter: number };
  /** The plan's sales lines, so this screen can say what a customer costs to win (§6.61). */
  products: AnyProduct[];
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
  const whenLabel = (g: Goal) => quarters.find((q) => q.planYear === g.year && q.quarter === g.quarter)?.label ?? `Q${g.quarter ?? ""}`;
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [kill, setKill] = useState<{ id: string; channel: string; budget: number } | null>(null);
  const [market, setMarket] = useState<Market>(initial.market);
  const [marketDirty, setMarketDirty] = useState(false);
  // An empty grid starts with one blank row ready to type in (it only saves once its first column is filled).
  // The starter row has a fixed id so server and client render the same HTML; rows added later get random ids.
  const blankSpend = (id = "tmp-new-spend"): WithMeta<Spend> => ({ id, kind: "advertising", approach: "", annual_budget: 0, sort_order: 0 });
  const blankEvidence = (id = "tmp-new-evidence"): WithMeta<Evidence & { when_text: string }> => ({ id, source: "", method: "", finding: "", decision: "", occurred_on: null, when_text: "", sort_order: 0 });
  const [rows, setRows] = useState<{ spend: WithMeta<Spend>[]; evidence: WithMeta<Evidence & { when_text: string }>[] }>({
    spend: initial.spend.length ? initial.spend : [blankSpend()],
    evidence: initial.evidence.length ? initial.evidence.map((e) => ({ ...e, when_text: formatMonth(e.occurred_on) })) : [blankEvidence()],
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
  type GridKind = Exclude<RowKind, "competitors">;
  const list = (k: GridKind) => rowsRef.current[k] as unknown as AnyRow[];
  const setList = (k: GridKind, fn: (xs: AnyRow[]) => AnyRow[]) => setRows((r) => ({ ...r, [k]: fn(r[k] as unknown as AnyRow[]) }));
  const edit = (k: GridKind, id: string, changes: Record<string, unknown>, immediate = false) => {
    setList(k, (xs) => xs.map((x) => (x.id === id ? { ...x, ...changes, _dirty: true, _error: undefined } : x)));
    if (immediate) queueMicrotask(() => commit(k, id));
  };
  const commit = (k: GridKind, id: string) => {
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
    setList(k, (xs) => { const rest = xs.filter((x) => x.id !== id); return rest.length ? rest : [k === "spend" ? blankSpend(`tmp-${crypto.randomUUID()}`) as unknown as AnyRow : blankEvidence(`tmp-${crypto.randomUUID()}`) as unknown as AnyRow]; });
    if (!id.startsWith("tmp-")) start(async () => { await deleteRow(planId, k, id); });
  };
  const flush = () => { commitMarket(); (["spend", "evidence"] as GridKind[]).forEach((k) => list(k).forEach((r) => r._dirty && commit(k, r.id))); };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromMarketing(planId, intent); });
  };

  const written = [...MARKET_FIELDS, ...CUSTOMER_FIELDS, POSITION_ONE_LINER].filter((f) => (market[f.key] ?? "").trim()).length;

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
  const anyDirty = marketDirty || (["spend", "evidence"] as GridKind[]).some((k) => (rows[k] as AnyRow[]).some((r) => r._dirty));
  const rowError = (["spend", "evidence"] as GridKind[]).flatMap((k) => rows[k] as AnyRow[]).find((r) => r._error)?._error;
  const plural = customerNoun(customerWord).many.toLowerCase();

  /** One field list, three tabs (§6.61) — every narrative box on this module saves the same way. */
  const narrative = (fields: readonly { key: string; label: string; hint: string; placeholder: string }[]) => (
    <FieldGrid>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} span={3} hint={f.hint}>
          <FieldTextarea value={market[f.key as keyof Market] ?? ""} placeholder={f.placeholder} className="min-h-[84px]"
            onChange={(e) => { setMarket((m) => ({ ...m, [f.key]: e.target.value })); setMarketDirty(true); setError(undefined); }} />
        </Field>
      ))}
    </FieldGrid>
  );

  return (
    <ModuleFrame
      step={3} total={GUIDED_STEPS.length} group="Market" title="Marketing" subtitle={`Who your ${plural} are and what you will spend to win them`} mode={mode}
      areas={[
        { key: "market", label: "Market", count: written },
        { key: "spend", label: "Channels & spend", count: rows.spend.filter((r) => r.approach.trim()).length,
          ...(missingKinds.length ? { tag: `${missingKinds.length} not considered` } : {}) },
        { key: "research", label: "Research", count: rows.evidence.filter((r) => r.source.trim()).length },
        { key: "brand", label: "Brand", count: BRAND_FIELDS.filter((f) => (market[f.key] ?? "").trim()).length },
        { key: "sales", label: "Sales process", count: SALES_FIELDS.filter((f) => (market[f.key] ?? "").trim()).length },
        { key: "actions", label: "Actions", count: acts.length },
      ]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }}
      scope={{ label: "This plan" }}
      primaryAction={
        area === "spend" ? <Button size="sm" type="button" onClick={() => add("spend", { kind: "advertising", approach: "", annual_budget: 0 })}>+ Channel</Button>
        : area === "research" ? <Button size="sm" type="button" onClick={() => add("evidence", { source: "", method: "", finding: "", decision: "", occurred_on: null, when_text: "" })}>+ Research</Button>
        : area === "actions" ? <Button size="sm" type="button" onClick={() => setEditing({})}>+ Action</Button>
        : undefined}
      footer={<ModuleFooter planId={planId} prevId="people" formId="marketing-form" />}
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
      <PendingBridge pending={pending} dirty={anyDirty} error={error ?? rowError} />
      <form id="marketing-form" onSubmit={onSubmit} className="hidden" />

      {area === "market" && (
        <div onBlur={(e) => left(e) && commitMarket()}>
          <Toolbar><Meta className="ml-0">{written} of {MARKET_FIELDS.length + CUSTOMER_FIELDS.length + 1} written. Rough is fine; you can polish later.</Meta></Toolbar>
          <Section title="Market">{narrative(MARKET_FIELDS)}</Section>
          {/* Who they are and what they care about, split out of the one box that used to hold both (§6.61). */}
          <Section title="Your customers">{narrative(CUSTOMER_FIELDS)}</Section>
          <Section title="Position">{narrative([POSITION_ONE_LINER])}</Section>
        </div>
      )}

      {area === "brand" && (
        <div onBlur={(e) => left(e) && commitMarket()}>
          <Toolbar><Meta className="ml-0">What the business stands for, how it sounds, how it looks. Your <b>purpose</b> and <b>brand promise</b> are step 1 — this is what a customer meets.</Meta></Toolbar>
          <Section title="Brand">{narrative(BRAND_FIELDS)}</Section>
        </div>
      )}

      {area === "sales" && (
        <div onBlur={(e) => left(e) && commitMarket()}>
          <Toolbar><Meta className="ml-0">Marketing brings them to the door. This is what happens next — and it is the half most plans leave out.</Meta></Toolbar>
          <Section title="Winning the work">{narrative(SALES_FIELDS)}</Section>
        </div>
      )}

      {area === "spend" && (
        <>
          <Toolbar><Meta className="ml-0">Only the channels you will use. The total feeds Overheads as a locked Marketing line.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: 220 }}>Type</Th><Th>Approach</Th><Th right style={{ width: 140 }}>Annual budget</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.spend.map((s) => (
                <Row key={s.id} data-row={s.id} onBlur={(e) => left(e) && commit("spend", s.id)} className={cn(s._error && "[&>td]:bg-bad-soft")} title={s._error}>
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

          <Note>Annual figures for Year 1. Later years follow the Overheads growth assumption unless you change them there.</Note>
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
                    <Td className={cn(g.year === thisQuarter.planYear && g.quarter === thisQuarter.quarter && "font-semibold")}>{whenLabel(g)}</Td>
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
            <thead><tr><Th style={{ width: "22%" }}>Question or source</Th><Th style={{ width: "20%" }}>How you looked</Th><Th>What it showed</Th><Th style={{ width: "22%" }}>What you&apos;ll do</Th><Th style={{ width: 110 }}>When</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {rows.evidence.map((ev) => (
                <Row key={ev.id} data-row={ev.id} onBlur={(e) => left(e) && commit("evidence", ev.id)} className={cn(ev._error && "[&>td]:bg-bad-soft")} title={ev._error}>
                  <Td wrap><CellTextarea value={ev.source} placeholder="e.g. How long do builders wait for a slab?" onChange={(e) => edit("evidence", ev.id, { source: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={ev.method ?? ""} placeholder="e.g. Phone survey of 40 builders, over two weeks" onChange={(e) => edit("evidence", ev.id, { method: e.target.value })} /></Td>
                  <Td wrap><CellTextarea value={ev.finding ?? ""} placeholder="e.g. 31 of 40 had waited >3 weeks in the last year; 26 would pay 5\u20138% more for a guaranteed date" onChange={(e) => edit("evidence", ev.id, { finding: e.target.value })} /></Td>
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

      {/* One dialog for a quarterly goal, wherever it is written (§6.60) — the same one the Goals step opens. */}
      {editing && (
        <QuarterlyGoalDialog
          area="marketing" goal={editing.goal} people={people} quarters={quarters} pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => start(once(async () => {
            const r = await saveQuarterlyGoal(planId, { ...input, id: editing.goal?.id, area: "marketing" });
            if (!r.ok) { setError(r.error); return; }
            setError(undefined); setEditing(null); router.refresh();
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
            if (!r.ok) { setError(r.error); return; }
            setActs((xs) => xs.filter((x) => x.id !== killAction.id));
            setKillAction(null); router.refresh();
          }))}
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
