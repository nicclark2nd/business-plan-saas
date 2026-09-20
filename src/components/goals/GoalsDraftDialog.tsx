"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";
import { AREA_HINT } from "@/app/(app)/plans/[planId]/goals/model";
import { parseGoals } from "@/engine/ai/goals";
import { cn } from "@/lib/utils";

/**
 * SIX PROPOSALS, TAKEN ONE AT A TIME (§6.115).
 *
 * `DraftDialog` fills one box and can hand its answer straight back to the form. Six is a different
 * problem: the client has to be able to take three of them, rewrite one and ignore two, and nothing may be
 * written to the plan until they say so — the rule every draft in this app follows (§6.106.1).
 *
 * SO THE UNIT OF ACCEPTANCE IS ONE GOAL, NEVER THE SET. There is no "accept all": six paragraphs approved
 * with a single click is not review, and these six head the report's sections. Each is editable in place
 * before it is taken, because a draft the client improved is worth more than one they accepted whole.
 *
 * THE TEXT STREAMS AND THE PANEL FILLS IN AS IT ARRIVES, which is why the six are marked rather than
 * returned as JSON: half a marked list parses and half a JSON document does not. No spinner, same as
 * everywhere else — the wait is filled by the answer.
 *
 * AN AREA THE MODEL FUMBLED SIMPLY HAS NO PROPOSAL. It shows what the client already wrote, or nothing at
 * all. It never shows a blank box that could be accepted by accident.
 */

const FAIL_MARK = "[[DRAFT_FAILED]]";

export type GoalQuestion = { key: string; question: string };

export function GoalsDraftDialog({
  planId, questions, existing, onUse, onClose,
}: {
  planId: string;
  questions: GoalQuestion[];
  /** What is in the six boxes right now, so a proposal can be shown against what it would replace. */
  existing: Partial<Record<GoalArea, string>>;
  /** One goal, taken. Called once per area the client accepts — never for the set. */
  onUse: (area: GoalArea, text: string) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState("");
  const [edited, setEdited] = useState<Partial<Record<GoalArea, string>>>({});
  const [taken, setTaken] = useState<Partial<Record<GoalArea, true>>>({});
  const [state, setState] = useState<"asking" | "waiting" | "streaming" | "done" | "failed">(
    questions.length ? "asking" : "waiting",
  );
  const [error, setError] = useState<string>();
  /* The effect owns the controller, keyed on a counter — the §6.106.1 fix, for the same reason. */
  const [runId, setRunId] = useState(questions.length ? 0 : 1);
  const abort = useRef<AbortController>(null);

  const drafts = parseGoals(raw);

  const run = useCallback(async (controller: AbortController) => {
    await Promise.resolve();
    if (controller.signal.aborted) return;
    setRaw(""); setEdited({}); setTaken({}); setError(undefined); setState("waiting");
    abort.current = controller;
    try {
      const res = await fetch(`/plans/${planId}/ai/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ answers: questions.map((q) => ({ question: q.question, answer: answers[q.key] ?? "" })) }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: "The draft could not be started." }));
        setError(j.error ?? "The draft could not be started."); setState("failed"); return;
      }
      const reader = res.body.getReader();
      const decode = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decode.decode(value, { stream: true });
        const at = acc.indexOf(FAIL_MARK);
        if (at >= 0) {
          /* Everything before the marker is real, and the goals already parsed out of it stay offered. */
          setRaw(acc.slice(0, at));
          setError(acc.slice(at + FAIL_MARK.length).trim());
          setState("failed");
          return;
        }
        setRaw(acc);
        setState("streaming");
      }
      setRaw(acc);
      const got = Object.keys(parseGoals(acc)).length;
      setState(got ? "done" : "failed");
      if (!got) setError("The AI returned nothing usable. Try again.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Lost the connection before the draft finished."); setState("failed");
    }
  }, [planId, questions, answers]);

  /*
   * THE EFFECT OWNS THE CONTROLLER, KEYED ON THE COUNTER ALONE (§6.106.1, and it matters more here).
   *
   * `run` is rebuilt whenever `answers` changes, so depending on it would abort the request the moment the
   * client's own typed answers were captured into the closure — the request would cancel itself on the way
   * out. That is the same family as the bug §6.106.1 fixed, and this dialog has two more pieces of state
   * feeding the callback than that one did.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    void run(controller);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const textOf = (a: GoalArea) => edited[a] ?? drafts[a] ?? "";
  const offered = GOAL_AREAS.filter(({ key }) => textOf(key).trim());
  const busy = state === "waiting" || state === "streaming";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Draft your six annual goals</DialogTitle>
          <DialogDescription>
            One for each part of the business, written together so they agree with each other and with your
            forecast. They carry no owner and no quarter — those are yours to set.
          </DialogDescription>
        </DialogHeader>

        {state === "asking" ? (
          <div className="grid gap-3">
            <p className="text-[12.5px] text-muted-foreground">A sentence each is plenty. Leave one blank and it will be left out.</p>
            {questions.map((q) => (
              <div key={q.key}>
                <label className="mb-[3px] block text-[11.5px] font-semibold text-muted-foreground" htmlFor={`gq-${q.key}`}>{q.question}</label>
                <Textarea id={`gq-${q.key}`} className="min-h-[56px]" value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-y-auto pr-1">
            {busy && !offered.length && <p className="py-6 text-center text-[12.5px] text-muted-foreground">Writing…</p>}
            <div className="grid gap-3">
              {GOAL_AREAS.map(({ key, label }) => {
                const text = textOf(key);
                if (!text.trim()) return null;
                const was = existing[key]?.trim();
                return (
                  <div key={key} className={cn("rounded border border-border p-2.5", taken[key] && "border-good bg-good-soft/40")}>
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-[12.5px] font-semibold">{label}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{AREA_HINT[key]}</span>
                      {taken[key]
                        ? <span className="flex-none text-[11px] font-semibold text-good">Taken</span>
                        : (
                          <Button type="button" size="sm" variant="outline" className="flex-none" disabled={busy}
                            onClick={() => { onUse(key, text.trim()); setTaken((t) => ({ ...t, [key]: true })); }}>
                            {was ? "Replace" : "Use this"}
                          </Button>
                        )}
                    </div>
                    {/*
                      Editable before it is taken. A client who fixes one word in a draft has made it
                      theirs, and making them take it and then fix it on the screen behind is a worse
                      version of the same two keystrokes.
                    */}
                    <Textarea className="min-h-[54px] text-[12.5px]" value={text} disabled={busy || !!taken[key]}
                      onChange={(e) => setEdited((x) => ({ ...x, [key]: e.target.value }))} />
                    {was && !taken[key] && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Replaces: <span className="italic">{was}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Inside the non-asking branch already, so this line is always the drafts' own warning. */}
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">
              Read them before you use them. AI sometimes adds a detail that is not in your plan. Nothing is
              saved until you take it.
            </p>
            {error && <p role="alert" className="mt-2 text-[11.5px] font-semibold text-bad">{error}</p>}
          </div>
        )}

        <DialogFooter className="mt-1">
          <Button type="button" variant="outline" onClick={onClose}>{Object.keys(taken).length ? "Done" : "Cancel"}</Button>
          {state === "asking"
            ? <Button type="button" onClick={() => setRunId((n) => n + 1)}>Write them</Button>
            : <Button type="button" variant="outline" disabled={busy} onClick={() => setRunId((n) => n + 1)}>Try again</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
