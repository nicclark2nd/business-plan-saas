"use client";

import { useRef } from "react";
import { useSerialSave } from "./serialSave";

/**
 * ROW GRIDS THAT SAVE AS EACH BOX IS LEFT (§6.131, open item 39).
 *
 * Every row grid used to save when focus left the ROW. Tab out of the last box and focus lands on the row's
 * own remove button — still inside the row — so the save never ran, and the footer said "All changes
 * saved" over a figure that was never stored (§6.98). The add-backs and capacity measures were moved to
 * per-box saves in §6.129.3; this is the same fix, made once, for the grids that share one shape: rows
 * with a temporary `tmp-…` id until their first save gives them a real one.
 *
 * THREE THINGS PER-BOX SAVING NEEDS THAT PER-ROW SAVING GOT AWAY WITHOUT.
 *
 * 1. **A queue per row.** Leave two boxes quickly and two saves race; both see no id and both INSERT.
 *    Saves for one row run in order, so the second one finds the id the first created.
 * 2. **One name per row.** A row is `tmp-abc` until it is stored and a uuid after, and a save queued under
 *    the old name must still find it. `realId` answers "what is this row called in the database" from
 *    either name, and `same` matches a row by either.
 * 3. **A key that does not change.** The id changing under React's key rebuilt the row mid-typing and threw
 *    the cursor out of the box the client had just moved into (§6.125). `keyOf` keeps the first name for
 *    the life of the screen.
 */
export function useRowSaves() {
  const serial = useSerialSave();
  const born = useRef(new Map<string, string>());   // tmp → stored id
  const first = useRef(new Map<string, string>());  // stored id → tmp it was born as

  const keyOf = (id: string) => first.current.get(id) ?? id;
  return {
    /** A stable React key for a row, whichever name it currently has. */
    keyOf,
    /** Whether two ids name the same row. */
    same: (a: string, b: string) => a === b || keyOf(a) === keyOf(b),
    /** The row's id in the database, or undefined if it has never been stored. */
    realId: (id: string) => (id.startsWith("tmp-") ? born.current.get(id) : id),
    /** Record that a row saved for the first time under `stored`. */
    adopt: (tmp: string, stored: string) => {
      if (!tmp.startsWith("tmp-")) return;
      born.current.set(tmp, stored);
      first.current.set(stored, tmp);
    },
    /** Run a save for one row after any save already running for it. */
    queue: (scope: string, id: string, job: () => Promise<void>) => serial(`${scope}:${keyOf(id)}`, job),
  };
}
