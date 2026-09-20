import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { productNoun } from "@/engine/plan/vocabulary";
import { CAPACITY_FIELDS, type Capacity, type OpStep, type Premise, type Supplier } from "./model";
import { OperationsModule } from "./OperationsModule";
import { draftingFor } from "../drafting";

const AREAS = ["premises", "suppliers", "process", "capacity"] as const;

export default async function OperationsPage({ params, searchParams }: {
  params: Promise<{ planId: string }>; searchParams: Promise<{ area?: string }>;
}) {
  const { planId } = await params;
  const { area } = await searchParams;
  const supabase = await createClient();
  const [session, premises, suppliers, steps, capacity, settings] = await Promise.all([
    getSession(),
    supabase.from("plan_outlets").select("id, name, address, tenure, is_primary, floor_area, monthly_cost, purpose, sort_order")
      .eq("plan_id", planId).order("is_primary", { ascending: false }).order("sort_order").order("created_at"),
    supabase.from("plan_suppliers").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_operations_steps").select("*").eq("plan_id", planId).order("sort_order").order("created_at"),
    supabase.from("plan_operations").select("*").eq("plan_id", planId).maybeSingle(),
    supabase.from("plan_settings").select("product_type").eq("plan_id", planId).maybeSingle(),
  ]);

  const written = Object.fromEntries(
    CAPACITY_FIELDS.map((f) => [f.key, String(capacity.data?.[f.key] ?? "")]),
  ) as Capacity;
  const noun = productNoun(settings.data?.product_type as string | null);

  /*
   * THREE OF THE FIVE CAPACITY BOXES (§6.111). Operating hours is a bare fact nothing can shape, and
   * capacity today would be answered from the sales forecast — which is what the business intends to
   * sell, not what it could deliver. See `engine/ai/fields.ts`.
   */
  const drafting = await draftingFor(planId, CAPACITY_FIELDS.map((f) => f.key));

  return (
    <OperationsModule
      planId={planId}
      mode={(session?.profile?.mode ?? "guided") as "guided" | "advanced"}
      initialArea={AREAS.includes((area ?? "") as typeof AREAS[number]) ? (area as typeof AREAS[number]) : "premises"}
      initialPremises={(premises.data ?? []) as Premise[]}
      initialSuppliers={(suppliers.data ?? []) as Supplier[]}
      initialSteps={(steps.data ?? []) as OpStep[]}
      initialCapacity={written}
      noun={{ one: noun.one, many: noun.many }}
      drafting={drafting}
    />
  );
}
