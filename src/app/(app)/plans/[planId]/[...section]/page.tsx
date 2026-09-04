import Link from "next/link";
import { navLabel, GUIDED_STEPS } from "@/lib/nav";

/** Placeholder for modules not yet built. Each module replaces this with its own route folder. */
export default async function SectionPage({ params }: { params: Promise<{ planId: string; section: string[] }> }) {
  const { planId, section } = await params;
  const id = section[0];
  const step = GUIDED_STEPS.find((s) => s.id === id)?.step;
  return (
    <div className="mx-auto max-w-[860px]">
      <div className="eyebrow">{step ? `Step ${step} of 12 · ` : ""}{navLabel(id)}</div>
      <h1 className="mt-1 text-2xl font-semibold">{navLabel(id)}</h1>
      <div className="card mt-5 border-dashed p-8 text-center">
        <p className="text-[13px] text-muted">This module is next in the build queue. The design is in <code>docs/mockup</code> and the fields in <code>docs/planning/Data_Model.md</code>.</p>
        <Link href={`/plans/${planId}/dashboard`} className="btn mt-4">← Back to dashboard</Link>
      </div>
    </div>
  );
}
