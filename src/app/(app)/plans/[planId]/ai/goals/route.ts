import { createClient } from "@/lib/supabase/server";
import { gatherReport } from "../../reports/gather";
import { buildGoalMessages, goalsReadiness } from "@/engine/ai/goals";
import { AiUnavailable, openRouter } from "@/lib/ai/provider";
import { GOAL_AREAS, type GoalArea } from "@/engine/whatif/goals";

/**
 * SIX GOALS, ONE REQUEST (§6.115).
 *
 * The same shape as `../draft` and for the same reasons — a route because the answer arrives in pieces, a
 * marker in the body because the status code is spent once the stream has started, and the model never
 * touching the database because everything it sees was assembled here.
 *
 * What is different is that ONE request returns SIX passages. They are written together on purpose: six
 * goals drafted separately do not add up, and a plan whose marketing goal ignores its sales goal is worse
 * than a plan with no goals at all.
 *
 * THE OWNER, THE QUARTER AND THE DATE ARE NOT IN THE ANSWER AND NOT IN THE REQUEST. Nothing here reads
 * `plan_people`, and the system rules forbid naming anyone. A commitment with somebody's name on it is
 * the client's to make.
 */
export const dynamic = "force-dynamic";

export const FAIL_MARK = "[[DRAFT_FAILED]]";

const bad = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });

const isArea = (a: string): a is GoalArea => GOAL_AREAS.some((x) => x.key === a);

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;

  let body: { answers?: { question: string; answer: string }[]; existing?: Record<string, string> };
  try { body = await req.json(); } catch { return bad("Malformed request."); }

  /* The consent is enforced here, not on the screen (§6.106). A hidden button is a courtesy. */
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("plan_settings").select("ai_enabled").eq("plan_id", planId).maybeSingle();
  if (error) return bad("Couldn't read this plan's settings.", 500);
  if (!settings?.ai_enabled) return bad("AI drafting is switched off for this plan. Turn it on in Plan settings.", 403);

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
      .select("area, title").eq("plan_id", planId).is("parent_id", null);
    const existing: Partial<Record<GoalArea, string>> = {};
    for (const r of rows ?? []) {
      if (isArea(r.area) && typeof r.title === "string" && r.title.trim()) existing[r.area] = r.title;
    }

    /* Only lines the client actually planned to act on (§6.59.1) — an observation is not an intention. */
    const { data: swot } = await supabase.from("plan_swot_items")
      .select("quadrant, text, response").eq("plan_id", planId).not("response", "is", null).order("sort_order");
    const responses = (swot ?? [])
      .filter((s) => typeof s.response === "string" && s.response.trim())
      .map((s) => ({ quadrant: String(s.quadrant), text: String(s.text ?? ""), response: String(s.response) }));

    messages = buildGoalMessages(input, body.answers ?? [], existing, responses);
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
