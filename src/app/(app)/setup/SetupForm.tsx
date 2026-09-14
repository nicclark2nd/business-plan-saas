"use client";

import { useActionState, useState } from "react";
import { completeSetup } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_LONG, currentFinancialYear, planYearLabel } from "@/engine/plan/calendar";
import { FormError } from "@/components/FormMessage";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "owner", title: "I run this business", desc: "I'm building a plan for my own business." },
  { value: "coach", title: "I'm a business coach", desc: "I'll build plans with my clients, one or many at a time." },
  { value: "consultant", title: "I'm a consultant", desc: "I deliver plans as part of an engagement." },
  { value: "accounting_firm", title: "We're an accounting firm", desc: "We add planning to the work we do for clients." },
];
const COUNTRIES = ["Australia", "United States", "New Zealand", "United Kingdom", "Canada", "Singapore", "Other"];
const CURRENCIES = ["AUD", "USD", "NZD", "GBP", "CAD", "SGD", "EUR"];

export function SetupForm() {
  const [state, action, pending] = useActionState(completeSetup, undefined);
  const [kind, setKind] = useState("owner");
  const [country, setCountry] = useState("Australia");
  const [currency, setCurrency] = useState("AUD");
  // The plan's financial year, asked once, here (§6.33.2). Everything downstream reads these two and the
  // client never has to find them in Settings to make Year 1 mean what they think it means.
  const [fyEnd, setFyEnd] = useState("6");
  const firstYear = currentFinancialYear(Number(fyEnd));
  const advisor = kind !== "owner";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="financial_year_end_month" value={fyEnd} />
      <input type="hidden" name="first_projected_year" value={String(firstYear)} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">Which best describes you?</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {KINDS.map((k) => (
            <button
              type="button" key={k.value} role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
              className={cn("rounded-md border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                kind === k.value ? "border-primary bg-accent" : "border-border hover:border-input")}
            >
              <div className="text-[13px] font-semibold">{k.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{k.desc}</div>
            </button>
          ))}
        </div>
      </fieldset>

      {advisor && (
        <div className="space-y-1.5"><Label htmlFor="org_name">Your practice or firm name</Label><Input id="org_name" name="org_name" placeholder="e.g. Laidlaw Coaching" required /></div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="business_name">{advisor ? "First client business to plan for" : "Business name"}</Label>
        <Input id="business_name" name="business_name" placeholder="e.g. DesignOne Concreting" required />
        {advisor && <p className="text-xs text-muted-foreground">You&apos;ll be able to add more clients and invite them to their own login afterwards.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Country</Label>
          <Select value={country} onValueChange={(v) => v && setCountry(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label>Currency</Label>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select></div>
      </div>
      <div className="space-y-1.5">
        <Label>Financial year ends in</Label>
        <Select value={fyEnd} onValueChange={(v) => v && setFyEnd(v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTH_LONG.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Year 1 of the plan will run <b>{planYearLabel(firstYear, Number(fyEnd))}</b> — the year the business is in. You can change it in Plan settings.
        </p>
      </div>
      <FormError>{state?.error}</FormError>
      <Button type="submit" disabled={pending}>{pending ? "Setting up…" : "Create my plan →"}</Button>
    </form>
  );
}
