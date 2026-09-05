import { createClient } from "@/lib/supabase/server";
import { GuidedStep, CoachPanel, CoachExample } from "@/components/guided/GuidedStep";
import { VisionForm } from "./VisionForm";
import { VISION_FIELDS, type VisionValues } from "./fields";

export default async function VisionPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("plan_framework").select("vision,mission,purpose,brand_promise,ai_direction,field_of_play").eq("plan_id", planId).maybeSingle();
  const initial = Object.fromEntries(VISION_FIELDS.map((f) => [f.key, (data?.[f.key] as string | null) ?? ""])) as VisionValues;

  return (
    <GuidedStep
      planId={planId} formId="vision-form" prevId="dashboard" step={1} group="Strategy & Direction · Vision & Purpose"
      title="What is this business for?" subtitle="Six short statements that open your plan"
      help={<>
        <CoachPanel title="Why this matters">
          <p>These six statements open your business plan; every lender, grant assessor and investor reads them first. Rough is fine — you can polish later.</p>
        </CoachPanel>
        <CoachPanel title="What good looks like">
          <p>Specific beats grand. A vision a competitor could also claim isn&apos;t a vision.</p>
          <p>A grant assessor is checking that you know exactly what you sell and to whom. Name the customer and the area.</p>
          <CoachExample>&ldquo;To be the best concreter in Australia&rdquo; tells the reader nothing. &ldquo;First-choice for residential slabs in the Illawarra&rdquo; tells them where you&apos;ll win.</CoachExample>
        </CoachPanel>
        <CoachPanel title="Where this goes">
          <p>Opens the <b>Executive Summary</b> in every report template. Read by the AI when it drafts your goals.</p>
        </CoachPanel>
      </>}
    >
      <VisionForm planId={planId} initial={initial} />
    </GuidedStep>
  );
}
