"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section, Field, FieldGrid, FieldInput } from "@/components/module/FieldGrid";
import { ImageUpload } from "@/components/module/ImageUpload";
import { removePhoto, saveProfile, uploadPhoto, type ProfilePatch } from "../actions";

export type ProfileView = { fullName: string; title: string | null; phone: string | null; email: string | null; photoPath: string | null; photoUrl: string | null };

/**
 * MY PROFILE (§6.182) — the consultant as a person: what a client will see on the "Your Planner" card
 * (part 2), and the name on what they send. The sign-in email is shown, not edited here, and a password is
 * never on a screen — both belong to the sign-in system.
 */
export function ProfileForm({ me }: { me: ProfileView }) {
  const router = useRouter();
  const [p, setP] = useState(me);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [, start] = useTransition();

  const save = (patch: ProfilePatch) => {
    setError(undefined); setNote("Saving…");
    start(async () => {
      const res = await saveProfile(patch);
      if (!res.ok) { setError(res.error); setNote(undefined); return; }
      setNote("Saved"); router.refresh();
    });
  };
  const box = (k: "fullName" | "title" | "phone", col: keyof ProfilePatch, label: string, span: 2 | 3, placeholder?: string) => (
    <Field label={label} span={span}>
      <FieldInput value={p[k] ?? ""} placeholder={placeholder}
        onChange={(e) => setP((x) => ({ ...x, [k]: e.target.value }))}
        onBlur={(e) => { if ((e.target.value.trim() || null) !== (me[k] || null)) save({ [col]: e.target.value }); }} />
    </Field>
  );

  return (
    <div className="pb-10">
      <div className="border-b border-border px-5 py-4">
        <div className="eyebrow">My Profile</div>
        <h1 className="text-[22px] font-semibold">You, as your clients see you</h1>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
          Your clients will see your name, photo, phone and email on a small &ldquo;Your Planner&rdquo; card inside their plan, so they know how to reach you.
        </p>
        {(error || note) && <p className={error ? "mt-2 text-[12.5px] font-semibold text-bad" : "mt-2 text-[12px] text-muted-foreground"} role={error ? "alert" : undefined}>{error ?? note}</p>}
      </div>
      <Section title="Your details">
        <FieldGrid>
          {box("fullName", "full_name", "Your name", 3)}
          {box("title", "title", "Title", 3, "e.g. Business Coach")}
          {box("phone", "phone", "Direct phone", 3)}
          <Field label="Email" span={3} hint="The address you sign in with. Change it from the sign-in screen, not here.">
            <FieldInput value={p.email ?? ""} disabled />
          </Field>
        </FieldGrid>
      </Section>
      <ImageUpload title="Your photo" noun="photo" path={me.photoPath} url={me.photoUrl}
        onPending={(busy, e) => { setError(e); setNote(busy ? "Saving…" : undefined); }}
        upload={uploadPhoto} remove={removePhoto}
        blurb={<>A head-and-shoulders photo, shown on the <b>&ldquo;Your Planner&rdquo; card</b> your clients see.</>} />
    </div>
  );
}
