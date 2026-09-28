import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/lib/planLoad";
import { runForecast } from "@/engine/forecast/run";
import { planMonths } from "@/engine/plan/calendar";
import { moneyFormatter } from "@/engine/plan/money";
import { EXISTING_DEBT_ID } from "@/engine/funding/existing";
import { TARGET_KINDS, TARGET_STEPS, checkTargets, readTargets, type TargetCheck, type TargetFacts } from "@/engine/capability/targets";

type Run = ReturnType<typeof runForecast>;
type Loaded = Awaited<ReturnType<typeof loadPlan>>;

/** The six figures the targets are read against, from a forecast run the caller already has. */
export function targetFacts(loaded: Pick<Loaded, "plan" | "fyEndMonth" | "firstYear">, run: Run): TargetFacts {
  const { plan, fyEndMonth, firstYear } = loaded;
  const f = run.checked ?? run.forecast;
  const p = f.pnl?.[1];
  const names = planMonths(fyEndMonth);
  let lowest: TargetFacts["lowestCash"] = null;
  for (const [y, mc] of Object.entries(run.monthlyByYear ?? {})) {
    (mc?.months ?? []).forEach((m, i) => {
      if (!lowest || m.closingCash < lowest.value) {
        /* The plan year ENDS in firstYear + y − 1; its months after the year-end month fall in the year before. */
        const end = fyEndMonth || 12, month = ((end + i) % 12) + 1;
        const calYear = firstYear + Number(y) - 1 - (month > end ? 1 : 0);
        lowest = { value: m.closingCash, when: `${names[i] ?? `month ${i + 1}`} ${calYear}` };
      }
    });
  }
  const existing = (plan.sources.funding ?? []).find((s) => (s as { id?: string }).id === EXISTING_DEBT_ID) as { loan?: { term_months?: number | null } } | undefined;
  return {
    firstYear,
    y1: p ? { revenue: p.revenue, cogs: p.cogs, overheads: p.overheads, operatingProfit: p.operatingProfit } : null,
    debtorDays: plan.workingCapital?.[1]?.debtorDays ?? null,
    loanTermMonths: existing?.loan?.term_months ?? null,
    lowestCash: lowest,
  };
}

/**
 * THE AGREED TARGETS FOR ONE STEP, READ AGAINST THE PLAN (§6.167). Cheap when there is nothing to show: the
 * forecast only runs when a target shown on this step has been agreed.
 */
export async function loadTargetChecks(planId: string, step: string): Promise<TargetCheck[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_settings").select("agreed_targets, currency").eq("plan_id", planId).maybeSingle();
  if (error) return [];
  const targets = readTargets(data?.agreed_targets);
  if (!targets || !TARGET_KINDS.some((k) => targets[k] && TARGET_STEPS[k].shownOn.includes(step))) return [];
  try {
    const loaded = await loadPlan(planId);
    const checks = checkTargets(targets, targetFacts(loaded, runForecast(loaded.plan)), moneyFormatter(data?.currency as string | undefined), step);
    return checks;
  } catch (e) {
    console.error("targets", planId, e);
    return [];
  }
}
