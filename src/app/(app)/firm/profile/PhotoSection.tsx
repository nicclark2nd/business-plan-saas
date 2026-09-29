"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/module/FieldGrid";
import { PhotoCropper } from "@/components/PhotoCropper";
import { LOGO_ACCEPT, LOGO_MAX_LABEL, checkLogo } from "@/engine/plan/logo";
import { removePhoto, uploadPhoto } from "../actions";

/**
 * YOUR PHOTO (§6.190) — chosen, fitted into the circle, and saved. "Adjust" reopens the ORIGINAL, not the
 * cropped square, so zooming back out later has the whole picture to work with.
 */
export function PhotoSection({ url, originalUrl, initials, onChange }: {
  url: string | null; originalUrl: string | null; initials: string;
  onChange: (busy: boolean, error?: string) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ src: string; file: File | null } | null>(null);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();

  const report = (b: boolean, e?: string) => { setError(e); onChange(b, e); };
  const choose = (f: File | null | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    const check = checkLogo({ type: f.type, size: f.size, name: f.name });
    if (!check.ok) { report(false, check.error.replace("A logo", "A photo").replace("a logo", "a photo")); return; }
    setEditing({ src: URL.createObjectURL(f), file: f });
  };
  const close = () => { if (editing?.file) URL.revokeObjectURL(editing.src); setEditing(null); };
  const save = (square: Blob) => {
    const form = new FormData();
    form.set("photo", new File([square], "photo.jpg", { type: "image/jpeg" }));
    if (editing?.file) form.set("original", editing.file);
    close();
    report(true);
    start(async () => {
      try {
        const res = await uploadPhoto(form);
        if (!res.ok) { report(false, res.error); return; }
        report(false); router.refresh();
      } catch {
        report(false, "The photo didn't upload. Check your connection and try again.");
      }
    });
  };
  const remove = () => { setConfirm(false); report(true); start(async () => {
    const res = await removePhoto();
    if (!res.ok) { report(false, res.error); return; }
    report(false); router.refresh();
  }); };

  return (
    <Section title="Your photo">
      <div className="flex items-start gap-5">
        <div className="grid size-[112px] shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary">
          {url
            /* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL */
            ? <img src={url} alt="Your photo" className="size-full object-cover" />
            : <span className="text-[26px] font-semibold text-muted-foreground">{initials}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px]">A head-and-shoulders photo, shown in a circle on the <b>&ldquo;Your Planner&rdquo; card</b> your clients see.</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">PNG or JPEG, up to {LOGO_MAX_LABEL}. After choosing it you can move and zoom it to sit in the circle.</p>
          {error && <p className="mt-2 text-[12.5px] text-bad" role="alert">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={input} type="file" accept={LOGO_ACCEPT} className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
            <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Saving…" : url ? "Replace photo" : "Upload a photo"}</Button>
            {url && <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing({ src: originalUrl ?? url, file: null })}>Adjust</Button>}
            {url && !confirm && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(true)}>Remove</Button>}
            {url && confirm && (
              <>
                <span className="text-[12.5px] text-muted-foreground">Remove your photo?</span>
                <Button size="sm" variant="outline" disabled={busy} onClick={remove}>Yes, remove</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>Keep it</Button>
              </>
            )}
          </div>
        </div>
      </div>
      {editing && <PhotoCropper src={editing.src} onCancel={close} onSave={save} />}
    </Section>
  );
}
