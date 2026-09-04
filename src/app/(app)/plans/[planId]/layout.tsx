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
  const doneSteps = GUIDED_STEPS.filter((s) => {
    const sec = completeness.sections.find((x) => x.id === s.id);
    return sec ? sec.done >= sec.total : false;
  }).map((s) => s.step!);
  const initials = (session.profile?.full_name || session.user.email || "?").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="grid h-screen min-h-[640px] grid-cols-[240px_1fr] grid-rows-[48px_1fr]">
      <header className="col-span-2 flex items-center gap-4 border-b border-nav-line bg-nav px-4 text-nav-text">
        <Link href="/setup" className="flex w-[224px] items-center gap-2.5 font-bold text-white">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[5px] bg-primary text-xs">▲</span>PlanWell
        </Link>
        <div className="text-[13px] text-nav-muted">Plan: <b className="font-semibold text-nav-text">{plan.business_name}</b> · FY{plan.plan_year}</div>
        <div className="flex-1" />
        <ModeToggle mode={mode} />
        <form action="/auth/signout" method="post">
          <button title="Sign out" className="grid h-7 w-7 place-items-center rounded-full bg-[#3E5A78] text-[11px] font-bold text-white">{initials}</button>
        </form>
      </header>
      <Sidebar planId={planId} mode={mode} doneSteps={doneSteps} />
      <main className="overflow-y-auto px-7 pb-20 pt-6">{children}</main>
    </div>
  );
}
