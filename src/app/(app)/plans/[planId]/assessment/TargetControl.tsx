"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMoney } from "@/components/MoneyProvider";
import { cn } from "@/lib/utils";
import type { Target } from "@/engine/capability/assessment";
import { TARGET_META, clampTarget, mayWriteThrough, type AgreedTarget, type AgreedTargets } from "@/engine/capability/targets";
import { saveTarget } from "./actions";

const LINK = "font-semibold text-primary underline-offset-2 hover:underline";
const DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

/**
 * AGREE THE TARGET (§6.165) — the proposed figure from the accounts, which the Planner can change, and one
 * button. Once agreed it says so, and when the target is also a plan setting it says where that setting is
 * and whether it matches.
 */
export function TargetControl({ planId, proposed: raw, agreed, setting, firstYear, onSaved }: {
  planId: string;
  proposed: Target;
  agreed: AgreedTarget | undefined;
  /** The plan setting this target is, for the two that are one; undefined for the rest. */
  setting: number | null | undefined;
  firstYear: number;
  onSaved: (targets: AgreedTargets, setting: number | null) => void;
}) {
  const num = useMoney();
  const meta = TARGET_META[raw.kind];
  /* The proposal as it would be stored, so "changed from the suggestion" is never a rounding difference. */
  const proposed = { ...raw, value: clampTarget(raw.kind, raw.value) ?? raw.value } as Target;
  const show = (v: number) => (meta.unit === "money" ? num(v) : String(v));
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const base = agreed?.value ?? proposed.value;
  const shown = text ?? show(base);
  const parsed = (() => { const t = shown.replace(/[,\s%]/g, ""); if (t === "" || t === "-") return null; const v = Number(t); return Number.isFinite(v) ? clampTarget(proposed.kind, v) : null; })();
  const changed = agreed !== undefined && parsed !== null && parsed !== agreed.value;

  const save = (value: number | null) => {
    setError(null);
    start(async () => {
      const r = await saveTarget(planId, proposed.kind, value, proposed.value);
      if (!r.ok) { setError(r.error); return; }
      setText(null);
      if (r.data) onSaved(r.data.targets, r.data.setting);
    });
  };

  const unit = meta.unit === "pct" ? "%" : meta.unit === "days" ? "days" : meta.unit === "months" ? "months" : "";
  const when = proposed.kind === "breakEven" || proposed.kind === "overheadsCap" ? ` in ${firstYear}` : "";
  const years = meta.unit === "months" && parsed !== null && parsed % 12 === 0 ? ` (${parsed / 12} years)` : "";

  return (
    <div className={cn("mt-2 rounded-md border px-3 py-2", agreed && !changed ? "border-good/40 bg-good-soft" : "border-border bg-background")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
        <span className="font-semibold">Target for the plan:</span>
        <span>{meta.label}</span>
        <Input inputMode="decimal" aria-label={meta.label} disabled={pending}
          className={cn("num h-7 text-right", meta.unit === "money" ? "w-28" : "w-16")}
          value={shown} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && parsed !== null) { e.preventDefault(); save(parsed); } }} />
        {unit && <span className="text-muted-foreground">{unit}</span>}
        <span className="text-muted-foreground">{when}{years}</span>
        <span className="ml-auto flex items-center gap-2">
          {agreed && !changed ? (
            <>
              <span className="text-[12.5px] font-semibold text-good">✓ Agreed{agreed.agreed_at ? ` ${DATE.format(new Date(agreed.agreed_at))}` : ""}</span>
              <button type="button" className={cn(LINK, "text-[12px]")} disabled={pending} onClick={() => save(null)}>Take back</button>
            </>
          ) : (
            <>
              {changed && <button type="button" className={cn(LINK, "text-[12px]")} disabled={pending} onClick={() => setText(null)}>Cancel</button>}
              <Button type="button" size="sm" disabled={pending || parsed === null} onClick={() => parsed !== null && save(parsed)}>
                {pending ? "Saving…" : changed ? "Agree the new figure" : "Agree"}
              </Button>
            </>
          )}
        </span>
      </div>
      {((agreed && agreed.value !== proposed.value) || (!agreed && parsed !== null && parsed !== proposed.value)) && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          The accounts suggested {show(proposed.value)}{unit === "%" ? "%" : unit ? ` ${unit}` : ""}.{" "}
          <button type="button" className={LINK} disabled={pending} onClick={() => (agreed ? save(proposed.value) : setText(null))}>Use that</button>
        </p>
      )}
      {meta.sets && setting !== undefined && <SetsNote planId={planId} meta={meta} agreed={agreed} setting={setting} show={show} unit={unit} />}
      {error && <p className="mt-1 text-[12px] font-semibold text-bad">{error}</p>}
    </div>
  );
}

function SetsNote({ planId, meta, agreed, setting, show, unit }: {
  planId: string; meta: (typeof TARGET_META)[keyof typeof TARGET_META]; agreed: AgreedTarget | undefined;
  setting: number | null; show: (v: number) => string; unit: string;
}) {
  const where = <Link className={LINK} href={`/plans/${planId}/${meta.sets!.to}`}>{meta.sets!.label}</Link>;
  const fig = (v: number) => `${show(v)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
  let text: React.ReactNode;
  if (agreed && setting === agreed.value) text = <>The plan runs on this too — it is set on {where}.</>;
  else if (agreed && setting !== null) text = <span className="text-warn">{where} has {fig(setting)}, typed there since, and the plan runs on that. Change it there to match.</span>;
  else if (!agreed && mayWriteThrough(setting, null)) text = <>Agreeing also sets it on {where}, so it is not asked for again.</>;
  else if (!agreed && setting !== null) text = <>{where} already has {fig(setting)}. Agreeing records the target and leaves that figure alone.</>;
  else text = null;
  return text ? <p className="mt-1 text-[12px] text-muted-foreground">{text}</p> : null;
}
