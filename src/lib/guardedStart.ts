"use client";

/**
 * A SAVE THAT THROWS MUST NOT TAKE THE SCREEN WITH IT (§6.136, open item 25).
 *
 * Every save in the app returns `{ ok: false, error }` when the server refuses it, and every screen shows
 * that. What was never driven live is the other kind of failure: the request that never arrives — Wi-Fi
 * drops, the laptop sleeps, the server is restarting. A server action then REJECTS instead of returning,
 * the rejection escapes the transition, and React hands it to the error boundary. Tested on Goals by
 * failing the request on purpose: the whole screen was replaced by "Failed to fetch", and what the client
 * had just typed went with it.
 *
 * `guarded(start, onFail)` is `start` with the rejection caught and turned into a sentence the screen
 * already knows how to show. The text stays in the box because nothing clears it, so leaving the box again
 * retries.
 */
export const UNREACHABLE =
  "Couldn't reach the server, so your last change isn't saved yet. It's still on screen — try it again once you're back online.";

/**
 * Next signals a redirect (and a not-found) by THROWING an error whose digest starts `NEXT_`. That is not a
 * failure: "Save and continue" ends in one, and catching it would strand the client on the screen they just
 * finished. It is rethrown untouched (§6.138).
 */
const isNavigation = (e: unknown) =>
  !!e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_");

/**
 * `onOk` runs when the job completes without throwing — the place to clear an earlier "couldn't reach the
 * server" once the connection is back. It says nothing about whether the SERVER accepted the save; each
 * screen still reports its own `{ ok: false }` answers as before.
 */
export function guarded(
  start: (fn: () => Promise<void>) => void,
  onFail: (message: string) => void,
  onOk?: () => void,
) {
  return (fn: () => Promise<void> | void) => start(async () => {
    try { await fn(); onOk?.(); }
    catch (e) {
      if (isNavigation(e)) throw e;
      console.error("save did not reach the server", e);
      onFail(UNREACHABLE);
    }
  });
}
