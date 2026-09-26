"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { setMode as persistMode } from "@/app/(app)/actions";

/**
 * Guided vs Advanced is a *view* preference (§6.22).
 *
 * It changes which items the sidebar lists and whether the help rail starts open. It does not change a
 * single figure on any screen. The first version nonetheless persisted it with `revalidatePath`, which threw
 * away the whole route and re-ran the layout and the page — about 39 round trips to Supabase — to redraw the
 * same numbers. Measured at just over two seconds a click.
 *
 * So the mode lives on the client. The toggle flips instantly, and the preference is written to the profile
 * in the background where nobody is waiting on it. The server still seeds the value on first render, so a
 * reload or a new tab comes up in the mode the user chose.
 */
export type Mode = "guided" | "advanced";

const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void; saving: boolean }>({
  mode: "guided", setMode: () => {}, saving: false,
});

export function ModeProvider({ initial, children }: { initial: Mode; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  // Plain state, not useOptimistic. An optimistic value is only held for the life of the transition and
  // then falls back to whatever the server last rendered — and since this deliberately does not revalidate,
  // the server's value never catches up, so the switch snapped straight back to Guided every time. The
  // client owns the mode for the session; the write only has to say if it failed.
  const [mode, show] = useState<Mode>(initial);

  const setMode = (next: Mode) => {
    if (next === mode) return;
    const previous = mode;
    show(next);                                  // instant, and it stays
    start(async () => {
      /* A request that never arrived is a preference that did not save, not a reason to crash (§6.138). */
      const saved = await persistMode(next).catch(() => false);
      if (!saved) show(previous);                // revert only if the preference genuinely did not save
    });
  };

  return <Ctx.Provider value={{ mode, setMode, saving: pending }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
