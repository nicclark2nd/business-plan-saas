"use client";

import { useRef } from "react";

/**
 * SAVES FOR ONE ROW, ONE AT A TIME, IN ORDER (§6.129.3).
 *
 * The capacity measures and the add-backs used to save when focus left the ROW. Found on the built screen:
 * Tab out of the last box and focus lands on the row's own remove button — still inside the row — so the
 * save never ran, and the footer went on saying "All changes saved" over a figure that was never stored.
 * The one message a client cannot afford to miss, missed (§6.98).
 *
 * So each box saves as it is left. That opens the opposite fault: leave the name, then the figure, quickly,
 * and two saves race — both see no id yet and both INSERT, and the row is stored twice. This runs a row's
 * saves in a queue, each reading the row as it stands when its turn comes, so the second save finds the id
 * the first one created.
 */
export function useSerialSave() {
  const chains = useRef(new Map<string, Promise<void>>());
  return (key: string, job: () => Promise<void>): Promise<void> => {
    const prev = chains.current.get(key) ?? Promise.resolve();
    const next = prev.then(job, job);
    chains.current.set(key, next);
    return next;
  };
}
