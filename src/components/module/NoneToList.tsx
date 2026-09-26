"use client";

import { guarded } from "@/lib/guardedStart";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/module/DataGrid";
import { sayNone, type NoneStep } from "@/app/(app)/plans/[planId]/none";

/**
 * The line under an empty list that lets a client say the emptiness is deliberate (§6.57.1).
 *
 * It only ever appears when there is nothing in the table, because a row answers the question by itself.
 * Once said it stays said, and one click takes it back — nothing is destroyed either way, so neither
 * direction needs confirming.
 */
export function NoneToList({ planId, step, said, say, unsay }: {
  planId: string; step: NoneStep; said: boolean;
  /** "The business owns no fixed assets" — what the client is claiming, in their words not the table's. */
  say: string;
  /** The same claim, stated back to them once it is true. */
  unsay: string;
}) {
  const router = useRouter();
  const [pending, startRaw] = useTransition();
  /* A save that never reaches the server is said, not allowed to take the screen down (§6.138). */
  const [err, setErr] = useState<string>();
  const start = guarded(startRaw, (m) => setErr(m), () => setErr(undefined));
  const set = (value: boolean) => start(async () => { await sayNone(planId, step, value); router.refresh(); });

  if (said) {
    return (
      <div className="mt-2 text-[12px] text-muted-foreground">
        {unsay} <LinkButton onClick={() => set(false)} className="ml-1">Not right?</LinkButton>
        {err && <span className="ml-2 text-bad">{err}</span>}
      </div>
    );
  }
  return (
    <div className="mt-3 text-[12px]">
      <LinkButton onClick={() => set(true)}>{pending ? "Saving…" : say}</LinkButton>
      {err && <span className="ml-2 text-bad">{err}</span>}
    </div>
  );
}
