"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section, Field, FieldGrid, FieldInput } from "@/components/module/FieldGrid";
import { DEFAULT_BRAND, cleanColour, readable } from "@/engine/plan/brand";
import { LogoSection } from "./LogoSection";
import { removeFirmLogo, saveFirm, uploadFirmLogo } from "./firmActions";

export type FirmView = { name: string; colour: string | null; logoPath: string | null; logoUrl: string | null; isAdmin: boolean };

/**
 * YOUR FIRM'S LETTERHEAD (§6.180) — on the Branding tab beside the client's own logo, because that is where
 * a Planner looks for "how does this print". Set once for the firm: every client's Planner's report carries
 * it. The client's business plan keeps the client's logo; the two never mix.
 *
 * Saves on leaving the field, like every other box in the app (§6.10). No Save button.
 */
export function FirmSection({ planId, firm, onPending }: {
  planId: string; firm: FirmView; onPending: (busy: boolean, error?: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(firm.name);
  const [colour, setColour] = useState(firm.colour ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const ro = !firm.isAdmin;

  const save = (patch: { name?: string; colour?: string | null }) => {
    onPending(true); setError(undefined);
    start(async () => {
      const res = await saveFirm(planId, patch);
      if (!res.ok) { setError(res.error); onPending(false, res.error); return; }
      onPending(false); router.refresh();
    });
  };

  const clean = cleanColour(colour);
  const ink = readable(clean ?? DEFAULT_BRAND);
  const darker = !!clean && ink !== clean;

  return (
    <>
      <Section title="Your firm's letterhead">
        <p className="mb-3 text-[13px]">
          It goes on the <b>Planner&apos;s report</b> for every client of your firm — the logo on the cover and at the top of each page, your colour on the headings, and &ldquo;Prepared by&rdquo; your firm&apos;s name. The client&apos;s own logo, above, stays on their business plan.
          {ro && <span className="text-muted-foreground"> Only your firm&apos;s admin can change it.</span>}
        </p>
        <FieldGrid>
          <Field label="Firm name" span={2} hint="As it should read on the cover: “Prepared by …”.">
            <FieldInput value={name} disabled={ro} onChange={(e) => setName(e.target.value)}
              onBlur={() => { if (name.trim() !== firm.name) save({ name }); }} />
          </Field>
          <Field label="Firm colour" span={2} hint="Used for headings and rules. Six digits, like #1F3A5F.">
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick the firm colour" disabled={ro || pending}
                value={clean ?? DEFAULT_BRAND} className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5"
                onChange={(e) => { setColour(e.target.value.toUpperCase()); save({ colour: e.target.value }); }} />
              <FieldInput value={colour} disabled={ro} placeholder={DEFAULT_BRAND} className="max-w-[120px] font-mono"
                onChange={(e) => setColour(e.target.value)}
                onBlur={() => { if ((cleanColour(colour) ?? null) !== firm.colour) save({ colour: colour || null }); }} />
              <span className="text-[15px] font-semibold" style={{ color: ink }}>Heading in your colour</span>
            </div>
          </Field>
        </FieldGrid>
        {darker && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            This colour is light for text on white paper, so headings will print a shade darker ({ink}) to stay readable. Your logo keeps its own colours.
          </p>
        )}
        {error && <p className="mt-2 text-[12.5px] text-bad" role="alert">{error}</p>}
      </Section>
      <LogoSection planId={planId} path={firm.logoPath} url={firm.logoUrl} onPending={onPending} readOnly={ro}
        title="Your firm's logo" upload={uploadFirmLogo} remove={removeFirmLogo}
        blurb={<>It goes on the <b>cover of the Planner&apos;s report</b> and at the top of every page after it, for every client of your firm.</>} />
    </>
  );
}
