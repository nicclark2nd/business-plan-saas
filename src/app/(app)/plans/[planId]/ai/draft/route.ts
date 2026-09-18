import { createClient } from "@/lib/supabase/server";
import { gatherReport } from "../../reports/gather";
import { planDraft, type DraftableField } from "@/engine/ai/draft";
import { buildMessages } from "@/engine/ai/prompt";
import { AiUnavailable, openRouter } from "@/lib/ai/provider";
import { DRAFTABLE } from "@/engine/ai/fields";

/**
 * ONE DRAFT (6.106.1).
 *
 * A route rather than a server action, because the answer ARRIVES IN PIECES and a server action returns
 * once. That is not a technical preference - it is why this app still has no spinners. A save takes
 * milliseconds and needs no waiting state; a draft takes seconds, and rather than inventing one, the text
 * simply begins appearing. There is no blank pause left to express.
 *
 * THE MODEL NEVER TOUCHES THE DATABASE. The plan is loaded here, through the same client with RLS every
 * page uses, so it can only ever see plans this session may see. What crosses to the provider is text this
 * file assembled: no connection, no token, no tool on the other side.
 *
 * THE GUARANTEE IS NOT THAT THE MODEL WAS TOLD NOT TO LOOK. IT IS THAT THERE IS NOTHING TO LOOK AT.
 */
export const dynamic = "force-dynamic";

/**
 * How a failure travels once the stream has started (6.98).
 *
 * The status code is spent by then, so the message rides in the body behind a marker no business plan will
 * ever contain. A draft that stops halfway with no explanation is worse than one that never started.
 */
export const FAIL_MARK = "[[DRAFT_FAILED]]";

const bad = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;

  let body: { field?: string; answers?: { question: string; answer: string }[] };
  try { body = await req.json(); } catch { return bad("Malformed request."); }

  const field: DraftableField | undefined = DRAFTABLE[body.field ?? ""];
  if (!field) return bad("That field cannot be drafted.");

  /*
   * THE CONSENT IS ENFORCED HERE, NOT ON THE SCREEN (6.106). A hidden button is a courtesy; a server that
   * refuses is the control, and it holds whatever the browser was persuaded to send.
   */
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("plan_settings").select("ai_enabled").eq("plan_id", planId).maybeSingle();
  if (error) return bad("Couldn't read this plan's settings.", 500);
  if (!settings?.ai_enabled) return bad("AI drafting is switched off for this plan. Turn it on in Plan settings.", 403);

  let messages;
  try {
    const { input } = await gatherReport(planId);
    messages = buildMessages(field, planDraft(input, field), body.answers ?? []);
  } catch (e) {
    console.error("draft gather", e);
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
      /* Nothing between here and the browser may buffer this, or streaming buys nothing. */
      "X-Accel-Buffering": "no",
    },
  });
}
