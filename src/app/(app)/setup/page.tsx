import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/plan";
import { SetupForm } from "./SetupForm";
import { Badge } from "@/components/ui/badge";
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
    return (
      <main className="px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-end justify-between">
            <div><div className="eyebrow">Your plans</div><h1 className="text-2xl font-semibold">Welcome back{session.profile?.full_name ? `, ${session.profile.full_name.split(" ")[0]}` : ""}</h1></div>
            <form action="/auth/signout" method="post"><Button variant="outline" size="sm" type="submit">Sign out</Button></form>
          </div>
          <div className="space-y-2">
            {session.plans.map((p) => (
              <Link key={p.id} href={`/plans/${p.id}/dashboard`} className="block">
                <Card className="flex-row items-center justify-between py-4 transition-colors hover:border-input">
                  <CardContent className="flex w-full items-center justify-between">
                    <div><div className="font-semibold">{p.business_name}</div><div className="text-xs text-muted-foreground">FY{p.plan_year} · {orgName(p)}</div></div>
                    <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
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
