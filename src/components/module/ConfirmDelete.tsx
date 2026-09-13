"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * One delete confirmation for the whole app (§6.24).
 *
 * The rule it enforces: **a row carrying figures the forecast uses is never deleted silently.** Sales
 * products, fixed costs, people, competitors and marketing spend all ask first; a single line of free text —
 * a SWOT item, a piece of evidence — does not, because a dialog there is friction that teaches people to
 * click through dialogs without reading, which is what makes the dangerous ones dangerous.
 *
 * And it names the consequence rather than asking "are you sure". "Are you sure" tells the client nothing
 * they did not already know; "contributes 141,372 to Year 1 sales, and its price, growth, monthly split and
 * cost go with it" is the sentence that actually stops the wrong click.
 *
 * Pass `blocked` when the row cannot go at all because something else is built on it (§6.24.1). The delete
 * button is then absent rather than disabled — a button you cannot press invites hunting for the way round
 * it, where a plain sentence explaining what to do first does not.
 */
export function ConfirmDelete({ title, what, blocked, onCancel, onConfirm }: {
  /** What is being deleted, named — "Delete Carports?" */
  title: string;
  /** What goes with it, in the client's terms. Not "this cannot be undone". */
  what: React.ReactNode;
  /** When set, the row is not deletable: this says what depends on it and what to do first. */
  blocked?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{blocked ? title.replace(/^Delete /, "Can't delete ").replace(/\?$/, "") : title}</DialogTitle>
          <DialogDescription>{blocked ?? what}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {blocked ? (
            <Button size="sm" type="button" onClick={onCancel}>Got it</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" type="button" onClick={onCancel}>Keep it</Button>
              <Button variant="destructive" size="sm" type="button" onClick={onConfirm}>Delete</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
