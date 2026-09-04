"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/FormMessage";
import { useStep } from "@/components/guided/StepFrame";
import { cn } from "@/lib/utils";
import { savePerson, deletePerson, continueFromPeople, type Person } from "./actions";

type Row = Person & { _new?: boolean; _open?: boolean; _dirty?: boolean; _error?: string };
const PRODUCTIVITY = ["Exceptional", "Strong", "Solid", "Developing", "Needs support"];
const money = (n: number | null | undefined) => n ? "$" + Math.round(n).toLocaleString("en-AU") : "—";

function blank(): Row {
  return { id: "", name: "", position: "", pct_time_in_sales: 0, pct_shareholding: 0, annual_salary: 0, salary_by_year: {}, productivity_level: null,
    productivity_comments: null, duties: null, qualities: null, education: null, focus_areas: null, sort_order: 0, _new: true, _open: true };
}

export function PeopleList({ planId, initial }: { planId: string; initial: Person[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pending, start] = useTransition();
  const { setPending, setNote } = useStep();
  useEffect(() => setPending(pending), [pending, setPending]);
  const anyOpen = rows.some((r) => r._open);
  useEffect(() => setNote(anyOpen ? "Finish the open person first — unsaved rows won't be kept." : undefined), [anyOpen, setNote]);
  const shareTotal = rows.reduce((a, r) => a + (r.pct_shareholding ?? 0), 0);
  const patch = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const add = () => { setRows((rs) => [blank(), ...rs]); setTimeout(() => (document.querySelector<HTMLInputElement>("#person-0-name"))?.focus(), 0); };
  const remove = (i: number) => { const r = rows[i]; setRows((rs) => rs.filter((_, j) => j !== i)); if (r.id) start(() => deletePerson(planId, r.id)); };
  const save = (i: number, form: HTMLFormElement) => {
    const fd = new FormData(form);
    start(async () => {
      const res = await savePerson(planId, fd);
      if (res.error) patch(i, { _error: res.error });
      else patch(i, { id: res.id!, _new: false, _open: false, _dirty: false, _error: undefined, name: String(fd.get("name")), position: String(fd.get("job_title") ?? ""),
        pct_shareholding: Number(fd.get("pct_shareholding") || 0), annual_salary: Number(String(fd.get("annual_salary") ?? "0").replace(/[^0-9.]/g, "") || 0) });
    });
  };

  return (
    <>
      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <Button size="sm" type="button" onClick={add}>+ Add a person</Button>
          <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "person" : "people"} · new ones appear at the top{shareTotal > 0 && <> · shareholding {shareTotal}%{shareTotal !== 100 && <span className="text-warn"> (should total 100%)</span>}</>}</span>
        </div>

        {rows.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">Start with the owner. Add anyone whose role matters to the plan — a bank or investor will want to know who runs the business.</div>}

        <div className="max-h-[520px] overflow-auto">
          {rows.length > 0 && (
            <div className="sticky top-0 z-[1] grid grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_130px_150px_120px] gap-3 border-b border-input bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground whitespace-nowrap">
              <span>Name</span><span>Position</span><span className="text-right" title="Percent shareholding">Share %</span><span className="text-right">Salary</span><span />
            </div>
          )}
          {rows.map((r, i) => (
            <div key={r.id || `new-${i}`} className={cn("border-b border-border last:border-b-0", r._new && "bg-accent/40")}>
              {!r._open ? (
                <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_130px_150px_120px] items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="font-semibold">{r.name}</span><span className="text-muted-foreground">{r.position || "—"}</span>
                  <span className="num text-right">{r.pct_shareholding ?? 0}%</span><span className="num text-right">{money(r.annual_salary)}</span>
                  <span className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => patch(i, { _open: true })}>Edit</Button><Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(i)} title="Remove">×</Button></span>
                </div>
              ) : (
                <form className="space-y-4 px-4 py-4" onSubmit={(e) => { e.preventDefault(); save(i, e.currentTarget); }}>
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_130px_150px_120px] gap-3">
                    <div className="space-y-1"><Label htmlFor={`person-${i}-name`}>Name</Label><Input id={`person-${i}-name`} name="name" defaultValue={r.name} required placeholder="Full name" /></div>
                    <div className="space-y-1"><Label>Position</Label><Input name="job_title" defaultValue={r.position ?? ""} placeholder="e.g. Managing Director" /></div>
                                        <div className="space-y-1"><Label className="whitespace-nowrap">Shareholding %</Label><Input name="pct_shareholding" inputMode="decimal" className="num text-right" defaultValue={r.pct_shareholding || ""} placeholder="0" /></div>
                    <div className="space-y-1"><Label className="whitespace-nowrap">Annual salary ($)</Label><Input name="annual_salary" inputMode="numeric" className="num text-right" defaultValue={r.annual_salary || ""} placeholder="0" /></div>
                  </div>

                  <details className="group rounded-md border border-border bg-secondary/60">
                    <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold text-primary">More about {r.name || "this person"} <span className="font-normal text-muted-foreground">— optional: salary by year, duties, productivity, background</span></summary>
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

                  <FormError>{r._error}</FormError>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : r._new ? "Add person" : "Save changes"}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => (r._new ? remove(i) : patch(i, { _open: false }))}>Cancel</Button>
                    {!r._new && <Badge variant="outline" className="ml-auto text-muted-foreground">Saved</Badge>}
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      <form id="people-form" action={(fd) => start(() => continueFromPeople(planId, fd.get("intent") === "next" ? "next" : "later"))} />
    </>
  );
}
