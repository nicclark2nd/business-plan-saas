import { NextResponse } from "next/server";
import { getSession } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { allowanceFor, myBillingOrg } from "@/lib/billing";
import { StripeUnavailable, getLevel, stripe } from "@/lib/stripe";
import { siteOrigin } from "@/lib/siteOrigin";

/**
 * START A PAYMENT ON STRIPE'S OWN PAGE (§6.185) — a subscription, or extra plans on top of one.
 *
 * The browser names a price and a quantity; everything else is decided here. The price must be one of this
 * app's (its product carries `bizplanhq`), of the kind this organisation buys — a firm cannot take the owner's
 * price, nobody buys extra plans without a subscription — and the organisation's id travels to Stripe in the
 * checkout's own metadata, so the notice that comes back says whose it is without trusting anything else.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = await siteOrigin();
  const back = (path: string, msg?: string) => NextResponse.redirect(`${origin}${path}${msg ? `?billing=${encodeURIComponent(msg)}` : ""}`, 303);
  const [session, org] = await Promise.all([getSession(), myBillingOrg()]);
  if (!session || !org) return back("/login");
  const page = org.kind === "firm" ? "/firm/billing" : "/billing";
  if (!org.isAdmin) return back(page, "Only your firm's admin can change billing.");

  const form = await req.formData();
  const priceId = String(form.get("price") ?? "");
  const quantity = Math.min(50, Math.max(1, Math.trunc(Number(form.get("quantity") ?? 1)) || 1));
  const level = await getLevel(priceId);
  if (!level) return back(page, "That price is not available.");

  const allowance = await allowanceFor(org.id);
  if (level.kind === "extra_plan") {
    if (!allowance?.paid) return back(page, "Extra plans go on top of a subscription. Subscribe first.");
  } else {
    if (level.kind !== org.kind) return back(page, "That price is not for your kind of account.");
    if (allowance?.paid) return back(page, "You already have a subscription. Change it with Manage billing.");
  }

  const supabase = await createClient();
  const { data: customer } = await supabase.rpc("billing_customer", { p_org: org.id });
  try {
    const checkout = await stripe<{ url: string }>("/checkout/sessions", {
      method: "POST",
      params: {
        mode: level.recurring ? "subscription" : "payment",
        line_items: [{ price: level.priceId, quantity: level.recurring ? 1 : quantity }],
        client_reference_id: org.id,
        metadata: { organisation_id: org.id },
        ...(level.recurring ? { subscription_data: { metadata: { organisation_id: org.id } } } : {}),
        ...(customer ? { customer: customer as string } : { customer_email: session.user.email }),
        ...(!customer && !level.recurring ? { customer_creation: "always" } : {}),
        success_url: `${origin}${page}?billing=done`,
        cancel_url: `${origin}${page}`,
        allow_promotion_codes: "true",
      },
    });
    return NextResponse.redirect(checkout.url, 303);
  } catch (e) {
    return back(page, e instanceof StripeUnavailable ? e.message : "Couldn't reach Stripe. Try again in a moment.");
  }
}
