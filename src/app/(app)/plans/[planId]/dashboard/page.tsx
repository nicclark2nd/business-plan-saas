import Link from "next/link";
import { getCompleteness, getSession } from "@/lib/plan";
import { GUIDED_STEPS } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Panel({ title, badge, children, className }: { title: string; badge?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader className="flex items-center justify-between"><CardTitle className="text-sm">{title}</CardTitle>{badge}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const session = await getSession();
  const plan = session!.plans.find((p) => p.id === planId)!;
  const c = await getCompleteness(planId);
  const nextStep = GUIDED_STEPS.find((s) => { const sec = c.sections.find((x) => x.id === s.id); return sec && sec.done < sec.total; }) ?? GUIDED_STEPS[GUIDED_STEPS.length - 1];
  const hasNumbers = c.sections.filter((s) => ["sales", "overheads"].includes(s.id)).every((s) => s.done >= s.total);
  const base = `/plans/${planId}`;
  const waiting = <Badge variant="outline" className="text-muted-foreground">Waiting for data</Badge>;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-4">
        <div className="eyebrow">Dashboard</div>
        <h1 className="text-[22px] font-semibold leading-tight">{plan.business_name} — Year 1 plan</h1>
        <div className="mt-1 text-[13px] text-muted-foreground">{hasNumbers ? "Plan figures shown." : "Add Sales and Overheads to see your plan's numbers here."}</div>
      </div>

      <div className="mb-3 grid grid-cols-5 gap-3">
        {["Revenue", "Gross margin", "Net profit", "Cash at year end", "Debtor days"].map((k) => (
          <Card key={k} className="gap-1 py-3.5"><CardContent className="px-4">
            <div className="text-xs font-semibold text-muted-foreground">{k}</div>
            <div className="num mt-1 text-2xl font-bold tracking-[-0.01em] text-faint">—</div>
            <div className="mt-0.5 text-xs text-faint">{hasNumbers ? "Forecast pending" : "Needs Sales & Overheads"}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-[1.2fr_1fr_1fr] gap-3">
        <Panel title="Cash runway" badge={<Badge variant="outline" className="text-muted-foreground">Not yet</Badge>}>
          <p className="text-[13px] text-muted-foreground">Your lowest projected cash month and how long opening cash lasts. Appears once Historic and Funding are in.</p>
        </Panel>
        <Panel title="Plan completeness" badge={<Badge variant="secondary" className="num bg-accent text-accent-foreground">{c.percent}%</Badge>}>
          {c.sections.map((s) => (
            <Link key={s.id} href={`${base}/${s.id}`} className="flex items-center gap-2.5 py-1 text-[13px] hover:text-primary">
              <span className="w-[120px] flex-none">{s.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-border"><i className={cn("block h-full", s.done >= s.total ? "bg-good" : "bg-primary")} style={{ width: `${(s.done / s.total) * 100}%` }} /></span>
              <span className="num w-10 text-right text-xs text-muted-foreground">{s.done}/{s.total}</span>
            </Link>
          ))}
        </Panel>
        <Panel title="This quarter's goals" badge={<span className="eyebrow">Q1</span>}>
          <p className="text-[13px] text-muted-foreground">Goals are drafted for you at step 11, once your forecast exists. <Link className="font-semibold text-primary" href={`${base}/goals`}>Open Goals</Link></p>
        </Panel>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        <Panel title="AI insights" badge={waiting}>
          <p className="text-[13px] text-muted-foreground">Three observations about your plan, read from your own numbers — margins, costs, cash timing. They appear as soon as Historic and Sales are in.</p>
        </Panel>
        <Card className="gap-2 border-primary bg-accent">
          <CardHeader><div className="eyebrow text-primary">Next action</div><CardTitle className="text-[15px]">Step {nextStep.step}: {nextStep.label}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{c.percent === 0 ? "Start with what the business is for — six short statements." : "Pick up where you left off."}</p>
            <Button className="mt-3" render={<Link href={`${base}/${nextStep.id}`} />}>Continue →</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
