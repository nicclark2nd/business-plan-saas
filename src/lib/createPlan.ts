import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentFinancialYear } from "@/engine/plan/calendar";
import { GENERIC_TAX_RATE, countryDefault } from "@/engine/plan/countryDefaults";

/**
 * ONE WAY A PLAN IS MADE (§6.182) — by setup (a business owner's first plan, or a consultant's first client)
 * and by My Clients → Add new business. Two copies of this would be two ideas of what a new plan starts with.
 *
 * The plan's financial calendar is stated at creation (§6.33.2); the country gives the tax rate; an owner's
 * sign-in email goes on their own cover (§6.151) and a consultant's never goes on a client's.
 */
export type NewPlan = {
  businessName: string;
  country: string | null;
  currency: string;
  fyEndMonth: number;
  firstProjectedYear?: number | null;
  /** The owner's own email, for their cover. Never a consultant's. */
  ownerEmail?: string | null;
  /** The firm's default paper (§6.182), when it has set one. */
  pageSize?: "a4" | "letter" | null;
};

export function readNewPlan(formData: FormData): NewPlan | { error: string } {
  const businessName = String(formData.get("business_name") ?? "").trim();
  if (!businessName) return { error: "Give the business a name." };
  const fyEndMonth = Math.min(12, Math.max(1, Math.trunc(Number(formData.get("financial_year_end_month"))) || 6));
  const first = Math.trunc(Number(formData.get("first_projected_year")));
  return {
    businessName,
    country: String(formData.get("country") ?? "").trim() || null,
    currency: String(formData.get("currency") ?? "AUD").trim(),
    fyEndMonth,
    firstProjectedYear: Number.isFinite(first) && first >= 1900 && first <= 2200 ? first : null,
  };
}

export async function createPlan(orgId: string, userId: string, p: NewPlan): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("plans").insert({ organisation_id: orgId, business_name: p.businessName, created_by: userId })
    .select("id").single();
  if (error || !plan) {
    /* The database's allowance (0062): the one refusal worth putting in words, with where to go next. */
    if (/plan limit reached/.test(error?.message ?? "")) return { error: "limit" };
    if (/account on hold/.test(error?.message ?? "")) return { error: "This account is on hold, so nothing new can be added. Contact BizPlanHQ to lift it." };
    console.error("create the plan", error);
    return { error: "Couldn't create the plan. Try again." };
  }

  await supabase.from("plan_settings").update({
    country: p.country, currency: p.currency, financial_year_end_month: p.fyEndMonth,
    first_projected_year: p.firstProjectedYear ?? currentFinancialYear(p.fyEndMonth),
    tax_rate: countryDefault(p.country)?.taxRate ?? GENERIC_TAX_RATE,
    ...(p.ownerEmail ? { contact_email: p.ownerEmail } : {}),
    ...(p.pageSize ? { page_size: p.pageSize } : {}),
  }).eq("plan_id", plan.id);
  return { id: plan.id };
}
