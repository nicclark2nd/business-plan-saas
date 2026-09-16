"use client";

import { useRef } from "react";

/**
 * A save that cannot be started twice (§6.51).
 *
 * A dialog's Save button calls a server action and closes the dialog when it returns. Between those two
 * moments the button is still there, still enabled, and the draft it holds still carries its temporary id —
 * so a second click does not update the row the first click created, it INSERTS A SECOND ONE. Nic clicked
 * Save twice on one equipment loan and the plan took 60,000 of debt, two lenders called Citibank, and two
 * excavators. Everything downstream was right: Fixed Assets faithfully showed one asset per loan, and the
 * unique index did its job, because there really were two loans.
 *
 * The guard is a ref rather than the transition's `pending`, because `pending` only becomes true after a
 * render — and two clicks can land inside one frame. A ref is set in the same tick as the first click, so
 * the second has something to hit.
 *
 * Use it around the body of a save, not around the click:
 *
 *     const once = useSaveOnce();
 *     const save = (next: Row) => start(once(async () => { ... }));
 */
export function useSaveOnce() {
  const busy = useRef(false);
  return (run: () => Promise<unknown>) => async () => {
    if (busy.current) return;
    busy.current = true;
    try { await run(); } finally { busy.current = false; }
  };
}
