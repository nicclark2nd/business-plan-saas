import type { Message } from "@/engine/ai/prompt";

/**
 * THE ONE PLACE THIS APP TALKS TO A MODEL (§6.105.3).
 *
 * An interface with one implementation, because the vendor question will be asked again. Model and provider
 * are configuration; swapping either is an env change rather than a rewrite, which is the right posture for
 * something moving this fast. Coupling the app to a vendor is the mistake, not picking the wrong one today.
 *
 * ZERO RETENTION IS SET ON EVERY REQUEST, NOT IN A DASHBOARD.
 *
 * OpenRouter offers both. The account toggles are off, and even if they were on, a guarantee that lives in a
 * web page depends on nobody changing it in eighteen months. `provider: { zdr: true }` travels with the call,
 * lives in this file, and is asserted by a test.
 *
 * > **AND IT NEVER FALLS BACK.** If no zero-retention endpoint can serve the model, the request is refused
 * > and the client is told why. A silent reroute to a provider that keeps the plan would be the exact thing
 * > the setting exists to prevent, and nobody would ever know it had happened.
 *
 * Retention and training are separate things: these settings address retention. Training is excluded by the
 * account's own Data Training toggles, which is why the consent wording claims only what is actually set.
 */

export type DraftStream = AsyncIterable<string>;

export interface DraftProvider {
  /** Yields the passage in pieces as it arrives. Streaming is not a flourish — see §6.105.4. */
  stream(messages: Message[], signal?: AbortSignal): DraftStream;
}

export class AiUnavailable extends Error {
  constructor(message: string, readonly kind: "unconfigured" | "no_zdr_endpoint" | "refused" | "network") {
    super(message);
    this.name = "AiUnavailable";
  }
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";

/**
 * SERVER ONLY. The key is read here and nowhere else, from a variable with no `NEXT_PUBLIC_` prefix, so it
 * cannot reach a browser bundle. The guard is belt and braces: a module that reads a secret should say so
 * loudly if it is ever imported somewhere it must not be.
 */
function apiKey(): string {
  if (typeof window !== "undefined") throw new AiUnavailable("The AI client must never run in a browser.", "refused");
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiUnavailable("AI drafting is not configured on this server.", "unconfigured");
  return key;
}

export const draftModel = () => process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

/** The body, split out so a test can read what is actually sent without a network call. */
export function requestBody(messages: Message[], model = draftModel()) {
  return {
    model,
    messages,
    stream: true,
    /* Retention refused at the routing layer, on this request, every time. */
    provider: { zdr: true },
    temperature: 0.4,
    max_tokens: 700,
  };
}

/** One Server-Sent Events line from OpenRouter to zero or one pieces of text. */
export function pieceFromLine(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
    return j.choices?.[0]?.delta?.content ?? null;
  } catch {
    /* A partial frame is normal mid-stream; the reader will hand it back with its other half. */
    return null;
  }
}

export const openRouter: DraftProvider = {
  async *stream(messages, signal) {
    const key = apiKey();
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          /* OpenRouter attributes traffic by these; they carry no client data. */
          "HTTP-Referer": "https://bizplanhq.com",
          "X-Title": "BizPlanHQ",
        },
        body: JSON.stringify(requestBody(messages)),
      });
    } catch {
      throw new AiUnavailable("Could not reach the AI service. Try again in a moment.", "network");
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      /*
       * A model with no zero-retention endpoint is the one failure worth naming precisely, because the
       * answer is "choose a different model", not "try again" (§6.105.3).
       */
      if (/zdr|zero.?data.?retention|no (allowed )?(endpoints|providers)/i.test(detail)) {
        throw new AiUnavailable(
          `No zero-retention provider can serve ${draftModel()}, so the request was refused rather than routed to one that stores your plan. Choose a different model in Plan settings.`,
          "no_zdr_endpoint",
        );
      }
      throw new AiUnavailable(`The AI service refused the request (${res.status}).`, "refused");
    }

    const reader = res.body.getReader();
    const decode = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decode.decode(value, { stream: true });
      const lines = buffer.split("\n");
      /* The last element is whatever arrived without its newline yet — keep it for the next chunk. */
      buffer = lines.pop() ?? "";
      for (const l of lines) {
        const piece = pieceFromLine(l);
        if (piece) yield piece;
      }
    }
  },
};
