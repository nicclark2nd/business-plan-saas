"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { briefingSheet, unknownFigures } from "@/engine/ai/briefing";
import type { Tab, TabRead, View } from "@/engine/capability/read";
import { saveBriefing, type SavedBriefing } from "./actions";

/**
 * THE PLANNER'S BRIEFING (§6.179) — one note per tab, per view.
 *
 * Written by AI from what this tab already says, or typed, then edited and saved. The saved note is what the
 * branded report prints. Nothing is saved until Save is pressed: a draft the Planner has not read must never
 * become what the client is sent.
 *
 * NO SPINNER (§6.106.1). The note streams into the box, so the wait is filled by the answer.
 */

const FAIL_MARK = "[[DRAFT_FAILED]]";
const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

export function Briefing({ planId, tab, view, R, money, adviser, aiOn, initial, onSaved }: {
  planId: string; tab: Tab; view: View; R: TabRead; money: (v: number) => string;
  adviser: boolean; aiOn: boolean; initial: SavedBriefing | null; onSaved: (b: SavedBriefing | null) => void;
}) {
  const [saved, setSaved] = useState<SavedBriefing | null>(initial);
  const [text, setText] = useState<string | null>(null); // null = not editing
  const [state, setState] = useState<"idle" | "waiting" | "streaming" | "saving">("idle");
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(!!initial);
  /* Whether the text in the box came from the model, so the warning about invented details is only said then. */
  const [fromAi, setFromAi] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  /* The same fact sheet the server sent the model — the figure check compares the note with it. */
  const sheet = useMemo(() => briefingSheet(R, tab, money, null), [R, tab, money]);
  const odd = useMemo(() => (text ? unknownFigures(text, sheet) : []), [text, sheet]);
  const stale = !!saved && (saved.score !== (R.s.value ?? null) || (saved.headline ?? null) !== R.v.headline);
  const busy = state === "waiting" || state === "streaming" || state === "saving";
  const title = adviser ? "Planner's briefing" : "Briefing";

  async function write() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setOpen(true); setError(undefined); setText(""); setState("waiting"); setFromAi(true);
    try {
      const res = await fetch(`/plans/${planId}/ai/briefing`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ tab, view }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: "The briefing could not be started." }));
        setError(j.error ?? "The briefing could not be started."); setText(saved?.body ?? null); setState("idle"); return;
      }
      const reader = res.body.getReader();
      const decode = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decode.decode(value, { stream: true });
        const at = acc.indexOf(FAIL_MARK);
        if (at >= 0) { setText(acc.slice(0, at).trim()); setError(acc.slice(at + FAIL_MARK.length).trim()); setState("idle"); return; }
        setText(acc); setState("streaming");
      }
      setText(acc.trim());
      if (!acc.trim()) setError("The AI returned nothing. Try again.");
      setState("idle");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Lost the connection before the briefing finished."); setState("idle");
    }
  }

  async function save() {
    if (text === null) return;
    setState("saving"); setError(undefined);
    const res = await saveBriefing(planId, tab, view, text);
    setState("idle");
    if (!res.ok) { setError(res.error); return; }
    setSaved(res.data ?? null); onSaved(res.data ?? null); setText(null);
    if (!res.data) setOpen(false);
  }

  function cancel() {
    abort.current?.abort();
    setText(null); setError(undefined); setState("idle");
    if (!saved) setOpen(false);
  }

  const aiButton = aiOn
    ? <Button size="sm" onClick={write} disabled={busy}>{saved || text ? "Write it again with AI" : "Write it with AI"}</Button>
    : null;

  return (
    <section className="border-b border-border px-5 py-3.5" aria-label={title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="eyebrow">{title}</span>
        {saved && text === null && <span className="text-[11.5px] text-muted-foreground">Saved {date(saved.saved_at)} · goes in the report</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {text === null && !open && (
            <>
              {aiButton}
              <Button size="sm" variant="outline" onClick={() => { setOpen(true); setText(""); setFromAi(false); }}>Write it yourself</Button>
            </>
          )}
          {text === null && open && saved && (
            <>
              {aiButton}
              <Button size="sm" variant="outline" onClick={() => { setText(saved.body); setFromAi(false); }}>Edit</Button>
            </>
          )}
        </div>
      </div>

      {text === null && !open && (
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          A note for {adviser ? "your client" : "the owner"} about this tab{view === "actual" ? ", from the accounts only" : ", from the plan"} — written from the story, the fixes and the figures above.
          {!aiOn && <> AI writing is off for this plan; you can type it, or turn AI on in <a className="font-semibold text-primary hover:underline" href={`/plans/${planId}/settings?area=ai`}>Plan settings</a>.</>}
        </p>
      )}

      {text === null && saved && (
        <>
          {stale && (
            <p className="mt-2 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] font-semibold text-warn">
              The figures on this tab have changed since this was saved{saved.score !== null ? ` (the score was ${saved.score}, it is now ${R.s.value ?? "—"})` : ""}. Read it again before it goes in the report.
            </p>
          )}
          <div className="mt-2 max-w-[80ch] whitespace-pre-line text-[13.5px] leading-relaxed">{saved.body}</div>
        </>
      )}

      {text !== null && (
        <div className="mt-2 space-y-2">
          {state === "waiting" && <p className="text-[12.5px] text-muted-foreground">Writing...</p>}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={state === "streaming" || state === "waiting"}
            className="min-h-[260px] max-w-[80ch] text-[13.5px] leading-relaxed"
            placeholder={`What would you tell ${adviser ? "your client" : "the owner"} about this tab? Short paragraphs, plain words.`} />
          {odd.length > 0 && state === "idle" && (
            <p className="max-w-[80ch] text-[12px] font-semibold text-warn">
              Check {odd.length === 1 ? "this figure" : "these figures"} — {odd.length === 1 ? "it is" : "they are"} not on this tab: {odd.join(", ")}.
            </p>
          )}
          {state === "idle" && text && fromAi && (
            <p className="text-[11.5px] text-muted-foreground">Read it before you save it. AI sometimes adds a detail that is not in your plan. Nothing is saved until you press Save.</p>
          )}
          {error && <p className="text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={busy || (!text.trim() && !saved)}>
              {state === "saving" ? "Saving..." : !text.trim() && saved ? "Remove the briefing" : "Save"}
            </Button>
            {aiButton}
            <Button size="sm" variant="outline" onClick={cancel}>{state === "streaming" || state === "waiting" ? "Stop" : "Cancel"}</Button>
          </div>
        </div>
      )}

      {text === null && error && <p className="mt-2 text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
    </section>
  );
}
