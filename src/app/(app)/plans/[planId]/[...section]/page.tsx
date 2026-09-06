import Link from "next/link";
import { navLabel, GUIDED_STEPS } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Placeholder for modules not yet built. Each module replaces this with its own route folder. */
export default async function SectionPage({ params }: { params: Promise<{ planId: string; section: string[] }> }) {
  const { planId, section } = await params;
  const id = section[0];
  const step = GUIDED_STEPS.find((s) => s.id === id)?.step;
  return (
    <div className="mx-auto max-w-[860px] px-7 pt-6">
      <div className="eyebrow">{step ? `Step ${step} of ${GUIDED_STEPS.length} · ` : ""}{navLabel(id)}</div>
      <h1 className="mt-1 text-2xl font-semibold">{navLabel(id)}</h1>
      <Card className="mt-5 border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-[13px] text-muted-foreground">This module is next in the build queue. The design is in <code>docs/mockup</code> and the fields in <code>docs/planning/Data_Model.md</code>.</p>
          <Button variant="outline" className="mt-4" render={<Link href={`/plans/${planId}/dashboard`} />}>← Back to dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
