import { briefingMessages } from "@/engine/ai/briefing";
import { AiUnavailable, openRouter } from "@/lib/ai/provider";
import { readForBriefing, TABS, VIEWS } from "@/lib/briefing";
import type { Tab, View } from "@/engine/capability/read";
import { guardDraft } from "../guard";

/**
 * THE PLANNER'S BRIEFING, STREAMED (§6.179).
 *
 * A route for the same reason as the field draft (§6.106.1): the note arrives in pieces, and the Planner
 * reads it as it is written rather than watching a spinner. The same three gates — signed in, AI switched
 * on for this plan, inside the day's allowance — are passed first, on the server.
 *
 * The body names a tab and a view. That is all the browser decides; the fact sheet is built here.
 */
export const dynamic = "force-dynamic";

const FAIL_MARK = "[[DRAFT_FAILED]]";

const bad = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;

  let body: { tab?: string; view?: string };
  try { body = await req.json(); } catch { return bad("Malformed request."); }
  const tab = TABS.find((t) => t === body.tab) as Tab | undefined;
  const view = VIEWS.find((v) => v === body.view) as View | undefined;
  if (!tab || !view) return bad("That tab cannot be briefed.");

  const gate = await guardDraft(planId, "capability_briefing");
  if (!gate.ok) return gate.response;

  let messages;
  try {
    const { R, adviser, sheet } = await readForBriefing(planId, tab, view);
    if (R.s.value === null && !R.fixes.story) return bad("There is nothing on this tab to brief yet. Fill in the plan first.", 409);
    messages = briefingMessages(sheet, { adviser, onActual: R.onActual });
  } catch (e) {
    console.error("briefing gather", e);
    return bad("Couldn't read this plan.", 500);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of openRouter.stream(messages, req.signal, { maxTokens: 1000 })) {
          controller.enqueue(encoder.encode(piece));
        }
      } catch (e) {
        const message = e instanceof AiUnavailable ? e.message : "The briefing stopped before it finished.";
        controller.enqueue(encoder.encode(FAIL_MARK + message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
