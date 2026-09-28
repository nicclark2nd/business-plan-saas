import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "./AccountActions";
import { KIND, allowanceOf, type AccountRow } from "../../AccountsTable";

export const dynamic = "force-dynamic";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * ONE ACCOUNT, READ-ONLY (§6.186) — "view as this consultant" without becoming them: who is in it, the plans it
 * holds and who looks after each, what it pays. Figures inside the plans are not shown; a Site Admin is not a
 * member of anyone's plan. Opening this page is written to the activity log.
 */
export default async function AdminAccountPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const [accounts, people, plans] = await Promise.all([
    supabase.rpc("platform_accounts"),
    supabase.rpc("platform_account_people", { p_org: orgId }),
    supabase.rpc("platform_account_plans", { p_org: orgId }),
  ]);
  const a = ((accounts.data ?? []) as AccountRow[]).find((r) => r.organisation_id === orgId);
  if (!a) notFound();
  const team = (people.data ?? []) as { user_id: string; full_name: string | null; email: string; role: string; joined: string }[];
  const rows = (plans.data ?? []) as { plan_id: string; business_name: string; created_at: string; updated_at: string; archived_at: string | null; looked_after_by: string | null; client_email: string | null; ai_calls_30d: number }[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-[12.5px] font-semibold text-primary hover:underline">← Every account</Link>
        <h1 className="mt-1 text-[22px] font-semibold">{a.name}
          {a.on_hold_at && <span className="ml-2 rounded border border-warn/50 px-1.5 align-middle text-[12px] font-semibold text-warn">On hold since {date(a.on_hold_at)}</span>}
        </h1>
        <p className="text-[12.5px] text-muted-foreground">{KIND[a.kind] ?? a.kind} · joined {date(a.created_at)} · last active {date(a.last_activity)}</p>
      </div>

      <section className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
        {[
          ["Plans in use", `${a.active_plans} of ${allowanceOf(a)}`, a.archived_plans ? `${a.archived_plans} archived` : "none archived"],
          ["Subscription", a.level_name ?? "None", a.billing_status === "none" ? "never subscribed" : `${a.billing_status}${a.current_period_end ? ` · to ${date(a.current_period_end)}` : ""}`],
          ["Made up of", `${a.plans_included} + ${a.extra_plans} extra`, `${a.granted_plans} given by BizPlanHQ`],
          ["AI drafting", `${a.ai_calls_30d}`, "calls in the last 30 days"],
        ].map(([h, v, s]) => (
          <div key={h} className="bg-background px-4 py-3">
            <div className="eyebrow">{h}</div>
            <div className="mt-1 text-[18px] font-semibold">{v}</div>
            <div className="text-[12px] text-muted-foreground">{s}</div>
          </div>
        ))}
      </section>

      <AccountActions orgId={orgId} onHold={!!a.on_hold_at} reason={a.on_hold_reason} granted={a.granted_plans} />

      <section>
        <h2 className="eyebrow mb-2">People ({team.length})</h2>
        <table className="w-full max-w-[900px] text-[13px]">
          <tbody>
            {team.map((p) => (
              <tr key={p.user_id} className="border-t border-border">
                <td className="py-1.5 pr-3 font-semibold">{p.full_name || "—"}</td>
                <td className="py-1.5 pr-3">{p.email}</td>
                <td className="py-1.5 pr-3 capitalize">{p.role}</td>
                <td className="py-1.5 text-muted-foreground">joined {date(p.joined)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="eyebrow mb-2">Plans ({rows.length})</h2>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11.5px] uppercase tracking-[.04em] text-muted-foreground">
            <tr><th className="py-1.5 pr-3 font-semibold">Business</th><th className="py-1.5 pr-3 font-semibold">Looked after by</th><th className="py-1.5 pr-3 font-semibold">Client login</th>
              <th className="py-1.5 pr-3 text-right font-semibold">AI, 30 days</th><th className="py-1.5 pr-3 font-semibold">Last changed</th><th className="py-1.5 font-semibold">Created</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.plan_id} className="border-t border-border">
                <td className="py-1.5 pr-3 font-semibold">{p.business_name}{p.archived_at && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">archived</span>}</td>
                <td className="py-1.5 pr-3">{p.looked_after_by ?? "—"}</td>
                <td className="py-1.5 pr-3">{p.client_email ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{p.ai_calls_30d}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{date(p.updated_at)}</td>
                <td className="py-1.5 text-muted-foreground">{date(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11.5px] text-muted-foreground">What is inside each plan is the account&apos;s own, and is not shown here.</p>
      </section>
    </div>
  );
}
