"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Dense editable grid primitives for module areas (mockup: table.list). Cells edit in place: borderless until
 * hover, framed on focus. Saving policy lives in the module (save once when focus leaves a row — §6.10).
 */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-2 border-b border-border px-5 py-2.5", className)}>{children}</div>;
}
export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("ml-auto text-xs text-muted-foreground", className)}>{children}</span>;
}
export function Note({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-2.5 text-xs text-muted-foreground">{children}</div>;
}

export function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className="overflow-x-auto"><table className={cn("w-full table-fixed border-collapse text-[13px]", className)}>{children}</table></div>;
}
export function Th({ children, className, right, style }: { children?: React.ReactNode; className?: string; right?: boolean; style?: React.CSSProperties }) {
  return (
    <th style={style} className={cn("sticky top-0 z-[1] whitespace-nowrap border-b border-input bg-secondary px-3 py-[7px] text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground first:pl-5 last:pr-5", right && "text-right", className)}>
      {children}
    </th>
  );
}
export function Td({ children, className, right, wrap, colSpan, rowSpan, style, title }: { children?: React.ReactNode; className?: string; right?: boolean; wrap?: boolean; colSpan?: number; rowSpan?: number; style?: React.CSSProperties; title?: string }) {
  return (
    <td colSpan={colSpan} rowSpan={rowSpan} style={style} title={title} className={cn("h-9 border-b border-border px-3 first:pl-5 last:pr-5", wrap ? "whitespace-normal py-1" : "whitespace-nowrap", right && "text-right", className)}>
      {children}
    </td>
  );
}
export function Row({ children, className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("hover:[&>td]:bg-secondary/60", className)} {...props}>{children}</tr>;
}
export function FootRow({ children }: { children: React.ReactNode }) {
  return <tfoot><tr className="[&>td]:border-t-2 [&>td]:border-input [&>td]:bg-secondary [&>td]:font-bold">{children}</tr></tfoot>;
}
/** Group header row (one per person in an all-people scope). */
export function GroupRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return <tr><td colSpan={colSpan} className="h-8 border-b border-border bg-secondary px-5 font-semibold"><div className="flex items-center gap-3">{children}</div></td></tr>;
}

/** A name that sets the scope. */
export function NameLink({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={cn("font-semibold text-primary hover:underline", className)}>{children}</button>;
}
export function LinkButton({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={cn("text-xs font-semibold text-primary hover:underline", className)}>{children}</button>;
}
export function RemoveButton({ onClick, title = "Remove" }: { onClick: () => void; title?: string }) {
  return <button type="button" onClick={onClick} title={title} aria-label={title} className="px-1 text-[15px] leading-none text-muted-foreground/70 hover:text-bad">×</button>;
}

/** Focus the first real text control in a new row (skips the hidden inputs shadcn Select renders). */
export function focusRow(selector: string) {
  setTimeout(() => document.querySelector<HTMLElement>(`${selector} input:not([type="hidden"]):not([aria-hidden="true"]), ${selector} textarea`)?.focus(), 0);
}

const cell = "h-7 rounded-[3px] border-transparent bg-transparent px-1.5 py-1 text-[13px] shadow-none hover:border-input focus-visible:bg-card";

/** In-place text cell. `numeric` → right-aligned, tabular figures, numeric keyboard, no spinner (§6.9). */
export function CellInput({ className, numeric, ...props }: React.ComponentProps<typeof Input> & { numeric?: boolean }) {
  return <Input {...props} inputMode={numeric ? (props.inputMode ?? "decimal") : props.inputMode} className={cn(cell, numeric && "num text-right", className)} />;
}

/** In-place choice cell. Saves on selection (the module passes onValueChange). */
export function CellSelect({ value, onValueChange, options, className, placeholder, disabled }: {
  value: string | null | undefined; onValueChange: (v: string) => void; options: { value: string; label: string }[];
  className?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <Select value={value ?? null} onValueChange={(v) => v !== null && onValueChange(String(v))} disabled={disabled}>
      <SelectTrigger size="sm" className={cn("w-full", cell, className)}>
        <SelectValue placeholder={placeholder}>{options.find((o) => o.value === value)?.label ?? value ?? placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/** In-place multi-line cell for anything that is a sentence: two lines tall from the start, fixed width, grows down (§6.9). */
export function CellTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea rows={2} autoComplete="off" data-1p-ignore="" data-lpignore="true" data-bwignore="" data-form-type="other" data-keeper-ignore=""
      className={cn("block w-full resize-none rounded-[3px] border border-transparent bg-transparent px-1.5 py-1 text-[13px] leading-[1.4] outline-none field-sizing-content min-h-[46px] hover:border-input focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/50", className)}
      {...props} />
  );
}
