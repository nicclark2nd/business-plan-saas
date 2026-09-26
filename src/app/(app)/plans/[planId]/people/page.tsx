import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadCapTable } from "@/lib/planSources";
import { PeopleModule } from "./PeopleModule";
import type { PeopleData } from "./model";
import { firstProjectedYear } from "@/engine/plan/calendar";
import type { TransferRating } from "@/engine/capability/judgements";

/* `?area=` (§6.129) — the pencil from the Capability to Sell tab lands on Risk & Succession, not on People. */
export default async function PeoplePage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, cap, people, capabilities, settings, ratings] = await Promise.all([
    getSession(),
    // Who owns the business, composed once and shown the same way on Funding (§6.54).
    loadCapTable(planId),
    supabase.from("plan_people").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_people_capabilities").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_settings").select("currency, financial_year_end_month, first_projected_year").eq("plan_id", planId).maybeSingle(),
    /*
     * The six change-of-owner judgements (§6.129). Read here and scored here; the Capability to Sell
     * dashboard reads the same rows rather than asking a second time (§6.41).
     */
    supabase.from("plan_transfer_ratings").select("factor, score, note").eq("plan_id", planId),
  ]);
  const data = { people: people.data ?? [], capabilities: capabilities.data ?? [] } as PeopleData;
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";

  return (
    <PeopleModule
      planId={planId} initial={data} mode={mode} cap={cap}
      currency={settings.data?.currency ?? "AUD"}
      /*
       * THE FIFTH PLACE (§6.33.1, §6.126).
       *
       * §6.33.1 found `plans.plan_year` standing in for the plan's calendar in four screens and fixed
       * them. This one was missed, and it survived because every test plan had a cover year that happened
       * to sit close enough to the projected year for the answer to look plausible. A plan created today
       * makes the gap a whole year: the cover says 2026, Year 1 ends June 2027, and this screen was
       * measuring tenure and start years from July 2025.
       *
       * `plan_year` is the year printed on the front of the report. It is not a financial year, it is not
       * this plan's Year 1, and nothing that decides WHEN money happens may read it.
       */
      planYear={firstProjectedYear(settings.data?.first_projected_year, settings.data?.financial_year_end_month)}
      fyEndMonth={settings.data?.financial_year_end_month ?? 6}
      ratings={(ratings.data ?? []) as TransferRating[]}
      initialArea={area === "salary" || area === "cap" || area === "risk" ? area : "people"}
    />
  );
}
