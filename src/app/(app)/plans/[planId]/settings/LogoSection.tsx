"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/module/FieldGrid";
import { LOGO_ACCEPT, LOGO_MAX_LABEL, LOGO_TYPES_LABEL, checkLogo } from "@/engine/plan/logo";
import { uploadLogo, removeLogo } from "./actions";

/**
 * The plan's logo (§6.94) — the thing the Branding tab promised and did not have.
 *
 * The file is checked HERE as well as in the action, and that is not a duplicated rule: `checkLogo` is one
 * function called twice (§6.19). Checking on this side means a client who picks a 9 MB TIFF is told so
 * instantly instead of after the upload; checking on the server side means a client who bypasses this
 * screen is still refused. Neither alone is enough.
 */
export function LogoSection({ planId, path, url, onPending }: {
  planId: string;
  /** The stored object path, or null. */
  path: string | null;
  /** A signed URL for it, minted on the server for this request (§6.94). */
  url: string | null;
  onPending: (busy: boolean, error?: string) => void;
}) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  const report = (busy: boolean, e?: string) => { setError(e); onPending(busy, e); };

  const choose = (f: File | null | undefined) => {
    if (!f) return;
    const check = checkLogo({ type: f.type, size: f.size, name: f.name });
    if (!check.ok) { report(false, check.error); if (file.current) file.current.value = ""; return; }
    report(true);
    const form = new FormData();
    form.set("logo", f);
    start(async () => {
      const res = await uploadLogo(planId, form);
      if (file.current) file.current.value = "";
      if (!res.ok) report(false, res.error);
      else { report(false); router.refresh(); }
    });
  };

  const drop = () => {
    setConfirming(false);
    report(true);
    start(async () => {
      const res = await removeLogo(planId);
      if (!res.ok) report(false, res.error);
      else { report(false); router.refresh(); }
    });
  };

  return (
    <Section title="Logo">
      <div className="flex items-start gap-5">
        {/* A checkerboard behind it, because most logos are transparent PNGs and a white mark on a white
            card looks like a failed upload. */}
        <div className="flex size-[124px] shrink-0 items-center justify-center rounded border border-border bg-[repeating-conic-gradient(var(--color-secondary)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2">
          {url
            ? <Image src={url} alt="Your logo" width={108} height={108} unoptimized className="max-h-[108px] w-auto object-contain" />
            : <span className="text-center text-[11.5px] leading-tight text-muted-foreground">No logo<br />yet</span>}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px]">
            It goes on the <b>cover of the business plan</b> and in the header of every page after it, on the screen and in the Word download.
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {LOGO_TYPES_LABEL}, up to {LOGO_MAX_LABEL}. A transparent PNG sits best on the cover.
            {/* Said plainly rather than left for a client to discover from a broken document. */}
            {" "}WebP and SVG are not accepted — Word cannot place them without breaking the page.
          </p>
          {error && <p className="mt-2 text-[12.5px] text-bad">{error}</p>}

          <div className="mt-3 flex items-center gap-2">
            <input ref={file} type="file" accept={LOGO_ACCEPT} className="hidden"
              onChange={(e) => choose(e.target.files?.[0])} />
            <Button type="button" size="sm" disabled={pending} onClick={() => file.current?.click()}>
              {pending ? "Working…" : path ? "Replace logo" : "Upload a logo"}
            </Button>
            {path && !confirming && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(true)}>Remove</Button>
            )}
            {path && confirming && (
              <>
                <span className="text-[12.5px] text-muted-foreground">Remove it from the plan?</span>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={drop}>Yes, remove</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Keep it</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
