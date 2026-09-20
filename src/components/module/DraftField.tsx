"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DraftDialog, type DraftQuestion } from "./DraftDialog";

/**
 * THE DRAFT BUTTON, ONCE, FOR EVERY MODULE THAT HAS ONE (§6.109).
 *
 * §6.106.1 wired this by hand into the Vision form, which was right for one screen. Marketing is the
 * second, and seven more steps are queued behind it — so the wiring (open state, the dialog, the caption,
 * the line that appears when drafting is switched off) moves here before it is written a third time
 * (§6.41). A module now renders one element per field and holds no drafting state at all.
 *
 * THREE STATES, AND THE THIRD IS THE ONE THAT MATTERS.
 *
 *   `offer` is an object  → the field is draftable and drafting is on: button and caption.
 *   `offer` is null       → the field is draftable but drafting is OFF for this plan: say where to turn it on.
 *   `offer` is undefined  → the field has NO button by design, and never will: say nothing.
 *
 * That last distinction is the whole reason this is a three-way and not a boolean. Market size has no
 * button because no model should be inventing a market size; telling a client "drafting is off" under it
 * would send them to Plan settings to switch on something that was never going to appear. Silence there is
 * the honest answer, and it is decided by the server, which is the only place that knows both halves.
 */

/** What the server worked out for one field: the caption it may claim, and what it will ask first. */
export type DraftOffer = { caption: string; questions: DraftQuestion[] } | null;

/**
 * Keyed by field. A key that is ABSENT means "not draftable" — so a module passes this straight through
 * from the page and never keeps a second list of which of its fields have buttons.
 */
export type Drafting = Record<string, DraftOffer | undefined>;

export function DraftField({
  planId, field, offer, value, onUse, row,
}: {
  planId: string;
  /** The screen's own field definition. Nothing about the field is written again here. */
  field: { key: string; label: string; sub?: string; hint?: string };
  offer: DraftOffer | undefined;
  /** The box's current text, so the dialog can say whether Use replaces something. */
  value: string;
  /**
   * The draft goes back to the FORM, not to the database (§6.106.1) — it lands in the box as a suggestion
   * and the screen's own save runs when focus leaves, exactly as it does when the client types.
   */
  onUse: (text: string) => void;
  /**
   * For a field that is about one row — a product, a competitor, a process step — that row's own name
   * (§6.113). The server resolves it against the saved plan and refuses if it finds nothing, so a name
   * typed into a dialog and not saved yet gets a clear message rather than a passage about nothing.
   */
  row?: string;
}) {
  const [open, setOpen] = useState(false);

  if (offer === undefined) return null;

  if (offer === null) {
    return (
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        Drafting is off for this plan. Turn it on in{" "}
        <a className="font-semibold text-primary hover:underline" href={`/plans/${planId}/settings?area=ai`}>Plan settings</a>.
      </p>
    );
  }

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>✦ Suggest a draft</Button>
        <span className="text-[11.5px] text-muted-foreground">{offer.caption}</span>
      </div>
      {open && (
        <DraftDialog
          planId={planId} fieldKey={field.key} row={row} label={field.label} sub={field.sub} hint={field.hint}
          questions={offer.questions} hasText={!!value.trim()}
          onUse={onUse} onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
