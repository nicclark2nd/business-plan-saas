"use client";

import { useActionState, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/FormMessage";
import { useStep } from "@/components/guided/StepFrame";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { saveVision } from "./actions";
import { VISION_FIELDS, visionDraftable, type VisionValues } from "./fields";
import { DraftField, type Drafting } from "@/components/module/DraftField";

export function VisionForm({ planId, initial, drafting = {} }: { planId: string; initial: VisionValues; drafting?: Drafting }) {
  const action = saveVision.bind(null, planId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState<VisionValues>(initial);
  const { setPending } = useStep();
  useEffect(() => setPending(pending), [pending, setPending]);
  const written = useMemo(() => VISION_FIELDS.filter((f) => values[f.key].trim()).length, [values]);

  return (
    <>
      {/*
        * n-of-n strip: every multi-field step shows what's on the page and how far along you are.
        *
        * COUNTED, NOT WRITTEN OUT. Both numbers were the literal 6, and adding a seventh statement (§6.129)
        * would have left a page of seven fields reporting "5 of 6 written · all six on this page" — one fact
        * written down twice, which is the fault this project keeps finding in new costumes (§6.41).
        */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {VISION_FIELDS.map((f) => (
          <a key={f.key} href={`#${f.key}`}
            className={cn("rounded-full border px-2.5 py-[3px] text-xs font-semibold no-underline",
              values[f.key].trim() ? "border-good bg-good-soft text-good" : "border-border bg-card text-muted-foreground")}>
            {f.n} {f.label}
          </a>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{written} of {VISION_FIELDS.length} written · all {VISION_FIELDS.length} on this page</span>
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

              The button itself is DraftField now (6.109), shared with every other step that grows one.
            */}
            {/* A field that refuses drafting grows no button at all — absent, not disabled (§6.106). */}
            {visionDraftable(f) && (
              <DraftField planId={planId} field={{ key: f.key, label: f.label, sub: f.sub, hint: "hint" in f ? f.hint : undefined }}
                offer={drafting[f.key]} value={values[f.key]}
                onUse={(text) => setValues((v) => ({ ...v, [f.key]: text }))} />
            )}
          </div>
        ))}
        <FormError>{state?.error}</FormError>
      </form>

    </>
  );
}
