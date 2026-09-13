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
 */
export function ConfirmDelete({ title, what, onCancel, onConfirm }: {
  /** What is being deleted, named — "Delete Carports?" */
  title: string;
  /** What goes with it, in the client's terms. Not "this cannot be undone". */
  what: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{what}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Keep it</Button>
          <Button variant="destructive" size="sm" type="button" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
