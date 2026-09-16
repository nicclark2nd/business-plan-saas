"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/module/FieldGrid";
import { Note } from "@/components/module/DataGrid";
import { setArchived, deletePlan } from "@/app/(app)/plans/lifecycle";

export type PlanInventory = { label: string; count: number }[];

/**
 * What happens to a plan when it is finished with (§6.58).
 *
 * Two doors of very different weights, and the copy says which is which before either is opened. Archiving
 * is the one almost everybody wants: the plan leaves the Welcome screen and loses nothing.
 *
 * Deleting names the contents out loud first — 2 products, 3 fixed assets, 14 goals — because "are you
 * sure?" is not a question anybody reads, and a count of the work is. Then it asks for the business's name
 * typed out, which is the only confirmation that cannot be given by muscle memory. The gap this closes is
 * a MISTYPED name, so recognising a name is exactly the thing the client cannot be trusted to do.
 */
export function DangerArea({ planId, planName, archivedAt, inventory }: {
  planId: string; planName: string; archivedAt: string | null; inventory: PlanInventory;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | undefined>();

  const archived = !!archivedAt;
  const same = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
  const matches = same(typed) === same(planName);
  const held = inventory.filter((i) => i.count > 0);
  // "1 product ... built on IT"; anything more than one thing is "them".
  const one = held.length === 1 && held[0].count === 1;

  const archive = () => start(async () => {
    const res = await setArchived(planId, !archived);
    if (!res.ok) { setError(res.error); return; }
    setError(undefined);
    router.refresh();
  });

  const destroy = () => start(async () => {
    const res = await deletePlan(planId, typed);
    if (!res.ok) { setError(res.error); return; }
    router.replace("/setup");
  });

  return (
    <>
      <Section title="Archive this plan">
        <p className="max-w-[70ch] text-[13px] text-muted-foreground">
          {archived
            ? <>This plan is archived. It is behind the <b>Archived</b> heading on your plans list, and everything in it is exactly where you left it.</>
            : <>Takes it off your plans list without changing a figure. A client you finished last year does not need to sit beside the ones you are working on — and you can bring it back any time.</>}
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" type="button" onClick={archive} disabled={pending}>
            {pending ? "Saving…" : archived ? "Restore this plan" : "Archive this plan"}
          </Button>
        </div>
      </Section>

      <Section title="Delete this plan">
        <p className="max-w-[70ch] text-[13px] text-muted-foreground">
          Permanent. Everything in the plan goes with it and none of it can be recovered — if you are tidying
          up rather than getting rid of something, archive it instead.
        </p>
        {held.length > 0 && (
          <p className="mt-2 max-w-[70ch] text-[13px]">
            This plan holds {held.map((i) => `${i.count} ${i.label}`).join(" · ")}.
          </p>
        )}
        <div className="mt-3">
          <Button variant="destructive" size="sm" type="button" onClick={() => { setTyped(""); setError(undefined); setOpen(true); }}>
            Delete this plan…
          </Button>
        </div>
        {error && <Note>{error}</Note>}
      </Section>

      {open && (
        <Dialog open onOpenChange={() => !pending && setOpen(false)}>
          <DialogContent className="max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Delete {planName}?</DialogTitle>
              <DialogDescription>
                {held.length > 0
                  ? <>This destroys {held.map((i) => `${i.count} ${i.label}`).join(", ")} and the five-year forecast built on {one ? "it" : "them"}. It cannot be undone, and there is no copy.</>
                  : <>There is nothing in this plan yet, so there is nothing to lose — but it still cannot be undone.</>}
              </DialogDescription>
            </DialogHeader>
            <div>
              <span className="mb-[3px] block text-[11.5px] font-semibold text-muted-foreground">
                Type <b className="text-foreground">{planName}</b> to confirm
              </span>
              <Input autoFocus value={typed} onChange={(e) => { setTyped(e.target.value); setError(undefined); }}
                placeholder={planName} className="h-8" />
              {error && <p className="mt-1.5 text-[12px] text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setOpen(false)} disabled={pending}>Keep it</Button>
              <Button variant="destructive" size="sm" type="button" onClick={destroy} disabled={pending || !matches}>
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
