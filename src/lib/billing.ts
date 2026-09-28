import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { loadMyFirm } from "@/lib/myFirm";

/**
 * WHO PAYS, AND FOR WHAT (§6.185).
 *
 * The organisation that pays is the consultant's firm, or — for a business owner planning for themselves —
 * their own organisation. Each has one subscription and one allowance of active plans; the database keeps the
 * count and refuses a plan past it (0062).
 */
export type BillingOrg = { id: string; name: string; kind: "firm" | "owner"; isAdmin: boolean };

export async function myBillingOrg(): Promise<BillingOrg | null> {
  const firm = await loadMyFirm();
  if (firm) return { id: firm.id, name: firm.name, kind: "firm", isAdmin: firm.role === "admin" };
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("organisation_members").select("role, organisations(id, name, kind)")
    .eq("user_id", session.user.id).eq("role", "admin");
  const owned = (data ?? []).map((r) => (Array.isArray(r.organisations) ? r.organisations[0] : r.organisations) as { id: string; name: string; kind: string } | null)
    .filter((o): o is { id: string; name: string; kind: string } => !!o && o.kind === "owner");
  const pick = owned.find((o) => o.id === session.profile?.default_organisation_id) ?? owned[0];
  return pick ? { id: pick.id, name: pick.name, kind: "owner", isAdmin: true } : null;
}

export type Allowance = { allowed: number; used: number; paid: boolean; status: string; level: string | null };

/** Fails soft to "unknown" before migration 0062: nothing is blocked by a screen that cannot read the count. */
export async function allowanceFor(orgId: string): Promise<Allowance | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plan_allowance", { p_org: orgId });
  const r = (data as { allowed: number; used: number; paid: boolean; status: string; level_name: string | null }[] | null)?.[0];
  if (error || !r) return null;
  return { allowed: r.allowed, used: r.used, paid: r.paid, status: r.status, level: r.level_name };
}

export type Account = { status: string; level: string | null; plansIncluded: number; extraPlans: number; grantedPlans: number;
  periodEnd: string | null; cancelAtEnd: boolean; hasCustomer: boolean };

export async function accountFor(orgId: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("billing_accounts").select("*").eq("organisation_id", orgId).maybeSingle();
  if (!data) return null;
  return {
    status: data.status, level: data.level_name, plansIncluded: data.plans_included, extraPlans: data.extra_plans,
    grantedPlans: data.granted_plans, periodEnd: data.current_period_end, cancelAtEnd: !!data.cancel_at_period_end,
    hasCustomer: !!data.stripe_customer_id,
  };
}

/** The database's refusal of a plan past the allowance (0062), in words. */
export const PLAN_LIMIT = /plan limit reached/;
export const planLimitMessage = (kind: "firm" | "owner") =>
  kind === "firm"
    ? "Your subscription's plans are all in use. Archive a finished client, or add plans in Billing."
    : "Your plans are all in use. Archive one you've finished with, or subscribe in Billing.";
