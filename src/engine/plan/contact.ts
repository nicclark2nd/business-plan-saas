/**
 * The business's own contact details, as printed on the cover of its plan (§6.96).
 *
 * Both are optional and both are TYPED BY A CLIENT, which is the whole design problem: somebody will write
 * "www.example.com.au", somebody else "https://example.com.au/", and the cover has to print one of them
 * next to the other without looking like two different kinds of thing.
 *
 * So there are two answers for each, deliberately: what is STORED is what the client typed, cleaned only of
 * whitespace, because it is theirs; what is PRINTED is a tidied form. Storing the tidied version would throw
 * away what they wrote, and a client who typed a full URL with a path would find it quietly shortened.
 */

/**
 * Deliberately loose. A cover is not a login form: the cost of refusing a real address a regex has not heard
 * of is far higher than the cost of printing an odd-looking one, and there is nobody to send mail to here —
 * this address is printed, never used. So: something, an @, something with a dot, and no spaces.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const checkEmail = (raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } => {
  const v = String(raw ?? "").trim();
  if (!v) return { ok: true, value: null };
  if (!EMAIL.test(v)) return { ok: false, error: "That does not look like an email address — it needs an @ and a domain." };
  return { ok: true, value: v };
};

/** Same bargain: a host with a dot in it, nothing more. A scheme and a path are allowed and kept. */
export const checkWebsite = (raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } => {
  const v = String(raw ?? "").trim();
  if (!v) return { ok: true, value: null };
  if (/\s/.test(v)) return { ok: false, error: "A web address cannot contain spaces." };
  const host = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0];
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) {
    return { ok: false, error: "That does not look like a web address — it needs a domain, e.g. example.com." };
  }
  return { ok: true, value: v };
};

/**
 * What the cover prints: no scheme, no "www.", no trailing slash. A cover is read, not clicked, and
 * "https://www.actioncoach.com/" beside an email address is three pieces of punctuation nobody needs.
 */
export function websiteForPrint(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const bare = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  return bare || null;
}

/** A clickable form for the screen, where it IS clicked. Assumes https where the client gave no scheme. */
export const websiteHref = (raw: string | null | undefined): string | null => {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
};

/**
 * The one line at the foot of the cover. Joined with a middle dot, and — the point of the function — it
 * produces NOTHING rather than a stray separator when only one of the two is set.
 */
export const contactLine = (email: string | null | undefined, website: string | null | undefined): string | null => {
  const parts = [String(email ?? "").trim(), websiteForPrint(website) ?? ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};
