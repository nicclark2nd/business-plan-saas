import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, getCompleteness } from "@/lib/plan";
import { ModeToggle } from "@/components/ModeToggle";
import { Sidebar } from "@/components/Sidebar";
import { GUIDED_STEPS } from "@/lib/nav";

export default async function PlanLayout({ children, params }: { children: React.ReactNode; params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const plan = session.plans.find((p) => p.id === planId);
  if (!plan) notFound();
  const mode = (session.profile?.mode ?? "guided") as "guided" | "advanced";
  const completeness = await getCompleteness(planId);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: settings } = await supabase.from("plan_settings").select("currency").eq("plan_id", planId).maybeSingle();
  const STATUS: Record<string, string> = { draft: "Working draft", active: "Active", complete: "Complete", archived: "Archived" };
  const doneSteps = GUIDED_STEPS.filter((s) => {
    const sec = completeness.sections.find((x) => x.id === s.id);
    return sec ? sec.done >= sec.total : false;
  }).map((s) => s.step!);
  const initials = (session.profile?.full_name || session.user.email || "?").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="grid h-screen min-h-[640px] grid-cols-[240px_1fr] grid-rows-[48px_1fr]">
      <header className="col-span-2 flex items-center gap-4 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
        <Link href="/setup" className="flex w-[224px] items-center gap-2.5 font-bold text-white">
          <span className="grid size-[26px] place-items-center rounded-[5px] bg-sidebar-primary text-xs text-sidebar-primary-foreground">▲</span>PlanWell
        </Link>
        <div className="text-[13px] text-sidebar-muted">Plan: <b className="font-semibold text-sidebar-foreground">{plan.business_name}</b> · FY{plan.plan_year}</div>
        <div className="flex-1" />
        <div className="mr-2 flex items-center gap-3 text-xs text-sidebar-muted"><span className="flex items-center gap-1.5"><i className={`block size-1.5 rounded-full ${plan.status === "draft" ? "bg-warn" : "bg-good"}`} />{STATUS[plan.status] ?? plan.status}</span><span className="h-3 w-px bg-sidebar-border" /><span className="rounded border border-sidebar-border px-1.5 py-0.5 font-semibold">{settings?.currency ?? "AUD"}</span></div>
        <ModeToggle mode={mode} />
        <form action="/auth/signout" method="post">
          <button type="submit" title="Sign out" className="grid size-7 place-items-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-accent-foreground ring-1 ring-sidebar-border hover:bg-sidebar-primary">{initials}</button>
        </form>
      </header>
      <Sidebar planId={planId} mode={mode} doneSteps={doneSteps} />
      <main className="min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
