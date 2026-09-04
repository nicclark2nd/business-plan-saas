import { createClient } from "@/lib/supabase/server";
import { GuidedStep, CoachPanel, CoachExample } from "@/components/guided/GuidedStep";
import { PeopleList } from "./PeopleList";
import type { Person } from "./actions";

export default async function PeoplePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("plan_people").select("*").eq("plan_id", planId).order("sort_order").order("created_at");
  return (
    <GuidedStep
      planId={planId} formId="people-form" prevId="vision" step={2} group="People · Key People" wide
      title="Who runs the business?"
      why="Owners, directors and the people a lender or investor would ask about. Name, role, shareholding and salary — the rest is optional and can wait."
      aside={<>
        <CoachPanel title="What good looks like">
          <p>Three to six people is typical. Start with the owner; add anyone whose absence would change the plan.</p>
          <p>Salaries here feed Overheads and the forecast, so put real numbers in — a $0 owner salary flatters the profit and every bank knows it.</p>
          <CoachExample>Shareholding should add to 100%. If it doesn&apos;t, the report&apos;s ownership section will look wrong to an investor.</CoachExample>
        </CoachPanel>
        <CoachPanel title="Where this goes">
          <p><b>Ownership &amp; key people</b> section of every report. Salaries → Overheads; % shareholding → cap table (investor pack).</p>
        </CoachPanel>
      </>}
    >
      <PeopleList planId={planId} initial={(data ?? []) as Person[]} />
    </GuidedStep>
  );
}
