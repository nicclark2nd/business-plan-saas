"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CellSelect, CellTextarea } from "@/components/module/DataGrid";
import { AREA_LABEL, GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { STATUSES, type Goal, type GoalStatus, type Person, type SwotResponse } from "@/app/(app)/plans/[planId]/goals/model";

/**
 * The one dialog a 90-day goal is written in (§6.60, reshaped by §6.125).
 *
 * It lives here rather than inside Goals because Marketing opens it too. A marketing action IS a 90-day
 * goal with an owner and a date, so the two screens are two windows onto one list — and two dialogs over
 * one table is how the fields drift apart, which this project has paid for more than once.
 *
 * WHAT WENT, AND WHY. It used to ask for a QUARTER, because a goal hung beneath an annual goal and the
 * dashboard grouped by Q1–Q4. The ladder replaced that with a single 90-day period whose end date the
 * client picks once, at the top of the list — so the question here is only "by when", and a due date
 * answers it without asking anybody to translate a date into a quarter first.
 *
 * WHAT STAYED. The area, but as an optional TAG rather than a required filing decision: it picks the
 * section of the report this goal prints under, and a goal that belongs under none of them is allowed to
 * say so instead of being filed under the wrong heading (§6.125).
 */
export function GoalDialog({ area, goal, from, people, pending, onClose, onSave }: {
  /** Fixed by the screen that opened it — Marketing passes "marketing". Undefined means offer the picker. */
  area?: GoalArea | null;
  goal?: Goal;
  /** The SWOT line being answered, if this goal is one (§6.59.1). */
  from?: SwotResponse;
  people: Person[];
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    title: string; area: GoalArea | null;
    ownerPersonId: string | null; status: GoalStatus; milestoneDate: string | null;
  }) => void;
}) {
  const fixed = area !== undefined && area !== null;
  /**
   * A SWOT response arrives already written — it is what the client said they would do — so it is the
   * starting title rather than a blank box. What it does NOT arrive with is an area: nothing about a
   * threat says whether answering it is a marketing job or an operational one, so the app asks instead of
   * guessing and filing the goal under the wrong heading in the report.
   */
  const [pickedArea, setPickedArea] = useState<GoalArea | "">(goal?.area ?? area ?? "");
  const [title, setTitle] = useState(goal?.title ?? from?.response ?? "");
  const [owner, setOwner] = useState(goal?.owner_person_id ?? "");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "not_started");
  const [due, setDue] = useState(goal?.milestone_date ?? "");
  const first = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit" : "New"} goal{fixed && area ? ` · ${AREA_LABEL[area]}` : ""}</DialogTitle>
        </DialogHeader>
        {from && (
          <p className="rounded border border-border bg-secondary px-3 py-2 text-[12.5px]">
            <span className="text-muted-foreground">Answering a {from.quadrant} from your SWOT: </span>
            <b>{from.text}</b>
          </p>
        )}
        {goal?.detail && <p className="rounded border border-border bg-secondary px-3 py-1.5 text-[12.5px] text-muted-foreground">{goal.detail}</p>}

        <label className="block">
          <span className="eyebrow">What will be done</span>
          <CellTextarea ref={first} autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Specific enough that someone else could tell whether it happened."
            className="mt-1 min-h-[58px] w-full rounded border border-input bg-card px-2 py-1.5 text-[13px]" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          {!fixed && (
            <label className="block">
              <span className="eyebrow">Part of the business</span>
              <CellSelect className="mt-1 h-8 w-full" value={pickedArea} onValueChange={(v) => setPickedArea(v as GoalArea)}
                placeholder="No area"
                options={[{ value: "", label: "No area" }, ...GOAL_AREAS.map((a) => ({ value: a.key, label: a.label }))]} />
              <span className="mt-1 block text-[11px] text-muted-foreground">Decides which section of the report it prints under.</span>
            </label>
          )}
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
            {/*
              * "Milestone date" told a client nothing (§6.89). Nic, on his own screen: "I have no idea how
              * to set the due date." The field was right there — the LABEL was the problem, naming an
              * internal concept instead of the question it asks.
              */}
            <span className="eyebrow">Due date</span>
            <Input type="date" className="mt-1 h-8" value={due} onChange={(e) => setDue(e.target.value)} />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {due ? "Shown in the plan beside this goal." : "Optional — but a goal with no date tends not to happen."}
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button disabled={pending || !title.trim()}
            onClick={() => onSave({
              title, area: (fixed ? area : (pickedArea || null)) as GoalArea | null,
              ownerPersonId: owner || null, status, milestoneDate: due || null,
            })}>
            {pending ? "Saving…" : goal ? "Save" : "Add goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
