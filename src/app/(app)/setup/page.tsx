import { redirect } from "next/navigation";
import { getSession } from "@/lib/plan";
import { SetupForm } from "./SetupForm";
import { PlanCard } from "./PlanCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function orgName(p: { organisations?: { name: string } | { name: string }[] | null }) {
  const o = p.organisations;
  return Array.isArray(o) ? o[0]?.name : o?.name;
}

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.plans.length > 0) {
    // A plan that has been put away is still a plan (§6.58) — it is just not in front of you.
    const live = session.plans.filter((p) => !p.archived_at);
    const archived = session.plans.filter((p) => p.archived_at);

    return (
      <main className="px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-end justify-between">
            <div><div className="eyebrow">Your plans</div><h1 className="text-2xl font-semibold">Welcome back{session.profile?.full_name ? `, ${session.profile.full_name.split(" ")[0]}` : ""}</h1></div>
            <form action="/auth/signout" method="post"><Button variant="outline" size="sm" type="submit">Sign out</Button></form>
          </div>
          <div className="space-y-2">
            {live.map((p) => <PlanCard key={p.id} plan={p} orgName={orgName(p)} archived={false} />)}
            {live.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Every plan is archived. Restore one below, or set up another business.
              </p>
            )}
          </div>

          {archived.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-[13px] font-semibold text-muted-foreground">
                Archived ({archived.length})
              </summary>
              <div className="mt-3 space-y-2 opacity-75">
                {archived.map((p) => <PlanCard key={p.id} plan={p} orgName={orgName(p)} archived />)}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Nothing here has been deleted — an archived plan keeps every figure and opens as it always did.
                To destroy one for good, open it and go to Plan settings.
              </p>
            </details>
          )}

          <details className="mt-8">
            <summary className="cursor-pointer text-[13px] font-semibold text-primary">Set up another business</summary>
            <Card className="mt-3"><CardContent><SetupForm /></CardContent></Card>
          </details>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="eyebrow">Setup · takes about a minute</div>
        <h1 className="mt-1 text-2xl font-semibold">Let&apos;s set up your plan</h1>
        <p className="mt-1 max-w-[60ch] text-[13px] text-muted-foreground">Two questions now; everything else is asked step by step inside the plan. You can change any of this later in Settings.</p>
        <Card className="mt-6"><CardContent><SetupForm /></CardContent></Card>
      </div>
    </main>
  );
}
