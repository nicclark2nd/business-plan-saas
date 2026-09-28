import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { myBillingOrg } from "@/lib/billing";
import { StripeUnavailable, stripe } from "@/lib/stripe";
import { siteOrigin } from "@/lib/siteOrigin";

/**
 * STRIPE'S OWN BILLING PAGE (§6.185): change level, change card, see invoices, cancel. Nothing about a card is
 * ever entered in this app. Admins only; the customer is the organisation's own, read under the database's rules.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const origin = await siteOrigin();
  const org = await myBillingOrg();
  if (!org) return NextResponse.redirect(`${origin}/login`, 303);
  const page = org.kind === "firm" ? "/firm/billing" : "/billing";
  const back = (msg: string) => NextResponse.redirect(`${origin}${page}?billing=${encodeURIComponent(msg)}`, 303);
  if (!org.isAdmin) return back("Only your firm's admin can change billing.");
  const supabase = await createClient();
  const { data: customer } = await supabase.rpc("billing_customer", { p_org: org.id });
  if (!customer) return back("There is no subscription to manage yet.");
  try {
    const portal = await stripe<{ url: string }>("/billing_portal/sessions", {
      method: "POST", params: { customer: customer as string, return_url: `${origin}${page}` },
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (e) {
    return back(e instanceof StripeUnavailable ? e.message : "Couldn't reach Stripe. Try again in a moment.");
  }
}
