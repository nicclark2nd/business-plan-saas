/**
 * Site Admin's account row and the two small rules both the list (a client component) and the account page (a
 * server component) need (§6.186). Kept in a plain module: a server component cannot call a function exported
 * from a "use client" file — it receives a reference to it, not the function.
 */
export type AccountRow = {
  organisation_id: string; name: string; kind: string; created_at: string; on_hold_at: string | null; on_hold_reason: string | null;
  admin_email: string | null; people: number; active_plans: number; archived_plans: number; clients_with_login: number;
  billing_status: string; level_name: string | null; plans_included: number; extra_plans: number; granted_plans: number;
  current_period_end: string | null; ai_calls_30d: number; last_activity: string | null;
};

export const PAID = new Set(["active", "trialing", "past_due"]);
export const allowanceOf = (r: Pick<AccountRow, "billing_status" | "plans_included" | "extra_plans" | "granted_plans">) =>
  Math.max(1, PAID.has(r.billing_status) ? r.plans_included + r.extra_plans : 0) + r.granted_plans;
export const KIND: Record<string, string> = { owner: "Owner", coach: "Coach", consultant: "Consultant", accounting_firm: "Accounting firm" };

