import "server-only";

/**
 * WHAT A CLIENT IS TOLD WHEN A WRITE FAILS, AND WHAT ONLY THE LOG IS TOLD (§6.120).
 *
 * Forty-nine places used to do this:
 *
 *     return { ok: false, error: `Couldn't save: ${error.message}` };
 *
 * §6.98 was right that a failed save is the one message a client cannot afford to miss. But
 * `error.message` from PostgREST carries column names, constraint names, table names and sometimes the
 * offending value, and all of it went on screen. Two separate problems in one line:
 *
 * 1. **It is free reconnaissance.** Anyone probing learns the shape of the schema from its refusals.
 * 2. **It is useless to the person reading it.** "duplicate key value violates unique constraint
 *    plan_goals_area_key" tells a concreter nothing they can act on, and it is frightening in a way the
 *    actual problem is not.
 *
 * The detail still exists and still matters — it goes to `console.error`, where whoever is debugging can
 * read it and the client never has to.
 *
 * `doing` is an infinitive phrase: "save the licence", "remove that row", "load last year's figures". It
 * reads correctly in the log line and in the sentence, which is why it is one argument and not two.
 *
 * NO CLAIM IS MADE ABOUT WHAT SURVIVED. The obvious flourish is "nothing was lost" — and it would be a
 * lie in at least one place, because `setPrimaryPremise` writes twice and the second write can fail after
 * the first succeeded. A message that reassures wrongly is worse than one that simply says what happened.
 */

export type Failure = { ok: false; error: string };

export function failed(e: unknown, doing: string): Failure {
  console.error(doing, e);
  return { ok: false, error: `Couldn't ${doing}. Try again.` };
}
