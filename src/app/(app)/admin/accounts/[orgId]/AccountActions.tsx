"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { grantPlans, setHold } from "../../actions";

/** The two things a Site Admin does to an account (§6.186): hold it, and give it plans. Both are logged. */
export function AccountActions({ orgId, onHold, reason, granted }: { orgId: string; onHold: boolean; reason: string | null; granted: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const [why, setWhy] = useState("");
  const [n, setN] = useState(String(granted));
  const [confirm, setConfirm] = useState(false);
  const run = (f: () => Promise<{ ok: true } | { ok: false; error: string }>) => { setError(undefined); start(async () => {
    const res = await f();
    if (!res.ok) { setError(res.error); return; }
    setConfirm(false); setWhy(""); router.refresh();
  }); };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-md border border-border p-4">
        <h2 className="text-[15px] font-semibold">{onHold ? "On hold" : "Put on hold"}</h2>
        {onHold ? (
          <>
            <p className="mt-1 text-[12.5px]">Reason shown to them: <b>{reason ?? "—"}</b></p>
            <p className="text-[12px] text-muted-foreground">Their people and clients can read everything but save nothing.</p>
            <Button className="mt-3" variant="outline" disabled={busy} onClick={() => run(() => setHold(orgId, false, ""))}>Lift the hold</Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[12px] text-muted-foreground">Makes the whole account read-only — for its people and its clients — until you lift it. Nothing is deleted.</p>
            <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason they will see, e.g. Payment overdue"
              className="mt-3 h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px]" />
            {!confirm
              ? <Button className="mt-2" variant="outline" disabled={busy || !why.trim()} onClick={() => setConfirm(true)}>Put on hold…</Button>
              : <span className="mt-2 inline-flex items-center gap-2 text-[12.5px]">Freeze this account now?
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setHold(orgId, true, why))}>Yes, put on hold</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>Cancel</Button></span>}
          </>
        )}
      </div>
      <div className="rounded-md border border-border p-4">
        <h2 className="text-[15px] font-semibold">Plans given by BizPlanHQ</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">On top of anything they pay for. Set the number; 0 takes them away. Plans already made are never removed.</p>
        <div className="mt-3 flex items-center gap-2">
          <input type="number" min={0} max={10000} value={n} onChange={(e) => setN(e.target.value)} className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-[13px]" />
          <Button variant="outline" disabled={busy || Number(n) === granted} onClick={() => run(() => grantPlans(orgId, Number(n)))}>Save</Button>
        </div>
      </div>
      {error && <p className="text-[12.5px] font-semibold text-bad md:col-span-2" role="alert">{error}</p>}
    </section>
  );
}
