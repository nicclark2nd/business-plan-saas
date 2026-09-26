import "server-only";
import { createClient } from "@/lib/supabase/server";
import { draftModel } from "@/lib/ai/provider";
import { DRAFTS_PER_PLAN_PER_DAY } from "@/engine/ai/limits";

/**
 * WHAT EVERY DRAFT REQUEST HAS TO GET PAST (§6.119).
 *
 * Both AI routes did the consent check themselves, in the same eight lines. A cost ceiling needed adding
 * to both, which is the moment to stop writing it twice (§6.41) — and a control that exists on one of two
 * routes is not a control.
 *
 * THREE GATES, IN THE ORDER THAT COSTS LEAST TO FAIL.
 *
 * 1. **Signed in.** RLS means an anonymous request would read nothing anyway, but the meter row needs a
 *    user id and a refusal here is cheaper than finding out later.
 * 2. **Consent.** Checked on the SERVER, not trusted from the browser (§6.106) — a hidden button is a
 *    courtesy, a server that refuses is the control.
 * 3. **The ceiling.** Counted from `ai_calls`, which is durable: an in-memory counter on Vercel resets
 *    every cold start, which on a serverless platform means it barely exists.
 *
 * THE METER IS WRITTEN BEFORE THE MODEL IS CALLED, NOT AFTER. A request that fails upstream, times out or
 * is abandoned halfway still cost something to make, and a counter that only records successes is a
 * counter an attacker can drive for free by hanging up early.
 */

export type Refusal = { ok: false; response: Response };
export type Allowed = { ok: true; userId: string };

const bad = (message: string, status: number): Refusal => ({
  ok: false,
  response: new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  }),
});

export async function guardDraft(planId: string, purpose: "field_draft" | "goals_draft" | "multiples_search"): Promise<Refusal | Allowed> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("Sign in to use drafting.", 401);

  const { data: settings, error } = await supabase
    .from("plan_settings").select("ai_enabled").eq("plan_id", planId).maybeSingle();
  if (error) return bad("Couldn't read this plan's settings.", 500);
  if (!settings?.ai_enabled) {
    return bad("AI drafting is switched off for this plan. Turn it on in Plan settings.", 403);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_calls").select("id", { count: "exact", head: true })
    .eq("plan_id", planId).gte("created_at", since);

  /*
   * A METER THAT CANNOT BE READ DOES NOT OPEN THE GATE.
   *
   * The tempting fallback is to let the draft through when the count fails, so a database hiccup does not
   * break the feature. That turns the one reliable way to break the count into the one reliable way to
   * remove the limit. A client who cannot draft for a minute has lost a convenience; an unbounded spend
   * is the thing this exists to prevent.
   */
  if (countError) {
    console.error("ai ceiling", planId, countError);
    return bad("Couldn't check this plan's drafting allowance. Try again in a moment.", 503);
  }
  if ((count ?? 0) >= DRAFTS_PER_PLAN_PER_DAY) {
    return bad(
      `This plan has used its ${DRAFTS_PER_PLAN_PER_DAY} drafts for today. It resets over the next 24 hours — or write this one yourself and come back to it.`,
      429,
    );
  }

  /*
   * Recorded whatever happens next. Tokens and cost stay at their defaults: OpenRouter reports usage at
   * the END of a stream and this row is written before it starts, on purpose. Counting REQUESTS is what
   * bounds the spend; counting tokens exactly is a nicer number and a separate job.
   */
  const { error: meterError } = await supabase.from("ai_calls").insert({
    plan_id: planId, user_id: user.id, purpose, model: draftModel(),
  });
  if (meterError) {
    console.error("ai meter", planId, meterError);
    return bad("Couldn't start a draft just now. Try again in a moment.", 503);
  }

  return { ok: true, userId: user.id };
}
