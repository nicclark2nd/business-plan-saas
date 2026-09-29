"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section, Field, FieldGrid, FieldInput, FieldSelect } from "@/components/module/FieldGrid";
import { ImageUpload } from "@/components/module/ImageUpload";
import { DEFAULT_BRAND, cleanColour, preparedByLine, readable } from "@/engine/plan/brand";
import { COUNTRIES } from "@/app/(app)/plans/[planId]/settings/model";
import { removeFirmLogo, saveFirm, uploadFirmLogo, type FirmPatch } from "../actions";

export type FirmForm = {
  name: string; country: string | null; colour: string | null;
  addressLine: string | null; city: string | null; region: string | null; postcode: string | null;
  phone: string | null; website: string | null; businessNumber: string | null;
  preparedBy: string | null; defaultPageSize: "a4" | "letter" | null;
  logoPath: string | null; logoUrl: string | null;
};

/**
 * MY FIRM (§6.182) — the firm's details and its letterhead, set once and used for every client.
 *
 * Everything here goes on what the firm SENDS — the Planner's report's cover, header and "Prepared by" line —
 * and, from part 2, the "Your Planner" card a client sees. None of it is ever written into a client's plan.
 *
 * Saves on leaving each box, like every other form in the app (§6.10). An advisor sees it; only an admin
 * changes it.
 */
export function FirmDetails({ firm, email, isAdmin }: { firm: FirmForm; email: string | null; isAdmin: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(firm);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [, start] = useTransition();
  const ro = !isAdmin;

  const save = (patch: FirmPatch) => {
    setError(undefined); setNote("Saving…");
    start(async () => {
      const res = await saveFirm(patch);
      if (!res.ok) { setError(res.error); setNote(undefined); return; }
      setNote("Saved"); router.refresh();
    });
  };
  /* A text box: edits locally, saves when the Planner leaves it — and only if it changed. */
  const box = (k: keyof FirmForm, col: keyof FirmPatch, label: string, span: 1 | 2 | 3 | 4 | 6, o: { hint?: string; placeholder?: string } = {}) => (
    <Field label={label} span={span} hint={o.hint}>
      <FieldInput value={(f[k] as string | null) ?? ""} disabled={ro} placeholder={o.placeholder}
        onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
        onBlur={(e) => { if ((e.target.value.trim() || null) !== ((firm[k] as string | null) ?? null)) save({ [col]: e.target.value } as FirmPatch); }} />
    </Field>
  );

  const clean = cleanColour(f.colour);
  const ink = readable(clean ?? DEFAULT_BRAND);
  const auto = preparedByLine({ name: f.name, phone: f.phone, website: f.website, preparedBy: null }, email);

  return (
    <div className="pb-10">
      <div className="border-b border-border px-5 py-4">
        <div className="eyebrow">My Firm</div>
        <h1 className="text-[22px] font-semibold">Your firm&apos;s details</h1>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
          Set once, used for every client on what your firm sends out — the cover, header and &ldquo;Prepared by&rdquo; line of the Planner&apos;s report. None of it appears inside a client&apos;s plan: the card your clients see there shows you as a person, from My Profile.
          {ro && <b className="text-foreground"> Only your firm&apos;s admin can change these.</b>}
        </p>
        {(error || note) && <p className={error ? "mt-2 text-[12.5px] font-semibold text-bad" : "mt-2 text-[12px] text-muted-foreground"} role={error ? "alert" : undefined}>{error ?? note}</p>}
      </div>

      <Section title="The firm">
        <FieldGrid>
          {box("name", "name", "Firm name", 3)}
          {box("businessNumber", "business_number", "Business number", 3, { hint: "ABN, EIN or company number. Kept with your firm's details; add it to the “Prepared by” line below if you want it printed." })}
          {box("addressLine", "address_line", "Street address", 6)}
          {box("city", "city", "City or suburb", 2)}
          {box("region", "region", "State or region", 2)}
          {box("postcode", "postcode", "Postcode or ZIP", 2)}
          <Field label="Country" span={2}>
            <FieldSelect value={f.country ?? ""} options={COUNTRIES.map((c) => ({ value: c, label: c }))} placeholder="Choose a country"
              onValueChange={(v) => { if (ro || !v) return; setF((x) => ({ ...x, country: v })); save({ country: v }); }} />
          </Field>
          {box("phone", "phone", "Phone", 2)}
          {box("website", "website", "Website", 2, { placeholder: "www.yourfirm.com" })}
        </FieldGrid>
      </Section>

      <Section title="Your letterhead">
        <FieldGrid>
          <Field label="Firm colour" span={3} hint="Headings and rules on the Planner's report. Six digits, like #1F3A5F.">
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick the firm colour" disabled={ro}
                value={clean ?? DEFAULT_BRAND} className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5"
                onChange={(e) => { const v = e.target.value.toUpperCase(); setF((x) => ({ ...x, colour: v })); save({ colour: v }); }} />
              <FieldInput value={f.colour ?? ""} disabled={ro} placeholder={DEFAULT_BRAND} className="max-w-[120px] font-mono"
                onChange={(e) => setF((x) => ({ ...x, colour: e.target.value }))}
                onBlur={() => { if (cleanColour(f.colour) !== firm.colour) save({ colour: f.colour || null }); }} />
              <span className="text-[15px] font-semibold" style={{ color: ink }}>Heading in your colour</span>
            </div>
            {!!clean && ink !== clean && (
              <p className="mt-1 text-[11.5px] text-muted-foreground">Light for text on white paper, so headings print a shade darker ({ink}) to stay readable.</p>
            )}
          </Field>
          <Field label="Paper for new plans" span={3} hint="Each plan can still change its own in Plan settings.">
            <FieldSelect value={f.defaultPageSize ?? ""} placeholder="Follow the client's country"
              options={[{ value: "a4", label: "A4" }, { value: "letter", label: "US Letter" }]}
              onValueChange={(v) => { if (ro) return; const p = v === "a4" || v === "letter" ? v : null; setF((x) => ({ ...x, defaultPageSize: p })); save({ default_page_size: p }); }} />
          </Field>
          <Field label="“Prepared by” line" span={6} hint={f.preparedBy ? "Clear it to go back to the line built from your details." : `Built from your details: “${auto}”. Type your own to replace it.`}>
            <FieldInput value={f.preparedBy ?? ""} disabled={ro} placeholder={auto}
              onChange={(e) => setF((x) => ({ ...x, preparedBy: e.target.value }))}
              onBlur={(e) => { if ((e.target.value.trim() || null) !== firm.preparedBy) save({ prepared_by: e.target.value }); }} />
          </Field>
        </FieldGrid>
      </Section>

      <ImageUpload title="Your firm's logo" noun="logo" path={f.logoPath} url={firm.logoUrl} readOnly={ro}
        onPending={(busy, e) => { setError(e); setNote(busy ? "Saving…" : undefined); }}
        upload={uploadFirmLogo} remove={removeFirmLogo}
        blurb={<>It goes on the <b>cover of the Planner&apos;s report</b> and at the top of every page after it, for every client of your firm.</>} />
    </div>
  );
}
