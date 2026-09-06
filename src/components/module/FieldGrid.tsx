"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * One-record form grid for a module area (mockup: .section + .fields). Six columns; a field spans 1–6.
 * Same save policy as grids: text saves when focus leaves it, choices save on selection (§6.10).
 */
export function Section({ title, children, tail }: { title: string; children: React.ReactNode; tail?: React.ReactNode }) {
  return (
    <div className="px-5 pb-1.5 pt-3.5">
      <h2 className="mb-2.5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">{title}<span className="h-px flex-1 bg-border" />{tail}</h2>
      {children}
    </div>
  );
}
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-6 gap-x-4 gap-y-3 max-[1280px]:grid-cols-3 max-[900px]:grid-cols-2">{children}</div>;
}
export function Field({ label, span = 1, hint, children }: { label: string; span?: 1 | 2 | 3 | 4 | 6; hint?: string; children: React.ReactNode }) {
  const cols = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4", 6: "col-span-6 max-[1280px]:col-span-3 max-[900px]:col-span-2" }[span];
  return (
    <div className={cn(cols, span === 2 && "max-[900px]:col-span-2", span >= 3 && span < 6 && "max-[1280px]:col-span-3 max-[900px]:col-span-2")}>
      <label className="mb-[3px] block text-[11.5px] font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
export function FieldInput({ className, numeric, ...props }: React.ComponentProps<typeof Input> & { numeric?: boolean }) {
  return <Input {...props} inputMode={numeric ? (props.inputMode ?? "decimal") : props.inputMode} className={cn("h-8", numeric && "num text-right", className)} />;
}
export function FieldTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={cn("min-h-[64px]", className)} />;
}
export type SelectOption = { value: string; label: string };
export type SelectGroupDef = { group: string; note?: string; items: SelectOption[] };
export function FieldSelect({ value, onValueChange, options, groups, placeholder, className }: {
  value: string | null | undefined; onValueChange: (v: string) => void; options?: SelectOption[]; groups?: SelectGroupDef[]; placeholder?: string; className?: string;
}) {
  const all = groups ? groups.flatMap((g) => g.items) : (options ?? []);
  return (
    <Select value={value ?? null} onValueChange={(v) => v !== null && onValueChange(String(v))}>
      <SelectTrigger className={cn("h-8 w-full", className)}><SelectValue placeholder={placeholder}>{all.find((o) => o.value === value)?.label ?? value ?? placeholder}</SelectValue></SelectTrigger>
      <SelectContent className="max-h-[420px]">
        {groups
          ? groups.map((g, i) => (
              <SelectGroup key={g.group}>
                {i > 0 && <SelectSeparator />}
                <SelectLabel className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{g.group}{g.note && <span className="ml-2 font-normal normal-case tracking-normal text-faint">— {g.note}</span>}</SelectLabel>
                {g.items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectGroup>
            ))
          : all.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
