import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/plan";
import { SetupForm } from "./SetupForm";

function orgName(p: { organisations?: { name: string } | { name: string }[] | null }) {
  const o = p.organisations;
  return Array.isArray(o) ? o[0]?.name : o?.name;
}

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Returning user with plans: show the plan list rather than the wizard.
  if (session.plans.length > 0) {
    return (
      <main className="min-h-screen bg-bg px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-end justify-between">
            <div><div className="eyebrow">Your plans</div><h1 className="text-2xl font-semibold">Welcome back{session.profile?.full_name ? `, ${session.profile.full_name.split(" ")[0]}` : ""}</h1></div>
            <form action="/auth/signout" method="post"><button className="btn btn-sm">Sign out</button></form>
          </div>
          <div className="space-y-2">
            {session.plans.map((p) => (
              <Link key={p.id} href={`/plans/${p.id}/dashboard`} className="card flex items-center justify-between hover:border-line-strong">
                <div><div className="font-semibold">{p.business_name}</div><div className="text-xs text-muted">FY{p.plan_year} · {orgName(p)}</div></div>
                <span className="pill bg-primary-soft text-primary capitalize">{p.status}</span>
              </Link>
            ))}
          </div>
          <details className="mt-8">
            <summary className="cursor-pointer text-[13px] font-semibold text-primary">Set up another business</summary>
            <div className="card mt-3"><SetupForm /></div>
          </details>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="eyebrow">Setup · takes about a minute</div>
        <h1 className="mt-1 text-2xl font-semibold">Let&apos;s set up your plan</h1>
        <p className="mt-1 max-w-[60ch] text-[13px] text-muted">Two questions now; everything else is asked step by step inside the plan. You can change any of this later in Settings.</p>
        <div className="card mt-6"><SetupForm /></div>
      </div>
    </main>
  );
}
