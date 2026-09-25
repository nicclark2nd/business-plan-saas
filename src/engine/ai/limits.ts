/**
 * WHAT A DRAFT REQUEST IS ALLOWED TO BE (§6.119).
 *
 * The routes took `body.answers` straight from the request and passed it into the prompt. There was no cap
 * on how many answers, no cap on how long one could be, and no check that the array held what it claimed.
 *
 * > `max_tokens` limits what the model WRITES. Input tokens are billed too, and nothing limited those.
 *
 * A dialog cannot produce more than three short answers, so a request carrying a thousand long ones did
 * not come from the app. Clamping here costs a real client nothing and removes the amplification: without
 * it, one POST could carry megabytes into a paid API, and there was no rate limit behind it either.
 *
 * It hardens the parsing as well, which is the quieter win. `body.answers` was typed but never validated,
 * so a malformed body — `answers: "hello"`, or an array of nulls — reached `buildMessages` and threw
 * somewhere further in, where the error said nothing useful about why.
 */

/** Three questions is the cap a field can ask (`MAX_QUESTIONS`); Goals asks two. Four leaves room. */
export const MAX_ANSWERS = 4;
/** A sentence or two is what the dialog asks for. 2000 characters is roughly two pages. */
export const MAX_ANSWER_CHARS = 2000;
/** The question text is ours, echoed back by the browser. It only needs to survive the round trip. */
export const MAX_QUESTION_CHARS = 300;
/** A row is matched against a name the client typed on a screen, not free text. */
export const MAX_ROW_CHARS = 200;

export type Answer = { question: string; answer: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Whatever arrived, as at most `MAX_ANSWERS` well-formed answers. Never throws: a request that is the
 * wrong shape becomes an empty list, and the draft goes ahead with the plan's own context — which is what
 * a client with nothing typed into the questions gets anyway.
 */
export function boundAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_ANSWERS)
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      question: str(a.question, MAX_QUESTION_CHARS),
      answer: str(a.answer, MAX_ANSWER_CHARS),
    }));
}

/** The row a field is about, bounded. Anything else is not a name this plan can hold. */
export const boundRow = (raw: unknown): string => str(raw, MAX_ROW_CHARS);

/**
 * HOW MANY DRAFTS ONE PLAN MAY ASK FOR IN A DAY.
 *
 * Deliberately generous against real use and fatal to a script. A client writing a whole plan in one
 * sitting touches perhaps thirty fields and retries a few, and Goals is one press for six passages. A
 * hundred and twenty is several times that, and still bounds the worst case to something survivable.
 *
 * Per PLAN rather than per user: it is the plan that has a paying customer behind it, and a user with ten
 * plans is doing ten plans' worth of legitimate work.
 */
export const DRAFTS_PER_PLAN_PER_DAY = 120;
