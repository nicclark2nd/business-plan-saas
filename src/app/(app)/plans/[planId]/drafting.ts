import "server-only";
import { createClient } from "@/lib/supabase/server";
import { gatherReport } from "./reports/gather";
import { planDraft } from "@/engine/ai/draft";
import { DRAFTABLE } from "@/engine/ai/fields";
import type { Drafting } from "@/components/module/DraftField";

/**
 * WHAT EACH DRAFT BUTTON ON A STEP MAY CLAIM, WORKED OUT ON THE SERVER (§6.109).
 *
 * §6.106.1 put this loop in `vision/page.tsx`; Marketing wanted the same loop, so it moves here rather
 * than being written twice (§6.41). Every step that grows a draft button calls this one function.
 *
 * THE CAPTION IS COMPUTED BY THE SAME CHECK THAT DECIDES WHAT IS SENT. That is the point of doing it here
 * and not in the browser: the line under a button is produced by `planDraft` from the same assembly the
 * report is built from, so it cannot promise a client "will use your products" seven steps before products
 * exist, which is exactly what the stub it replaced did (§6.87).
 *
 * IT FAILS SOFT, AND IT FAILS TOWARDS SILENCE. Drafting switched off, a plan too empty to gather, a key
 * not in `DRAFTABLE` — none of them breaks the step. A field the client cannot draft simply has no button.
 *
 * Returns a map keyed by field. Absent means "no button, by design"; null means "draftable, but drafting
 * is off for this plan"; an object means "here is the button and what it will ask". `DraftField` renders
 * those three cases and a module needs to know nothing about which of its fields are draftable.
 */
export async function draftingFor(planId: string, keys: readonly string[]): Promise<Drafting> {
  const known = keys.filter((k) => k in DRAFTABLE);
  if (!known.length) return {};

  const supabase = await createClient();
  const { data } = await supabase.from("plan_settings").select("ai_enabled").eq("plan_id", planId).maybeSingle();

  /* Off is not an error and not a gap: every draftable field reports itself draftable-but-off. */
  const off: Drafting = Object.fromEntries(known.map((k) => [k, null]));
  if (!data?.ai_enabled) return off;

  try {
    const { input } = await gatherReport(planId);
    return Object.fromEntries(known.map((k) => {
      const d = planDraft(input, DRAFTABLE[k]);
      return [k, { caption: d.caption, questions: d.questions }];
    }));
  } catch (e) {
    /*
     * A plan that will not gather is a real fault worth logging, but it is not this button's to report:
     * the step still has to open and the client still has to be able to type. They get the same line they
     * would get with drafting switched off, which is the one that points somewhere useful.
     */
    console.error("drafting", planId, e);
    return off;
  }
}
