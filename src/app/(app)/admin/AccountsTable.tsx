"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type AccountRow = {
  organisation_id: string; name: string; kind: string; created_at: string; on_hold_at: string | null; on_hold_reason: string | null;
  admin_email: string | null; people: number; active_plans: number; archived_plans: number; clients_with_login: number;
  billing_status: string; level_name: string | null; plans_included: number; extra_plans: number; granted_plans: number;
  current_period_end: string | null; ai_calls_30d: number; last_activity: string | null;
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");
const PAID = new Set(["active", "trialing", "past_due"]);
export const allowanceOf = (r: Pick<AccountRow, "billing_status" | "plans_included" | "extra_plans" | "granted_plans">) =>
  Math.max(1, PAID.has(r.billing_status) ? r.plans_included + r.extra_plans : 0) + r.granted_plans;
export const KIND: Record<string, string> = { owner: "Owner", coach: "Coach", consultant: "Consultant", accounting_firm: "Accounting firm" };

/** THE ACCOUNTS (§6.186). Filter and search here; everything else is on the account's own page. */
export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "firms" | "owners" | "hold" | "paying">("all");
  const shown = useMemo(() => rows.filter((r) =>
    (show === "all" || (show === "firms" ? r.kind !== "owner" : show === "owners" ? r.kind === "owner" : show === "hold" ? !!r.on_hold_at : PAID.has(r.billing_status)))
    && (!q.trim() || `${r.name} ${r.admin_email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, show]);
  const paying = rows.filter((r) => PAID.has(r.billing_status)).length;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="eyebrow">Site Admin</div>
          <h1 className="text-[22px] font-semibold">{rows.length} accounts</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {rows.filter((r) => r.kind !== "owner").length} firms · {rows.filter((r) => r.kind === "owner").length} owners · {paying} paying · {rows.filter((r) => r.on_hold_at).length} on hold
          </p>
        </div>
        <div className="flex-1" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or admin email"
          className="h-8 w-[260px] rounded-md border border-input bg-background px-2.5 text-[13px]" />
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className="h-8 rounded-md border border-input bg-background px-2 text-[13px]">
          <option value="all">Every account</option><option value="firms">Firms</option><option value="owners">Owners</option>
          <option value="paying">Paying</option><option value="hold">On hold</option>
        </select>
      </div>
      <p className="mt-2 text-[11.5px] text-muted-foreground">Opening this list, and every account, is written to the activity log.</p>

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary/50 text-left text-[11.5px] uppercase tracking-[.04em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Account</th><th className="px-3 py-2 font-semibold">Kind</th>
              <th className="px-3 py-2 font-semibold">Subscription</th><th className="px-3 py-2 text-right font-semibold">Plans</th>
              <th className="px-3 py-2 text-right font-semibold">People</th><th className="px-3 py-2 text-right font-semibold">Clients in</th>
              <th className="px-3 py-2 text-right font-semibold">AI, 30 days</th><th className="px-3 py-2 font-semibold">Last active</th>
              <th className="px-3 py-2 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.organisation_id} className="border-t border-border align-top hover:bg-secondary/30">
                <td className="px-3 py-2">
                  <Link href={`/admin/accounts/${r.organisation_id}`} className="font-semibold text-primary hover:underline">{r.name}</Link>
                  {r.on_hold_at && <span className="ml-1.5 rounded border border-warn/50 px-1 text-[10.5px] font-semibold text-warn">On hold</span>}
                  <div className="text-[11.5px] text-muted-foreground">{r.admin_email ?? "no admin"}</div>
                </td>
                <td className="px-3 py-2">{KIND[r.kind] ?? r.kind}</td>
                <td className="px-3 py-2">
                  <span className={cn(PAID.has(r.billing_status) ? "text-good" : "text-muted-foreground")}>{r.level_name ?? (PAID.has(r.billing_status) ? "Paid" : "None")}</span>
                  <div className="text-[11.5px] text-muted-foreground">{r.billing_status === "none" ? "—" : r.billing_status}{r.granted_plans ? ` · ${r.granted_plans} given` : ""}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className={cn(r.active_plans >= allowanceOf(r) && "font-semibold text-warn")}>{r.active_plans} of {allowanceOf(r)}</span>
                  {r.archived_plans > 0 && <div className="text-[11.5px] text-muted-foreground">+{r.archived_plans} archived</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.people}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.kind === "owner" ? "—" : r.clients_with_login}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.ai_calls_30d}</td>
                <td className="px-3 py-2 text-muted-foreground">{date(r.last_activity)}</td>
                <td className="px-3 py-2 text-muted-foreground">{date(r.created_at)}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No account matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
