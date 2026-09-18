import Link from "next/link";
import { navLabel, GUIDED_STEPS } from "@/lib/nav";
import { getCompleteness } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * What a client sees when they reach something that is not built yet (§6.70).
 *
 * This page used to read: "This module is next in the build queue. The design is in docs/mockup and the
 * fields in docs/planning/Data_Model.md." A developer's note, with two internal repository paths in it,
 * shown to a business owner who is paying for the product.
 *
 * And the likeliest person to see it was the worst possible one. **Business plan is step 15** — the last
 * step of the guided path and the entire reason a client filled in the other fourteen. They walk the whole
 * way, click the deliverable, and are told to go and read a markdown file.
 *
 * Six menu items land here: Business plan, Recommendations, and the four unbuilt Assets modules. Each says
 * what the screen is for and what to do in the meantime. None of them name a file, promise a date, or
 * pretend the thing exists.
 */
const BLURB: Record<string, { what: string; meanwhile?: string }> = {
  reports: {
    what: "Your plan, written out as the document a lender reads — business overview, market, the team, five years of statements and the assumptions behind them.",
    meanwhile: "Everything it prints is already in the plan. Finish the steps and the report has its content waiting.",
  },
  strategy: {
    what: "Observations drawn from your own figures — where the margin is thin, which costs move fastest, where the cash gets tight.",
    meanwhile: "Nothing here is guesswork you need to supply. It reads what you have already entered.",
  },
  social: { what: "The accounts and audiences the business reaches people through." },
  memberships: { what: "Industry bodies, accreditations and subscriptions the business holds." },
  ip: { what: "Trade marks, designs, registered names and anything else the business owns that is not physical." },
};

export default async function SectionPage({ params }: { params: Promise<{ planId: string; section: string[] }> }) {
  const { planId, section } = await params;
  const id = section[0];
  const step = GUIDED_STEPS.find((s) => s.id === id)?.step;
  const label = navLabel(id);
  const blurb = BLURB[id];
  // Only worth fetching for a step on the guided path, where "how far along am I" is the useful next thing.
  const c = step ? await getCompleteness(planId) : null;
  const nextStep = c ? GUIDED_STEPS.find((s) => { const sec = c.sections.find((x) => x.id === s.id); return sec && sec.done < sec.total; }) : undefined;

  return (
    <div className="mx-auto max-w-[860px] px-7 pt-6">
      <div className="eyebrow">{step ? `Step ${step} of ${GUIDED_STEPS.length} · ` : ""}{label}</div>
      <h1 className="mt-1 text-2xl font-semibold">{label}</h1>

      <Card className="mt-5">
        <CardContent className="py-6">
          <div className="text-[13px] font-semibold text-muted-foreground">Not built yet</div>
          <p className="mt-1.5 max-w-[62ch] text-[14px]">{blurb?.what ?? `${label} is still being built.`}</p>
          {blurb?.meanwhile && <p className="mt-2 max-w-[62ch] text-[13px] text-muted-foreground">{blurb.meanwhile}</p>}

          {c && (
            <p className="mt-3 text-[13px]">
              Your plan is <b className="num">{c.percent}%</b> complete.
              {nextStep
                ? <> The next thing waiting on you is <Link className="font-semibold text-primary hover:underline" href={`/plans/${planId}/${nextStep.id}`}>step {nextStep.step}, {nextStep.label}</Link>.</>
                : <> Every step has been answered.</>}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="outline" render={<Link href={`/plans/${planId}/dashboard`} />}>← Back to dashboard</Button>
            {c && <Button variant="outline" render={<Link href={`/plans/${planId}/forecast`} />}>Review the forecast</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
