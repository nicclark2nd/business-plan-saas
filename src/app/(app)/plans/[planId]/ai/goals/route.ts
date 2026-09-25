import { createClient } from "@/lib/supabase/server";
import { gatherReport } from "../../reports/gather";
import { buildGoalMessages, goalsReadiness } from "@/engine/ai/goals";
import { AiUnavailable, openRouter } from "@/lib/ai/provider";
import { boundAnswers } from "@/engine/ai/limits";
import { guardDraft } from "../guard";

/**
 * THE WHOLE LADDER, ONE REQUEST (§6.115, §6.125).
 *
 * The same shape as `../draft` and for the same reasons — a route because the answer arrives in pieces, a
 * marker in the body because the status code is spent once the stream has started, and the model never
 * touching the database because everything it sees was assembled here.
 *
 * What is different is that ONE request returns THREE lists. They are written together on purpose: a
 * five-year picture drafted without sight of this year's commitments is how a plan ends up promising to
 * triple while its one-year goals describe standing still.
 *
 * NOTHING IN THE 90-DAY BAND IS DRAFTED, and no owner or date is in the answer. Nothing here reads
 * `plan_people`, and the system rules forbid naming anyone. A commitment with somebody's name on it is
 * the client's to make.
 */
export const dynamic = "force-dynamic";

export const FAIL_MARK = "[[DRAFT_FAILED]]";

const bad = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;

  let body: { answers?: { question: string; answer: string }[]; existing?: Record<string, string> };
  try { body = await req.json(); } catch { return bad("Malformed request."); }

  /*
   * Signed in, consented, and inside the day's allowance (§6.106, §6.119). This route spends six passages
   * per press, so it is the one the ceiling exists for.
   */
  const gate = await guardDraft(planId, "goals_draft");
  if (!gate.ok) return gate.response;
  const supabase = await createClient();

  let messages;
  try {
    const { input } = await gatherReport(planId);

    /*
     * A PLAN WITH NO NUMBERS IS NOT READY, AND SAYS SO IN THE SCREEN'S OWN WORDS. This is checked again
     * here rather than trusted from the button, because the button is a courtesy and this is the control.
     */
    const ready = goalsReadiness(input);
    if (!ready.ready) return bad(ready.reason ?? "This plan is not ready for goals yet.", 409);

    /*
     * What the client has already written, read from the PLAN rather than taken from the request: the
     * browser may say which areas it is asking about, but what is in them is not the browser's to assert.
     */
    const { data: rows } = await supabase.from("plan_goals")
      .select("horizon, title").eq("plan_id", planId).neq("horizon", "ninety").order("sort_order");
    const existing: Partial<Record<string, string>> = {};
    for (const r of rows ?? []) {
      const h = String(r.horizon ?? "");
      if (!h || typeof r.title !== "string" || !r.title.trim()) continue;
      existing[h] = existing[h] ? `${existing[h]}\n${r.title.trim()}` : r.title.trim();
    }

    /* Only lines the client actually planned to act on (§6.59.1) — an observation is not an intention. */
    const { data: swot } = await supabase.from("plan_swot_items")
      .select("quadrant, text, response").eq("plan_id", planId).not("response", "is", null).order("sort_order");
    const responses = (swot ?? [])
      .filter((s) => typeof s.response === "string" && s.response.trim())
      .map((s) => ({ quadrant: String(s.quadrant), text: String(s.text ?? ""), response: String(s.response) }));

    messages = buildGoalMessages(input, boundAnswers(body.answers), existing, responses);
  } catch (e) {
    console.error("goals draft", e);
    return bad("Couldn't read this plan.", 500);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of openRouter.stream(messages, req.signal)) {
          controller.enqueue(encoder.encode(piece));
        }
      } catch (e) {
        const message = e instanceof AiUnavailable ? e.message : "The draft stopped before it finished.";
        controller.enqueue(encoder.encode(FAIL_MARK + message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
