import { createClient } from "@/lib/supabase/server";
import { GuidedStep, CoachPanel, CoachExample } from "@/components/guided/GuidedStep";
import { PeopleModule } from "./PeopleModule";
import type { PeopleData } from "./actions";

export default async function PeoplePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const [people, duties, qualities, education, focus, settings] = await Promise.all([
    supabase.from("plan_people").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people_duties").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people_qualities").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people_education").select("*").eq("plan_id", planId).order("year_completed", { ascending: false }),
    supabase.from("plan_people_focus").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_settings").select("currency").eq("plan_id", planId).maybeSingle(),
  ]);
  const data = { people: people.data ?? [], duties: duties.data ?? [], qualities: qualities.data ?? [], education: education.data ?? [], focus: focus.data ?? [] } as PeopleData;

  return (
    <GuidedStep
      planId={planId} formId="people-form" prevId="vision" step={2} group="People · Key People" wide
      title="Who runs the business?"
      why="Owners, directors and the people a lender or investor would ask about. Name, role, shareholding and salary are the essentials; open a person's details for their salary schedule, duties, qualities, education and focus."
      aside={<>
        <CoachPanel title="What good looks like">
          <p>Three to six people is typical. Start with the owner; add anyone whose absence would change the plan.</p>
          <p>Salaries feed Overheads and the forecast, so put real numbers in — a $0 owner salary flatters the profit and every bank knows it. Use the salary schedule for planned rises, cuts or a later start.</p>
          <CoachExample>Shareholding should add to 100%. If it doesn&apos;t, the report&apos;s ownership section will look wrong to an investor.</CoachExample>
        </CoachPanel>
        <CoachPanel title="Where this goes">
          <p><b>Ownership &amp; key people</b> section of every report — duties, qualities and education make the team credible to a lender. Salary schedule → Overheads by year; shareholding → cap table (investor pack).</p>
        </CoachPanel>
      </>}
    >
      <PeopleModule planId={planId} initial={data} currency={settings.data?.currency ?? "AUD"} />
    </GuidedStep>
  );
}
