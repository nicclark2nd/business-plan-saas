"use client";

import { useActionState, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormMessage";
import { StepFooter } from "@/components/guided/GuidedStep";
import { cn } from "@/lib/utils";
import { saveVision } from "./actions";
import { VISION_FIELDS, type VisionValues } from "./fields";

export function VisionForm({ planId, initial }: { planId: string; initial: VisionValues }) {
  const action = saveVision.bind(null, planId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState<VisionValues>(initial);
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
            <div className="flex items-center gap-2.5">
              <Button type="button" variant="outline" size="sm" disabled title="AI drafting arrives with the Strategy layer">✦ Suggest a draft</Button>
              <span className="text-xs text-muted-foreground">Will use your industry, products and goals</span>
            </div>
          </div>
        ))}
        <FormError>{state?.error}</FormError>
        <StepFooter planId={planId} prevId="dashboard" pending={pending} />
      </form>
    </>
  );
}
