import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadCapabilityFacts } from "@/lib/capabilityFacts";
import { moneyFormatter } from "@/engine/plan/money";
import { readTab, readViews, type Tab, type View } from "@/engine/capability/read";
import { briefingSheet } from "@/engine/ai/briefing";

/**
 * ONE TAB, READ ON THE SERVER, FOR THE BRIEFING (§6.179).
 *
 * The same facts the page is drawn from (`loadCapabilityFacts`), through the same assembly (`readTab`), so
 * the note is written from exactly what the Planner is looking at. Nothing the browser sends becomes a fact:
 * the request names a tab and a view, and everything else is read here, under RLS.
 */
export const TABS: readonly Tab[] = ["grow", "borrow", "sell"];
export const VIEWS: readonly View[] = ["actual", "plan"];

export async function readForBriefing(planId: string, tab: Tab, view: View) {
  const supabase = await createClient();
  const [f, plan] = await Promise.all([
    loadCapabilityFacts(planId),
    supabase.from("plans").select("business_name").eq("id", planId).maybeSingle().then((r) => r.data),
  ]);
  const money = moneyFormatter(f.currency);
  const ctx = {
    facts: f.facts, history: f.history ?? [], firstYear: f.firstYear, money, adviser: f.adviser,
    months: f.months, agreedTargets: f.agreedTargets, facilities: f.facilities,
  };
  const R = readTab(ctx, readViews(ctx), tab, view === "actual");
  const business = typeof plan?.business_name === "string" && plan.business_name.trim() ? plan.business_name.trim() : null;
  return { R, adviser: f.adviser, sheet: briefingSheet(R, tab, money, business) };
}
