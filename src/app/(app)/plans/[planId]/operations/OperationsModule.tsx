"use client";

import { guarded } from "@/lib/guardedStart";
import { useRowSaves } from "@/lib/rowSaves";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Grid, Th, Td, Toolbar, Meta, Note, RemoveButton, CellInput, CellSelect, CellTextarea, focusRow } from "@/components/module/DataGrid";
import { Section, FieldGrid, Field, FieldTextarea } from "@/components/module/FieldGrid";
import { ConfirmDelete } from "@/components/module/ConfirmDelete";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { CAPACITY_FIELDS, STEP_DETAIL, DEPENDENCY, TENURE, type Capacity, type OpStep, type Premise, type Supplier } from "./model";
import { DraftField, type Drafting } from "@/components/module/DraftField";
import { continueFromOperations, deleteRow, saveCapacity, setPrimaryPremise, upsertRow, type RowKind } from "./actions";
import { CapacityMeasures, type CapacityMeasure } from "./CapacityMeasures";

type AreaKey = "premises" | "suppliers" | "process" | "capacity";
type Dirty = { _dirty?: boolean };
const STEP = GUIDED_STEPS.find((s) => s.id === "operations")?.step ?? 6;
const proseLabel = "mb-0.5 pl-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground";

/**
 * Operations (§6.84) — the section every business plan outline asks for and this app had no data for.
 *
 * Four areas, and the boundaries between them and the rest of the app are the whole design:
 *
 *   **Premises** extends `plan_outlets`, which has existed since 0002 with no screen behind it. The monthly
 *   cost is recorded and DELIBERATELY NOT fed to the forecast — rent is already an overhead on step 9, and
 *   a figure that reached the engine from two places would be counted twice (§6.41).
 *
 *   **Suppliers** earns its place on one column: dependency. A critical supplier with no alternative is a
 *   risk visible on the face of the plan, and no other screen in the product can say it.
 *
 *   **How the work gets done** begins where the SALES process on Marketing ends. One is how a job is won,
 *   the other how it is delivered, and a plan that confuses them describes neither.
 *
 *   **Capacity** is the part that connects the operation to the money. "What limits it" is asked for the
 *   binding constraint rather than a list, because a list is not a constraint.
 */
export function OperationsModule({ planId, mode, initialArea, initialPremises, initialSuppliers, initialSteps, initialCapacity, initialMeasures, noun, drafting = {} }: {
  planId: string; mode: "guided" | "advanced"; initialArea: AreaKey;
  initialPremises: Premise[]; initialSuppliers: Supplier[]; initialSteps: OpStep[]; initialCapacity: Capacity;
  /** What the business depends on, and how much of it is used (§6.129.3). */
  initialMeasures: CapacityMeasure[];
  noun: { one: string; many: string };
  /** What the server decided each capacity box may offer (§6.109). Two of the five are absent (§6.111). */
  drafting?: Drafting;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  /* A part that saves on its own reports its "Saving…" here, so the footer tells the truth (§6.132). */
  const [partBusy, setPartBusy] = useState(false);
  /** Keyed per row and per area, so several failures are several messages (§6.98). */
  const errors = useSaveErrors();
  const [pending, startRaw] = useTransition();
  /* A save that never reaches the server is reported, not allowed to take the screen down (§6.138). */
  const start = guarded(startRaw, (message) => errors.raise({ key: "connection", message, label: "Connection" }), () => errors.clear("connection"));
  const [kill, setKill] = useState<{ kind: RowKind; id: string; name: string } | null>(null);

  const blankPremise = (id: string): Premise & Dirty => ({ id, name: "", address: null, tenure: null, is_primary: false, floor_area: null, monthly_cost: 0, purpose: null, sort_order: 0 });
  const blankSupplier = (id: string): Supplier & Dirty => ({ id, name: "", supplies: null, terms: null, dependency: "medium", alternative: null, sort_order: 0 });
  const blankStep = (id: string): OpStep & Dirty => ({ id, title: "", detail: null, owner: null, duration: null, sort_order: 0 });

  const [premises, setPremises] = useState<(Premise & Dirty)[]>(initialPremises.length ? initialPremises : [blankPremise("tmp-p")]);
  const [suppliers, setSuppliers] = useState<(Supplier & Dirty)[]>(initialSuppliers.length ? initialSuppliers : [blankSupplier("tmp-s")]);
  const [steps, setSteps] = useState<(OpStep & Dirty)[]>(initialSteps.length ? initialSteps : [blankStep("tmp-o")]);
  const [capacity, setCapacity] = useState<Capacity>(initialCapacity);
  const [capacityDirty, setCapacityDirty] = useState(false);

  const pRef = useRef(premises); useEffect(() => { pRef.current = premises; }, [premises]);
  const sRef = useRef(suppliers); useEffect(() => { sRef.current = suppliers; }, [suppliers]);
  const oRef = useRef(steps); useEffect(() => { oRef.current = steps; }, [steps]);
  const cRef = useRef(capacity); useEffect(() => { cRef.current = capacity; }, [capacity]);
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  type AnyRow = Record<string, unknown> & Dirty & { id: string };
  const refOf = (kind: RowKind) => (kind === "premises" ? pRef : kind === "suppliers" ? sRef : oRef) as unknown as React.MutableRefObject<AnyRow[]>;
  const stateOf = (kind: RowKind) => (kind === "premises" ? setPremises : kind === "suppliers" ? setSuppliers : setSteps) as unknown as (xs: AnyRow[]) => void;
  const listOf = (kind: RowKind) => refOf(kind).current;
  /*
   * WRITTEN TO THE REF ON THE EDIT (§6.131), not after the render: a choice saves in the same tick it is
   * made, and a ref that caught up in an effect handed that save the row as it was before the choice.
   */
  const setter = (kind: RowKind) => (fn: (xs: AnyRow[]) => AnyRow[]) => {
    const next = fn(refOf(kind).current);
    refOf(kind).current = next;
    stateOf(kind)(next);
  };
  const rs = useRowSaves();
  /* The column a row cannot be stored without — the same one the action refuses (operations/actions.ts). */
  const REQUIRED: Record<RowKind, string> = { premises: "name", suppliers: "name", steps: "title" };

  const edit = (kind: RowKind, id: string, changes: Record<string, unknown>, immediate = false) => {
    /* Typing no longer erases the reason a row would not save (§6.98). */
    setter(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, ...changes, _dirty: true } : x)));
    if (immediate) commit(kind, id);
  };
  /*
   * EACH BOX SAVES AS IT IS LEFT, QUEUED PER ROW (§6.131). Returns the save so leaving the screen can wait
   * for it rather than racing it.
   */
  const commit = (kind: RowKind, id: string): Promise<void> => {
    const p = rs.queue(kind, id, () => saveRow(kind, id));
    start(() => p);
    return p;
  };
  const saveRow = async (kind: RowKind, id: string) => {
    /* Read when this save's turn comes: the row may have moved on, or been removed. */
    const row = listOf(kind).find((x) => rs.same(x.id, id));
    if (!row || !row._dirty) return;
    const stored = rs.realId(row.id);
    /* A new row with no name waits, dirty and unscolded, until it has one — see marketing (§6.131). */
    if (!stored && !String(row[REQUIRED[kind]] ?? "").trim()) return;
    setter(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: false } : x)));
    let r: Awaited<ReturnType<typeof upsertRow>>;
    /* Never reached the server: put the row back to unsaved so leaving a box retries it (§6.138). */
    try { r = await upsertRow(planId, kind, { ...row, id: stored }); }
    catch (e) { setter(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: true } : x))); throw e; }
    const key = `${kind}:${rs.keyOf(row.id)}`;
    if (!r.ok) {
      errors.raise({ key, message: r.error, label: kind === "premises" ? "Premises" : kind === "suppliers" ? "Supplier" : "Process step" });
      setter(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, _dirty: true } : x)));
      return;
    }
    errors.clear(key);
    rs.adopt(row.id, r.data!.id);
    setter(kind)((xs) => xs.map((x) => (rs.same(x.id, id) ? { ...x, id: r.data!.id } : x)));
  };
  const add = (kind: RowKind) => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    const blank = kind === "premises" ? blankPremise(tmp) : kind === "suppliers" ? blankSupplier(tmp) : blankStep(tmp);
    setter(kind)((xs) => [blank as never, ...xs]);
    focusRow(`[data-row="${tmp}"]`);
  };
  const askRemove = (kind: RowKind, id: string, name: string) => {
    if (!name.trim() && !rs.realId(id)) { remove(kind, id); return; }
    setKill({ kind, id, name });
  };
  const remove = (kind: RowKind, id: string) => {
    setKill(null);
    const blank = kind === "premises" ? blankPremise : kind === "suppliers" ? blankSupplier : blankStep;
    setter(kind)((xs) => { const rest = xs.filter((x) => !rs.same(x.id, id)); return rest.length ? rest : [blank(`tmp-${crypto.randomUUID()}`) as never]; });
    /* Behind any save still running for the row, so a first save in flight cannot land after the delete. */
    start(() => rs.queue(kind, id, async () => {
      const stored = rs.realId(id);
      if (!stored) return;
      const r = await deleteRow(planId, kind, stored);
      if (!r.ok) errors.raise({ key: `${kind}:${rs.keyOf(id)}`, message: r.error, label: "Remove" });
    }));
  };
  const commitCapacity = () => {
    if (!capacityDirty) return;
    setCapacityDirty(false);
    start(async () => {
      let r: Awaited<ReturnType<typeof saveCapacity>>;
      try { r = await saveCapacity(planId, cRef.current); } catch (e) { setCapacityDirty(true); throw e; }   // §6.138
      if (!r.ok) { errors.raise({ key: "capacity", message: r.error, label: "Capacity" }); setCapacityDirty(true); }
      else errors.clear("capacity");
    });
  };
  const makePrimary = (id: string) => {
    setter("premises")((xs) => xs.map((x) => ({ ...x, is_primary: rs.same(x.id, id) })));
    const stored = rs.realId(id);
    if (stored) start(async () => {
      const r = await setPrimaryPremise(planId, stored);
      if (!r.ok) errors.raise({ key: "primary", message: r.error, label: "Main premises" }); else errors.clear("primary");
    });
  };
  const flush = () => {
    commitCapacity();
    return Promise.all((["premises", "suppliers", "steps"] as RowKind[])
      .flatMap((k) => listOf(k).filter((r) => r._dirty).map((r) => commit(k, r.id))));
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    /* The row saves finish before the page moves on — a redirect that overtakes the last save loses it. */
    start(async () => { await flush(); await continueFromOperations(planId, intent); });
  };

  const namedPremises = premises.filter((x) => x.name.trim());
  const namedSuppliers = suppliers.filter((x) => x.name.trim());
  const namedSteps = steps.filter((x) => x.title.trim());
  const capacityWritten = CAPACITY_FIELDS.filter((f) => capacity[f.key].trim()).length;
  const critical = namedSuppliers.filter((x) => (x.dependency === "critical" || x.dependency === "high") && !x.alternative?.trim());
  const dirty = [...premises, ...suppliers, ...steps].some((r) => r._dirty) || capacityDirty;

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("operations")} title="Operations"
      subtitle="Where the work happens, who supplies it, how it flows, and what limits it" mode={mode}
      errors={errors}
      areas={[
        { key: "premises", label: "Premises", count: namedPremises.length },
        { key: "suppliers", label: "Suppliers", count: namedSuppliers.length },
        { key: "process", label: "How the work gets done", count: namedSteps.length },
        { key: "capacity", label: "Capacity", ...(capacityWritten ? { count: capacityWritten } : { tag: "not written" }) },
      ]}
      area={area} onArea={(k) => { flush(); setArea(k as AreaKey); }} scope={{ label: "This plan" }}
      primaryAction={
        area === "premises" ? <Button size="sm" type="button" onClick={() => add("premises")}>+ Place</Button>
        : area === "suppliers" ? <Button size="sm" type="button" onClick={() => add("suppliers")}>+ Supplier</Button>
        : area === "process" ? <Button size="sm" type="button" onClick={() => add("steps")}>+ Step</Button>
        : undefined}
      footer={<ModuleFooter planId={planId} moduleId="operations" formId="operations-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p><b>Premises</b> — where the work is done, and on what terms. Mark the main one; that is the address a plan is written from. The monthly cost is recorded here for the reader, and is <b>not</b> added to the forecast: rent is already an overhead on step 9, and counting it twice would overstate your costs.</p>
        <p><b>Suppliers</b> — the column that matters is <b>dependency</b>. A supplier you could replace next week is worth a line; one you could not is worth a paragraph, and a lender will ask what happens if they stop. Naming the alternative is the answer.</p>
        <p><b>How the work gets done</b> starts where the <b>sales process</b> on Marketing stops. That one is how a {noun.one} is won; this one is how it is delivered.</p>
        <p><b>Capacity</b> is what connects all of it to the money. Be specific about what runs out first — one binding constraint, not a list of pressures.</p>
        <h3>Where this goes</h3>
        <p>The Operations section of the business plan, which every standard outline asks for. What limits your capacity also explains the shape of the revenue forecast, and a plan whose sales grow past its stated capacity is the first thing a careful reader notices.</p>
      </>}
    >
      <PendingBridge pending={pending || partBusy} dirty={dirty} />
      <form id="operations-form" onSubmit={onSubmit} className="hidden" />

      {area === "premises" && (
        <>
          <Toolbar><Meta className="ml-0">
            {namedPremises.length
              ? <>{namedPremises.length} {namedPremises.length === 1 ? "place" : "places"}{premises.some((x) => x.is_primary) ? "" : " — mark which one is the main address"}</>
              : "Where the business operates from. A business with no fixed premises should say so — it is an answer, not a blank."}
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "24%" }}>Place</Th><Th style={{ width: "26%" }}>Address</Th>
              <Th style={{ width: "16%" }}>Tenure</Th><Th style={{ width: "12%" }}>Size</Th>
              <Th right style={{ width: 130 }}>Cost a month</Th><Th style={{ width: 92 }}>Main</Th><Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {premises.map((x) => [
                <tr key={rs.keyOf(x.id) + "a"} data-row={x.id} onBlur={() => commit("premises", x.id)}
                  className={cn("[&>td]:border-b-0 [&>td]:pt-2", errors.forKey(`premises:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`premises:${rs.keyOf(x.id)}`)}>
                  <Td><CellInput value={x.name} placeholder="Yard, office, depot" className="font-semibold" onChange={(e) => edit("premises", x.id, { name: e.target.value })} /></Td>
                  <Td><CellInput value={x.address ?? ""} placeholder="Street and suburb" onChange={(e) => edit("premises", x.id, { address: e.target.value })} /></Td>
                  <Td><CellSelect value={x.tenure} options={TENURE} placeholder="Tenure —" onValueChange={(v) => edit("premises", x.id, { tenure: v }, !!x.name.trim())} /></Td>
                  <Td><CellInput value={x.floor_area ?? ""} placeholder="420 m²" onChange={(e) => edit("premises", x.id, { floor_area: e.target.value })} /></Td>
                  <Td right><CellInput money value={x.monthly_cost === null ? "" : String(x.monthly_cost)} placeholder="0" onChange={(e) => edit("premises", x.id, { monthly_cost: Number(e.target.value.replace(/[,\s$]/g, "")) || 0 })} /></Td>
                  <Td>
                    <button type="button" onClick={() => makePrimary(x.id)} disabled={!x.name.trim()}
                      className={cn("rounded border px-2 py-0.5 text-[11.5px] font-semibold",
                        x.is_primary ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-secondary disabled:opacity-40")}>
                      {x.is_primary ? "✓ Main" : "Set main"}
                    </button>
                  </Td>
                  <Td><RemoveButton onClick={() => askRemove("premises", x.id, x.name)} /></Td>
                </tr>,
                <tr key={rs.keyOf(x.id) + "b"} data-row={x.id} onBlur={() => commit("premises", x.id)} className={cn(errors.forKey(`premises:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft")}>
                  <Td colSpan={7} wrap className="pb-2.5 pt-0">
                    <div className="rounded-[3px] border-l-2 border-input bg-secondary/60 py-2 pl-3.5 pr-3">
                      <div className={proseLabel}>What happens here</div>
                      <CellTextarea value={x.purpose ?? ""} placeholder="e.g. Plant, formwork stock and the two crew utes. Quoting and admin are done from here."
                        onChange={(e) => edit("premises", x.id, { purpose: e.target.value })} />
                    </div>
                  </Td>
                </tr>,
              ])}
            </tbody>
          </Grid>
          <Note>
            The cost a month is here so a reader can see what the premises carry. It is <b>not</b> added to
            the forecast — rent and outgoings belong on <b>Overheads</b>, and a figure reaching the engine
            from two places would be counted twice.
          </Note>
        </>
      )}

      {area === "suppliers" && (
        <>
          <Toolbar><Meta className="ml-0">
            {namedSuppliers.length
              ? <>{namedSuppliers.length} recorded{critical.length ? ` · ${critical.length} you depend on with no alternative named` : ""}</>
              : "Who the business depends on to deliver. Start with the one it could least afford to lose."}
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "24%" }}>Supplier</Th><Th style={{ width: "26%" }}>What they supply</Th>
              <Th style={{ width: "20%" }}>Terms</Th><Th style={{ width: "18%" }}>We depend on them</Th><Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {suppliers.map((x) => [
                <tr key={rs.keyOf(x.id) + "a"} data-row={x.id} onBlur={() => commit("suppliers", x.id)}
                  className={cn("[&>td]:border-b-0 [&>td]:pt-2", errors.forKey(`suppliers:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`suppliers:${rs.keyOf(x.id)}`)}>
                  <Td><CellInput value={x.name} placeholder="Name" className="font-semibold" onChange={(e) => edit("suppliers", x.id, { name: e.target.value })} /></Td>
                  <Td><CellInput value={x.supplies ?? ""} placeholder="Concrete, steel, plant hire" onChange={(e) => edit("suppliers", x.id, { supplies: e.target.value })} /></Td>
                  <Td><CellInput value={x.terms ?? ""} placeholder="30 days, COD, fixed to Jun 27" onChange={(e) => edit("suppliers", x.id, { terms: e.target.value })} /></Td>
                  <Td><CellSelect value={x.dependency} options={DEPENDENCY} placeholder="—"
                    className={cn("font-semibold", x.dependency === "critical" || x.dependency === "high" ? "text-bad" : x.dependency === "medium" ? "text-warn" : "text-good")}
                    onValueChange={(v) => edit("suppliers", x.id, { dependency: v }, !!x.name.trim())} /></Td>
                  <Td><RemoveButton onClick={() => askRemove("suppliers", x.id, x.name)} /></Td>
                </tr>,
                <tr key={rs.keyOf(x.id) + "b"} data-row={x.id} onBlur={() => commit("suppliers", x.id)} className={cn(errors.forKey(`suppliers:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft")}>
                  <Td colSpan={5} wrap className="pb-2.5 pt-0">
                    <div className="rounded-[3px] border-l-2 border-input bg-secondary/60 py-2 pl-3.5 pr-3">
                      <div className={proseLabel}>If they stopped tomorrow</div>
                      <CellTextarea value={x.alternative ?? ""} placeholder="e.g. Hanson can cover us at about 4% more with two days' notice; we have poured with them before."
                        onChange={(e) => edit("suppliers", x.id, { alternative: e.target.value })} />
                    </div>
                  </Td>
                </tr>,
              ])}
            </tbody>
          </Grid>
          {critical.length > 0 && (
            <Note>
              <span className="text-warn">
                {critical.length === 1 ? "One supplier you depend on has" : `${critical.length} suppliers you depend on have`} no
                alternative named. That is the first question a lender asks about a supply chain, and an
                honest answer — even &quot;there isn&apos;t one&quot; — reads better than a blank.
              </span>
            </Note>
          )}
        </>
      )}

      {area === "process" && (
        <>
          <Toolbar><Meta className="ml-0">
            {namedSteps.length
              ? <>{namedSteps.length} {namedSteps.length === 1 ? "step" : "steps"}, in order — newest at the top until you reorder</>
              : `How a ${noun.one} is delivered, step by step. How one is WON is the sales process on Marketing.`}
          </Meta></Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "30%" }}>Step</Th><Th style={{ width: "22%" }}>Who owns it</Th><Th style={{ width: "18%" }}>How long</Th><Th style={{ width: 36 }} />
            </tr></thead>
            <tbody>
              {steps.map((x) => [
                <tr key={rs.keyOf(x.id) + "a"} data-row={x.id} onBlur={() => commit("steps", x.id)}
                  className={cn("[&>td]:border-b-0 [&>td]:pt-2", errors.forKey(`steps:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft")} title={errors.forKey(`steps:${rs.keyOf(x.id)}`)}>
                  <Td><CellInput value={x.title} placeholder="Site measure and set-out" className="font-semibold" onChange={(e) => edit("steps", x.id, { title: e.target.value })} /></Td>
                  <Td><CellInput value={x.owner ?? ""} placeholder="Name or role" onChange={(e) => edit("steps", x.id, { owner: e.target.value })} /></Td>
                  <Td><CellInput value={x.duration ?? ""} placeholder="Half a day" onChange={(e) => edit("steps", x.id, { duration: e.target.value })} /></Td>
                  <Td><RemoveButton onClick={() => askRemove("steps", x.id, x.title)} /></Td>
                </tr>,
                <tr key={rs.keyOf(x.id) + "b"} data-row={x.id} onBlur={() => commit("steps", x.id)} className={cn(errors.forKey(`steps:${rs.keyOf(x.id)}`) && "[&>td]:bg-bad-soft")}>
                  <Td colSpan={4} wrap className="pb-2.5 pt-0">
                    <div className="rounded-[3px] border-l-2 border-input bg-secondary/60 py-2 pl-3.5 pr-3">
                      <div className={proseLabel}>{STEP_DETAIL.label}</div>
                      <CellTextarea value={x.detail ?? ""} placeholder={STEP_DETAIL.placeholder}
                        onChange={(e) => edit("steps", x.id, { detail: e.target.value })} />
                      {/*
                        Per step (§6.114). The step's OWNER sits in the row above and has no button — it is
                        a person's name, and no slice of this plan reads a person. A step with no title yet
                        has nothing for the server to resolve, so it has no button either.
                      */}
                      {x.title.trim() && (
                        <DraftField planId={planId} field={STEP_DETAIL} offer={drafting[STEP_DETAIL.key]}
                          value={x.detail ?? ""} row={x.title}
                          onUse={(text) => edit("steps", x.id, { detail: text })} />
                      )}
                    </div>
                  </Td>
                </tr>,
              ])}
            </tbody>
          </Grid>
        </>
      )}

      {area === "capacity" && (
        <div onBlur={(e) => left(e) && commitCapacity()}>
          <Toolbar><Meta className="ml-0">
            {capacityWritten} of {CAPACITY_FIELDS.length} written. This is what ties the operation to the revenue forecast.
          </Meta></Toolbar>
          <Section title="Capacity and constraints">
            <FieldGrid>
              {CAPACITY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} span={6} hint={f.hint}>
                  <FieldTextarea value={capacity[f.key]} placeholder={f.placeholder} className="min-h-[72px]"
                    onChange={(e) => { setCapacity((c) => ({ ...c, [f.key]: e.target.value })); setCapacityDirty(true); }} />
                  {/* A draft lands in the BOX; `setCapacityDirty` is what typing does, so this area's own
                      blur-save runs on its own terms (§6.109). */}
                  <DraftField planId={planId} field={f} offer={drafting[f.key]} value={capacity[f.key]}
                    onUse={(text) => { setCapacity((c) => ({ ...c, [f.key]: text })); setCapacityDirty(true); }} />
                </Field>
              ))}
            </FieldGrid>
          </Section>
          {/* Its own save path, so it sits outside the prose's onBlur — see CapacityMeasures (§6.129.3). */}
          <div onBlur={(e) => e.stopPropagation()}>
            <CapacityMeasures planId={planId} initial={initialMeasures} onBusy={setPartBusy}
              onError={(key, message) => message
                ? errors.raise({ key, message, label: "Capacity measures" })
                : errors.clear(key)} />
          </div>
          <Note>
            A plan whose sales grow past its own stated capacity is the first thing a careful reader notices.
            If the forecast on <b>Sales</b> needs more than this says you can deliver, <b>how we lift it</b>
            {" "}is where that is answered.
          </Note>
        </div>
      )}

      {kill && (
        <ConfirmDelete
          title={`Delete ${kill.name.trim() || "this row"}?`}
          what={<>Everything recorded against it goes too, and it drops out of the Operations section of the plan.</>}
          onCancel={() => setKill(null)}
          onConfirm={() => remove(kill.kind, kill.id)}
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
