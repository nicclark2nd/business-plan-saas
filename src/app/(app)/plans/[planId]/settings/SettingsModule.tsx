"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ModuleFrame, ModuleStatusFooter, useModule } from "@/components/module/ModuleFrame";
import { useSaveErrors } from "@/components/module/saveErrors";
import { Section, FieldGrid, Field, FieldInput, FieldSelect, FieldTextarea } from "@/components/module/FieldGrid";
import { Input } from "@/components/ui/input";
import { Toolbar, Meta, Grid, Th, Td, Row as GridRow } from "@/components/module/DataGrid";
import { currentFinancialYear, firstProjectedYear, planYearEnding, planYearLabel } from "@/engine/plan/calendar";
import { taxComponents, taxHeading } from "@/engine/plan/gst";
import { needsRegion, regimeFor, regionLabel, regionsFor, type TaxComponent } from "@/engine/plan/taxRegimes";
import { formatMonth } from "../people/model";
import { saveProfile, saveFinancial, savePrinting, saveAiConsent } from "./actions";
import { PAGE_SIZE_LABEL, defaultPageSizeFor } from "@/engine/report/pageSize";
import { DangerArea, type PlanInventory } from "./DangerArea";
import { LicenceSection } from "./LicenceSection";
import { LogoSection } from "./LogoSection";
import { legalStructuresFor, CUSTOMER_TYPES, PRODUCT_TYPES, COUNTRIES, CURRENCIES, MONTHS, profileMissing, type Settings, type Profile, type Financial, type Licence } from "./model";
import { navGroup } from "@/lib/nav";
import { governingLawNote } from "@/engine/plan/jurisdiction";

type AreaKey = "profile" | "financial" | "printing" | "ai" | "branding" | "lifecycle";
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function SettingsModule({ planId, initial, mode, initialArea, licences, logoUrl, archivedAt, inventory }: {
  planId: string; initial: Settings; mode: "guided" | "advanced"; initialArea: AreaKey;
  /** What the business itself is licensed, registered or insured to do (§6.64). */
  licences: Licence[];
  /** A signed URL for the plan's logo, minted on the server for this request (§6.94). */
  logoUrl: string | null;
  /** When the plan was put away, or null (§6.58). */
  archivedAt: string | null;
  /** What the plan holds, so deleting it can say so rather than asking "are you sure?". */
  inventory: PlanInventory;
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  const [s, setS] = useState(initial);
  const [established, setEstablished] = useState(formatMonth(initial.date_established));
  const [dirty, setDirty] = useState<"profile" | "financial" | null>(null);
  /**
   * THREE SOURCES, THREE KEYS (§6.98). Profile, licences and the logo used to race into one `error` slot
   * and overwrite each other, so a licence that would not save could be erased by a logo that would not
   * either. Keyed, they sit side by side until each is fixed.
   */
  const errors = useSaveErrors();
  const [pending, start] = useTransition();
  const ref = useRef(s); useEffect(() => { ref.current = s; }, [s]);
  const estRef = useRef(established); useEffect(() => { estRef.current = established; }, [established]);

  // §6.10: text saves when focus leaves the area; choices save on selection.
  /*
   * TYPING DOES NOT CLEAR A FAILURE (§6.98). This called `setError(undefined)` on every keystroke, so the
   * reason a save failed was gone before a client could read it — which is exactly how three cover fields
   * were typed into a table with no columns for them and nobody was told. Only a successful save of the
   * same thing clears it, in `commit` below.
   */
  const edit = (changes: Partial<Settings>, which: "profile" | "financial", immediate = false) => {
    setS((x) => ({ ...x, ...changes })); setDirty(which);
    if (immediate) queueMicrotask(() => commit(which));
  };
  const commit = (which: "profile" | "financial" | null) => {
    if (!which) return;
    setDirty(null);
    start(async () => {
      const res = which === "profile"
        ? await saveProfile(planId, { ...(ref.current as Profile), established_text: estRef.current })
        : await saveFinancial(planId, ref.current as Financial);
      if (!res.ok) {
        errors.raise({
          key: which, message: res.error, field: "field" in res ? res.field : undefined,
          label: which === "profile" ? "Business profile" : "Financial year & tax",
        });
        setDirty(which);
      } else {
        errors.clear(which);
        if (res.data && "date_established" in res.data) { setS((x) => ({ ...x, date_established: res.data!.date_established })); setEstablished(formatMonth(res.data.date_established)); }
      }
    });
  };
  const left = (e: React.FocusEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node);
  /* Neither printing control is typed, so there is no field to leave — both save on the choice itself. */
  const editPrinting = (changes: Partial<Settings>) => {
    const next = { ...ref.current, ...changes };
    setS(next);
    start(async () => {
      const res = await savePrinting(planId, next);
      if (!res.ok) errors.raise({ key: "printing", message: res.error, label: "How the plan prints" });
      else errors.clear("printing");
    });
  };
  /*
   * A CONSENT SAVES LIKE A CONSENT (§6.106): the switch is all the client sends, and the server writes who
   * and when. It reports under its own error key so a failure here cannot erase a failure elsewhere.
   */
  const editAi = (enabled: boolean) => {
    setS((x) => ({ ...x, ai_enabled: enabled }));
    start(async () => {
      const res = await saveAiConsent(planId, enabled);
      if (!res.ok) { errors.raise({ key: "ai", message: res.error, label: "AI drafting" }); setS((x) => ({ ...x, ai_enabled: !enabled })); }
      else errors.clear("ai");
    });
  };
  const missing = profileMissing(s);
  /**
   * The licence list saves on its own schedule, so it reports its own state up rather than sharing `dirty`.
   * One PendingBridge per module: two of them race and the footer flickers between "Saving" and "Saved".
   */
  const [licBusy, setLicBusy] = useState(false);
  const raise = errors.raise, clear = errors.clear;
  /** Licences and the logo report under their own keys, so neither can erase the other (§6.98). */
  const onLicPending = useCallback((busy: boolean, e?: string) => {
    setLicBusy(busy);
    if (e) raise({ key: "licences", message: e, label: "Licences" }); else clear("licences");
  }, [raise, clear]);
  const onLogoPending = useCallback((busy: boolean, e?: string) => {
    setLicBusy(busy);
    if (e) raise({ key: "logo", message: e, label: "Logo" }); else clear("logo");
  }, [raise, clear]);

  return (
    <ModuleFrame
      group={navGroup("settings")} title="Plan settings" subtitle="Who the business is, how its year runs, and how the plan is branded" mode={mode}
      errors={errors}
      areas={[
        { key: "profile", label: "Business profile", ...(missing.length ? { count: missing.length } : {}) },
        { key: "financial", label: "Financial year & tax" },
        { key: "printing", label: "How the plan prints" },
        { key: "ai", label: "AI drafting" },
        { key: "branding", label: "Branding" },
        { key: "lifecycle", label: "Archive & delete" },
      ]}
      area={area} onArea={(k) => { commit(dirty); setArea(k as AreaKey); }}
      scope={{ label: s.business_name || "This plan" }}
      footer={<ModuleStatusFooter planId={planId} />}
      help={<>
        <h3>Why this matters</h3>
        <p>The profile opens the business overview in every report; a lender reads legal structure and years trading before a single number. Type of customer and product only change the words the app uses — &quot;clients&quot; instead of &quot;customers&quot; — so pick what your industry says.</p>
        <h3>Financial year &amp; tax</h3>
        <p>Year 1 of the plan is the financial year ending in the plan year. Tax rate is applied to profit in the forecast; dividend % is the share of after-tax profit paid to owners.</p>
        <h3>Archive or delete</h3>
        <p>Archiving takes a plan off your list and changes nothing in it — the right answer for a client you have finished with. Deleting destroys every figure, goal and forecast in the plan and cannot be undone, so it asks you to type the business name first.</p>
        <h3>Where working-capital and cash-flow assumptions went</h3>
        <p>Debtor, stock and creditor days, tax timing and CapEx are forecast assumptions, not settings. They live with the forecast, defaulted from your historic figures.</p>
      </>}
    >
      <PendingBridge pending={pending || licBusy} dirty={!!dirty} />

      {area === "profile" && (
        <div onBlur={(e) => left(e) && dirty === "profile" && commit("profile")}>
          <Toolbar><Meta className="ml-0">{missing.length ? <>Reports need {missing.length} more field{missing.length === 1 ? "" : "s"}: <b>{missing.map((k) => k.replace(/_/g, " ")).join(", ")}</b>.</> : "Everything a report\u2019s business overview needs is here."}</Meta></Toolbar>
          <Section title="Business">
            <FieldGrid>
              <Field label="Business name" span={2} error={errors.forField("business_name")}><FieldInput value={s.business_name} onChange={(e) => edit({ business_name: e.target.value }, "profile")} /></Field>
              <Field label="Industry" span={2}><FieldInput value={s.industry ?? ""} placeholder="e.g. Commercial concreting" onChange={(e) => edit({ industry: e.target.value }, "profile")} /></Field>
              <Field label="Date established"><FieldInput value={established} placeholder="month year" onChange={(e) => { setEstablished(e.target.value); setDirty("profile"); }} /></Field>
              <Field label="Plan year" hint="The year on the front cover of the report — not the financial year."><FieldInput numeric inputMode="numeric" value={s.plan_year ?? ""} onChange={(e) => edit({ plan_year: Number(e.target.value.replace(/\D/g, "")) || 0 }, "profile")} /></Field>
              {/* Moving country resets the taxes that came with the old one — enforced in `saveProfile`, so
                  it holds whichever screen changes the country (§6.39.1). */}
              {/*
                THE COUNTRY NOW DECIDES THE LEGAL NOTICE TOO (§6.95.1), so the screen says what it will say.
                A field with a consequence a client cannot see is how a plan ends up governed by the laws of
                somewhere they picked in passing eighteen months ago.
              */}
              <Field label="Main country of operation"
                hint={governingLawNote(s.country, s.tax_region)
                  ? `The plan's legal notice will say it is governed by ${governingLawNote(s.country, s.tax_region)}.`
                  : "Also decides the sales tax, the paper the Word file prints on, and the legal notice on page two."}>
                <FieldSelect value={s.country} options={opts(COUNTRIES)} placeholder="Choose" onValueChange={(v) => edit({ country: v }, "profile", true)} />
              </Field>
              {/*
                ONE FIELD, NOT TWO (§6.96). This writes `tax_region` — the column that has always held a
                state or province — rather than a new "main state of operation" beside it. Two fields
                meaning one thing would give a Texas plan two answers, with the legal notice reading one
                and the tax rates the other (§6.41).

                It saves through the FINANCIAL saver even though it is rendered here, because that is what
                owns the column; and where the country's tax depends on the state, choosing one replaces
                the tax rates exactly as it did when this control lived in the tax section.
              */}
              <Field label="Main state of operation"
                hint={needsRegion(s.country) ? "Also sets the sales tax rates on the next tab." : "Optional. Printed in the plan's legal notice."}>
                {regionsFor(s.country).length
                  ? <FieldSelect value={s.tax_region ?? ""} placeholder={`Choose a ${regionLabel(s.country).toLowerCase()}`}
                      options={regionsFor(s.country).map((r) => ({ value: r, label: r }))}
                      onValueChange={(v) => edit({ tax_region: v, tax_components: regimeFor(s.country, v).components }, "financial", true)} />
                  : <FieldInput value={s.tax_region ?? ""} placeholder="e.g. Queensland"
                      onChange={(e) => edit({ tax_region: e.target.value }, "financial")}
                      onBlur={() => commit("financial")} />}
              </Field>
              <Field label="Legal structure" span={2} hint="Grouped by liability; your country's names come first."><FieldSelect value={s.legal_structure} groups={legalStructuresFor(s.country)} placeholder="Choose" onValueChange={(v) => edit({ legal_structure: v }, "profile", true)} /></Field>
              <Field label="Type of customer" span={2} hint="Changes the word the app uses for the people you sell to."><FieldSelect value={s.customer_type} options={opts(CUSTOMER_TYPES)} placeholder="Choose" onValueChange={(v) => edit({ customer_type: v }, "profile", true)} /></Field>
              <Field label="Type of product sold" span={2}><FieldSelect value={s.product_type} options={PRODUCT_TYPES} placeholder="Choose" onValueChange={(v) => edit({ product_type: v }, "profile", true)} /></Field>
              {/*
                ABOUT WHAT YOU SELL (§6.103) — asked here rather than at step 8.
                It was on the Sales screen, below a ten-row table, two-thirds of the way through the path:
                the one paragraph describing the business, asked after six steps that would have been easier
                for having read it. The column has always been on plan_settings, so nothing moved but the
                question.
              */}
              <Field label="About what you sell" span={4}
                hint="An elevator pitch in two or three sentences: what you sell, who buys it, and what it is worth to them. Not why the business exists — that is Mission, at step 1. Opens the products section of the report.">
                <FieldTextarea value={s.products_services_statement ?? ""} className="min-h-[72px]"
                  placeholder="e.g. We pour, finish and guarantee residential and light-commercial concrete for builders and homeowners across the South Coast. Quoted price is the final price, and a slab is poured within ten working days of the site being ready."
                  onChange={(e) => edit({ products_services_statement: e.target.value }, "profile")} /></Field>
            </FieldGrid>
          </Section>

          {/* Everything here is optional, and every line disappears from the cover when it is empty (§6.96). */}
          <Section title="On the cover">
            <FieldGrid>
              <Field label="Tagline" span={4} error={errors.forField("tagline")} hint="The line under your name on the cover. What the business does, in its own words — not the industry.">
                <FieldInput value={s.tagline ?? ""} placeholder="e.g. Concreting &amp; civil works" onChange={(e) => edit({ tagline: e.target.value }, "profile")} />
              </Field>
              <Field label="Contact email" span={2} error={errors.forField("contact_email")} hint="Printed at the foot of the cover. Not your sign-in address.">
                <FieldInput value={s.contact_email ?? ""} placeholder="e.g. hello@example.com" onChange={(e) => edit({ contact_email: e.target.value }, "profile")} />
              </Field>
              <Field label="Main website" span={2} error={errors.forField("website")} hint="Printed without the https:// and the www.">
                <FieldInput value={s.website ?? ""} placeholder="e.g. example.com" onChange={(e) => edit({ website: e.target.value }, "profile")} />
              </Field>
            </FieldGrid>
          </Section>
          <LicenceSection planId={planId} initial={licences} onPending={onLicPending} />
        </div>
      )}

      {area === "financial" && (
        <div onBlur={(e) => left(e) && dirty === "financial" && commit("financial")}>
          <Toolbar><Meta className="ml-0">
            <b>Year 1 runs {planYearLabel(firstProjectedYear(s.first_projected_year, s.financial_year_end_month), s.financial_year_end_month)}</b> — the year the business is in. Year 5 ends {planYearEnding(firstProjectedYear(s.first_projected_year, s.financial_year_end_month), 5)}.
            {s.first_projected_year === null && <span className="text-warn"> · First projected year is not set, so this is the financial year today falls in.</span>}
          </Meta></Toolbar>
          <Section title="Financial year">
            <FieldGrid>
              <Field label="Financial year ends in" span={2}><FieldSelect value={String(s.financial_year_end_month)} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} onValueChange={(v) => edit({ financial_year_end_month: Number(v) }, "financial", true)} /></Field>
              <Field label="First projected year" hint="The year Year 1 ends in. With these two fields the plan knows its own calendar."><FieldInput numeric inputMode="numeric" value={s.first_projected_year ?? ""} placeholder={String(currentFinancialYear(s.financial_year_end_month))} onChange={(e) => edit({ first_projected_year: Number(e.target.value.replace(/\D/g, "")) || null }, "financial")} /></Field>
              <Field label="Currency"><FieldSelect value={s.currency} options={opts(CURRENCIES)} onValueChange={(v) => edit({ currency: v }, "financial", true)} /></Field>
            </FieldGrid>
          </Section>
          <Section title="Tax and distributions">
            <FieldGrid>
              <Field label="Company tax rate %" hint="Applied to profit before tax in the forecast."><FieldInput numeric value={String(s.tax_rate)} onChange={(e) => edit({ tax_rate: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }, "financial")} /></Field>
              <Field label="Dividend %" hint="Share of after-tax profit paid out to owners. Never more than the company has made."><FieldInput numeric value={String(s.dividend_rate)} onChange={(e) => edit({ dividend_rate: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }, "financial")} /></Field>
              <Field label="Tax losses brought forward" hint="Unrelieved losses from before the plan. They come off the first profits the plan makes.">
                <FieldInput numeric value={String(s.opening_tax_losses)} onChange={(e) => edit({ opening_tax_losses: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }, "financial")} />
              </Field>
              <Field label="Accumulated profit at the start" hint="Profits already retained in the business. Negative if it is carrying a deficit. A dividend cannot exceed it.">
                <FieldInput numeric value={String(s.opening_retained_earnings)} onChange={(e) => edit({ opening_retained_earnings: Number(e.target.value.replace(/[^\d.-]/g, "")) || 0 }, "financial")} />
              </Field>
            </FieldGrid>
          </Section>
          {/* Tax (§6.39). Off is the default and changes nothing; on moves cash, never profit. */}
          <TaxSection s={s} edit={edit} />
        </div>
      )}

      {area === "lifecycle" && (
        <>
          <Toolbar><Meta className="ml-0">What happens to this plan when you are finished with it. Archiving is reversible; deleting is not.</Meta></Toolbar>
          <DangerArea planId={planId} planName={s.business_name || "this plan"} archivedAt={archivedAt} inventory={inventory} />
        </>
      )}

      {area === "printing" && (() => {
        const derived = defaultPageSizeFor(s.country);
        return (
        <>
          <Toolbar><Meta className="ml-0">Two decisions about the business plan document. Neither changes a figure — the forecast, the statements and the totals are the same either way.</Meta></Toolbar>
          <Section title="Leadership Team salaries">
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={s.print_key_people_salaries}
                onChange={(e) => editPrinting({ print_key_people_salaries: e.target.checked })}
                className="mt-[3px] size-3.5 shrink-0 accent-primary" />
              <span>
                The Financial Plan names each person and what they are paid
                {/*
                  THE WORDING IS THE POINT (§6.93). Clearing this does not hide the money and the screen must
                  not let a client believe it does — the total still prints, and a client who thinks a figure
                  is suppressed when it is not will send the document to the wrong person.
                */}
                <span className="mt-1 block text-[11.5px] text-muted-foreground">
                  Clear it and the salary table is left out, but the money is not hidden: <b>Leadership Team salaries</b> still
                  prints as one line in Overheads and still sits in the profit and loss. This controls whose name is against it.
                </span>
                <span className="mt-1 block text-[11.5px] text-muted-foreground">
                  On for a plan going to a bank or an investor. Off for a copy going to staff, or to someone you have not signed with yet.
                </span>
              </span>
            </label>
          </Section>
          <Section title="Page size">
            <FieldGrid>
              <Field label="Word download" span={2} hint="The screen version is unchanged — this is the .docx only.">
                <FieldSelect value={s.page_size ?? ""} options={[
                  { value: "", label: `Follow the country — ${PAGE_SIZE_LABEL[derived]}` },
                  { value: "a4", label: PAGE_SIZE_LABEL.a4 },
                  { value: "letter", label: PAGE_SIZE_LABEL.letter },
                ]} onValueChange={(v) => editPrinting({ page_size: v === "a4" || v === "letter" ? v : null })} />
              </Field>
              <Field label="" span={2}>
                <p className="pt-[22px] text-[11.5px] text-muted-foreground">
                  {s.page_size
                    ? <>Set for every copy of this plan, whatever the country says.</>
                    : <>{s.country ? <><b>{s.country}</b> uses {PAGE_SIZE_LABEL[derived].split(" — ")[0]}.</> : <>No country set, so A4.</>} Change the country and the paper follows it.</>}
                </p>
              </Field>
            </FieldGrid>
          </Section>
        </>
        );
      })()}

      {area === "ai" && (
        <>
          <Toolbar><Meta className="ml-0">Whether this plan&apos;s written sections can be drafted for you.</Meta></Toolbar>
          <Section title="Use AI to help draft this plan">
            {/*
              THE STATEMENT IS THE FEATURE, NOT THE TOGGLE (§6.106).
              Every sentence here is one the code actually keeps: the slices decide what is sent and a test
              proves names, wages and funding are in none of them. Nothing is claimed that is enforced only
              by a setting in somebody's dashboard.
            */}
            <label className="flex max-w-[760px] cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-[3px] size-4 accent-[var(--primary)]"
                checked={s.ai_enabled} onChange={(e) => editAi(e.target.checked)} />
              <span>
                <span className="block text-[13px] font-semibold">Let me ask for a draft of a written section</span>
                <span className="mt-1.5 block text-[12.5px] leading-[1.6] text-muted-foreground">
                  When this is on, you can ask for a draft of any written section. To do that we send the
                  relevant parts of this plan — your industry, what you sell, your market and your goals — to
                  an AI service, which returns suggested wording.
                </span>
                <span className="mt-1.5 block text-[12.5px] leading-[1.6] text-muted-foreground">
                  <b>We never send names, salaries or funding details.</b> Nothing is sent unless you press a
                  draft button. Every suggestion is yours to edit or discard, and nothing is saved to your
                  plan until you accept it.
                </span>
                <span className="mt-1.5 block text-[12.5px] leading-[1.6] text-muted-foreground">
                  The AI models are provided by third parties and may change over time.
                </span>
              </span>
            </label>
            {/* The record, shown rather than hidden: a client is entitled to see what they agreed to and when. */}
            {s.ai_enabled_at && (
              <p className="mt-4 text-[11.5px] text-muted-foreground">
                {s.ai_enabled
                  ? <>Turned on {new Date(s.ai_enabled_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}.</>
                  : <>Off. It was last turned on {new Date(s.ai_enabled_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} — that record is kept rather than erased.</>}
              </p>
            )}
          </Section>
        </>
      )}

      {area === "branding" && (
        <>
          <Toolbar><Meta className="ml-0">Your logo goes on the business plan&apos;s cover and the header of every page after it.</Meta></Toolbar>
          <LogoSection planId={planId} path={s.logo_path} url={logoUrl} onPending={onLogoPending} />
        </>
      )}
    </ModuleFrame>
  );
}

/** STATUS ONLY now (§6.98) — failure travels on its own channel and is rendered in red, not in this grey. */
function PendingBridge({ pending, dirty }: { pending: boolean; dirty: boolean }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => setNote(pending ? "Saving…" : dirty ? "Unsaved — saves when you leave the field" : undefined), [pending, dirty, setNote]);
  return null;
}

/**
 * The taxes this business charges (§6.39).
 *
 * Four markets, three different taxes, and one screen. The country is already on the Business profile, so
 * all this asks for is the state or province where that decides the answer — and it decides a great deal:
 * Ontario charges one reclaimable 13 % HST, British Columbia charges a 5 % GST it claims back plus a 7 %
 * PST it never does, and a US rate is a state rate plus whatever counties and cities add on top.
 *
 * The regime fills itself in and every figure stays editable, because a default that cannot be overridden
 * is a guess wearing a uniform. Nothing appears at all until registration is on.
 */
function TaxSection({ s, edit }: {
  s: Settings; edit: (patch: Partial<Settings>, area: "profile" | "financial", now?: boolean) => void;
}) {
  const regime = regimeFor(s.country, s.tax_region);
  const live = s.tax_components.length ? s.tax_components : regime.components;
  const heading = taxHeading(taxComponents({ ...s, gst_registered: true }));
  const wantsRegion = needsRegion(s.country);

  const setComponent = (i: number, patch: Partial<TaxComponent>) =>
    edit({ tax_components: live.map((c, j) => (j === i ? { ...c, ...patch } : c)) }, "financial");

  // "Sales tax / sales tax" is what a fixed suffix gives you in the United States (§6.39.1).
  return (
    <Section title={heading}>
      <FieldGrid>
        <Field label={`Registered for ${heading}`} hint="Off leaves the forecast exactly as it is. On, the tax rides on every sale and is remitted each period.">
          <FieldSelect value={s.gst_registered ? "yes" : "no"}
            options={[{ value: "no", label: "Not registered" }, { value: "yes", label: `Registered for ${heading}` }]}
            onValueChange={(v) => edit({ gst_registered: v === "yes" }, "financial", true)} />
        </Field>
        {/*
          THE STATE IS EDITED ON BUSINESS PROFILE, NOT HERE (§6.96). It used to be typed in this section,
          because tax was the only thing that needed it — and it therefore only existed for the United
          States and Canada, and only once a client had switched registration on. It is now a fact about
          the business rather than a detail of its tax, so it is asked once, up there, for every plan.
          This says where it came from, because the rates below depend on it; it does not offer a second
          place to change it (§6.41).
        */}
        {s.gst_registered && wantsRegion && (
          <Field label={regionLabel(s.country)} hint="Set on Business profile. The rates below follow it.">
            <div className="flex h-8 items-center text-[13px]">
              {s.tax_region
                ? <span className="font-semibold">{s.tax_region}</span>
                : <span className="text-warn">Not set — choose it on Business profile and the rates will follow.</span>}
            </div>
          </Field>
        )}
      </FieldGrid>

      {s.gst_registered && (!wantsRegion || s.tax_region) && (
        <>
          <div className="mt-3 overflow-x-auto">
            <Grid className="min-w-[620px]">
              <thead><tr>
                <Th style={{ width: "22%" }}>Tax</Th>
                <Th right style={{ width: 110 }}>Rate %</Th>
                <Th style={{ width: 150 }}>Filed</Th>
                <Th style={{ width: 130 }}>Paid</Th>
                <Th>Claimed back on purchases</Th>
              </tr></thead>
              <tbody>
                {live.map((c, i) => (
                  <GridRow key={`${c.label}-${i}`}>
                    <Td><b>{c.label}</b></Td>
                    <Td right>
                      <Input inputMode="decimal" className="h-8 num text-right" value={String(c.rate)}
                        onChange={(e) => setComponent(i, { rate: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
                    </Td>
                    <Td>
                      <FieldSelect value={c.frequency}
                        options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "annually", label: "Annually" }]}
                        onValueChange={(v) => setComponent(i, { frequency: v as TaxComponent["frequency"] })} />
                    </Td>
                    <Td className="text-muted-foreground">
                      {c.lagMonths === 0 ? "same month" : c.lagMonths === 1 ? "a month after" : `${c.lagMonths} months after`}
                    </Td>
                    <Td className={c.reclaimable ? "text-muted-foreground" : "font-semibold text-warn"}>
                      {c.reclaimable ? "Yes — claimed back" : "No — a cost to the business"}
                    </Td>
                  </GridRow>
                ))}
              </tbody>
            </Grid>
          </div>
          {regime.note && <p className="mt-2 text-[12.5px] text-muted-foreground">{regime.note}</p>}
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Every price and cost in the plan stays tax-exclusive, so none of this changes the profit. It changes
            the cash, and puts what you have collected but not yet paid over onto the balance sheet. Lines that
            carry no tax are marked on their own row; wages are never taxed and are excluded automatically.
          </p>
        </>
      )}
    </Section>
  );
}
