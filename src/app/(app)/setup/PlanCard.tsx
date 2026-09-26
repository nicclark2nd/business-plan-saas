"use client";

import { guarded } from "@/lib/guardedStart";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setArchived } from "@/app/(app)/plans/lifecycle";

/**
 * One plan on the Welcome screen, with the one control it needs (§6.58).
 *
 * The whole card used to be a link, which is why there was nowhere to put an action: a button inside an
 * anchor is a button that sometimes navigates instead. So the anchor wraps the name and the archive control
 * sits beside it, outside.
 *
 * Archiving only ever appears here. Deleting does not: it lives inside the plan, in Plan settings, behind
 * the business's own name — far enough away that nobody reaches it while tidying a list.
 */
export function PlanCard({ plan, orgName, archived }: {
  plan: { id: string; business_name: string; status: string; plan_year: number };
  orgName?: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startRaw] = useTransition();
  /* A save that never reaches the server is said, not allowed to take the page down (§6.138). */
  const [err, setErr] = useState<string>();
  const start = guarded(startRaw, (m) => setErr(m), () => setErr(undefined));
  const toggle = () => start(async () => { await setArchived(plan.id, !archived); router.refresh(); });

  return (
    <Card className="flex-row items-center justify-between py-4">
      <CardContent className="flex w-full items-center justify-between gap-4">
        <Link href={`/plans/${plan.id}/dashboard`} className="min-w-0 flex-1">
          <div className="truncate font-semibold hover:text-primary">{plan.business_name}</div>
          <div className="text-xs text-muted-foreground">FY{plan.plan_year}{orgName ? ` · ${orgName}` : ""}</div>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          {err && <span className="max-w-[260px] text-[11.5px] text-bad">{err}</span>}
          <Badge variant="secondary" className="capitalize">{plan.status}</Badge>
          <Button variant="outline" size="sm" type="button" onClick={toggle} disabled={pending}>
            {pending ? "…" : archived ? "Restore" : "Archive"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
