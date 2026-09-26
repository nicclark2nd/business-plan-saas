"use client";

import { guarded } from "@/lib/guardedStart";
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
import { FORECAST_YEARS } from "@/engine/forecast/model";
import { saveProfile, saveFinancial, savePrinting, saveAiConsent, saveExit, upsertAddBack, deleteAddBack, findMultiples, acceptMultiples } from "./actions";
import { ComparableSearch } from "./ComparableSearch";
import { RangesSection } from "./RangesSection";
import type { MultiplesReading, MultipleSource } from "@/engine/ai/multiples";
import { Button } from "@/components/ui/button";
import { DraftDialog, type DraftQuestion } from "@/components/module/DraftDialog";
import { DRAFTABLE } from "@/engine/ai/fields";
import { PAGE_SIZE_LABEL, defaultPageSizeFor } from "@/engine/report/pageSize";
import { DangerArea, type PlanInventory } from "./DangerArea";
import { LicenceSection } from "./LicenceSection";
import { LogoSection } from "./LogoSection";
import { legalStructuresFor, CUSTOMER_TYPES, PRODUCT_TYPES, COUNTRIES, CURRENCIES, MONTHS, profileMissing, type Settings, type Profile, type Financial, type Licence, type AddBack } from "./model";
import { CellInput, RemoveButton, FootRow } from "@/components/module/DataGrid";
import { useMoney } from "@/components/MoneyProvider";
import { useSerialSave } from "@/lib/serialSave";
import { navGroup } from "@/lib/nav";
import { governingLawNote } from "@/engine/plan/jurisdiction";

type AreaKey = "profile" | "financial" | "printing" | "exit" | "ranges" | "ai" | "branding" | "lifecycle";
type ExitKey = "asking_price" | "multiple_low" | "multiple_high";
/** A stored figure into a box, and back. Empty is null, never nought (§6.89). */
const exStr = (v: number | null) => (v === null || v === undefined ? "" : String(v));
const exNum = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : null;
};
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function SettingsModule({ planId, initial, mode, initialArea, licences, logoUrl, archivedAt, inventory, addBacks, drafting = {}}: {
  planId: string; initial: Settings; mode: "guided" | "advanced"; initialArea: AreaKey;
  drafting?: Record<string, { caption: string; questions: DraftQuestion[] }>;
  /** What the business itself is licensed, registered or insured to do (§6.64). */
  licences: Licence[];
  /** A signed URL for the plan's logo, minted on the server for this request (§6.94). */
  logoUrl: string | null;
  /** When the plan was put away, or null (§6.58). */
  archivedAt: string | null;
  /** What the plan holds, so deleting it can say so rather than asking "are you sure?". */
  inventory: PlanInventory;
  /** Exit & sale's add-backs, itemised (§6.129.3). */
  addBacks: AddBack[];
}) {
  const [area, setArea] = useState<AreaKey>(initialArea);
  /* Which field's draft dialog is open. Null when AI is off, because then no button exists. */
  const [draftOpen, setDraftOpen] = useState<string | null>(null);
  const [s, setS] = useState(initial);
  const [established, setEstablished] = useState(formatMonth(initial.date_established));
  const [dirty, setDirty] = useState<"profile" | "financial" | null>(null);
  /** What the last save changed on the way in, if anything. Cleared the moment the client types again. */
  const [adjusted, setAdjusted] = useState<string>();
  /**
   * THREE SOURCES, THREE KEYS (§6.98). Profile, licences and the logo used to race into one `error` slot
   * and overwrite each other, so a licence that would not save could be erased by a logo that would not
   * either. Keyed, they sit side by side until each is fixed.
   */
  const errors = useSaveErrors();
  const [pending, startRaw] = useTransition();
  /* A save that never reaches the server is reported, not allowed to take the screen down (§6.138). */
  const start = guarded(startRaw, (message) => errors.raise({ key: "connection", message, label: "Connection" }), () => errors.clear("connection"));
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
    setS((x) => ({ ...x, ...changes })); setDirty(which); setAdjusted(undefined);
    if (immediate) queueMicrotask(() => commit(which));
  };
  const commit = (which: "profile" | "financial" | null) => {
    if (!which) return;
    setDirty(null);
    start(async () => {
      /* Never reached the server: the tab is unsaved again, so leaving a box retries it (§6.138). */
      try { await commitBody(which); } catch (e) { setDirty(which); throw e; }
    });
  };
  const commitBody = async (which: "profile" | "financial") => {
    {
      /*
       * The two saves are handled in their own branches rather than through one union (§6.121). Financial
       * hands back the row it stored and Profile does not, and a union of the two narrows to nothing
       * useful — so the types stay honest and the reader can see which call returns what.
       */
      if (which === "profile") {
        const res = await saveProfile(planId, { ...(ref.current as Profile), established_text: estRef.current });
        if (!res.ok) {
          errors.raise({ key: which, message: res.error, field: res.field, label: "Business profile" });
          setDirty(which);
          return;
        }
        errors.clear(which);
        if (res.data && "date_established" in res.data) {
          setS((x) => ({ ...x, date_established: res.data!.date_established }));
          setEstablished(formatMonth(res.data.date_established));
        }
        return;
      }

      const res = await saveFinancial(planId, ref.current as Financial);
      if (!res.ok) {
        errors.raise({ key: which, message: res.error, field: res.field, label: "Financial year & tax" });
        setDirty(which);
        return;
      }
      errors.clear(which);
      /*
       * THE SCREEN ADOPTS WHAT WAS STORED (§6.121).
       *
       * Every number on this tab is clamped on the way in, and silently: a client typed 99999 into the tax
       * rate, the plan took 100, and the box went on saying 99999 until a refresh they had no reason to do.
       * The save now hands back the row it wrote, so the two cannot disagree — and if anything came back
       * changed, the footer names the box and what it became, because a number moving under your hands with
       * no explanation is its own fault.
       */
      if (res.saved) {
        setS((x) => ({ ...x, ...res.saved!.stored }));
        setAdjusted(res.saved.note);
      }
    }
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
  /**
   * EXIT & SALE, RAW STRINGS, PARSED ON BLUR (§6.129). The same shape as every other nullable numeric box in
   * the app and for the same two reasons: a decimal point cannot be typed into a box that re-parses on every
   * keystroke, and a cleared box has to be able to mean "not priced" rather than "priced at nothing".
   */
  const [ex, setEx] = useState<Record<ExitKey, string>>({
    asking_price: exStr(initial.asking_price),
    multiple_low: exStr(initial.multiple_low), multiple_high: exStr(initial.multiple_high),
  });
  const [exitYear, setExitYear] = useState<number | null>(initial.intended_exit_year ?? null);
  /*
   * THE REF IS WRITTEN ON THE EDIT, NOT AFTER THE RENDER (§6.129). Spreading the closure's `ex` means two
   * boxes filled in quick succession build the second patch from a state that has not caught up, and the
   * first figure is silently dropped. Found on the built Assumptions screen; fixed in both places.
   */
  const exRef = useRef(ex);
  const editEx = (k: ExitKey, v: string) => {
    const next = { ...exRef.current, [k]: v };
    exRef.current = next;
    setEx(next);
  };
  const yrRef = useRef(exitYear); useEffect(() => { yrRef.current = exitYear; }, [exitYear]);
  /*
   * ONE SAVE FOR THE WHOLE TAB, not one per box, because the low/high check is a relationship between two of
   * them: sending a low on its own cannot know what it will be compared against. Fired on blur and on a
   * choice, which is the same policy as everywhere else (§6.10).
   */
  const commitExit = () => start(async () => {
    const res = await saveExit(planId, {
      asking_price: exNum(exRef.current.asking_price),
      multiple_low: exNum(exRef.current.multiple_low), multiple_high: exNum(exRef.current.multiple_high),
      intended_exit_year: yrRef.current,
    });
    if (!res.ok) errors.raise({ key: "exit", message: res.error, field: res.field, label: "Exit & sale" });
    else { errors.clear("exit"); if (res.sourcesCleared) setFound(null); }
  });

  /*
   * THE SEARCHED RANGE (§6.130). Kept outside the transition: a search takes seconds, and `pending` would
   * lock every box on the tab while it ran. The card is the only thing waiting.
   */
  const [found, setFound] = useState<{ sources: MultipleSource[]; on: string } | null>(
    initial.multiple_sources && initial.multiple_found_on ? { sources: initial.multiple_sources, on: initial.multiple_found_on } : null);
  const [search, setSearch] = useState<"searching" | MultiplesReading | null>(null);
  const runSearch = async () => {
    setSearch("searching");
    try { setSearch(await findMultiples(planId)); }
    catch { setSearch({ ok: false, setAside: 0, reason: "The search stopped before it finished. Try again in a moment." }); }
  };
  const takeRange = (r: Extract<MultiplesReading, { ok: true }>) => start(async () => {
    const res = await acceptMultiples(planId, { low: r.low, high: r.high, sources: r.sources });
    if (!res.ok) { errors.raise({ key: "exit", message: res.error, field: "multiple_low", label: "Exit & sale" }); return; }
    errors.clear("exit");
    /* The boxes adopt what was stored (§6.121), so the next blur-save sees an unchanged range and keeps the sources. */
    editEx("multiple_low", String(res.data.low));
    editEx("multiple_high", String(res.data.high));
    setFound({ sources: res.data.sources, on: res.data.found_on });
    setSearch(null);
  });

  /*
   * ADD-BACKS AS ROWS (§6.129.3). Keyed by a `uid` given once, never by the database id — an id that
   * changes from nothing to a real one on first save made React rebuild the row mid-typing on the Goals
   * ladder, and the unit typed next was lost (§6.125). Amounts are raw strings until the row is left.
   */
  const num = useMoney();
  type AB = { uid: string; id?: string; label: string; amount: string };
  const [abs, setAbs] = useState<AB[]>(() => addBacks.map((a) => ({ uid: a.id, id: a.id, label: a.label, amount: String(a.amount) })));
  const absRef = useRef(abs);
  const editAb = (uid: string, patch: Partial<AB>) => {
    const next = absRef.current.map((a) => (a.uid === uid ? { ...a, ...patch } : a));
    absRef.current = next; setAbs(next);
  };
  const serial = useSerialSave();
  /* Saved as each box is left, queued per line, so the second save finds the id the first created (§6.129.3). */
  const commitAb = (uid: string) => start(() => serial(uid, async () => {
    const a = absRef.current.find((x) => x.uid === uid);
    if (!a || !a.label.trim()) return;                        // no label yet: nothing to save, and no error to show
    const res = await upsertAddBack(planId, { id: a.id, label: a.label, amount: Number(a.amount.replace(/[^0-9.]/g, "")) || 0 });
    if (!res.ok) { errors.raise({ key: `addback:${uid}`, message: res.error, label: "Add-backs" }); return; }
    errors.clear(`addback:${uid}`);
    /* Adopt the id; keep what is in the boxes, which may have moved on while this was in flight. */
    editAb(uid, { id: res.data.id });
  }));
  const removeAb = (uid: string) => {
    const a = absRef.current.find((x) => x.uid === uid);
    const next = absRef.current.filter((x) => x.uid !== uid);
    absRef.current = next; setAbs(next);
    if (a?.id) start(async () => {
      const res = await deleteAddBack(planId, a.id!);
      if (!res.ok) errors.raise({ key: `addback:${uid}`, message: res.error, label: "Add-backs" });
    });
  };
  const addAb = () => {
    const next = [...absRef.current, { uid: crypto.randomUUID(), label: "", amount: "" }];
    absRef.current = next; setAbs(next);
  };
  const abTotal = abs.reduce((t, a) => t + (Number(a.amount.replace(/[^0-9.]/g, "")) || 0), 0);

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
        /*
         * EXIT & SALE (§6.129). Here rather than on the capability dashboard that reads it, because a
         * dashboard that collects data is a form wearing a disguise — and because these five figures were
         * typed there, unsaved, and gone on refresh, so the sale score changed every visit.
         */
        { key: "exit", label: "Exit & sale" },
        { key: "ranges", label: "Capability ranges" },
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
      <PendingBridge pending={pending || licBusy} dirty={!!dirty} adjusted={adjusted} />

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
                  onChange={(e) => edit({ products_services_statement: e.target.value }, "profile")} />
                {/*
                  ABSENT RATHER THAN DISABLED (§6.108), and the caption is computed alongside what will
                  actually be sent, so it cannot name data the plan does not hold.
                */}
                {drafting.products_services_statement && (
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setDraftOpen("products_services_statement")}>✦ Suggest a draft</Button>
                    <span className="text-xs text-muted-foreground">{drafting.products_services_statement.caption}</span>
                  </div>
                )}
              </Field>
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
                <FieldInput money value={String(s.opening_tax_losses)} onChange={(e) => edit({ opening_tax_losses: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }, "financial")} />
              </Field>
              <Field label="Accumulated profit at the start" hint="Profits already retained in the business. Negative if it is carrying a deficit. A dividend cannot exceed it.">
                <FieldInput money value={String(s.opening_retained_earnings)} onChange={(e) => edit({ opening_retained_earnings: Number(e.target.value.replace(/[^\d.-]/g, "")) || 0 }, "financial")} />
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

      {/*
        * EXIT & SALE (§6.129) — five figures the forecast cannot produce, and an explanation of two of them,
        * because Nic did not know what owner add-backs or comparable multiples were and neither will most
        * clients. A field whose meaning has to be guessed at collects noise.
        */}
      {/* Capability ranges for this plan (§6.140), read by the Financial Capabilities dials. */}
      {area === "ranges" && (
        <RangesSection planId={planId} initial={initial.capability_ranges ?? {}} start={start}
          onError={(message) => message ? errors.raise({ key: "ranges", message, label: "Capability ranges" }) : errors.clear("ranges")} />
      )}

      {area === "exit" && (
        <>
          <Toolbar><Meta className="ml-0">
            What you would want for the business, and what businesses like it have actually sold for. None of
            this changes a forecast figure — it is what the <b>Capability to sell</b> dials measure the plan against.
          </Meta></Toolbar>
          <Section title="The price">
            <FieldGrid>
              <Field label="Asking price" span={2} error={errors.forField("asking_price")}
                hint="Enterprise value — the business, not the business plus your house. Leave it empty until you have a number in mind.">
                <FieldInput money placeholder="Not priced" disabled={pending}
                  value={ex.asking_price} onChange={(e) => editEx("asking_price", e.target.value)}
                  onBlur={commitExit} />
              </Field>
              <Field label="Similar sales, low" span={1} error={errors.forField("multiple_low")}
                hint="× yearly earnings (EBITDA)">
                <FieldInput numeric placeholder="—" disabled={pending}
                  value={ex.multiple_low} onChange={(e) => editEx("multiple_low", e.target.value)}
                  onBlur={commitExit} />
              </Field>
              <Field label="Similar sales, high" span={1} hint="× yearly earnings (EBITDA)">
                <FieldInput numeric placeholder="—" disabled={pending}
                  value={ex.multiple_high} onChange={(e) => editEx("multiple_high", e.target.value)}
                  onBlur={commitExit} />
              </Field>
              <Field label="Aiming to sell in" span={2} hint="Optional. Which year of the plan the sale is pointed at.">
                <FieldSelect value={exitYear === null ? "" : String(exitYear)}
                  options={[{ value: "", label: "Not decided" }, ...FORECAST_YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }))]}
                  onValueChange={(v) => { setExitYear(v ? Number(v) : null); yrRef.current = v ? Number(v) : null; commitExit(); }} />
              </Field>
            </FieldGrid>
            <ComparableSearch aiOn={s.ai_enabled} industry={s.industry} country={s.country}
              found={found} search={search} busy={pending || search === "searching"}
              onSearch={runSearch} onUse={takeRange} onDismiss={() => setSearch(null)}
              onGo={(k) => { commit(dirty); setArea(k); }} />
          </Section>
          {/*
            ADD-BACKS, ONE LINE EACH (§6.129.3). A buyer's accountant does not accept "85,000 of add-backs";
            they accept or strike each line. Listing them is what lets the Capability to sell tab draw the
            bridge from reported to normalised earnings, one step per line.
          */}
          <Section title="Owner add-backs"
            tail={<Button size="sm" variant="outline" type="button" onClick={addAb} disabled={pending}>+ Add-back</Button>}>
            <p className="mb-2 max-w-[86ch] text-[12px] text-muted-foreground">
              Costs in the books that a new owner would not pay. One line each, a year&apos;s worth. Put in only what
              you could back with a document.
            </p>
            {abs.length ? (
              /* `min-w-0` overrides the grid's 900px floor, which is for full-width data grids, not a two-column list (§6.89). */
              <Grid className="min-w-0">
                <thead><tr><Th>What it is</Th><Th right style={{ width: 160 }}>A year</Th><Th style={{ width: 36 }} /></tr></thead>
                <tbody>
                  {abs.map((a) => (
                    <GridRow key={a.uid} title={errors.forKey(`addback:${a.uid}`)}>
                      <Td><CellInput value={a.label} placeholder="e.g. Owner's salary above a manager's market rate"
                        onChange={(e) => editAb(a.uid, { label: e.target.value })} onBlur={() => commitAb(a.uid)} /></Td>
                      <Td right><CellInput money value={a.amount} placeholder="0"
                        onChange={(e) => editAb(a.uid, { amount: e.target.value })} onBlur={() => commitAb(a.uid)} /></Td>
                      <Td><RemoveButton onClick={() => removeAb(a.uid)} /></Td>
                    </GridRow>
                  ))}
                </tbody>
                <FootRow><Td>Total added back to earnings</Td><Td right className="num">{num(abTotal)}</Td><Td /></FootRow>
              </Grid>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">None yet. Most owner-run businesses have at least one.</p>
            )}
          </Section>
          <Section title="What those two words mean">
            <div className="grid gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground max-w-[86ch]">
              <p>
                <b className="text-foreground">Owner add-backs</b> are costs sitting in the accounts that only exist because
                <i> you</i> run the business, and which a new owner would not pay: your salary above what a hired manager
                would cost, a spouse on the books, the family car, personal travel, one-off legal fees. A buyer values the
                business on what it would earn under ordinary management, so those costs are added back to the earnings
                before a multiple is applied. Every dollar of it is a dollar a buyer&apos;s accountant will argue about, so
                put in what you could actually defend with a document.
              </p>
              <p>
                <b className="text-foreground">Similar sales</b> are what businesses like this one have actually
                changed hands for, expressed as a multiple of those normalised earnings. A small trade business with the
                owner in the truck might be 2.5–3.5×; the same revenue with recurring contracts and a manager running it,
                4–5×. The low and high give a range to sit the asking price inside. A broker&apos;s report, industry
                benchmarking data or your accountant is where the figures come from. With AI on, the app can look up
                published figures and show you each source, but it never makes one up: a number it invented would be
                worse than none.
              </p>
            </div>
          </Section>
          <Section title="Would it survive a change of owner?">
            <p className="max-w-[86ch] text-[12.5px] leading-relaxed text-muted-foreground">
              That question is six judgements about the people and the systems, and it is scored under{" "}
              <b className="text-foreground">Leadership Team → Risk &amp; Succession</b> rather than here, because it is the
              same thing a lender calls key-person risk and it should only be answered once.
            </p>
          </Section>
        </>
      )}

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
                {/*
                  THE ONE CALL THAT LEAVES THE ZERO-RETENTION ROUTE (§6.130) gets its own sentence. The search
                  engine sees the query, so the query is built from three things and this says which three.
                */}
                <span className="mt-1.5 block text-[12.5px] leading-[1.6] text-muted-foreground">
                  On <b>Exit &amp; sale</b> you can also ask the app to look up what similar businesses sold for. That
                  searches the public web using only your industry, your country and a rough size band — never your
                  business name or your figures.
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

      {/*
        The draft returns to the FORM, not to the database (§6.106.1): it lands in the box and the screen's
        own save runs when focus leaves the area, exactly as when a client types.
      */}
      {draftOpen && (() => {
        const f = DRAFTABLE[draftOpen];
        return (
          <DraftDialog
            planId={planId} fieldKey={f.key} label={f.label} sub={f.sub} hint={f.hint}
            questions={drafting[f.key]?.questions ?? []}
            hasText={!!String(s[f.key as keyof Settings] ?? "").trim()}
            /* `immediate`, because a client who pressed "Use this" has decided — there is no field to leave. */
            onUse={(text) => edit({ [f.key]: text } as Partial<Settings>, "profile", true)}
            onClose={() => setDraftOpen(null)}
          />
        );
      })()}

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
function PendingBridge({ pending, dirty, adjusted }: { pending: boolean; dirty: boolean; adjusted?: string }) {
  const { setPending, setNote } = useModule();
  useEffect(() => setPending(pending), [pending, setPending]);
  /* An adjustment outranks "All changes saved": the save DID work, and it did not store what was typed. */
  useEffect(() => setNote(
    pending ? "Saving…"
      : dirty ? "Unsaved — saves when you leave the field"
        : adjusted ?? undefined,
  ), [pending, dirty, adjusted, setNote]);
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
