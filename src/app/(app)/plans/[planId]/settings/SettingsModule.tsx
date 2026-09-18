"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ModuleFrame, ModuleStatusFooter, useModule } from "@/components/module/ModuleFrame";
import { Section, FieldGrid, Field, FieldInput, FieldSelect } from "@/components/module/FieldGrid";
import { Input } from "@/components/ui/input";
import { Toolbar, Meta, Grid, Th, Td, Row as GridRow } from "@/components/module/DataGrid";
import { currentFinancialYear, firstProjectedYear, planYearEnding, planYearLabel } from "@/engine/plan/calendar";
import { taxComponents, taxHeading } from "@/engine/plan/gst";
import { needsRegion, regimeFor, regionLabel, regionsFor, type TaxComponent } from "@/engine/plan/taxRegimes";
import { formatMonth } from "../people/model";
import { saveProfile, saveFinancial, savePrinting } from "./actions";
import { PAGE_SIZE_LABEL, defaultPageSizeFor } from "@/engine/report/pageSize";
import { DangerArea, type PlanInventory } from "./DangerArea";
import { LicenceSection } from "./LicenceSection";
import { legalStructuresFor, CUSTOMER_TYPES, PRODUCT_TYPES, COUNTRIES, CURRENCIES, MONTHS, profileMissing, type Settings, type Profile, type Financial, type Licence } from "./model";
import { navGroup } from "@/lib/nav";

type AreaKey = "profile" | "financial" | "printing" | "branding" | "lifecycle";
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function SettingsModule({ planId, initial, mode, initialArea, licences, archivedAt, inventory }: {
  planId: string; initial: Settings; mode: "guided" | "advanced"; initialArea: AreaKey;
  /** What the business itself is licensed, registered or insured to do (§6.64). */
  licences: Licence[];
  /** When the plan was put away, or null (§6.58). */
  archivedAt: string | null;
  /** What the plan holds, so deleting it can say so rather than asking "are you sure?". */
  inventory: PlanInventory;
}) {
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
  /* Neither printing control is typed, so there is no field to leave — both save on the choice itself. */
  const editPrinting = (changes: Partial<Settings>) => {
    const next = { ...ref.current, ...changes };
    setS(next); setError(undefined);
    start(async () => {
      const res = await savePrinting(planId, next);
      if (!res.ok) setError(res.error);
    });
  };
  const missing = profileMissing(s);
  /**
   * The licence list saves on its own schedule, so it reports its own state up rather than sharing `dirty`.
   * One PendingBridge per module: two of them race and the footer flickers between "Saving" and "Saved".
   */
  const [licBusy, setLicBusy] = useState(false);
  const [licError, setLicError] = useState<string | undefined>();
  const onLicPending = useCallback((busy: boolean, e?: string) => { setLicBusy(busy); setLicError(e); }, []);

  return (
    <ModuleFrame
      group={navGroup("settings")} title="Plan settings" subtitle="Who the business is, how its year runs, and how the plan is branded" mode={mode}
      areas={[
        { key: "profile", label: "Business profile", ...(missing.length ? { count: missing.length } : {}) },
        { key: "financial", label: "Financial year & tax" },
        { key: "printing", label: "How the plan prints" },
        { key: "branding", label: "Branding", tag: "Soon" },
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
      <PendingBridge pending={pending || licBusy} dirty={!!dirty} error={error ?? licError} />

      {area === "profile" && (
        <div onBlur={(e) => left(e) && dirty === "profile" && commit("profile")}>
          <Toolbar><Meta className="ml-0">{missing.length ? <>Reports need {missing.length} more field{missing.length === 1 ? "" : "s"}: <b>{missing.map((k) => k.replace(/_/g, " ")).join(", ")}</b>.</> : "Everything a report\u2019s business overview needs is here."}</Meta></Toolbar>
          <Section title="Business">
            <FieldGrid>
              <Field label="Business name" span={2}><FieldInput value={s.business_name} onChange={(e) => edit({ business_name: e.target.value }, "profile")} /></Field>
              <Field label="Industry" span={2}><FieldInput value={s.industry ?? ""} placeholder="e.g. Commercial concreting" onChange={(e) => edit({ industry: e.target.value }, "profile")} /></Field>
              <Field label="Date established"><FieldInput value={established} placeholder="month year" onChange={(e) => { setEstablished(e.target.value); setDirty("profile"); }} /></Field>
              <Field label="Plan year" hint="The year on the front cover of the report — not the financial year."><FieldInput numeric inputMode="numeric" value={s.plan_year ?? ""} onChange={(e) => edit({ plan_year: Number(e.target.value.replace(/\D/g, "")) || 0 }, "profile")} /></Field>
              {/* Moving country resets the taxes that came with the old one — enforced in `saveProfile`, so
                  it holds whichever screen changes the country (§6.39.1). */}
              <Field label="Main country of operation"><FieldSelect value={s.country} options={opts(COUNTRIES)} placeholder="Choose" onValueChange={(v) => edit({ country: v }, "profile", true)} /></Field>
              <Field label="Legal structure" span={2} hint="Grouped by liability; your country's names come first."><FieldSelect value={s.legal_structure} groups={legalStructuresFor(s.country)} placeholder="Choose" onValueChange={(v) => edit({ legal_structure: v }, "profile", true)} /></Field>
              <Field label="Type of customer" span={2} hint="Changes the word the app uses for the people you sell to."><FieldSelect value={s.customer_type} options={opts(CUSTOMER_TYPES)} placeholder="Choose" onValueChange={(v) => edit({ customer_type: v }, "profile", true)} /></Field>
              <Field label="Type of product sold" span={2}><FieldSelect value={s.product_type} options={PRODUCT_TYPES} placeholder="Choose" onValueChange={(v) => edit({ product_type: v }, "profile", true)} /></Field>
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
        {s.gst_registered && wantsRegion && (
          <Field label={regionLabel(s.country)} hint="The tax depends on it. Changing this replaces the rates below.">
            <FieldSelect value={s.tax_region ?? ""} placeholder={`Choose a ${regionLabel(s.country).toLowerCase()}`}
              options={regionsFor(s.country).map((r) => ({ value: r, label: r }))}
              onValueChange={(v) => edit({ tax_region: v, tax_components: regimeFor(s.country, v).components }, "financial", true)} />
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
