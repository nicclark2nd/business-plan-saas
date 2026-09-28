"use client";

import { useActionState, useState } from "react";
import { completeSetup } from "../actions";
import { addClient } from "../firm/actions";
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
/* The same two lists Plan settings offers — one list, one place (§6.41). This copy had drifted to seven. */
import { COUNTRIES, CURRENCIES } from "@/app/(app)/plans/[planId]/settings/model";
import { countryDefault, followCountry } from "@/engine/plan/countryDefaults";

/**
 * `forFirm` (§6.182): My Clients → Add new business. The same form without "which best describes you" and the
 * firm's name — the consultant's firm already exists — and starting from the firm's own country and currency.
 */
export function SetupForm({ forFirm }: { forFirm?: { country: string | null; currency: string } } = {}) {
  const [state, action, pending] = useActionState(forFirm ? addClient : completeSetup, undefined);
  const [kind, setKind] = useState(forFirm ? "coach" : "owner");
  const [country, setCountry] = useState(forFirm?.country ?? "Australia");
  const [currency, setCurrency] = useState(forFirm?.currency ?? "AUD");
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

      {!forFirm && <fieldset>
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
      </fieldset>}

      {advisor && !forFirm && (
        <div className="space-y-1.5"><Label htmlFor="org_name">Your practice or firm name</Label><Input id="org_name" name="org_name" placeholder="e.g. Laidlaw Coaching" required /></div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="business_name">{forFirm ? "Client business" : advisor ? "First client business to plan for" : "Business name"}</Label>
        <Input id="business_name" name="business_name" placeholder="e.g. DesignOne Concreting" required />
        {advisor && !forFirm && <p className="text-xs text-muted-foreground">You&apos;ll be able to add more clients and invite them to their own login afterwards.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Country</Label>
          {/* The currency follows the country unless it has been changed by hand (§6.151). */}
          <Select value={country} onValueChange={(v) => {
            if (!v) return;
            const moved = followCountry(country, v, { currency, tax_rate: countryDefault(country)?.taxRate ?? null });
            if (moved.currency) setCurrency(moved.currency);
            setCountry(v);
          }}>
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
          {/* The month's name, not its number — the box read "6" for June. */}
          <SelectTrigger className="w-full"><SelectValue>{MONTH_LONG[Number(fyEnd) - 1]}</SelectValue></SelectTrigger>
          <SelectContent>{MONTH_LONG.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The plan covers <b>{firstYear}–{firstYear + 4}</b>. {firstYear} · Year 1 runs {planYearLabel(firstYear, Number(fyEnd))}; your last full year of accounts is {firstYear - 1}. You can change it in Plan settings.
        </p>
      </div>
      <FormError>{state?.error}</FormError>
      <Button type="submit" disabled={pending}>{pending ? "Setting up…" : forFirm ? "Add this business →" : "Create my plan →"}</Button>
    </form>
  );
}
