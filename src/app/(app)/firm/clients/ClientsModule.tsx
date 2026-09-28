"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, FieldGrid, FieldInput } from "@/components/module/FieldGrid";
import { cn } from "@/lib/utils";
import { SetupForm } from "../../setup/SetupForm";
import { saveClientContact, type ContactPatch } from "../actions";

type Contact = Required<{ [K in keyof ContactPatch]: string | null }>;
export type ClientRow = {
  id: string; businessName: string; archived: boolean; createdAt: string; planYears: string;
  address: string | null; email: string | null; website: string | null; country: string | null;
  contact: Contact;
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
const person = (c: Contact) => [c.contact_first_name, c.contact_family_name].filter(Boolean).join(" ");

/**
 * MY CLIENTS (§6.182) — the list on the left, the business picked on the right, as the old system had it and
 * without what it needed only because it was built a decade ago (passwords on screen, counted credits).
 * Invite, access and the three scores arrive in part 2.
 */
export function ClientsModule({ rows, others, selected, firm }: {
  rows: ClientRow[]; others: { id: string; businessName: string }[]; selected: string | null;
  firm: { country: string | null; currency: string };
}) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(selected && rows.some((r) => r.id === selected) ? selected : rows.find((r) => !r.archived)?.id ?? rows[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const shown = useMemo(() => rows.filter((r) => (showArchived || !r.archived) && (!q.trim() || `${r.businessName} ${person(r.contact)} ${r.contact.contact_email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, showArchived]);
  const archivedCount = rows.filter((r) => r.archived).length;
  const current = rows.find((r) => r.id === pick) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="eyebrow">My Clients</div>
          <h1 className="text-[22px] font-semibold">{rows.length === 1 ? "1 client business" : `${rows.length} client businesses`}</h1>
        </div>
        <div className="flex-1" />
        <Button onClick={() => setAdding(true)}>+ Add new business</Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by business or contact"
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setPick(r.id)}
                  className={cn("flex w-full items-start gap-2.5 border-b border-border px-4 py-2.5 text-left hover:bg-secondary",
                    r.id === pick && "bg-accent")}>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13.5px] font-semibold", r.archived && "text-muted-foreground")}>{r.businessName}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{person(r.contact) || "No contact yet"} · Plan {r.planYears}</span>
                  </span>
                  {r.archived && <span className="rounded border border-border px-1.5 text-[10.5px] text-muted-foreground">Archived</span>}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">{rows.length ? "No client matches that search." : "No clients yet. Add your first business."}</li>}
          </ul>
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived ({archivedCount})
            </label>
          )}
          {others.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <div className="eyebrow mb-1">Your other plans</div>
              {others.map((o) => <Link key={o.id} href={`/plans/${o.id}/dashboard`} className="block py-0.5 text-[12.5px] font-semibold text-primary hover:underline">{o.businessName}</Link>)}
            </div>
          )}
        </aside>

        <section className="min-h-0 overflow-y-auto">
          {current ? <ClientPanel key={current.id} r={current} /> : (
            <p className="px-6 py-10 text-[13px] text-muted-foreground">Pick a business on the left, or add your first one.</p>
          )}
        </section>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Add a new business</DialogTitle>
            <DialogDescription>It goes into your firm and opens in My Clients. You can invite the client to their own login once their details are in.</DialogDescription>
          </DialogHeader>
          <SetupForm forFirm={firm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientPanel({ r }: { r: ClientRow }) {
  const router = useRouter();
  const [c, setC] = useState<Contact>(r.contact);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [, start] = useTransition();

  const save = (k: keyof Contact, v: string) => {
    if ((v.trim() || null) === (r.contact[k] ?? null)) return;
    setError(undefined); setNote("Saving…");
    start(async () => {
      const res = await saveClientContact(r.id, { [k]: v });
      if (!res.ok) { setError(res.error); setNote(undefined); return; }
      setNote("Saved"); router.refresh();
    });
  };
  const box = (k: keyof Contact, label: string, span: 2 | 3, type = "text") => (
    <Field label={label} span={span}>
      <FieldInput type={type} value={c[k] ?? ""} onChange={(e) => setC((x) => ({ ...x, [k]: e.target.value }))} onBlur={(e) => save(k, e.target.value)} />
    </Field>
  );
  const fromPlan = (label: string, v: string | null, where: string) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{v ?? <span className="text-muted-foreground">Not in the plan yet — {where}</span>}</dd>
    </>
  );

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold leading-tight">{r.businessName}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Plan {r.planYears} · added {date(r.createdAt)}{r.archived ? " · archived" : ""}</p>
        </div>
        <Button render={<Link href={`/plans/${r.id}/dashboard`} />}>Open plan →</Button>
      </div>

      <h3 className="eyebrow mt-6">The business</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">Read from the plan, so nobody types them twice. Change them inside the plan.</p>
      <dl className="mt-2 grid grid-cols-[130px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
        {fromPlan("Address", r.address, "add the main premises on Operations")}
        {fromPlan("Email", r.email, "add it in Plan settings")}
        {fromPlan("Website", r.website, "add it in Plan settings")}
        {fromPlan("Country", r.country, "set it in Plan settings")}
      </dl>

      <h3 className="eyebrow mt-6">Contact person</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">Who you deal with at the business. Their email is where their invitation will go.</p>
      <div className="mt-2 max-w-[720px]">
        <FieldGrid>
          {box("contact_first_name", "First name", 3)}
          {box("contact_family_name", "Family name", 3)}
          {box("contact_email", "Email", 3, "email")}
          {box("contact_phone", "Phone", 3, "tel")}
        </FieldGrid>
      </div>
      {(error || note) && <p className={error ? "mt-2 text-[12.5px] font-semibold text-bad" : "mt-2 text-[12px] text-muted-foreground"} role={error ? "alert" : undefined}>{error ?? note}</p>}
    </div>
  );
}
