import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/plan";
import { cleanColour } from "@/engine/plan/brand";

/**
 * THE FIRM THE SIGNED-IN CONSULTANT WORKS IN (§6.182) — the consultant's own area is built on this.
 *
 * A consultant is an admin or advisor of an organisation that is not a business planning for itself
 * (`kind <> 'owner'`). A client given a login is a member of a PLAN, never of the firm, so this is null for
 * them and the firm area is closed to them.
 *
 * `select("*")` on purpose: the firm's detail columns arrive with migration 0059, and a named list would
 * fail every page in the gap between a deploy and the migration. Missing columns simply read as null.
 */
export type MyFirm = {
  id: string;
  name: string;
  kind: string;
  role: "admin" | "advisor";
  country: string | null;
  currency: string;
  colour: string | null;
  logoPath: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  businessNumber: string | null;
  preparedBy: string | null;
  defaultPageSize: "a4" | "letter" | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export const loadMyFirm = cache(async (): Promise<MyFirm | null> => {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("organisation_members")
    .select("role, organisations(*)").eq("user_id", session.user.id).in("role", ["admin", "advisor"]);
  const firms = (rows ?? []).flatMap((r) => {
    const o = (Array.isArray(r.organisations) ? r.organisations[0] : r.organisations) as Record<string, unknown> | null;
    return o && o.kind !== "owner" ? [{ role: r.role as "admin" | "advisor", o }] : [];
  });
  if (!firms.length) return null;
  /* One firm per consultant is the rule from here on; a person in two picks the one they last worked in. */
  const pick = firms.find((f) => f.o.id === session.profile?.default_organisation_id) ?? firms[0];
  const o = pick.o;
  return {
    id: String(o.id), name: String(o.name ?? ""), kind: String(o.kind), role: pick.role,
    country: str(o.country), currency: str(o.currency) ?? "AUD",
    colour: cleanColour(o.brand_colour as string | null), logoPath: str(o.logo_path),
    addressLine: str(o.address_line), city: str(o.city), region: str(o.region), postcode: str(o.postcode),
    phone: str(o.phone), website: str(o.website), businessNumber: str(o.business_number),
    preparedBy: str(o.prepared_by),
    defaultPageSize: o.default_page_size === "a4" || o.default_page_size === "letter" ? o.default_page_size : null,
  };
});
