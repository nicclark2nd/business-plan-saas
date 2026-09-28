"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TargetCheck } from "@/engine/capability/targets";

/**
 * THE AGREED TARGETS, ON THE STEP THAT DELIVERS THEM (§6.167).
 *
 * The page reads the checks on the server (`loadTargetChecks`) and wraps its module in `TargetsProvider`;
 * the frame draws the strip above the step's own content. A step with nothing agreed draws nothing. The
 * figures are the saved plan's — every save revalidates the page, so the strip moves as the plan does.
 */
const TargetsContext = createContext<TargetCheck[]>([]);

export function TargetsProvider({ checks, children }: { checks: TargetCheck[]; children: React.ReactNode }) {
  return <TargetsContext.Provider value={checks}>{children}</TargetsContext.Provider>;
}

export function TargetStrip() {
  const checks = useContext(TargetsContext);
  const { planId } = useParams<{ planId: string }>();
  if (!checks.length) return null;
  return (
    <div className="border-b border-border bg-accent/40 px-5 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="eyebrow">Agreed on the Planner&apos;s assessment</span>
        <Link href={`/plans/${planId}/assessment`} className="text-[12px] font-semibold text-primary underline-offset-2 hover:underline">Change a target →</Link>
      </div>
      <ul className="mt-1 space-y-0.5">
        {checks.map((c) => (
          <li key={c.kind} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", c.met === true ? "bg-good" : c.met === false ? "bg-bad" : "bg-muted-foreground/40")} />
            <span className="font-semibold">Target: {c.target}</span>
            <span className="text-muted-foreground">·</span>
            <span className={cn(c.met === true && "text-good", c.met === false && "text-bad", c.met === null && "text-muted-foreground")}>{c.plan}</span>
            {c.gap && <span className="text-[12.5px] text-muted-foreground">— {c.gap}</span>}
            {c.met === true && <span className="text-[12px] font-semibold text-good">✓ Met</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
