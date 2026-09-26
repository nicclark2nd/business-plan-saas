"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ModuleFrame, ModuleFooter, useModule } from "@/components/module/ModuleFrame";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Toolbar, Meta, RemoveButton, CellTextarea, LinkButton, focusRow } from "@/components/module/DataGrid";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { upsertSwot, deleteSwot, continueFromSwot } from "./actions";
import { QUADRANTS, QUADRANT_LABEL, QUADRANT_HINT, RESPONSE_LABEL, RESPONSE_PROMPT, RISK_QUADRANTS, QUADRANT_NOUN, type Quadrant, type SwotItem, type Suggestion, type LinkedGoal } from "./model";

type Row = SwotItem & { _dirty?: boolean };
const STEP = GUIDED_STEPS.find((s) => s.id === "swot")?.step ?? 5;
const blank = (q: Quadrant, id = `tmp-new-${q}`): Row => ({ id, quadrant: q, text: "", source: null, sort_order: 0, response: null });

export function SwotModule({ planId, initial, suggestions, goals, mode }: {
  planId: string; initial: SwotItem[]; suggestions: Suggestion[];
  /** Goals that answer a SWOT line (§6.59.1) — read only here; the commitment is made at the Goals step. */
  goals: LinkedGoal[];
  mode: "guided" | "advanced";
}) {
  // Every quadrant with nothing in it starts with a blank line (closed decision 8); fixed ids keep server and client in step.
  const [rows, setRows] = useState<Row[]>(() => [...initial, ...QUADRANTS.filter((q) => !initial.some((i) => i.quadrant === q)).map((q) => blank(q))]);
  /** Keyed per row, so several broken lines are several messages rather than the first one found (§6.98). */
  const errors = useSaveErrors();
  const [pending, start] = useTransition();
  const ref = useRef(rows); useEffect(() => { ref.current = rows; }, [rows]);
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);

  /* Typing no longer erases the reason a line would not save (§6.98). */
  const edit = (id: string, patch: Partial<Row>) => setRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch, _dirty: true } : x)));
  const commit = (id: string) => {
    const row = ref.current.find((x) => x.id === id);
    if (!row || !row._dirty || !row.text.trim()) return;
    setRows((xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: false } : x)));
    start(async () => {
      const r = await upsertSwot(planId, { id: id.startsWith("tmp-") ? undefined : id, quadrant: row.quadrant, text: row.text, source: row.source, response: row.response });
      if (r.ok) { errors.clear(`line:${id}`); setRows((xs) => xs.map((x) => (x.id === id ? { ...x, id: r.data!.id } : x))); }
      else { errors.raise({ key: `line:${id}`, message: r.error, label: "SWOT line" }); setRows((xs) => xs.map((x) => (x.id === id ? { ...x, _dirty: true } : x))); }
    });
  };
  const add = (q: Quadrant) => { const id = `tmp-${crypto.randomUUID()}`; setRows((xs) => [blank(q, id), ...xs]); focusRow(`[data-row="${id}"]`); };
  const remove = (row: Row) => {
    setRows((xs) => { const rest = xs.filter((x) => x.id !== row.id); return rest.some((x) => x.quadrant === row.quadrant) ? rest : [...rest, blank(row.quadrant, `tmp-${crypto.randomUUID()}`)]; });
    if (!row.id.startsWith("tmp-")) start(async () => { await deleteSwot(planId, row.id); });
  };
  /** One click turns a suggestion into a real item, saved at once, remembering where it came from. */
  const use = (s: Suggestion) => {
    const id = `tmp-${crypto.randomUUID()}`;
    setRows((xs) => [{ id, quadrant: s.quadrant, text: s.text, source: s.key, sort_order: 0, response: null }, ...xs.filter((x) => !(x.quadrant === s.quadrant && !x.text.trim() && x.id.startsWith("tmp-")))]);
    start(async () => {
      const r = await upsertSwot(planId, { quadrant: s.quadrant, text: s.text, source: s.key });
      if (r.ok) { errors.clear(`line:${id}`); setRows((xs) => xs.map((x) => (x.id === id ? { ...x, id: r.data!.id } : x))); }
      else errors.raise({ key: `line:${id}`, message: r.error, label: "SWOT line" });
    });
  };
  const flush = () => ref.current.forEach((r) => r._dirty && commit(r.id));
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    flush(); start(async () => { await continueFromSwot(planId, intent); });
  };

  const real = rows.filter((r) => r.text.trim());
  const used = new Set(rows.map((r) => r.source).filter(Boolean));
  const open = suggestions.filter((s) => !used.has(s.key));

  /**
   * The gap, named out loud (§6.41.3). A SWOT that lists four threats and plans for none of them is worth
   * less than one with two of each, and the screen should be the thing that says so — not the coach three
   * weeks later, and not a lender reading the report.
   */
  const planned = real.filter((r) => (r.response ?? "").trim());
  const byId = new Map(goals.filter((g) => g.swot_item_id).map((g) => [g.swot_item_id, g] as const));
  const exposed = RISK_QUADRANTS
    .map((q) => ({ q, n: real.filter((r) => r.quadrant === q && !(r.response ?? "").trim()).length }))
    .filter((x) => x.n > 0);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("swot")} title="SWOT" subtitle="Four honest lists — half of it is already in your plan" mode={mode}
      errors={errors}
      areas={[{ key: "swot", label: "SWOT", count: real.length }]} area="swot" onArea={() => {}} scope={{ label: "This plan" }}
      footer={<ModuleFooter planId={planId} moduleId="swot" formId="swot-form" />}
      help={<>
        <h3>What good looks like</h3>
        <p>Three to five lines a quadrant, each one specific enough that a stranger could check it. &quot;Good team&quot; is not a strength; &quot;11-year builder relationships and the only QBCC open licence in the postcode&quot; is.</p>
        <p>The faint lines are drawn from what you have already written — your advantage, your competitors, your team&apos;s development areas, what could change. Click <b>Use</b> to keep one; ignore the rest. Nothing is added without you.</p>
        <p>Weaknesses are the quadrant lenders read first. An honest one (&quot;the owner does all the estimating&quot;) with a plan to fix it beats a blank.</p>
        <h3>Mitigation</h3>
        <p>Under every line there is a second one: build on it, fix it, take it, guard against it. Four lists with nothing attached is a page in a report — the same four lists with &quot;hire and train a second estimator&quot; under the estimating weakness is a plan. Nothing is compulsory, but the line at the top counts the weaknesses and threats you have left blank, because that is the count a lender does.</p>
        <p>What you write here is part of the plan in its own right, and it is printed as part of it — a lender reading your Weaknesses sees your mitigation in the column beside each one. It does not have to become anything else to count.</p>
        <p>If you later want one of these to have somebody&apos;s name and a date on it, step {GUIDED_STEPS.find((s) => s.id === "goals")?.step} can turn it into a goal. That is optional. Anything you have already turned into one is tagged <b>goal</b> here, so you can see which lines somebody is accountable for and which are stated intent.</p>
        <h3>Where this goes</h3>
        <p>SWOT section of every report — every line with its mitigation beside it, and <b>&quot;Not yet addressed in this plan&quot;</b> beside the ones you leave blank. The AI reads all four quadrants when it drafts your Goals in step {GUIDED_STEPS.find((s) => s.id === "goals")?.step}.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={rows.some((r) => r._dirty)} />
      <form id="swot-form" onSubmit={onSubmit} className="hidden" />
      <Toolbar>
        <Meta className="ml-0">
          {real.length} line{real.length === 1 ? "" : "s"} across four quadrants · {planned.length} with a plan
          {byId.size > 0 ? ` · ${byId.size} now a goal` : ""}
          {open.length ? ` · ${open.length} suggested from your plan` : ""}.
        </Meta>
        {exposed.length > 0 && (
          <Meta className="ml-auto text-warn">
            {exposed.map((x) => `${x.n} ${QUADRANT_NOUN[x.q][x.n === 1 ? 0 : 1]}`).join(" and ")} with nothing planned.
          </Meta>
        )}
      </Toolbar>

      <div className="grid grid-cols-2 max-[1000px]:grid-cols-1">
        {QUADRANTS.map((q, i) => {
          const list = rows.filter((r) => r.quadrant === q);
          const sugg = open.filter((s) => s.quadrant === q);
          return (
            <section key={q} className={cn("min-w-0 border-border", i % 2 === 0 && "border-r max-[1000px]:border-r-0", i < 2 && "border-b")}>
              <header className="flex items-center gap-2.5 border-b border-border bg-secondary px-5 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">{QUADRANT_LABEL[q]}</h2>
                <span className="inline-block min-w-[18px] rounded-full border border-border bg-card px-[5px] text-center text-[10.5px] font-semibold text-muted-foreground">{list.filter((r) => r.text.trim()).length}</span>
                <span className="truncate text-[11.5px] text-muted-foreground">{QUADRANT_HINT[q]}</span>
                <LinkButton className="ml-auto shrink-0" onClick={() => add(q)}>+ Line</LinkButton>
              </header>
              {/*
                WHAT A CLIENT WITH AN EMPTY QUADRANT IS NOT TOLD (§6.127).
                The second line only renders once the line above it has text, so on a new plan there is no
                mitigation field anywhere on this screen and nothing announcing that one is coming. A
                client writes four lists, moves on, and never learns the half that turns a list into a
                plan exists. The sentence costs one line and only appears while the quadrant is empty.
              */}
              {list.every((r) => !r.text.trim()) && (
                <p className="border-b border-border px-5 py-1.5 text-[11.5px] text-muted-foreground">
                  Every line you write gets a second one under it — <b>{RESPONSE_LABEL[q].toLowerCase()}</b>: {RESPONSE_PROMPT[q].toLowerCase()}.
                </p>
              )}
              <ul>
                {list.map((r) => {
                  const goal = byId.get(r.id);
                  return (
                    <li key={r.id} data-row={r.id} onBlur={(e) => left(e) && commit(r.id)} title={errors.forKey(`line:${r.id}`)}
                      className={cn("border-b border-border py-1 pl-5 pr-3", errors.forKey(`line:${r.id}`) && "bg-bad-soft")}>
                      <div className="flex items-start gap-2">
                        <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-border" />
                        <CellTextarea value={r.text} placeholder="One line" className="min-h-[30px]" onChange={(e) => edit(r.id, { text: e.target.value })} />
                        {r.source && <span className="mt-2 shrink-0 text-[9.5px] uppercase tracking-[.06em] text-muted-foreground/70" title="Drawn from your plan">plan</span>}
                        <RemoveButton onClick={() => remove(r)} />
                      </div>
                      {/*
                        What the business will DO about it (§6.59). Shown under every line that has been
                        written, empty and prompting rather than hidden behind a link: the whole point is
                        that a blank one is visible. An arrow rather than a label, because the quadrant's
                        own verb is already in the placeholder.
                      */}
                      {r.text.trim() && (
                        <div className="flex items-start gap-2 pl-[14px]">
                          {/*
                            THE LABEL STAYS WHEN THE PLACEHOLDER GOES (§6.127). It is what tells a client
                            re-reading their own plan what this indented sentence is answering, and it is
                            the word the report prints beside it.
                          */}
                          <span className="mt-[6px] w-[62px] shrink-0 text-[9.5px] font-semibold uppercase tracking-[.06em] text-faint">
                            {RESPONSE_LABEL[q]}
                          </span>
                          <CellTextarea value={r.response ?? ""} placeholder={RESPONSE_PROMPT[q]} className="min-h-[26px] text-[12.5px] text-muted-foreground"
                            onChange={(e) => edit(r.id, { response: e.target.value })} />
                          {goal && (
                            <span className="mt-[5px] shrink-0 rounded border border-good/40 bg-good-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-[.05em] text-good"
                              title={`Goal: ${goal.title}${goal.milestone_date ? ` — due ${goal.milestone_date}` : ""}`}>goal</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                {sugg.map((s) => (
                  <li key={s.key} className="flex items-start gap-2 border-b border-dashed border-border py-1.5 pl-5 pr-3 text-[13px] text-muted-foreground">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full border border-faint" />
                    <span className="min-w-0 flex-1 italic">{s.text}<span className="ml-2 not-italic text-[10.5px] text-faint">from {s.from}</span></span>
                    <LinkButton className="shrink-0 pt-0.5" onClick={() => use(s)}>Use</LinkButton>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </ModuleFrame>
  );
}

/** STATUS ONLY (§6.98) — a failed save travels on its own channel and is shown in red, not in this grey. */
function PendingBridge({ pending, dirty }: { pending: boolean; dirty: boolean }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the line" : undefined), [pending, dirty, setNote]);
  return null;
}
