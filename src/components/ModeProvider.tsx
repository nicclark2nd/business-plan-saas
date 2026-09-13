"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
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
  // useOptimistic keeps the switch instant while the write is still in flight, and falls back to the
  // server's value if the write fails — so the button never lies about what was actually saved.
  const [mode, show] = useOptimistic<Mode, Mode>(initial, (_, next) => next);

  const setMode = (next: Mode) => {
    if (next === mode) return;
    start(async () => {
      show(next);
      await persistMode(next);
    });
  };

  return <Ctx.Provider value={{ mode, setMode, saving: pending }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
