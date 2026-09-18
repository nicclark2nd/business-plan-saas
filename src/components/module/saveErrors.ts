"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * What the app does when a save fails (§6.98).
 *
 * THE FAULT THIS REPLACES, in Nic's words: *"a failed save reports itself in the footer of a long form, far
 * from where you're typing."* He lost three fields to it — typed a tagline, a contact email and a website
 * against a table that had no columns for them, and the app said "All changes saved" while none of it saved.
 *
 * The audit found five faults in one place, not one:
 *
 *  1. The message rendered in `text-muted-foreground` — the SAME styling as "All changes saved". Even when
 *     shown, it did not look like an error.
 *  2. Eleven `edit()` handlers called `setError(undefined)` on every keystroke, so typing one more character
 *     erased the reason.
 *  3. Five more cleared it at the top of the next save attempt, so RETRYING erased it.
 *  4. Overheads and COGS never cleared it at all, so a stale error masked every later success.
 *  5. Every multi-row module collapsed N errors to the first with `.find()`, and Plan settings had three
 *     sources — profile, licence, logo — racing into one slot and overwriting each other.
 *
 * > **A FAILED SAVE IS THE ONE MESSAGE A CLIENT CANNOT AFFORD TO MISS, AND IT WAS THE ONE THE APP WHISPERED.**
 * > Everything else on these screens can be discovered later. Data that did not save cannot.
 *
 * THE RULES THIS ENFORCES:
 *
 *  - **An error is KEYED.** Two failures are two entries, not one that wins. A key is whatever failed —
 *    "profile", "logo", a row id — so a licence error and a logo error can be on screen together.
 *  - **Only a successful save of the SAME key clears it.** Not a keystroke, not a different row, not
 *    starting another attempt. The client's edit is what is being defended; nothing that happens to them
 *    while they read should remove the explanation.
 *  - **It carries where it happened.** `field` names the control so the screen can put the message beside
 *    it, and `label` names the thing so a summary can list it.
 */
export type SaveError = {
  /** What failed. Stable across retries so a retry replaces its own error rather than adding one. */
  key: string;
  message: string;
  /** The field this belongs beside, where there is one. */
  field?: string;
  /** How to name it in a summary — "Rent", "John Frankel", "Business profile". */
  label?: string;
};

export type SaveErrors = {
  list: SaveError[];
  /** Record a failure. A second failure under the same key replaces the first — it is the same thing. */
  raise: (e: SaveError) => void;
  /** Clear one key. Called ONLY from a successful save of that key (§6.98). */
  clear: (key: string) => void;
  /** Everything gone — a reload, or a whole area saved clean. Used sparingly and never from an edit handler. */
  clearAll: () => void;
  /** The message for one field, so a `Field` can render it beside the control. */
  forField: (field: string) => string | undefined;
  /** The message for one key, for a row. */
  forKey: (key: string) => string | undefined;
};

/**
 * The list operations, as plain functions so the RULES can be tested rather than the React around them
 * (§6.98). A retry replaces its own entry; a clear removes one key and touches nothing else; and both
 * return the same array when nothing changed, so React does not re-render for a no-op.
 */
export const raiseIn = (list: SaveError[], e: SaveError): SaveError[] =>
  [...list.filter((x) => x.key !== e.key), e];

export const clearIn = (list: SaveError[], key: string): SaveError[] =>
  list.some((x) => x.key === key) ? list.filter((x) => x.key !== key) : list;

export function useSaveErrors(): SaveErrors {
  const [list, setList] = useState<SaveError[]>([]);

  const raise = useCallback((e: SaveError) => setList((xs) => raiseIn(xs, e)), []);
  const clear = useCallback((key: string) => setList((xs) => clearIn(xs, key)), []);

  const clearAll = useCallback(() => setList((xs) => (xs.length ? [] : xs)), []);

  return useMemo(() => ({
    list,
    raise,
    clear,
    clearAll,
    forField: (field: string) => list.find((x) => x.field === field)?.message,
    forKey: (key: string) => list.find((x) => x.key === key)?.message,
  }), [list, raise, clear, clearAll]);
}

/** What the footer says when something is outstanding. Counted, because "an error" hides that there are four. */
export const errorSummary = (list: SaveError[]): string | null => {
  if (list.length === 0) return null;
  return list.length === 1
    ? "1 change didn't save"
    : `${list.length} changes didn't save`;
};
