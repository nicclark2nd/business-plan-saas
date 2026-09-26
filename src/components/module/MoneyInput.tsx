"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { groupDigits } from "@/lib/grouped";

/**
 * 1,000,000 IN EVERY MONEY BOX (§6.130, open item 41).
 *
 * Grouped while the box is not being edited, as typed while it is, so commas never appear under the cursor.
 * Works for both shapes of box in the app:
 *
 * - **Controlled** (`value`): only what is painted changes; the module's own string is untouched.
 * - **Uncontrolled** (`defaultValue`, read on blur): the box starts grouped, the commas come out when it is
 *   focused, the module's `onBlur` reads the plain figure, and the commas go back in afterwards.
 *
 * Every money parser in the app strips commas, so a pasted "1,000,000" saves either way; stripping them on
 * focus is for the person typing, not for the parser.
 */
type Props = { value?: unknown; defaultValue?: unknown; onFocus?: React.FocusEventHandler<HTMLInputElement>; onBlur?: React.FocusEventHandler<HTMLInputElement> };

export function useGrouped(money: boolean | undefined, props: Props) {
  const [editing, setEditing] = React.useState(false);
  if (!money) return {};
  const controlled = props.value !== undefined;
  return {
    ...(controlled
      ? { value: !editing && typeof props.value === "string" ? groupDigits(props.value) : props.value as string }
      : props.defaultValue !== undefined ? { defaultValue: groupDigits(String(props.defaultValue)) } : {}),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setEditing(true);
      if (!controlled) e.currentTarget.value = e.currentTarget.value.replace(/,/g, "");
      props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setEditing(false);
      props.onBlur?.(e);
      if (!controlled) e.currentTarget.value = groupDigits(e.currentTarget.value);
    },
  };
}

/** A plain `Input` that reads as money. Use where a module builds its own box rather than FieldInput/CellInput. */
export function MoneyInput(props: React.ComponentProps<typeof Input>) {
  const shown = useGrouped(true, props);
  return <Input {...props} {...shown} inputMode={props.inputMode ?? "decimal"} />;
}
