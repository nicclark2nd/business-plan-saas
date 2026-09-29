"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section, Field, FieldGrid, FieldInput } from "@/components/module/FieldGrid";
import { PhotoSection } from "./PhotoSection";
import { saveProfile, type ProfilePatch } from "../actions";
import { PlannerCard } from "@/components/PlannerCard";

export type ProfileView = { fullName: string; title: string | null; phone: string | null; email: string | null; photoPath: string | null; photoUrl: string | null; originalUrl: string | null };

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
          <Field label="Email" span={3} hint="The address you sign in with — also the one on your card.">
            <FieldInput value={p.email ?? ""} disabled />
          </Field>
        </FieldGrid>
      </Section>
      {/* THE CARD ITSELF (§6.187), live as the boxes change: what a client sees at the foot of their plan's menu. */}
      <div className="px-5 pb-1.5 pt-3.5">
        <h2 className="mb-2.5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">What your clients see<span className="h-px flex-1 bg-border" /></h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="w-[216px] rounded-md bg-sidebar p-3">
            <PlannerCard planner={{ name: p.fullName.trim() || p.email || "Your name", title: p.title?.trim() || null, phone: p.phone?.trim() || null, email: p.email, photoUrl: me.photoUrl }} />
          </div>
          <p className="max-w-[46ch] text-[12.5px] text-muted-foreground">
            This card sits at the foot of the menu in every plan your clients open, for the clients you look after. Nothing about your firm is on it — only you.
            {!me.photoUrl && " Add a photo below and your initials are replaced by it."}
          </p>
        </div>
      </div>
      <PhotoSection url={me.photoUrl} originalUrl={me.originalUrl}
        initials={(p.fullName || p.email || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        onChange={(busy, e) => { setError(e); setNote(busy ? "Saving…" : undefined); }} />
    </div>
  );
}
