import Link from "next/link";
import { getCompleteness, getSession } from "@/lib/plan";
import { GUIDED_STEPS } from "@/lib/nav";

export default async function DashboardPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const session = await getSession();
  const plan = session!.plans.find((p) => p.id === planId)!;
  const c = await getCompleteness(planId);
  const nextStep = GUIDED_STEPS.find((s) => { const sec = c.sections.find((x) => x.id === s.id); return sec && sec.done < sec.total; }) ?? GUIDED_STEPS[GUIDED_STEPS.length - 1];
  const hasNumbers = c.sections.filter((s) => ["sales", "overheads"].includes(s.id)).every((s) => s.done >= s.total);
  const base = `/plans/${planId}`;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><div className="eyebrow">Dashboard</div><h1 className="text-[22px] font-semibold leading-tight">{plan.business_name} — Year 1 plan</h1>
          <div className="mt-1 text-[13px] text-muted">{hasNumbers ? "Plan figures shown." : "Add Sales and Overheads to see your plan&apos;s numbers here."}</div></div>
      </div>

      {/* Plan health — empty state until the forecast has inputs */}
      <div className="mb-3 grid grid-cols-5 gap-3">
        {["Revenue", "Gross margin", "Net profit", "Cash at year end", "Debtor days"].map((k) => (
          <div key={k} className="card"><div className="text-xs font-semibold text-muted">{k}</div><div className="num mt-1 text-2xl font-bold text-faint">—</div><div className="mt-0.5 text-xs text-faint">{hasNumbers ? "Forecast pending" : "Needs Sales & Overheads"}</div></div>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-[1.2fr_1fr_1fr] gap-3">
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Cash runway</h2><span className="pill border border-line bg-surface-2 text-muted">Not yet</span></div>
          <p className="text-[13px] text-muted">Your lowest projected cash month and how long opening cash lasts. Appears once Historic and Funding are in.</p>
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Plan completeness</h2><span className="pill bg-primary-soft text-primary num">{c.percent}%</span></div>
          {c.sections.map((s) => (
            <Link key={s.id} href={`${base}/${s.id}`} className="flex items-center gap-2.5 py-1 text-[13px] hover:text-primary">
              <span className="w-[120px] flex-none">{s.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-line"><i className={`block h-full ${s.done >= s.total ? "bg-good" : "bg-primary"}`} style={{ width: `${(s.done / s.total) * 100}%` }} /></span>
              <span className="num w-10 text-right text-xs text-muted">{s.done}/{s.total}</span>
            </Link>
          ))}
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">This quarter&apos;s goals</h2><span className="eyebrow">Q1</span></div>
          <p className="text-[13px] text-muted">Goals are drafted for you at step 11, once your forecast exists. <Link className="font-semibold text-primary" href={`${base}/goals`}>Open Goals</Link></p>
        </div>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">AI insights</h2><span className="pill border border-line bg-surface-2 text-muted">Waiting for data</span></div>
          <p className="text-[13px] text-muted">Three observations about your plan, read from your own numbers — margins, costs, cash timing. They appear as soon as Historic and Sales are in.</p>
        </div>
        <div>
          <div className="rounded-md border border-primary bg-primary-soft p-4">
            <div className="eyebrow text-primary">Next action</div>
            <div className="mt-0.5 text-[15px] font-bold">Step {nextStep.step}: {nextStep.label}</div>
            <div className="mt-0.5 text-xs text-muted">{c.percent === 0 ? "Start with what the business is for — six short statements." : "Pick up where you left off."}</div>
            <Link href={`${base}/${nextStep.id}`} className="btn btn-primary mt-3">Continue →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
