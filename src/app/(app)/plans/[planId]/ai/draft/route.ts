import { gatherReport } from "../../reports/gather";
import { planDraft, type DraftableField } from "@/engine/ai/draft";
import { buildMessages } from "@/engine/ai/prompt";
import { AiUnavailable, openRouter } from "@/lib/ai/provider";
import { DRAFTABLE } from "@/engine/ai/fields";
import { subjectFor } from "@/engine/ai/subject";
import { boundAnswers, boundRow } from "@/engine/ai/limits";
import { guardDraft } from "../guard";

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

  let body: { field?: string; row?: string; answers?: { question: string; answer: string }[] };
  try { body = await req.json(); } catch { return bad("Malformed request."); }

  const field: DraftableField | undefined = DRAFTABLE[body.field ?? ""];
  if (!field) return bad("That field cannot be drafted.");

  /*
   * Signed in, consented, and inside the day's allowance — all three on the SERVER (6.106, 6.119). A
   * hidden button is a courtesy; a server that refuses is the control, and it holds whatever the browser
   * was persuaded to send.
   */
  const gate = await guardDraft(planId, "field_draft");
  if (!gate.ok) return gate.response;

  let messages;
  try {
    const { input } = await gatherReport(planId);

    /*
     * A ROW FIELD IS REFUSED WITHOUT ITS ROW (6.113).
     *
     * The browser sends a name; `subjectFor` finds that row in the plan and writes the block from what it
     * found, so nothing the request said becomes a fact. No match means the row is not in the saved plan -
     * usually a line typed into the dialog and not saved yet - and the honest answer is to say so, not to
     * write a passage about "why they buy it" with no idea what "it" is.
     */
    let subject: string | null = null;
    if (field.subject) {
      subject = subjectFor(input, field.subject, boundRow(body.row), field.key);
      if (subject === null) {
        return bad("Save this line first \u2014 a draft needs to know which one it is about.", 409);
      }
    }
    messages = buildMessages(field, planDraft(input, field), boundAnswers(body.answers), subject);
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
