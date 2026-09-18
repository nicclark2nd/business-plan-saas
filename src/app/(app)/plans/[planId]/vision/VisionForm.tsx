"use client";

import { useActionState, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormMessage";
import { useStep } from "@/components/guided/StepFrame";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { saveVision } from "./actions";
import { VISION_FIELDS, type VisionValues } from "./fields";
import { DraftDialog, type DraftQuestion } from "@/components/module/DraftDialog";

export type Drafting = Record<string, { caption: string; questions: DraftQuestion[] }>;

export function VisionForm({ planId, initial, drafting = {} }: { planId: string; initial: VisionValues; drafting?: Drafting }) {
  /* Which field's dialog is open, if any. Null when AI is off, because then no button exists to open one. */
  const [drafts, setDrafts] = useState<string | null>(null);
  const action = saveVision.bind(null, planId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState<VisionValues>(initial);
  const { setPending } = useStep();
  useEffect(() => setPending(pending), [pending, setPending]);
  const written = useMemo(() => VISION_FIELDS.filter((f) => values[f.key].trim()).length, [values]);

  return (
    <>
      {/* n-of-6 strip: every multi-field step shows what's on the page and how far along you are */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {VISION_FIELDS.map((f) => (
          <a key={f.key} href={`#${f.key}`}
            className={cn("rounded-full border px-2.5 py-[3px] text-xs font-semibold no-underline",
              values[f.key].trim() ? "border-good bg-good-soft text-good" : "border-border bg-card text-muted-foreground")}>
            {f.n} {f.label}
          </a>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{written} of 6 written · all six on this page</span>
      </div>

      <form id="vision-form" action={formAction} className="space-y-4">
        {VISION_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.n} · {f.label} <span className="font-normal text-muted-foreground">— {f.sub}</span></Label>
            {"hint" in f && f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            <Textarea id={f.key} name={f.key} value={values[f.key]} placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            {/*
              ABSENT RATHER THAN DISABLED (6.106). With AI switched off there is no greyed-out button and no
              tooltip explaining a locked door - there is a line saying where to open it. And the caption is
              computed alongside what will actually be sent, so it cannot promise products seven steps
              before products exist, which is what the stub it replaces did (6.87).
            */}
            {drafting[f.key] ? (
              <div className="flex items-center gap-2.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setDrafts(f.key)}>✦ Suggest a draft</Button>
                <span className="text-xs text-muted-foreground">{drafting[f.key].caption}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Drafting is off for this plan. Turn it on in <a className="font-semibold text-primary hover:underline" href={`/plans/${planId}/settings?area=ai`}>Plan settings</a>.
              </p>
            )}
          </div>
        ))}
        <FormError>{state?.error}</FormError>
      </form>

      {/*
        The draft returns to the FORM, not to the database (6.106.1). It lands in the box as a suggestion
        and the form's own save runs when the client leaves the field, exactly as it does when they type.
      */}
      {drafts && (() => {
        const f = VISION_FIELDS.find((x) => x.key === drafts)!;
        return (
          <DraftDialog
            planId={planId} fieldKey={f.key} label={f.label} sub={f.sub}
            hint={"hint" in f ? f.hint : undefined}
            questions={drafting[f.key]?.questions ?? []}
            hasText={!!values[f.key].trim()}
            onUse={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
            onClose={() => setDrafts(null)}
          />
        );
      })()}
    </>
  );
}
