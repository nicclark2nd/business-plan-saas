"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * ASKING FOR A DRAFT (6.106.1).
 *
 * The dialog is headed with the field's OWN label, sub-line and hint, so there is never a question about
 * which box is being filled and no second copy of that wording to drift from the screen behind it.
 *
 * NO SPINNER, AND NOT BY EXCEPTION. The text streams, so the wait is filled by the answer rather than by a
 * picture of waiting. The only thing shown before the first character arrives is a single quiet line, which
 * is the same idiom the footer already uses for "Saving...".
 *
 * NOTHING IS WRITTEN TO THE PLAN HERE. The draft goes back to the form as a suggestion; the form's own save
 * runs when the client leaves the field, exactly as it does when they type. A suggestion the client has not
 * looked at must never become their business plan.
 */

export type DraftQuestion = { slice: string; question: string };

const FAIL_MARK = "[[DRAFT_FAILED]]";

export function DraftDialog({
  planId, fieldKey, label, sub, hint, questions, hasText, onUse, onClose,
}: {
  planId: string;
  fieldKey: string;
  label: string;
  sub?: string;
  hint?: string;
  questions: DraftQuestion[];
  /** Whether the field already holds something, so the button can say what it will do to it. */
  hasText: boolean;
  onUse: (text: string) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [state, setState] = useState<"asking" | "waiting" | "streaming" | "done" | "failed">(
    questions.length ? "asking" : "waiting",
  );
  const [error, setError] = useState<string>();
  /*
   * ONE COUNTER, NOT A REF (6.106.1).
   *
   * The first version aborted the request from an unmount cleanup, and React's development double-mount
   * fired that cleanup immediately: the only attempt was cancelled, a ref stopped a second, and the dialog
   * sat on "Writing..." for ever while the catch swallowed the AbortError.
   *
   * Now the EFFECT owns the controller. A double-mount aborts the first attempt and starts a second, which
   * is what that pattern is for, and nothing outside the effect can cancel a run that is still wanted.
   */
  const [runId, setRunId] = useState(questions.length ? 0 : 1);
  const abort = useRef<AbortController>(null);

  const run = useCallback(async (controller: AbortController) => {
    /* Off the synchronous path of the effect that started it: this is a reset, not a render decision. */
    await Promise.resolve();
    if (controller.signal.aborted) return;
    setText(""); setError(undefined); setState("waiting");
    abort.current = controller;
    try {
      const res = await fetch(`/plans/${planId}/ai/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          field: fieldKey,
          answers: questions.map((q) => ({ question: q.question, answer: answers[q.slice] ?? "" })),
        }),
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
        /* A failure that began mid-stream arrives behind the marker, and everything before it is real. */
        const at = acc.indexOf(FAIL_MARK);
        if (at >= 0) {
          setText(acc.slice(0, at).trim());
          setError(acc.slice(at + FAIL_MARK.length).trim());
          setState("failed");
          return;
        }
        setText(acc);
        setState("streaming");
      }
      setText(acc.trim());
      setState(acc.trim() ? "done" : "failed");
      if (!acc.trim()) setError("The AI returned nothing. Try again.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Lost the connection before the draft finished."); setState("failed");
    }
  }, [planId, fieldKey, questions, answers]);

  /*
   * With nothing to ask, the draft starts on open: a dialog whose only content is a button to begin is a
   * toll. The effect owns the controller so React's development double-mount aborts the first attempt and
   * starts a second, rather than cancelling the only one — which is the bug this replaced.
   *
   * Both rules are off for this block on purpose. `run` reports its progress in state, which is the entire
   * job of an effect that owns a fetch, and keying on anything but the counter would abort a request the
   * moment it reported that it had started.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    void run(controller);
    return () => controller.abort();
    /* Keyed on the counter alone, deliberately: re-running when `run`'s own state changes would abort the
       request it had just started. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const busy = state === "waiting" || state === "streaming";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) { abort.current?.abort(); onClose(); } }}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{label}{sub ? <span className="font-normal text-muted-foreground"> — {sub}</span> : null}</DialogTitle>
          {hint && <DialogDescription>{hint}</DialogDescription>}
        </DialogHeader>

        {state === "asking" && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              The plan does not cover {questions.length === 1 ? "this yet" : "these yet"}, so a short answer
              is all it needs. Leave one blank and it will be left out.
            </p>
            {questions.map((q) => (
              <div key={q.slice} className="space-y-1">
                <label className="block text-[12.5px] font-semibold" htmlFor={`q-${q.slice}`}>{q.question}</label>
                <Textarea id={`q-${q.slice}`} className="min-h-[60px]"
                  value={answers[q.slice] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.slice]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}

        {state !== "asking" && (
          <div className="space-y-2">
            {state === "waiting" && <p className="text-[12.5px] text-muted-foreground">Writing...</p>}
            {text && (
              <p className="whitespace-pre-line rounded-md border border-border bg-secondary px-3 py-2 text-[13px] leading-[1.6]">
                {text}
              </p>
            )}
            {error && <p className="text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
            {state === "done" && (
              <p className="text-[11.5px] text-muted-foreground">
                Yours to edit once it is in the box. Nothing is saved until you leave the field.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {state === "asking" && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setRunId((n) => n + 1)}>Write it</Button>
            </>
          )}
          {state !== "asking" && (
            <>
              <Button variant="outline" onClick={() => { abort.current?.abort(); onClose(); }}>
                {busy ? "Stop" : "Discard"}
              </Button>
              {(state === "done" || state === "failed") && (
                <Button variant="outline" onClick={() => setRunId((n) => n + 1)} disabled={busy}>
                  Try again
                </Button>
              )}
              <Button disabled={!text.trim() || busy} onClick={() => { onUse(text.trim()); onClose(); }}>
                {hasText ? "Replace what is there" : "Use this"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
