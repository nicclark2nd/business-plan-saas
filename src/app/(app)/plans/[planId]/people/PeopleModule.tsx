"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row, FootRow, GroupRow, Toolbar, Meta, Note, NameLink, LinkButton, RemoveButton, CellInput, CellSelect } from "@/components/module/DataGrid";
import { cn } from "@/lib/utils";
import { GUIDED_STEPS } from "@/lib/nav";
import { SALARY_YEARS, planYearStart, startYearFromDate, tenureLabel, salarySchedule, scheduleChangeFromBase, totalSalariesByYear } from "@/engine/people/salary";
import { upsertPerson, deletePerson, upsertCapability, deleteCapability, continueFromPeople } from "./actions";
import { PERSON_ROLES, ROLE_LABEL, CAPABILITY_KINDS, KIND_LABEL, formatMonth, type Person, type Capability, type CapabilityKind, type PeopleData } from "./model";

const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num = (n: number | null | undefined) => fmt.format(Number(n) || 0);
type Row = Person & { _key: string; started_text: string; _dirty?: boolean; _state?: "saving" | "saved" | "error"; _error?: string };
type Cap = Capability & { _dirty?: boolean };
type AreaKey = "people" | "salary" | "cap" | "risk";

export function PeopleModule({ planId, initial, mode, currency, planYear, fyEndMonth }: {
  planId: string; initial: PeopleData; mode: "guided" | "advanced"; currency: string; planYear: number; fyEndMonth: number;
}) {
  void currency;
  const fyStart = useMemo(() => planYearStart(planYear, fyEndMonth), [planYear, fyEndMonth]);
  const [people, setPeople] = useState<Row[]>(() => initial.people.map((p) => ({ ...p, first_name: p.first_name ?? "", last_name: p.last_name ?? "", role: p.role ?? "employee", salary_adjustments: p.salary_adjustments ?? {}, started_text: formatMonth(p.started_on), _key: p.id })));
  const [caps, setCaps] = useState<Cap[]>(initial.capabilities);
  const [area, setArea] = useState<AreaKey>("people");
  const [scope, setScope] = useState<string | null>(null);        // a person's _key, or everyone
  const [pending, start] = useTransition();
  const peopleRef = useRef(people); useEffect(() => { peopleRef.current = people; }, [people]);
  const capsRef = useRef(caps); useEffect(() => { capsRef.current = caps; }, [caps]);

  const startYear = (p: Row) => startYearFromDate(p.started_on, fyStart);
  const visible = scope ? people.filter((p) => p._key === scope) : people;
  const scoped = people.find((p) => p._key === scope);
  const capsFor = (key: string) => caps.filter((c) => c.person_id === people.find((p) => p._key === key)?.id);
  const capCount = scope ? capsFor(scope).length : caps.length;

  // ----- save policy (§6.10): typing marks dirty; one request when focus leaves the row; selects save at once -----
  const patch = (key: string, p: Partial<Row>) => setPeople((ps) => ps.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const edit = (key: string, changes: Partial<Row>, immediate = false) => {
    setPeople((ps) => ps.map((r) => (r._key === key ? { ...r, ...changes, _dirty: true, _state: undefined } : r)));
    if (immediate) queueMicrotask(() => commitPerson(key));
  };
  const commitPerson = (key: string) => {
    const row = peopleRef.current.find((r) => r._key === key);
    if (!row || !row._dirty || !(row.first_name ?? "").trim()) return;
    patch(key, { _state: "saving", _dirty: false });
    start(async () => {
      const res = await upsertPerson(planId, { ...row, id: row.id || undefined });
      if (res.ok) patch(key, { id: res.data!.id, started_on: res.data!.started_on, started_text: formatMonth(res.data!.started_on), _state: "saved" });
      else patch(key, { _state: "error", _error: res.error, _dirty: true });
    });
  };
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  const addPerson = () => {
    const r: Row = { _key: crypto.randomUUID(), id: "", plan_id: planId, first_name: "", last_name: "", name: "", position: "", role: "employee", pct_shareholding: 0, annual_salary: 0, started_on: null, started_text: "", salary_adjustments: {}, sort_order: 0 };
    setPeople((ps) => [r, ...ps]); setScope(null); setArea("people");
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-row="${r._key}"] input[name=first_name]`)?.focus(), 0);
  };
  const removePerson = (r: Row) => {
    setPeople((ps) => ps.filter((x) => x._key !== r._key));
    if (scope === r._key) setScope(null);
    if (r.id) start(async () => { await deletePerson(planId, r.id); });
  };

  // ----- capabilities -----
  const editCap = (id: string, changes: Partial<Cap>, immediate = false) => {
    setCaps((cs) => cs.map((c) => (c.id === id ? { ...c, ...changes, _dirty: true } : c)));
    if (immediate) queueMicrotask(() => commitCap(id));
  };
  const commitCap = (id: string) => {
    const c = capsRef.current.find((x) => x.id === id);
    if (!c || !c._dirty || !c.description.trim()) return;
    setCaps((cs) => cs.map((x) => (x.id === id ? { ...x, _dirty: false } : x)));
    start(async () => {
      const res = await upsertCapability(planId, { ...c, id: c.id.startsWith("tmp-") ? undefined : c.id });
      if (res.ok && c.id.startsWith("tmp-")) setCaps((cs) => cs.map((x) => (x.id === id ? { ...x, id: res.data!.id } : x)));
    });
  };
  const addCap = (person: Row) => {
    if (!person.id) return;
    const tmp = `tmp-${crypto.randomUUID()}`;
    setCaps((cs) => [{ id: tmp, person_id: person.id, kind: "responsibility", description: "", internal: false, sort_order: 0 }, ...cs]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-cap="${tmp}"] input`)?.focus(), 0);
  };
  const removeCap = (c: Cap) => {
    setCaps((cs) => cs.filter((x) => x.id !== c.id));
    if (!c.id.startsWith("tmp-")) start(async () => { await deleteCapability(planId, c.id); });
  };

  const flush = () => { peopleRef.current.forEach((r) => r._dirty && commitPerson(r._key)); capsRef.current.forEach((c) => c._dirty && commitCap(c.id)); };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush();
    start(async () => { await continueFromPeople(planId, intent); });
  };

  const areas = [
    { key: "people", label: "People" },
    { key: "salary", label: "Salaries" },
    { key: "cap", label: "Roles & Capability", count: capCount },
    { key: "risk", label: "Risk & Succession", tag: "Phase 2" },
  ];

  return (
    <ModuleFrame
      step={2} total={GUIDED_STEPS.length} group="People" title="Management Team" subtitle="Owners, directors and the key people a lender asks about — not the whole payroll" mode={mode}
      areas={areas} area={area} onArea={(k) => setArea(k as AreaKey)}
      scope={{ label: scoped ? scoped.name || `${scoped.first_name} ${scoped.last_name ?? ""}`.trim() || "New person" : "All people", onClear: scope ? () => setScope(null) : undefined }}
      primaryAction={<Button size="sm" type="button" onClick={addPerson}>+ New person</Button>}
      footer={<ModuleFooter planId={planId} prevId="vision" formId="people-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Three to six people. Start with the owner; add anyone whose absence would change the plan — including hires you&apos;re planning (give them a future Started date).</p>
        <p>Salaries feed Overheads. A $0 owner salary flatters the profit and every bank knows it.</p>
        <div className="mb-4 mt-2 rounded-r border-l-[3px] border-primary bg-card px-2.5 py-1.5 text-xs text-muted-foreground">Shareholding should add to 100%. If it doesn&apos;t, the ownership table in the report will look wrong to an investor.</div>
        <h3>Where this goes</h3>
        <p><b>People</b> → ownership table and management team. <b>Salaries</b> → Overheads, in full or summarised depending on the report. <b>Roles &amp; Capability</b> → management bios (development areas stay internal). <b>Risk &amp; Succession</b> → key-person risk in funding, SBA and sale reports.</p>
        <p>12-month focus for each person lives under <b>Goals</b>, where every goal has an owner.</p>
      </>}
    >
      <PendingBridge pending={pending} saving={people.some((p) => p._state === "saving")} error={people.find((p) => p._state === "error")?._error} />
      <form id="people-form" onSubmit={onSubmit} className="hidden" />

      {area === "people" && (
        <>
          <Toolbar>
            <Meta className="ml-0">{people.length} {people.length === 1 ? "person" : "people"} · shareholding <b className={cn("num", Math.round(shareTotal(people)) === 100 ? "text-good" : "text-warn")}>{num(shareTotal(people))}%</b> · click a name to focus every area on that person</Meta>
          </Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: 130 }}>First name</Th><Th style={{ width: 130 }}>Last name</Th><Th>Position</Th><Th style={{ width: 130 }}>Role</Th><Th right style={{ width: 90 }}>Share %</Th><Th style={{ width: 115 }}>Started</Th><Th right style={{ width: 95 }}>Tenure</Th><Th style={{ width: 36 }} /></tr></thead>
            <tbody>
              {visible.length === 0 && <tr><Td colSpan={8} className="py-6 text-center text-muted-foreground">Start with the owner. Add anyone whose absence would change the plan.</Td></tr>}
              {visible.map((r) => (
                <Row key={r._key} data-row={r._key} onBlur={(e) => left(e) && commitPerson(r._key)} className={cn(r._state === "error" && "[&>td]:bg-bad-soft")} title={r._error}>
                  <Td>{r.id && scope !== r._key
                    ? <NameLink onClick={() => setScope(r._key)}>{r.first_name || "—"}</NameLink>
                    : <CellInput name="first_name" value={r.first_name} placeholder="First name" onChange={(e) => edit(r._key, { first_name: e.target.value })} />}
                  </Td>
                  <Td><CellInput value={r.last_name ?? ""} placeholder="Last name" onChange={(e) => edit(r._key, { last_name: e.target.value })} /></Td>
                  <Td><CellInput value={r.position ?? ""} placeholder="Job title" onChange={(e) => edit(r._key, { position: e.target.value })} /></Td>
                  <Td><CellSelect value={r.role} options={PERSON_ROLES.map((v) => ({ value: v, label: ROLE_LABEL[v] }))} onValueChange={(v) => edit(r._key, { role: v as Person["role"] }, true)} /></Td>
                  <Td right><CellInput numeric value={String(r.pct_shareholding ?? 0)} onChange={(e) => edit(r._key, { pct_shareholding: Number(e.target.value.replace(/[^\d.-]/g, "")) || 0 })} /></Td>
                  <Td><CellInput value={r.started_text} placeholder="Mar 2020" onChange={(e) => edit(r._key, { started_text: e.target.value, started_on: r.started_on })} /></Td>
                  <Td right className={cn("num text-muted-foreground", r.started_on && new Date(r.started_on) > new Date() && "text-warn")}>{tenureLabel(r.started_on, fyStart)}</Td>
                  <Td><RemoveButton onClick={() => removePerson(r)} /></Td>
                </Row>
              ))}
            </tbody>
            <FootRow>
              <Td colSpan={4}>Total <span className="ml-2 font-normal text-muted-foreground">{people.length} people{people.filter((p) => startYear(p) > 1).length ? ` · ${people.filter((p) => startYear(p) > 1).length} planned hire${people.filter((p) => startYear(p) > 1).length === 1 ? "" : "s"}` : ""}</span></Td>
              <Td right className={cn("num", Math.round(shareTotal(people)) === 100 ? "text-good" : "text-warn")}>{num(shareTotal(people))}%</Td>
              <Td colSpan={3} />
            </FootRow>
          </Grid>
          <Note>Fields save when you leave them. Tenure is calculated from Started against the plan&apos;s first year (from {formatMonth(fyStart.toISOString())}). A future date shows the plan year the person joins — their salary starts in that year automatically.</Note>
        </>
      )}

      {area === "salary" && (
        <>
          <Toolbar><Meta className="ml-0">Adjustment % compounds on the year before; negative for a cut. The Salary row calculates. The total feeds Overheads as a locked line — Overheads keeps its own &quot;Other wages&quot; input; on-costs are one % rate applied there. Contractors have no salary row.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "20%" }}>Name</Th><Th right style={{ width: 120 }}>Base</Th><Th style={{ width: 100 }} />{SALARY_YEARS.map((y) => <Th key={y} right>Year {y}</Th>)}<Th right style={{ width: 150 }} className="max-[1280px]:hidden">Y5 vs base</Th></tr></thead>
            <tbody>
              {visible.map((r) => {
                const sy = startYear(r);
                if (r.role === "contractor") return (
                  <Row key={r._key}><Td><NameLink onClick={() => setScope(r._key)}>{r.name || r.first_name}</NameLink><div className="text-[11.5px] text-muted-foreground">Contractor</div></Td><Td colSpan={8} className="text-muted-foreground">Costed in COGS or Overheads, not here.</Td></Row>
                );
                const sched = salarySchedule(r.annual_salary ?? 0, r.salary_adjustments, sy);
                const change = scheduleChangeFromBase(r.annual_salary ?? 0, r.salary_adjustments, sy);
                return [
                  <tr key={r._key + "a"} data-row={r._key} onBlur={(e) => left(e) && commitPerson(r._key)} className="[&>td]:border-b-0 [&>td]:h-[34px]">
                    <Td rowSpan={2} className="!border-b border-border align-middle">
                      <NameLink onClick={() => setScope(r._key)}>{r.name || r.first_name || "New person"}</NameLink>
                      <div className={cn("text-[11.5px]", sy > 1 ? "text-warn" : "text-muted-foreground")}>{sy > 5 ? "starts after Year 5" : sy > 1 ? `joins Year ${sy} · ${r.started_text}` : "from Year 1"}</div>
                    </Td>
                    <Td />
                    <Td className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground">Adjust %</Td>
                    {SALARY_YEARS.map((y) => <Td key={y} right className="text-muted-foreground">{y < sy ? "—" : <CellInput numeric value={String(r.salary_adjustments?.[String(y)] ?? "")} placeholder="0" onChange={(e) => edit(r._key, { salary_adjustments: { ...r.salary_adjustments, [String(y)]: Number(e.target.value.replace(/[^\d.-]/g, "")) || 0 } })} />}</Td>)}
                    <Td className="max-[1280px]:hidden" />
                  </tr>,
                  <tr key={r._key + "b"} data-row={r._key} onBlur={(e) => left(e) && commitPerson(r._key)} className="[&>td]:h-[30px] [&>td]:font-semibold">
                    <Td right className="!font-normal"><CellInput numeric value={num(r.annual_salary)} onChange={(e) => edit(r._key, { annual_salary: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></Td>
                    <Td className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground">Salary</Td>
                    {sched.map((s) => <Td key={s.year} right className={cn("num", s.year < sy && "text-muted-foreground")}>{s.year < sy ? "—" : num(s.value)}</Td>)}
                    <Td right className={cn("num max-[1280px]:hidden", change.delta < 0 ? "text-bad" : change.delta > 0 ? "text-good" : "text-muted-foreground")}>{change.delta >= 0 ? "+" : "−"}{num(Math.abs(change.delta))} ({change.percent >= 0 ? "+" : ""}{change.percent.toFixed(1)}%)</Td>
                  </tr>,
                ];
              })}
            </tbody>
            <FootRow>
              <Td>Total → Overheads</Td>
              <Td right className="num">{num(people.filter((p) => p.role !== "contractor").reduce((a, p) => a + (Number(p.annual_salary) || 0), 0))}</Td>
              <Td />
              {totalSalariesByYear(people.map((p) => ({ ...p, startYear: startYear(p) }))).map((t) => <Td key={t.year} right className="num">{num(t.value)}</Td>)}
              <Td className="max-[1280px]:hidden" />
            </FootRow>
          </Grid>
        </>
      )}

      {area === "cap" && <CapabilityArea people={visible} caps={caps} onScope={setScope} onAdd={addCap} onEdit={editCap} onCommit={commitCap} onRemove={removeCap} left={left} />}

      {area === "risk" && (
        <>
          <Toolbar><Meta className="ml-0">What happens to the business if this person is unavailable for six months. Used in funding, SBA and sale reports.</Meta></Toolbar>
          <Grid>
            <thead><tr><Th style={{ width: "18%" }}>Name</Th><Th style={{ width: 120 }}>Dependency</Th><Th style={{ width: 170 }}>Successor</Th><Th style={{ width: 150 }}>Key-person cover</Th><Th>Notes</Th></tr></thead>
            <tbody>{visible.map((r) => <Row key={r._key}><Td><NameLink onClick={() => setScope(r._key)}>{r.name || r.first_name}</NameLink></Td><Td colSpan={4} className="text-muted-foreground">Phase 2 — after the forecast is live.</Td></Row>)}</tbody>
          </Grid>
        </>
      )}
    </ModuleFrame>
  );
}

const shareTotal = (ps: Row[]) => ps.reduce((a, p) => a + (Number(p.pct_shareholding) || 0), 0);

/** Reports saving state up to the frame (footer text + disabled buttons). */
function PendingBridge({ pending, saving, error }: { pending: boolean; saving: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : saving ? "Saving…" : undefined), [saving, error, setNote]);
  return null;
}

function CapabilityArea({ people, caps, onScope, onAdd, onEdit, onCommit, onRemove, left }: {
  people: Row[]; caps: Cap[]; onScope: (k: string) => void; onAdd: (p: Row) => void;
  onEdit: (id: string, c: Partial<Cap>, immediate?: boolean) => void; onCommit: (id: string) => void; onRemove: (c: Cap) => void;
  left: (e: React.FocusEvent<HTMLElement>) => boolean;
}) {
  const [kind, setKind] = useState<string>("all");
  const kinds = CAPABILITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }));
  return (
    <>
      <Toolbar>
        <div className="w-[200px]"><CellSelect value={kind} onValueChange={setKind} options={[{ value: "all", label: "All types" }, ...kinds]} className="border-input" /></div>
        <Meta>Hatched rows (Development areas) are internal — never printed in an external report</Meta>
      </Toolbar>
      <Grid>
        <thead><tr><Th style={{ width: 200 }}>Type</Th><Th>Description</Th><Th style={{ width: 36 }} /></tr></thead>
        <tbody>
          {people.map((p) => {
            const rows = caps.filter((c) => c.person_id === p.id && (kind === "all" || c.kind === kind));
            return [
              <GroupRow key={p._key} colSpan={3}>
                <NameLink onClick={() => onScope(p._key)}>{p.name || p.first_name || "New person"}</NameLink>
                <span className="font-normal text-muted-foreground">{[p.position, ROLE_LABEL[p.role]].filter(Boolean).join(" · ")}</span>
                <span className="ml-auto">{p.id ? <LinkButton onClick={() => onAdd(p)}>+ Add</LinkButton> : <span className="text-xs font-normal text-muted-foreground">save the person first</span>}</span>
              </GroupRow>,
              ...rows.map((c) => (
                <Row key={c.id} data-cap={c.id} onBlur={(e) => left(e) && onCommit(c.id)} className={cn(c.internal && "[&>td]:bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(0,0,0,.025)_6px_8px)] [&_input]:italic [&_input]:text-muted-foreground")}>
                  <Td><CellSelect value={c.kind} options={kinds} onValueChange={(v) => onEdit(c.id, { kind: v as CapabilityKind, internal: v === "development" }, !!c.description.trim())} className={cn(c.internal && "italic text-muted-foreground")} /></Td>
                  <Td><CellInput value={c.description} placeholder={c.kind === "education" || c.kind === "licence" ? "What, where, year — e.g. Diploma of Accounting, TAFE Queensland, 2008" : "One line"} onChange={(e) => onEdit(c.id, { description: e.target.value })} /></Td>
                  <Td>{c.internal && <span className="mr-1.5 text-[9.5px] uppercase tracking-[.06em] text-muted-foreground/70">internal</span>}<RemoveButton onClick={() => onRemove(c)} /></Td>
                </Row>
              )),
            ];
          })}
        </tbody>
      </Grid>
    </>
  );
}
