"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CellSelect, CellTextarea } from "@/components/module/DataGrid";
import { AREA_LABEL, GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { STATUSES, type Goal, type GoalStatus, type Person, type SwotResponse } from "@/app/(app)/plans/[planId]/goals/model";
import type { QuarterChoice } from "@/app/(app)/plans/[planId]/goals/GoalsModule";
export type { QuarterChoice };

/**
 * The one dialog a quarterly goal is written in (§6.60).
 *
 * It lives here rather than inside Goals because Marketing opens it too. A marketing action IS a quarterly
 * goal with an owner and a date, so the two screens are two windows onto one list — and two dialogs over
 * one table is how the fields drift apart, which this project has paid for more than once.
 */
/** Five fields is a dialog, not a row of inputs in a list (§6.16). */
export function QuarterlyGoalDialog({ area, goal, from, people, quarters, pending, onClose, onSave }: {
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
            {/*
              * "Milestone date" told a client nothing (§6.89). Nic, on his own screen: "I have no idea how
              * to set the due date." The field was right there — the LABEL was the problem, naming an
              * internal concept instead of the question it asks, and nothing said it was optional.
              */}
            <span className="eyebrow">Due date</span>
            <Input type="date" className="mt-1 h-8" value={milestone} onChange={(e) => setMilestone(e.target.value)} />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {milestone ? "Shown in the plan beside this goal." : "Optional — the quarter alone is fine."}
            </span>
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
