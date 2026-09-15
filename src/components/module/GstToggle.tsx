"use client";

import { cn } from "@/lib/utils";

/**
 * Whether this line carries GST / VAT (§6.38).
 *
 * One control, used identically on a product, a fixed cost, an overhead and an asset, because the question
 * is the same in all four places and a client should not have to learn it four times.
 *
 * **It renders nothing at all when the business is not registered.** A sole trader under the threshold
 * should never be asked whether their rent is taxable — the question only exists once registration is on,
 * and a dialog that asks it anyway is a dialog that has been made harder to use for no one's benefit.
 *
 * The wording differs between a sale and a purchase on purpose: what a business CHARGES and what it CLAIMS
 * are different acts, and the exemptions are different too. An export is a GST-free sale; a bank fee is a
 * purchase with no GST to claim. Naming the common cases is what stops the flag being left on out of
 * uncertainty, which is the failure mode that silently overstates cash.
 */
export function GstToggle({ registered, label, kind, checked, onChange, className }: {
  registered: boolean;
  /** GST, VAT or Sales tax — whatever the tax is called where the business trades. */
  label: string;
  kind: "sale" | "purchase";
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  if (!registered) return null;
  return (
    <label className={cn("flex items-start gap-2 text-[13px]", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] size-3.5 shrink-0 accent-primary" />
      <span>
        {kind === "sale" ? `${label} is charged on this` : `${label} is charged on this, and you claim it back`}
        <span className="ml-2 text-[11.5px] text-muted-foreground">
          {kind === "sale"
            ? `Clear it for a ${label}-free sale — an export, basic food, a medical service.`
            : `Clear it where there is no ${label} to claim — bank fees and interest, most government charges, wages.`}
        </span>
      </span>
    </label>
  );
}

/** The same fact on a list row, so an exempt line can be seen without opening it. */
export function GstFreeTag({ registered, label, applies }: { registered: boolean; label: string; applies: boolean }) {
  if (!registered || applies) return null;
  return (
    <span className="ml-2 rounded-full border border-border px-1.5 text-[10.5px] font-semibold text-muted-foreground">
      no {label}
    </span>
  );
}
