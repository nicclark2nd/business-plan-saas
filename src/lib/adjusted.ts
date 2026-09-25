import "server-only";

/**
 * WHAT A SAVE CHANGED ON THE WAY IN (§6.123).
 *
 * §6.121 taught Plan settings to hand back the row it stored; §6.122 did the same for Sales. Both wrote
 * the same twenty lines: compare what was sent against what came back, keep the differences, name them
 * with the wording on the screen. Funding and Fixed Assets would have been the third and fourth copies, so
 * it moves here first (§6.41) — and the two that already exist move onto it, because a helper extracted
 * from two call sites and used by only the new ones is not a helper, it is a third copy.
 *
 * THE CLAMPS ARE NOT THE FAULT AND THIS DOES NOT REMOVE THEM. A 99999% tax rate, a client staying 9999
 * months, a facility smaller than the amount drawn against it — all of those are worse inside the forecast
 * than refused at the door. What was wrong was that the door closed silently.
 */

export type Adjustment = { label: string; from: string; to: string };

/** A field that is clamped on the way in, named as the screen names it. */
export type Watched<K> = { key: K; label: string };

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The fields that came back different from what was sent.
 *
 * Only numbers, and only a difference the client can see. An unreadable entry becoming 0 is not news worth
 * a sentence — they typed something that was never a number and the box will show them so. `sentKey` maps
 * a screen's field name to the column it is stored in, for the modules where those differ (Funding calls
 * one thing `amount` and stores it in five differently named columns).
 */
export function adjustments<S extends object, T extends object>(
  sent: S,
  stored: T,
  watched: readonly Watched<keyof T & string>[],
  sentKey: (key: keyof T & string) => keyof S & string = (k) => k as unknown as keyof S & string,
): Adjustment[] {
  return watched.flatMap(({ key, label }) => {
    const from = num(sent[sentKey(key)]);
    const to = num(stored[key]);
    return from !== null && to !== null && from !== to
      ? [{ label, from: String(from), to: String(to) }]
      : [];
  });
}

/**
 * The sentence the footer shows, or nothing.
 *
 * `subject` names the row on a screen that holds many — "Driveways: Average price can't be…". Plan
 * settings has one row and passes nothing, because "Financial year & tax:" in front of its own message
 * would be the screen telling a client which screen they are looking at.
 */
export function adjustedNote(list: Adjustment[], subject?: string): string | undefined {
  if (!list.length) return undefined;
  const body = list.map((a) => `${a.label} can't be ${a.from} — saved as ${a.to}.`).join(" ");
  return subject ? `${subject}: ${body}` : body;
}
