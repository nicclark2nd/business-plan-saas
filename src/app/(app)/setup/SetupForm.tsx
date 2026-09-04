"use client";

import { useActionState, useState } from "react";
import { completeSetup } from "../actions";

const KINDS = [
  { value: "owner", title: "I run this business", desc: "I'm building a plan for my own business." },
  { value: "coach", title: "I'm a business coach", desc: "I'll build plans with my clients, one or many at a time." },
  { value: "consultant", title: "I'm a consultant", desc: "I deliver plans as part of an engagement." },
  { value: "accounting_firm", title: "We're an accounting firm", desc: "We add planning to the work we do for clients." },
];

export function SetupForm() {
  const [state, action, pending] = useActionState(completeSetup, undefined);
  const [kind, setKind] = useState("owner");
  const advisor = kind !== "owner";
  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">Which best describes you?</legend>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <label key={k.value} className={`cursor-pointer rounded-md border p-3 ${kind === k.value ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong"}`}>
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
              <div className="text-[13px] font-semibold">{k.title}</div>
              <div className="mt-0.5 text-xs text-muted">{k.desc}</div>
            </label>
          ))}
        </div>
      </fieldset>
      {advisor && (
        <div className="field"><label htmlFor="org_name">Your practice or firm name</label><input id="org_name" name="org_name" placeholder="e.g. Laidlaw Coaching" required /></div>
      )}
      <div className="field">
        <label htmlFor="business_name">{advisor ? "First client business to plan for" : "Business name"}</label>
        <input id="business_name" name="business_name" placeholder="e.g. DesignOne Concreting" required />
        {advisor && <p className="mt-1 text-xs text-muted">You&apos;ll be able to add more clients and invite them to their own login afterwards.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field"><label htmlFor="country">Country</label>
          <select id="country" name="country" defaultValue="Australia">
            {["Australia","United States","New Zealand","United Kingdom","Canada","Singapore","Other"].map((c) => <option key={c}>{c}</option>)}
          </select></div>
        <div className="field"><label htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue="AUD">
            {["AUD","USD","NZD","GBP","CAD","SGD","EUR"].map((c) => <option key={c}>{c}</option>)}
          </select></div>
      </div>
      {state?.error && <p className="rounded bg-bad-soft px-3 py-2 text-[13px] text-bad">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Setting up…" : "Create my plan →"}</button>
    </form>
  );
}
