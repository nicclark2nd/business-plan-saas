"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStep } from "@/components/guided/StepFrame";
import { cn } from "@/lib/utils";
import { savePerson, deletePerson, continueFromPeople, type Person } from "./actions";

/**
 * Spreadsheet-style list. "+ Add a person" adds a row; rows save themselves when you leave them or pause
 * typing; × removes one. The only other button on the page is the footer's Save and continue.
 */
type Row = Person & { _key: string; _dirty?: boolean; _saving?: boolean; _saved?: boolean; _error?: string };
const PRODUCTIVITY = ["Exceptional", "Strong", "Solid", "Developing", "Needs support"];
const GRID = "grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_130px_150px_44px]";

const blank = (): Row => ({ _key: crypto.randomUUID(), id: "", name: "", position: "", pct_shareholding: 0, annual_salary: 0, salary_by_year: {}, productivity_level: null,
  productivity_comments: null, duties: null, qualities: null, education: null, focus_areas: null, sort_order: 0 });

export function PeopleList({ planId, initial }: { planId: string; initial: Person[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((p) => ({ ...p, _key: p.id })));
  const [pending, start] = useTransition();
  const { setPending, setNote } = useStep();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => setPending(pending), [pending, setPending]);

  const shareTotal = rows.reduce((a, r) => a + (Number(r.pct_shareholding) || 0), 0);
  const unsavedCount = rows.filter((r) => r._dirty && r.name.trim()).length;
  useEffect(() => setNote(unsavedCount ? `${unsavedCount} unsaved change${unsavedCount > 1 ? "s" : ""} — saving…` : undefined), [unsavedCount, setNote]);

  const patch = useCallback((key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...p } : r))), []);

  const collect = (root: HTMLElement) => {
    const fd = new FormData();
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input[name], textarea[name], select[name]").forEach((el) => fd.append(el.name, el.value));
    return fd;
  };

  const saveRow = useCallback((key: string, root: HTMLElement) => {
    const fd = collect(root);
    if (!String(fd.get("name") ?? "").trim()) return; // nothing to save yet
    patch(key, { _saving: true, _error: undefined });
    start(async () => {
      const res = await savePerson(planId, fd);
      if (res.error) patch(key, { _saving: false, _error: res.error });
      else patch(key, { id: res.id!, _saving: false, _dirty: false, _saved: true });
    });
  }, [planId, patch]);

  const scheduleSave = (key: string, root: HTMLElement) => {
    patch(key, { _dirty: true, _saved: false });
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => saveRow(key, root), 900);
  };

  const add = () => {
    const r = blank();
    setRows((rs) => [r, ...rs]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-row="${r._key}"] input[name=name]`)?.focus(), 0);
  };
  const remove = (r: Row) => {
    clearTimeout(timers.current[r._key]);
    setRows((rs) => rs.filter((x) => x._key !== r._key));
    if (r.id) start(() => deletePerson(planId, r.id));
  };

  return (
    <>
      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <Button size="sm" type="button" onClick={add}>+ Add a person</Button>
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "person" : "people"} · rows save as you type
            {shareTotal > 0 && <> · shareholding {shareTotal}%{shareTotal !== 100 && <span className="text-warn"> (should total 100%)</span>}</>}
          </span>
        </div>

        {rows.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">Start with the owner. Add anyone whose role matters to the plan — a bank or investor will want to know who runs the business.</div>}

        {rows.length > 0 && (
          <div className={cn("grid gap-3 border-b border-input px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground whitespace-nowrap", GRID)}>
            <span>Name</span><span>Position</span><span>Shareholding %</span><span>Annual salary ($)</span><span />
          </div>
        )}

        <div className="max-h-[560px] overflow-auto">
          {rows.map((r) => (
            <div key={r._key} data-row={r._key} className="border-b border-border px-4 py-3 last:border-b-0"
              onInput={(e) => scheduleSave(r._key, e.currentTarget)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { clearTimeout(timers.current[r._key]); saveRow(r._key, e.currentTarget); } }}>
              <input type="hidden" name="id" value={r.id} readOnly />
              <div className={cn("grid items-center gap-3", GRID)}>
                <Input name="name" defaultValue={r.name} placeholder="Full name" aria-label="Name" />
                <Input name="job_title" defaultValue={r.position ?? ""} placeholder="e.g. Managing Director" aria-label="Position" />
                <Input name="pct_shareholding" inputMode="decimal" className="num text-right" defaultValue={r.pct_shareholding || ""} placeholder="0" aria-label="Shareholding %"
                  onChange={(e) => patch(r._key, { pct_shareholding: Number(e.target.value) || 0 })} />
                <Input name="annual_salary" inputMode="numeric" className="num text-right" defaultValue={r.annual_salary || ""} placeholder="0" aria-label="Annual salary" />
                <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" title="Remove this person" onClick={() => remove(r)}>×</Button>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <details className="group flex-1 rounded-md border border-border bg-secondary/60">
                  <summary className="cursor-pointer px-3 py-1.5 text-[12.5px] font-semibold text-primary">More about this person <span className="font-normal text-muted-foreground">— optional: salary by year, duties, productivity, background</span></summary>
                  <div className="grid grid-cols-2 gap-4 border-t border-border px-3 py-3">
                    <div className="col-span-2">
                      <Label className="mb-1.5">Salary by year <span className="font-normal text-muted-foreground">— leave blank to use the annual salary every year</span></Label>
                      <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((y) => <Input key={y} name={`salary_y${y}`} inputMode="numeric" className="num text-right" placeholder={`Year ${y}`} defaultValue={r.salary_by_year?.[String(y)] ?? ""} />)}</div>
                    </div>
                    <div className="space-y-1"><Label>Productivity</Label>
                      <Select name="productivity_level" defaultValue={r.productivity_level ?? undefined}><SelectTrigger className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger><SelectContent>{PRODUCTIVITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Productivity notes</Label><Input name="productivity_comments" defaultValue={r.productivity_comments ?? ""} /></div>
                    <div className="space-y-1"><Label>Duties</Label><Textarea name="duties" className="min-h-[64px]" defaultValue={r.duties ?? ""} placeholder="What they are responsible for" /></div>
                    <div className="space-y-1"><Label>Qualities</Label><Textarea name="qualities" className="min-h-[64px]" defaultValue={r.qualities ?? ""} placeholder="What they bring" /></div>
                    <div className="space-y-1"><Label>Education &amp; experience</Label><Textarea name="education" className="min-h-[64px]" defaultValue={r.education ?? ""} /></div>
                    <div className="space-y-1"><Label>Focus this year</Label><Textarea name="focus_areas" className="min-h-[64px]" defaultValue={r.focus_areas ?? ""} placeholder="The one or two things they'll concentrate on" /></div>
                  </div>
                </details>
                <span className="w-16 text-right text-[11px] text-muted-foreground">{r._error ? <span className="text-bad">{r._error}</span> : r._saving ? "Saving…" : r._dirty ? "" : r._saved || r.id ? "Saved" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer buttons submit this: flush any pending row saves, then move on. */}
      <form id="people-form" action={(fd) => {
        Object.values(timers.current).forEach(clearTimeout);
        document.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => { const key = el.dataset.row!; const row = rows.find((x) => x._key === key); if (row?._dirty) saveRow(key, el); });
        start(() => continueFromPeople(planId, fd.get("intent") === "next" ? "next" : "later"));
      }} />
    </>
  );
}
