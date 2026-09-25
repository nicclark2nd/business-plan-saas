/**
 * WHERE A `next=` PARAMETER IS ALLOWED TO SEND SOMEBODY (§6.119).
 *
 * Two places took a redirect target from the client and neither checked it properly. The auth callback did
 * not check at all; sign-in checked `next.startsWith("/")`, which is the intuitive test and is wrong:
 *
 *     "//evil.com".startsWith("/")    -> true   ->  resolves to https://evil.com
 *     "/\\evil.com".startsWith("/")   -> true   ->  resolves to https://evil.com
 *
 * So `https://bizplanhq.com/auth/callback?code=…&next=//evil.com` was a link on our own domain that landed
 * the client on someone else's. The session is established here first, so it leaks no token — it is a
 * phishing primitive, and a good one, because the domain in the link is genuine and the client has just
 * been told by our own email to click it.
 *
 * > **THE ONLY RELIABLE TEST IS TO RESOLVE THE URL AND ASK WHERE IT ENDED UP.** Every string-prefix
 * > version of this check has now been written twice in this codebase and been wrong both times, which is
 * > why it is one function with tests rather than a condition at each call site (§6.41).
 *
 * Resolution happens against a SENTINEL base rather than the real origin, deliberately. It makes the
 * function pure and testable, it needs no origin plumbed into a server action that does not otherwise have
 * one, and it cannot accidentally pass because the attacker guessed the deployment's hostname. The answer
 * is always a relative path, so the caller supplies the origin and there is nothing for a caller to get
 * wrong either.
 */

/** Not a registrable TLD (RFC 2606), so nothing can ever resolve here by accident. */
const SENTINEL = "https://sentinel.invalid";

export function safeNext(next: string | null | undefined, fallback = "/setup"): string {
  if (typeof next !== "string" || !next.trim()) return fallback;
  try {
    const dest = new URL(next, SENTINEL);
    /* Anything that changed the origin was absolute, protocol-relative, or a scheme we do not want. */
    if (dest.origin !== SENTINEL) return fallback;
    return `${dest.pathname}${dest.search}${dest.hash}`;
  } catch {
    return fallback;
  }
}
