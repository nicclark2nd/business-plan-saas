"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleFrame, ModuleFooter } from "@/components/module/ModuleFrame";
import { CellSelect, CellTextarea, LinkButton, Note, RemoveButton } from "@/components/module/DataGrid";
import { GUIDED_STEPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSaveOnce } from "@/lib/saveOnce";
import { AREA_LABEL, GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { AREA_HINT, AREA_PROMPT, STATUSES, STATUS_LABEL, type Goal, type GoalStatus, type Person, type SwotResponse } from "./model";
import { continueFromGoals, deleteGoal, saveAnnualGoal, saveQuarterlyGoal, setGoalStatus } from "./actions";

export type QuarterChoice = { planYear: number; quarter: number; label: string; months: string };

type AreaKey = "areas" | "quarter" | "swot";
const STEP = GUIDED_STEPS.find((s) => s.id === "goals")?.step ?? 14;

const TONE: Record<GoalStatus, string> = {
  not_started: "bg-secondary text-muted-foreground",
  in_progress: "bg-accent text-primary",
  done: "bg-good-soft text-good",
  at_risk: "bg-warn-soft text-warn",
};

/**
 * Goals (§6.7) — six annual goals, and the quarterly goals that get you there.
 *
 * The six stay on ONE screen rather than becoming six tabs. That was the decision when Goals replaced APeX's
 * "12-month outcomes": a coach reading six areas together sees the plan; a coach clicking through six tabs
 * sees six lists. So the areas scroll, and the module bar carries the other useful cut instead — everything
 * due this quarter, which is what a review meeting actually opens.
 *
 * The annual goal is edited in place because it is one sentence. A quarterly goal has five fields and goes
 * through a dialog (§6.16), except its status, which is the one thing a review changes and saves on the spot.
 */
export function GoalsModule({ planId, mode, initial, people, quarters, thisQuarter, swot }: {
  planId: string; mode: "guided" | "advanced"; initial: Goal[]; people: Person[];
  quarters: QuarterChoice[]; thisQuarter: { planYear: number; quarter: number };
  /** Lines from step 5 the client said they would act on (§6.59.1). */
  swot: SwotResponse[];
}) {
  const [area, setArea] = useState<AreaKey>("areas");
  const [goals, setGoals] = useState<Goal[]>(initial);
  const [pending, start] = useTransition();
  const once = useSaveOnce();
  const [err, setErr] = useState<string>();
  const [editing, setEditing] = useState<{ area: GoalArea | null; goal?: Goal; from?: SwotResponse } | null>(null);
  const [toRemove, setToRemove] = useState<Goal | null>(null);

  // The plan can move underneath an open screen; the same rule the forecast grids follow (§6.43.2).
  const [cameFrom, setCameFrom] = useState(initial);
  if (initial !== cameFrom) { setCameFrom(initial); setGoals(initial); }

  const annual = (a: GoalArea) => goals.find((g) => !g.parent_id && g.area === a);
  const quarterly = (a: GoalArea) => goals.filter((g) => g.parent_id && g.area === a);
  const label = (g: Goal) => quarters.find((q) => q.planYear === g.year && q.quarter === g.quarter)?.label ?? `Q${g.quarter}`;
  const ownerName = (id: string | null) => people.find((p) => p.id === id)?.name || "";

  const setAnnual = (a: GoalArea, title: string) =>
    setGoals((xs) => {
      const row = xs.find((g) => !g.parent_id && g.area === a);
      if (row) return xs.map((g) => (g === row ? { ...g, title } : g));
      return [...xs, { id: `tmp-${a}`, parent_id: null, area: a, title, detail: null, year: null, quarter: null, owner_person_id: null, status: "not_started", milestone_date: null, source: "manual", sort_order: 0, swot_item_id: null }];
    });

  const commitAnnual = (a: GoalArea) => start(async () => {
    const r = await saveAnnualGoal(planId, a, annual(a)?.title ?? "");
    if (!r.ok) setErr(r.error); else setErr(undefined);
  });

  const changeStatus = (g: Goal, status: GoalStatus) => {
    setGoals((xs) => xs.map((x) => (x.id === g.id ? { ...x, status } : x)));
    start(async () => { const r = await setGoalStatus(planId, g.id, status); if (!r.ok) setErr(r.error); });
  };

  const remove = (g: Goal) => start(async () => {
    const r = await deleteGoal(planId, g.id);
    if (!r.ok) { setErr(r.error); return; }
    setGoals((xs) => xs.filter((x) => x.id !== g.id && x.parent_id !== g.id));
    setToRemove(null);
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const intent = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "later" ? "later" : "next";
    start(async () => { await continueFromGoals(planId, intent); });
  };

  const annualSet = GOAL_AREAS.filter((a) => (annual(a.key)?.title ?? "").trim()).length;
  const due = useMemo(
    () => goals.filter((g) => g.parent_id && g.year === thisQuarter.planYear && g.quarter === thisQuarter.quarter),
    [goals, thisQuarter]);
  const thisLabel = quarters.find((q) => q.planYear === thisQuarter.planYear && q.quarter === thisQuarter.quarter);
  /** Responses nobody is accountable for yet. A line that already has a goal is not offered again. */
  const committed = new Set(goals.map((g) => g.swot_item_id).filter(Boolean));
  const openSwot = swot.filter((s2) => !committed.has(s2.id));

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group="Goals" title="Goals"
      subtitle="One goal a year for each part of the business, and the quarters that get you there" mode={mode}
      areas={[
        { key: "areas", label: "By area", count: annualSet, tag: annualSet === GOAL_AREAS.length ? undefined : `${GOAL_AREAS.length - annualSet} to set` },
        { key: "quarter", label: thisLabel?.label ?? "This quarter", count: due.length },
        ...(swot.length ? [{ key: "swot", label: "From your SWOT", count: openSwot.length }] : []),
      ]}
      area={area} onArea={(k) => setArea(k as AreaKey)}
      scope={{ label: "This plan" }}
      footer={<ModuleFooter planId={planId} prevId="forecast" formId="goals-form" />}
      help={<>
        <h3>Two levels, on purpose</h3>
        <p>The <b>annual goal</b> is one or two sentences about where this part of the business is going. It heads its section of the report, so a lender reads all six as the plan&apos;s intent.</p>
        <p>A <b>quarterly goal</b> is a step towards it, with somebody&apos;s name on it and a date. Goals without an owner do not happen.</p>
        <h3>Set them after the numbers</h3>
        <p>These come at step {STEP} because a target set before the forecast exists is a wish. Your revenue, margin and cash figures are all decided by now — quote them.</p>
        <h3>From your SWOT</h3>
        <p>Anything you said you would do about a strength, weakness, opportunity or threat back at step 5 is waiting on its own tab. Turning one into a goal is where it gets an owner, a quarter and a status — and the SWOT screen then shows that line as committed rather than intended. The wording stays in one place: the goal is the commitment, the SWOT keeps the observation.</p>
        <h3>From What-If</h3>
        <p>Move the levers on the What-If planner and <b>Turn into goals</b> writes the quarterly goals for you, with the figure each one is worth already attached.</p>
        <h3>Where this goes</h3>
        <p>Annual goals head their report sections. Quarterly goals appear on your dashboard for the quarter they belong to.</p>
      </>}
    >
      <form id="goals-form" onSubmit={onSubmit} className="hidden" />
      {err && <Note><span className="text-bad">{err}</span></Note>}

      {area === "areas" ? (
        <div className="divide-y divide-border">
          {GOAL_AREAS.map(({ key, label: areaLabel }) => {
            const a = annual(key);
            const rows = quarterly(key);
            return (
              /*
               * A container query, not a breakpoint. `lg:` watches the VIEWPORT, and this column is not the
               * viewport — with the help rail open it is barely half of it, so a two-column split fired at
               * 1440 and squeezed the quarterly list into a hundred pixels. `@container` asks the only
               * question that matters: is there room HERE.
               */
              <section key={key} className="@container px-5 py-3.5">
                <div className="grid gap-3 @[680px]:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-[13px] font-semibold">{areaLabel}</h2>
                      <span className="text-[11.5px] text-muted-foreground">{AREA_HINT[key]}</span>
                    </div>
                    <CellTextarea
                      className="mt-1.5 min-h-[62px] w-full rounded border border-input bg-card px-2 py-1.5 text-[13px]"
                      placeholder={AREA_PROMPT[key]}
                      value={a?.title ?? ""} disabled={pending}
                      onChange={(e) => setAnnual(key, e.target.value)}
                      onBlur={() => commitAnnual(key)}
                    />
                  </div>
                  <div className="rounded border border-border">
                    <div className="flex items-center gap-2 border-b border-border bg-secondary px-3 py-1.5">
                      <span className="eyebrow">Quarters</span>
                      <LinkButton className="ml-auto whitespace-nowrap" onClick={() => setEditing({ area: key })}>+ Add a goal</LinkButton>
                    </div>
                    {rows.length === 0 ? (
                      <p className="px-3 py-2.5 text-[12.5px] text-muted-foreground">Nothing yet. A quarterly goal is a step towards the annual one, with somebody&apos;s name and a date on it.</p>
                    ) : rows.map((g) => (
                      <div key={g.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] last:border-b-0">
                        <span className="w-[74px] flex-none tabular-nums text-[11.5px] text-muted-foreground">{label(g)}</span>
                        <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-primary hover:underline"
                          title={g.detail ? `${g.title} — ${g.detail}` : g.title} onClick={() => setEditing({ area: key, goal: g })}>
                          {g.title}
                        </button>
                        {/* Outside the truncating cell: where a goal came from is the first thing truncation ate. */}
                        {g.source === "whatif" && (
                          <span className="flex-none rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary" title="Created from a What-If scenario">What-If</span>
                        )}
                        <span className="w-[96px] flex-none truncate text-[11.5px] text-muted-foreground">{ownerName(g.owner_person_id) || "—"}</span>
                        <select
                          value={g.status} disabled={pending}
                          onChange={(e) => changeStatus(g, e.target.value as GoalStatus)}
                          className={cn("h-6 rounded border-0 px-1.5 text-[11px] font-semibold", TONE[g.status])}>
                          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <RemoveButton onClick={() => setToRemove(g)} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : area === "swot" ? (
        <div className="px-5 py-3.5">
          {openSwot.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {swot.length === 0
                ? "Nothing yet. Write what you'll do about a line on the SWOT step and it will wait here."
                : "Every SWOT line you planned for now has a goal against it."}
            </p>
          ) : (
            <>
              <p className="mb-2.5 max-w-[80ch] text-[13px] text-muted-foreground">
                You said you would do something about {openSwot.length} line{openSwot.length === 1 ? "" : "s"} in your SWOT.
                Nobody is accountable for {openSwot.length === 1 ? "it" : "them"} yet — making one a goal gives it an owner, a quarter and a status.
              </p>
              <div className="rounded border border-border">
                {openSwot.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
                    <span className="w-[86px] flex-none pt-px text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{r.quadrant}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-muted-foreground" title={r.text}>{r.text}</div>
                      <div className="font-medium">{r.response}</div>
                    </div>
                    <LinkButton className="shrink-0 pt-px" onClick={() => setEditing({ area: null, from: r })}>Make it a goal</LinkButton>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="px-5 py-3.5">
          {due.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing is due in {thisLabel?.label ?? "this quarter"}. Add a quarterly goal under any area, or bring one over from the What-If planner.</p>
          ) : (
            <div className="rounded border border-border">
              {due.map((g) => (
                <div key={g.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
                  <span className="w-[92px] flex-none text-[11.5px] font-semibold text-muted-foreground">{AREA_LABEL[g.area]}</span>
                  <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-primary hover:underline"
                    onClick={() => setEditing({ area: g.area, goal: g })}>{g.title}</button>
                  <span className="w-[110px] flex-none truncate text-[11.5px] text-muted-foreground">{ownerName(g.owner_person_id) || "No owner"}</span>
                  <span className="w-[86px] flex-none tabular-nums text-[11.5px] text-muted-foreground">{g.milestone_date ?? ""}</span>
                  <span className={cn("rounded-full px-2 py-[2px] text-[11px] font-semibold", TONE[g.status])}>{STATUS_LABEL[g.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <QuarterlyDialog
          area={editing.area} goal={editing.goal} from={editing.from} people={people} quarters={quarters} pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => start(once(async () => {
            const r = await saveQuarterlyGoal(planId, {
              ...input, id: editing.goal?.id,
              area: input.area ?? editing.area ?? "operational",
              swotItemId: editing.from?.id ?? editing.goal?.swot_item_id ?? null,
            });
            if (!r.ok) { setErr(r.error); return; }
            setErr(undefined); setEditing(null);
          }))}
        />
      )}

      {toRemove && (
        <Dialog open onOpenChange={() => setToRemove(null)}>
          <DialogContent className="max-w-[440px]">
            <DialogHeader><DialogTitle>Remove &ldquo;{toRemove.title}&rdquo;?</DialogTitle></DialogHeader>
            <p className="text-[13px] text-muted-foreground">It disappears from this quarter and from your dashboard. The annual goal above it stays.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setToRemove(null)} disabled={pending}>Cancel</Button>
              <Button onClick={() => remove(toRemove)} disabled={pending}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ModuleFrame>
  );
}

/** Five fields is a dialog, not a row of inputs in a list (§6.16). */
function QuarterlyDialog({ area, goal, from, people, quarters, pending, onClose, onSave }: {
  /** Null when the goal came from a SWOT line, which belongs to no area until somebody says so. */
  area: GoalArea | null;
  goal?: Goal;
  /** The SWOT line being answered, if this goal is one (§6.59.1). */
  from?: SwotResponse;
  people: Person[]; quarters: QuarterChoice[]; pending: boolean;
  onClose: () => void;
  onSave: (input: { title: string; year: number; quarter: number; ownerPersonId: string | null; status: GoalStatus; milestoneDate: string | null; area?: GoalArea }) => void;
}) {
  /**
   * A SWOT response arrives already written — it is what the client said they would do — so it is the
   * starting title rather than a blank box. What it does NOT arrive with is an area: nothing about a
   * threat says whether answering it is a marketing job or an operational one, so the app asks instead of
   * guessing and filing the goal under the wrong heading in the report.
   */
  const [pickedArea, setPickedArea] = useState<GoalArea | "">(area ?? "");
  const [title, setTitle] = useState(goal?.title ?? from?.response ?? "");
  const [when, setWhen] = useState(`${goal?.year ?? quarters[0].planYear}:${goal?.quarter ?? quarters[0].quarter}`);
  const [owner, setOwner] = useState(goal?.owner_person_id ?? "");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "not_started");
  const [milestone, setMilestone] = useState(goal?.milestone_date ?? "");
  const first = useRef<HTMLTextAreaElement>(null);
  const [year, quarter] = when.split(":").map(Number);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit" : "New"} quarterly goal{area ? ` · ${AREA_LABEL[area]}` : ""}</DialogTitle>
        </DialogHeader>
        {from && (
          <p className="rounded border border-border bg-secondary px-3 py-2 text-[12.5px]">
            <span className="text-muted-foreground">Answering a {from.quadrant} from your SWOT: </span>
            <b>{from.text}</b>
          </p>
        )}
        {goal?.detail && <p className="rounded border border-border bg-secondary px-3 py-1.5 text-[12.5px] text-muted-foreground">{goal.detail}</p>}
        {!area && (
          <label className="block">
            <span className="eyebrow">Which part of the business</span>
            <CellSelect className="mt-1 h-8 w-full" value={pickedArea} onValueChange={(v) => setPickedArea(v as GoalArea)}
              placeholder="Pick an area"
              options={GOAL_AREAS.map((a) => ({ value: a.key, label: a.label }))} />
          </label>
        )}
        <label className="block">
          <span className="eyebrow">What will be done</span>
          <CellTextarea ref={first} autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Specific enough that someone else could tell whether it happened."
            className="mt-1 min-h-[58px] w-full rounded border border-input bg-card px-2 py-1.5 text-[13px]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="eyebrow">Quarter</span>
            <CellSelect className="mt-1 h-8 w-full" value={when} onValueChange={setWhen}
              options={quarters.map((q) => ({ value: `${q.planYear}:${q.quarter}`, label: `${q.label} · ${q.months}` }))} />
          </label>
          <label className="block">
            <span className="eyebrow">Owner</span>
            <CellSelect className="mt-1 h-8 w-full" value={owner} onValueChange={setOwner}
              placeholder={people.length ? "Nobody yet" : "Add people first"}
              options={[{ value: "", label: "Nobody yet" }, ...people.map((p) => ({ value: p.id, label: p.name || "Unnamed" }))]} />
          </label>
          <label className="block">
            <span className="eyebrow">Status</span>
            <CellSelect className="mt-1 h-8 w-full" value={status} onValueChange={(v) => setStatus(v as GoalStatus)}
              options={STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
          </label>
          <label className="block">
            <span className="eyebrow">Milestone date</span>
            <Input type="date" className="mt-1 h-8" value={milestone} onChange={(e) => setMilestone(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button disabled={pending || !title.trim() || (!area && !pickedArea)}
            onClick={() => onSave({ title, year, quarter, ownerPersonId: owner || null, status, milestoneDate: milestone || null, area: (area ?? pickedArea) as GoalArea })}>
            {pending ? "Saving…" : goal ? "Save" : "Add goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
