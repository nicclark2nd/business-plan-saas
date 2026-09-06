"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ModuleFrame, ModuleStatusFooter, useModule } from "@/components/module/ModuleFrame";
import { Section, FieldGrid, Field, FieldInput, FieldTextarea, FieldSelect } from "@/components/module/FieldGrid";
import { Toolbar, Meta } from "@/components/module/DataGrid";
import { formatMonth } from "../people/model";
import { saveProfile, saveFinancial } from "./actions";
import { legalStructuresFor, CUSTOMER_TYPES, PRODUCT_TYPES, COUNTRIES, CURRENCIES, MONTHS, profileMissing, type Settings, type Profile, type Financial } from "./model";

type AreaKey = "profile" | "financial" | "branding";
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function SettingsModule({ planId, initial, mode, initialArea }: { planId: string; initial: Settings; mode: "guided" | "advanced"; initialArea: AreaKey }) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [s, setS] = useState(initial);
  const [established, setEstablished] = useState(formatMonth(initial.date_established));
  const [dirty, setDirty] = useState<"profile" | "financial" | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const ref = useRef(s); useEffect(() => { ref.current = s; }, [s]);
  const estRef = useRef(established); useEffect(() => { estRef.current = established; }, [established]);

  // §6.10: text saves when focus leaves the area; choices save on selection.
  const edit = (changes: Partial<Settings>, which: "profile" | "financial", immediate = false) => {
    setS((x) => ({ ...x, ...changes })); setDirty(which); setError(undefined);
    if (immediate) queueMicrotask(() => commit(which));
  };
  const commit = (which: "profile" | "financial" | null) => {
    if (!which) return;
    setDirty(null);
    start(async () => {
      const res = which === "profile"
        ? await saveProfile(planId, { ...(ref.current as Profile), established_text: estRef.current })
        : await saveFinancial(planId, ref.current as Financial);
      if (!res.ok) { setError(res.error); setDirty(which); }
      else if (res.data && "date_established" in res.data) { setS((x) => ({ ...x, date_established: res.data!.date_established })); setEstablished(formatMonth(res.data.date_established)); }
    });
  };
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);
  const missing = profileMissing(s);

  return (
    <ModuleFrame
      group="Plan settings" title="Plan settings" subtitle="Who the business is, how its year runs, and how the plan is branded" mode={mode}
      areas={[
        { key: "profile", label: "Business profile", ...(missing.length ? { count: missing.length } : {}) },
        { key: "financial", label: "Financial year & tax" },
        { key: "branding", label: "Branding", tag: "Soon" },
      ]}
      area={area} onArea={(k) => { commit(dirty); setArea(k as AreaKey); }}
      scope={{ label: s.business_name || "This plan" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>Why this matters</h3>
        <p>The profile opens the business overview in every report; a lender reads legal structure and years trading before a single number. Type of customer and product only change the words the app uses — &quot;clients&quot; instead of &quot;customers&quot; — so pick what your industry says.</p>
        <h3>Financial year &amp; tax</h3>
        <p>Year 1 of the plan is the financial year ending in the plan year. Tax rate is applied to profit in the forecast; dividend % is the share of after-tax profit paid to owners.</p>
        <h3>Where working-capital and cash-flow assumptions went</h3>
        <p>Debtor, stock and creditor days, tax timing and CapEx are forecast assumptions, not settings. They live with the forecast, defaulted from your historic figures.</p>
      </>}
    >
      <PendingBridge pending={pending} dirty={!!dirty} error={error} />

      {area === "profile" && (
        <div onBlur={(e) => left(e) && dirty === "profile" && commit("profile")}>
          <Toolbar><Meta className="ml-0">{missing.length ? <>Reports need {missing.length} more field{missing.length === 1 ? "" : "s"}: <b>{missing.map((k) => k.replace(/_/g, " ").replace("products services statement", "products & services")).join(", ")}</b>.</> : "Everything a report&apos;s business overview needs is here."}</Meta></Toolbar>
          <Section title="Business">
            <FieldGrid>
              <Field label="Business name" span={2}><FieldInput value={s.business_name} onChange={(e) => edit({ business_name: e.target.value }, "profile")} /></Field>
              <Field label="Industry" span={2}><FieldInput value={s.industry ?? ""} placeholder="e.g. Commercial concreting" onChange={(e) => edit({ industry: e.target.value }, "profile")} /></Field>
              <Field label="Date established"><FieldInput value={established} placeholder="month year" onChange={(e) => { setEstablished(e.target.value); setDirty("profile"); }} /></Field>
              <Field label="Main country of operation"><FieldSelect value={s.country} options={opts(COUNTRIES)} placeholder="Choose" onValueChange={(v) => edit({ country: v }, "profile", true)} /></Field>
              <Field label="Legal structure" span={2} hint="Grouped by liability; your country's names come first."><FieldSelect value={s.legal_structure} groups={legalStructuresFor(s.country)} placeholder="Choose" onValueChange={(v) => edit({ legal_structure: v }, "profile", true)} /></Field>
              <Field label="Type of customer" span={2} hint="Changes the word the app uses for the people you sell to."><FieldSelect value={s.customer_type} options={opts(CUSTOMER_TYPES)} placeholder="Choose" onValueChange={(v) => edit({ customer_type: v }, "profile", true)} /></Field>
              <Field label="Type of product sold" span={2}><FieldSelect value={s.product_type} options={PRODUCT_TYPES} placeholder="Choose" onValueChange={(v) => edit({ product_type: v }, "profile", true)} /></Field>
              <Field label="Products & services statement" span={6} hint="Two or three sentences: what you sell, to whom, and why they choose you. Opens the business overview in the report."><FieldTextarea value={s.products_services_statement ?? ""} onChange={(e) => edit({ products_services_statement: e.target.value }, "profile")} /></Field>
            </FieldGrid>
          </Section>
        </div>
      )}

      {area === "financial" && (
        <div onBlur={(e) => left(e) && dirty === "financial" && commit("financial")}>
          <Toolbar><Meta className="ml-0">Plan year FY{s.plan_year}: Year 1 runs {MONTHS[s.financial_year_end_month % 12]} {s.financial_year_end_month === 12 ? s.plan_year : s.plan_year - 1} → {MONTHS[s.financial_year_end_month - 1]} {s.plan_year}.</Meta></Toolbar>
          <Section title="Financial year">
            <FieldGrid>
              <Field label="Financial year ends in" span={2}><FieldSelect value={String(s.financial_year_end_month)} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} onValueChange={(v) => edit({ financial_year_end_month: Number(v) }, "financial", true)} /></Field>
              <Field label="First projected year" hint="Leave blank to use the plan year."><FieldInput numeric inputMode="numeric" value={s.first_projected_year ?? ""} placeholder="plan year" onChange={(e) => edit({ first_projected_year: Number(e.target.value.replace(/\D/g, "")) || null }, "financial")} /></Field>
              <Field label="Currency"><FieldSelect value={s.currency} options={opts(CURRENCIES)} onValueChange={(v) => edit({ currency: v }, "financial", true)} /></Field>
            </FieldGrid>
          </Section>
          <Section title="Tax and distributions">
            <FieldGrid>
              <Field label="Company tax rate %" hint="Applied to profit before tax in the forecast."><FieldInput numeric value={String(s.tax_rate)} onChange={(e) => edit({ tax_rate: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }, "financial")} /></Field>
              <Field label="Dividend %" hint="Share of after-tax profit paid out to owners."><FieldInput numeric value={String(s.dividend_rate)} onChange={(e) => edit({ dividend_rate: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }, "financial")} /></Field>
            </FieldGrid>
          </Section>
        </div>
      )}

      {area === "branding" && (
        <>
          <Toolbar><Meta className="ml-0">Your logo goes on the report cover and page headers.</Meta></Toolbar>
          <Section title="Logo">
            <p className="text-[13px] text-muted-foreground">Logo upload arrives with the Reports step, so it lands where you can see it used.</p>
          </Section>
        </>
      )}
    </ModuleFrame>
  );
}

function PendingBridge({ pending, dirty, error }: { pending: boolean; dirty: boolean; error?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(error ? error : pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the field" : undefined), [pending, dirty, error, setNote]);
  return null;
}
