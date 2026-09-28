import { loadCapabilityFacts } from "@/lib/capabilityFacts";
import { CapabilitiesModule } from "./CapabilitiesModule";

/**
 * FINANCIAL CAPABILITIES (§6.128, rebuilt §6.129) — a tool, not a step. The facts are gathered by
 * `loadCapabilityFacts`, which the Planner's assessment reads too (§6.164).
 */
export default async function CapabilitiesPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const f = await loadCapabilityFacts(planId);
  return (
    <CapabilitiesModule planId={planId} mode={f.mode} currency={f.currency} facts={f.facts} products={f.products}
      facilities={f.facilities} months={f.months} openingDebt={f.openingDebt} extras={f.extras}
      history={f.history} firstYear={f.firstYear} adviser={f.adviser} monthsByYear={f.monthsByYear} targetChecks={f.targetChecks} />
  );
}
