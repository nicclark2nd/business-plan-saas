"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStep } from "@/components/guided/StepFrame";
import { cn } from "@/lib/utils";
import { salarySchedule, scheduleChangeFromBase, totalSalariesByYear, SALARY_YEARS } from "@/engine/people/salary";
import { upsertPerson, deletePerson, upsertListItem, deleteListItem, continueFromPeople, type PeopleData, type Person, type ListKind } from "./actions";

const money = (n: number | null | undefined, currency = "AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n) || 0);
const PRODUCTIVITY = ["1 - Avoiding", "2 - Distracted", "3 - Appropriate", "4 - Deliberate", "5 - Important", "6 - Inspired Work"];
const QUALITY_KINDS = ["skill", "strength", "development", "expertise", "certification"];
const EDUCATION_KINDS = ["degree", "certification", "training", "course", "workshop", "seminar", "conference"];
const PRIORITIES = ["high", "medium", "low"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const GRID = "grid-cols-[minmax(140px,1fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_110px_130px_150px]";

type Row = Person & { _key: string; _dirty?: boolean; _state?: "saving" | "saved" | "error"; _error?: string };

export function PeopleModule({ planId, initial, currency }: { planId: string; initial: PeopleData; currency: string }) {
  const [people, setPeople] = useState<Row[]>(() => initial.people.map((p) => ({ ...p, first_name: p.first_name ?? "", last_name: p.last_name ?? "", salary_start_year: p.salary_start_year ?? 1, salary_adjustments: p.salary_adjustments ?? {}, _key: p.id })));
  const [lists, setLists] = useState({ duties: initial.duties, qualities: initial.qualities, education: initial.education, focus: initial.focus });
  const [selected, setSelected] = useState<string | null>(initial.people[0]?.id ?? null);
  const [pending, start] = useTransition();
  const { setPending, setNote } = useStep();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(people.some((p) => p._state === "saving") ? "Saving…" : undefined), [people, setNote]);

  const patch = (key: string, p: Partial<Row>) => setPeople((ps) => ps.map((r) => (r._key === key ? { ...r, ...p } : r)));
  const shareTotal = people.reduce((a, p) => a + (Number(p.pct_shareholding) || 0), 0);
  const totals = useMemo(() => totalSalariesByYear(people), [people]);
  const sel = people.find((p) => p._key === selected) ?? null;

  /**
   * Save policy: typing only updates local state and marks the row dirty; the save happens once when focus
   * leaves the row (or the detail panel), when a dropdown is chosen, or when Continue is pressed.
   * No per-keystroke traffic — one request per edit session, per person.
   */
  const savePerson = (key: string, changes: Partial<Person>, immediate = false) => {
    setPeople((ps) => ps.map((r) => (r._key === key ? { ...r, ...changes, _dirty: true, _state: undefined } : r)));
    if (immediate) queueMicrotask(() => commitPerson(key));
  };
  const commitPerson = (key: string) => {
    const row = peopleRef.current.find((r) => r._key === key);
    if (!row || !row._dirty || !(row.first_name ?? "").trim()) return;
    patch(key, { _state: "saving", _dirty: false });
    start(async () => {
      const res = await upsertPerson(planId, { ...row, id: row.id || undefined });
      if (res.ok) patch(key, { id: res.data!.id, _state: "saved" }); else patch(key, { _state: "error", _error: res.error, _dirty: true });
    });
  };
  /** True when focus has left the element's subtree entirely. */
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);
  // Latest-value refs, read only inside event handlers (never during render).
  const peopleRef = useRef(people);
  useEffect(() => { peopleRef.current = people; }, [people]);

  const addPerson = () => {
    const r: Row = { _key: crypto.randomUUID(), id: "", plan_id: planId, first_name: "", last_name: "", name: "", position: "", pct_shareholding: 0, annual_salary: 0, salary_start_year: 1, salary_adjustments: {}, productivity_level: null, productivity_comments: null, sort_order: 0 };
    setPeople((ps) => [r, ...ps]); setSelected(r._key);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-row="${r._key}"] input[name=first_name]`)?.focus(), 0);
  };
  const removePerson = (r: Row) => {
    clearTimeout(timers.current[r._key]);
    setPeople((ps) => ps.filter((x) => x._key !== r._key));
    if (selected === r._key) setSelected(null);
    if (r.id) start(async () => { await deletePerson(planId, r.id); });
  };

  /** Generic per-person list helpers */
  type AnyItem = { id: string; person_id: string; sort_order: number } & Record<string, unknown>;
  const items = (kind: ListKind, personId: string) => (lists[kind] as AnyItem[]).filter((i) => i.person_id === personId);
  const setItems = (kind: ListKind, fn: (xs: AnyItem[]) => AnyItem[]) => setLists((l) => ({ ...l, [kind]: fn(l[kind] as AnyItem[]) }));
  const addItem = (kind: ListKind, personId: string, blank: Record<string, unknown>) => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    setItems(kind, (xs) => [{ id: tmp, person_id: personId, sort_order: 0, ...blank }, ...xs]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-item="${tmp}"] input, [data-item="${tmp}"] textarea`)?.focus(), 0);
  };
  const dirtyItems = useRef(new Set<string>());
  const saveItem = (kind: ListKind, item: AnyItem, changes: Record<string, unknown>, immediate = false) => {
    const next = { ...item, ...changes };
    setItems(kind, (xs) => xs.map((x) => (x.id === item.id ? next : x)));
    dirtyItems.current.add(`${kind}:${item.id}`);
    if (immediate) queueMicrotask(() => commitItem(kind, item.id));
  };
  const commitItem = (kind: ListKind, itemId: string) => {
    const k = `${kind}:${itemId}`; if (!dirtyItems.current.has(k)) return;
    const next = (listsRef.current[kind] as AnyItem[]).find((x) => x.id === itemId); if (!next) return;
    const required = kind === "duties" ? next.duty : kind === "qualities" ? next.description : kind === "education" ? next.institution : next.focus_area;
    if (!String(required ?? "").trim()) return;
    dirtyItems.current.delete(k);
    const { id, person_id, sort_order, ...fields } = next; void sort_order;
    start(async () => {
      const res = await upsertListItem(planId, kind, person_id, { ...fields, id: id.startsWith("tmp-") ? undefined : id });
      if (res.ok && id.startsWith("tmp-")) setItems(kind, (xs) => xs.map((x) => (x.id === id ? { ...x, id: res.data!.id } : x)));
    });
  };
  const listsRef = useRef(lists); useEffect(() => { listsRef.current = lists; }, [lists]);
  const removeItem = (kind: ListKind, item: AnyItem) => {
    setItems(kind, (xs) => xs.filter((x) => x.id !== item.id));
    if (!item.id.startsWith("tmp-")) start(async () => { await deleteListItem(planId, kind, item.id); });
  };

  return (
    <>
      {/* ---------- people list ---------- */}
      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <Button size="sm" type="button" onClick={addPerson}>+ Add a person</Button>
          <span className="text-xs text-muted-foreground">
            {people.length} {people.length === 1 ? "person" : "people"} · rows save when you leave them
            {shareTotal > 0 && <> · shareholding {shareTotal}%{shareTotal !== 100 && <span className="text-warn"> (should total 100%)</span>}</>}
          </span>
        </div>
        {people.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">Start with the owner. Add anyone whose role matters to the plan — a bank or investor will want to know who runs the business.</div>}
        {people.length > 0 && (
          <div className={cn("grid gap-3 border-b border-input px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground whitespace-nowrap", GRID)}>
            <span>First name</span><span>Last name</span><span>Position</span><span>Shareholding %</span><span>Annual salary</span><span />
          </div>
        )}
        {people.map((r) => (
          <div key={r._key} data-row={r._key} onClick={() => setSelected(r._key)} onBlur={(e) => { if (left(e)) commitPerson(r._key); }}
            className={cn("grid cursor-pointer items-center gap-3 border-b border-border px-4 py-2 last:border-b-0", GRID, selected === r._key && "bg-accent/50")}>
            <Input name="first_name" defaultValue={r.first_name ?? ""} placeholder="First name" aria-label="First name" onChange={(e) => savePerson(r._key, { first_name: e.target.value })} />
            <Input name="last_name" defaultValue={r.last_name ?? ""} placeholder="Last name" aria-label="Last name" onChange={(e) => savePerson(r._key, { last_name: e.target.value })} />
            <Input name="job_title" defaultValue={r.position ?? ""} placeholder="e.g. Managing Director" aria-label="Position" onChange={(e) => savePerson(r._key, { position: e.target.value })} />
            <Input name="pct_shareholding" inputMode="decimal" className="num text-right" defaultValue={r.pct_shareholding || ""} placeholder="0" aria-label="Shareholding %" onChange={(e) => savePerson(r._key, { pct_shareholding: Number(e.target.value) || 0 })} />
            <Input name="annual_salary" inputMode="numeric" className="num text-right" defaultValue={r.annual_salary || ""} placeholder="0" aria-label="Annual salary" onChange={(e) => savePerson(r._key, { annual_salary: Number(String(e.target.value).replace(/[^0-9.]/g, "")) || 0 })} />
            <div className="flex items-center justify-end gap-1">
              <span className="w-14 text-right text-[11px] text-muted-foreground">{r._state === "saving" ? "Saving…" : r._state === "error" ? <span className="text-bad" title={r._error}>Error</span> : r._dirty ? "Editing" : r.id ? "Saved" : ""}</span>
              <Button type="button" variant={selected === r._key ? "secondary" : "ghost"} size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r._key); }}>Details</Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" title="Remove this person" onClick={(e) => { e.stopPropagation(); removePerson(r); }}>×</Button>
            </div>
          </div>
        ))}
        {people.length > 1 && (
          <div className={cn("grid gap-3 border-t border-input bg-secondary px-4 py-2 text-xs", GRID)}>
            <span className="col-span-4 font-semibold text-muted-foreground">Total salaries, Year 1 → 5</span>
            <span className="num col-span-2 text-right text-muted-foreground">{totals.map((t) => money(t.value, currency)).join(" · ")}</span>
          </div>
        )}
      </div>

      {/* ---------- selected person detail ---------- */}
      {sel && sel.id && (
        <div className="mt-3 rounded-md border border-border bg-card" onBlur={(e) => { if (left(e)) commitPerson(sel._key); }}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div><span className="font-semibold">{sel.first_name} {sel.last_name ?? ""}</span>{sel.position && <span className="text-muted-foreground"> · {sel.position}</span>}</div>
            <span className="text-xs text-muted-foreground">Optional detail — saved when you leave a field</span>
          </div>
          <Tabs defaultValue="salary" className="px-4 pb-4 pt-2">
            <TabsList>
              {["salary", "productivity", "duties", "qualities", "education", "focus"].map((t) => <TabsTrigger key={t} value={t}>{cap(t)}{["duties", "qualities", "education", "focus"].includes(t) && items(t as ListKind, sel.id).length > 0 && <Badge variant="secondary" className="ml-1.5 px-1.5">{items(t as ListKind, sel.id).length}</Badge>}</TabsTrigger>)}
            </TabsList>

            <TabsContent value="salary" className="pt-3">
              <SalaryTab person={sel} currency={currency} onChange={(c, now) => savePerson(sel._key, c, now)} />
            </TabsContent>

            <TabsContent value="productivity" className="pt-3">
              <div className="grid grid-cols-[280px_1fr] gap-4">
                <div className="space-y-1.5"><Label>Productivity level</Label>
                  <Select value={sel.productivity_level ?? undefined} onValueChange={(v) => v && savePerson(sel._key, { productivity_level: v }, true)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Choose a level…" /></SelectTrigger>
                    <SelectContent>{PRODUCTIVITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                  <p className="text-xs text-muted-foreground">1 = Avoiding · 3 = Appropriate · 6 = Inspired work. How this person spends their time relative to what the plan needs.</p></div>
                <div className="space-y-1.5"><Label>Comments</Label><Textarea defaultValue={sel.productivity_comments ?? ""} placeholder="e.g. Accurate invoicing, supplier payments, debtor follow-up, cashflow control." onChange={(e) => savePerson(sel._key, { productivity_comments: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="duties" className="pt-3">
              <ItemList title="Duties" hint="One responsibility per line — what this person is accountable for." onAdd={() => addItem("duties", sel.id, { duty: "" })} empty={items("duties", sel.id).length === 0}>
                {items("duties", sel.id).map((it) => (
                  <ItemRow key={it.id} id={it.id} onBlur={(e) => { if (left(e)) commitItem("duties", it.id); }} onRemove={() => removeItem("duties", it)}>
                    <Input defaultValue={String(it.duty ?? "")} placeholder="e.g. Accounts payable processing and supplier payment scheduling" onChange={(e) => saveItem("duties", it, { duty: e.target.value })} />
                  </ItemRow>))}
              </ItemList>
            </TabsContent>

            <TabsContent value="qualities" className="pt-3">
              <ItemList title="Qualities" hint="Skills, strengths, expertise, certifications — and areas for development." onAdd={() => addItem("qualities", sel.id, { kind: "skill", description: "" })} empty={items("qualities", sel.id).length === 0}>
                {items("qualities", sel.id).map((it) => (
                  <ItemRow key={it.id} id={it.id} onBlur={(e) => { if (left(e)) commitItem("qualities", it.id); }} onRemove={() => removeItem("qualities", it)} lead={
                    <Select value={String(it.kind)} onValueChange={(v) => v && saveItem("qualities", it, { kind: v }, true)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{QUALITY_KINDS.map((k) => <SelectItem key={k} value={k}>{cap(k)}</SelectItem>)}</SelectContent></Select>}>
                    <Input defaultValue={String(it.description ?? "")} placeholder="e.g. MYOB and Xero proficiency" onChange={(e) => saveItem("qualities", it, { description: e.target.value })} />
                  </ItemRow>))}
              </ItemList>
            </TabsContent>

            <TabsContent value="education" className="pt-3">
              <ItemList title="Education & training" hint="Degrees, certifications, courses, workshops — with where and when." onAdd={() => addItem("education", sel.id, { kind: "course", institution: "", year_completed: "", description: "" })} empty={items("education", sel.id).length === 0}>
                {items("education", sel.id).map((it) => (
                  <ItemRow key={it.id} id={it.id} onBlur={(e) => { if (left(e)) commitItem("education", it.id); }} onRemove={() => removeItem("education", it)} lead={
                    <Select value={String(it.kind)} onValueChange={(v) => v && saveItem("education", it, { kind: v }, true)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{EDUCATION_KINDS.map((k) => <SelectItem key={k} value={k}>{cap(k)}</SelectItem>)}</SelectContent></Select>}>
                    <div className="grid grid-cols-[1fr_90px_1.4fr] gap-2">
                      <Input defaultValue={String(it.institution ?? "")} placeholder="Institution" onChange={(e) => saveItem("education", it, { institution: e.target.value })} />
                      <Input defaultValue={String(it.year_completed ?? "")} placeholder="Year" inputMode="numeric" className="num" onChange={(e) => saveItem("education", it, { year_completed: e.target.value })} />
                      <Input defaultValue={String(it.description ?? "")} placeholder="What it was" onChange={(e) => saveItem("education", it, { description: e.target.value })} />
                    </div>
                  </ItemRow>))}
              </ItemList>
            </TabsContent>

            <TabsContent value="focus" className="pt-3">
              <ItemList title="Focus this year" hint="The one to three things this person will concentrate on, with a priority and a target date." onAdd={() => addItem("focus", sel.id, { focus_area: "", description: "", priority: "medium", target_date: null })} empty={items("focus", sel.id).length === 0}>
                {items("focus", sel.id).map((it) => (
                  <ItemRow key={it.id} id={it.id} onBlur={(e) => { if (left(e)) commitItem("focus", it.id); }} onRemove={() => removeItem("focus", it)} lead={
                    <Select value={String(it.priority)} onValueChange={(v) => v && saveItem("focus", it, { priority: v }, true)}><SelectTrigger className={cn("w-[120px]", it.priority === "high" && "text-bad", it.priority === "medium" && "text-warn")}><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((k) => <SelectItem key={k} value={k}>{cap(k)}</SelectItem>)}</SelectContent></Select>}>
                    <div className="grid grid-cols-[1fr_150px] gap-2">
                      <Input defaultValue={String(it.focus_area ?? "")} placeholder="e.g. Debtor follow-up cadence" onChange={(e) => saveItem("focus", it, { focus_area: e.target.value })} />
                      <Input type="date" defaultValue={String(it.target_date ?? "")} aria-label="Target date" onChange={(e) => saveItem("focus", it, { target_date: e.target.value || null })} />
                      <Textarea className="col-span-2 min-h-[56px]" defaultValue={String(it.description ?? "")} placeholder="What done looks like" onChange={(e) => saveItem("focus", it, { description: e.target.value })} />
                    </div>
                  </ItemRow>))}
              </ItemList>
            </TabsContent>
          </Tabs>
        </div>
      )}
      {sel && !sel.id && <p className="mt-3 text-xs text-muted-foreground">Type a first name and the detail tabs (salary schedule, duties, qualities, education, focus) will open for this person.</p>}

      <form id="people-form" action={(fd) => { peopleRef.current.forEach((r) => commitPerson(r._key)); Array.from(dirtyItems.current).forEach((k) => { const [kind, id] = k.split(":") as [ListKind, string]; commitItem(kind, id); }); start(() => continueFromPeople(planId, fd.get("intent") === "next" ? "next" : "later")); }} />
    </>
  );
}

function SalaryTab({ person, currency, onChange }: { person: Person; currency: string; onChange: (c: Partial<Person>, immediate?: boolean) => void }) {
  const adj = person.salary_adjustments ?? {};
  const schedule = salarySchedule(person.annual_salary ?? 0, adj, person.salary_start_year);
  const change = scheduleChangeFromBase(person.annual_salary ?? 0, adj, person.salary_start_year);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_200px] gap-4">
        <div className="space-y-1.5"><Label>Annual salary (base)</Label><Input inputMode="numeric" className="num" value={person.annual_salary || ""} placeholder="0" onChange={(e) => onChange({ annual_salary: Number(String(e.target.value).replace(/[^0-9.]/g, "")) || 0 })} /></div>
        <div className="space-y-1.5"><Label>Starts in</Label>
          <Select value={String(person.salary_start_year)} onValueChange={(v) => v && onChange({ salary_start_year: Number(v) }, true)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{SALARY_YEARS.map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div>
        <Label className="mb-1.5">Adjustment % each year <span className="font-normal text-muted-foreground">— compounds on the year before; negative for a cut</span></Label>
        <div className="grid grid-cols-5 gap-2">
          {SALARY_YEARS.map((y) => (
            <div key={y} className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Year {y}</div>
              <Input inputMode="decimal" className="num text-right" value={adj[String(y)] ?? ""} placeholder="0" disabled={y < person.salary_start_year}
                onChange={(e) => onChange({ salary_adjustments: { ...adj, [String(y)]: e.target.value === "" ? undefined : Number(e.target.value) } })} />
              <div className="num text-right text-xs text-muted-foreground">{y < person.salary_start_year ? "—" : money(schedule[y - 1].value, currency)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md bg-secondary px-4 py-3 text-center text-[13px]">
        <div className="font-semibold">Change from base by Year 5</div>
        <div className={cn("num", change.delta < 0 ? "text-bad" : change.delta > 0 ? "text-good" : "text-muted-foreground")}>{change.delta >= 0 ? "+" : "−"}{money(Math.abs(change.delta), currency)} ({change.percent >= 0 ? "+" : ""}{change.percent}%)</div>
      </div>
    </div>
  );
}

function ItemList({ title, hint, onAdd, empty, children }: { title: string; hint: string; onAdd: () => void; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div><div className="text-[13px] font-semibold">{title}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>+ Add</Button>
      </div>
      {empty ? <div className="rounded-md border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">Nothing here yet.</div> : <div className="space-y-2">{children}</div>}
    </div>
  );
}

function ItemRow({ id, lead, children, onRemove, onBlur }: { id: string; lead?: React.ReactNode; children: React.ReactNode; onRemove: () => void; onBlur?: React.FocusEventHandler<HTMLElement> }) {
  return (
    <div data-item={id} onBlur={onBlur} className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-2">
      {lead}
      <div className="flex-1">{children}</div>
      <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" title="Remove" onClick={onRemove}>×</Button>
    </div>
  );
}
