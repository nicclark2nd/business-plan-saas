/**
 * ASSETS THAT ARE NOT ON THE BALANCE SHEET (§6.147) — three registers, descriptive only.
 *
 * The tables have existed since 0002 with no screen; the menu said "soon" (Open_Items 3). Nothing here
 * reaches the forecast: a trade mark's value to a buyer is real, but it is not a figure this plan can
 * defend, so it is recorded and described rather than counted (SaaS_Requirements, Assets: "descriptive
 * only; does not touch the financials").
 */
export type AreaKey = "social" | "memberships" | "ip";
export const AREAS: readonly AreaKey[] = ["social", "memberships", "ip"];

export type Social = { id: string; platform: string; url: string | null; description: string | null; sort_order: number };
export type Membership = { id: string; organisation_name: string; description: string | null; sort_order: number };
export type Ip = { id: string; name: string; ip_type: string | null; description: string | null; sort_order: number };

/** Stored as the key; printed as the label. "Other" keeps an unusual right from being forced into a wrong box. */
export const IP_TYPES = [
  { value: "trade_mark", label: "Trade mark" },
  { value: "patent", label: "Patent" },
  { value: "design", label: "Registered design" },
  { value: "copyright", label: "Copyright" },
  { value: "domain", label: "Domain name" },
  { value: "know_how", label: "Trade secret or know-how" },
  { value: "other", label: "Other" },
] as const;
export const ipTypeLabel = (v: string | null | undefined) => IP_TYPES.find((t) => t.value === v)?.label ?? null;
