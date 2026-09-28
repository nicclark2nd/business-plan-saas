"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, FieldGrid, FieldInput } from "@/components/module/FieldGrid";
import { cn } from "@/lib/utils";
import { SetupForm } from "../../setup/SetupForm";
import { assignPlanner, inviteClient, revokeClientAccess, saveClientContact, setClientDownload, type ContactPatch } from "../actions";

type Contact = Required<{ [K in keyof ContactPatch]: string | null }>;
export type ClientRow = {
  id: string; businessName: string; archived: boolean; createdAt: string; planYears: string;
  address: string | null; email: string | null; website: string | null; country: string | null;
  contact: Contact;
  /** May the client download their own business plan (§6.183). */
  canDownload: boolean;
  /** Who in the firm looks after this client (§6.184). */
  planners: string[];
  access: { state: "none" | "invited" | "expired" | "active" | "off"; email: string | null; token: string | null; expiresAt: string | null; since: string | null };
};

/** The client's access in four words the list can show at a glance (§6.183). */
const ACCESS: Record<ClientRow["access"]["state"], { label: string; tone: string }> = {
  none: { label: "Not invited", tone: "border-border text-muted-foreground" },
  invited: { label: "Invited", tone: "border-warn/50 text-warn" },
  expired: { label: "Link expired", tone: "border-bad/40 text-bad" },
  active: { label: "Active", tone: "border-good/50 text-good" },
  off: { label: "Access off", tone: "border-border text-muted-foreground" },
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
const person = (c: Contact) => [c.contact_first_name, c.contact_family_name].filter(Boolean).join(" ");

/**
 * MY CLIENTS (§6.182) — the list on the left, the business picked on the right, as the old system had it and
 * without what it needed only because it was built a decade ago (passwords on screen, counted credits).
 * Invite, access and the three scores arrive in part 2.
 */
export type Person = { id: string; name: string; role: string };

export function ClientsModule({ team, isAdmin, meId, rows, others, selected, firm, me, origin }: {
  team: Person[]; isAdmin: boolean; meId: string;
  rows: ClientRow[]; others: { id: string; businessName: string }[]; selected: string | null;
  firm: { country: string | null; currency: string; name: string };
  me: { name: string | null };
  origin: string;
}) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(selected && rows.some((r) => r.id === selected) ? selected : rows.find((r) => !r.archived)?.id ?? rows[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  /* An admin sees every client; "whose" narrows the list to one teammate's (§6.184). */
  const [whose, setWhose] = useState<string>("all");
  const nameOf = (id: string) => team.find((t) => t.id === id)?.name ?? "Someone who left";
  const shown = useMemo(() => rows.filter((r) => (showArchived || !r.archived) && (whose === "all" || (whose === "none" ? !r.planners.length : r.planners.includes(whose))) && (!q.trim() || `${r.businessName} ${person(r.contact)} ${r.contact.contact_email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, showArchived, whose]);
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
            {isAdmin && team.length > 1 && (
              <select value={whose} onChange={(e) => setWhose(e.target.value)} aria-label="Whose clients"
                className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-[13px]">
                <option value="all">Every client in the firm</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.id === meId ? "Looked after by me" : `Looked after by ${t.name}`}</option>)}
                <option value="none">Nobody looks after yet</option>
              </select>
            )}
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
                    {team.length > 1 && <span className="block truncate text-[11.5px] text-muted-foreground">{r.planners.length ? r.planners.map(nameOf).join(", ") : "Nobody assigned"}</span>}
                  </span>
                  {r.archived
                    ? <span className="rounded border border-border px-1.5 text-[10.5px] text-muted-foreground">Archived</span>
                    : <span className={cn("shrink-0 rounded border px-1.5 text-[10.5px] font-semibold", ACCESS[r.access.state].tone)}>{ACCESS[r.access.state].label}</span>}
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
          {current ? <ClientPanel key={current.id} r={current} firm={firm.name} me={me.name} origin={origin} team={team} isAdmin={isAdmin} /> : (
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

function ClientPanel({ r, firm, me, origin, team, isAdmin }: { r: ClientRow; firm: string; me: string | null; origin: string; team: Person[]; isAdmin: boolean }) {
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

      <LookedAfterBy r={r} team={team} isAdmin={isAdmin} />

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

      <ClientAccess r={r} contact={c} firm={firm} me={me} origin={origin} />
    </div>
  );
}

/**
 * WHO LOOKS AFTER THIS CLIENT (§6.184). An advisor sees only the clients they look after; an admin sees all
 * and decides. The first person listed is the one on the client's "Your Planner" card, unless someone else
 * sent the invitation they accepted.
 */
function LookedAfterBy({ r, team, isAdmin }: { r: ClientRow; team: Person[]; isAdmin: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState<string[]>(r.planners);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  if (team.length < 2 && !isAdmin) return null;
  const flip = (id: string, v: boolean) => {
    setError(undefined); setOn((x) => (v ? [...x, id] : x.filter((y) => y !== id)));
    start(async () => {
      const res = await assignPlanner(r.id, id, v);
      if (!res.ok) { setError(res.error); setOn((x) => (v ? x.filter((y) => y !== id) : [...x, id])); return; }
      router.refresh();
    });
  };
  return (
    <>
      <h3 className="eyebrow mt-6">Looked after by</h3>
      {isAdmin ? (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
          {team.map((t) => (
            <label key={t.id} className="flex items-center gap-1.5">
              <input type="checkbox" checked={on.includes(t.id)} disabled={busy} onChange={(e) => flip(t.id, e.target.checked)} />
              {t.name}{t.role === "admin" && <span className="text-[11.5px] text-muted-foreground">(admin)</span>}
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[13px]">{on.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean).join(", ") || "Nobody yet"}</p>
      )}
      {isAdmin && <p className="mt-1 text-[11.5px] text-muted-foreground">An advisor sees this client only while they are ticked. Admins see every client either way.</p>}
      {error && <p className="mt-1 text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
    </>
  );
}

/**
 * CLIENT ACCESS (§6.183) — invite, see where it stands, turn it off, and whether they may download.
 *
 * NO EMAIL LEAVES THE APP. Nic: the email comes from the consultant. So the link is shown, copied, or opened in
 * the consultant's own email program with the message already written — they press send, from their own
 * address, and the client sees it come from the person they know.
 */
function ClientAccess({ r, contact, firm, me, origin }: { r: ClientRow; contact: Contact; firm: string; me: string | null; origin: string }) {
  const router = useRouter();
  const [token, setToken] = useState(r.access.token);
  const [expires, setExpires] = useState(r.access.expiresAt);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, start] = useTransition();
  const [allow, setAllow] = useState(r.canDownload);

  const link = token ? `${origin}/invite/${token}` : null;
  const state = token && r.access.state !== "active" ? "invited" : r.access.state;
  const first = contact.contact_first_name || "there";
  const mail = link && contact.contact_email ? `mailto:${encodeURIComponent(contact.contact_email)}?subject=${encodeURIComponent(`Your login to ${r.businessName}'s business plan`)}&body=${encodeURIComponent(
    `Hi ${first},\n\nI've set up ${r.businessName}'s business plan for us to work on together. Use this link to create your login — it works for 14 days, and only with this email address:\n\n${link}\n\nAny questions, just reply.\n\n${me ?? ""}\n${firm}`,
  )}` : null;

  const invite = () => { setError(undefined); start(async () => {
    const res = await inviteClient(r.id);
    if (!res.ok) { setError(res.error); return; }
    setToken(res.token); setExpires(res.expiresAt); setCopied(false); router.refresh();
  }); };
  const off = () => { setError(undefined); setConfirmOff(false); start(async () => {
    const res = await revokeClientAccess(r.id);
    if (!res.ok) { setError(res.error); return; }
    setToken(null); router.refresh();
  }); };
  const download = (v: boolean) => { setError(undefined); setAllow(v); start(async () => {
    const res = await setClientDownload(r.id, v);
    if (!res.ok) { setError(res.error); setAllow(!v); return; }
    router.refresh();
  }); };
  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("Couldn't copy — select the link and copy it by hand."); } };

  const when = (iso: string | null) => (iso ? date(iso) : "");
  return (
    <>
      <h3 className="eyebrow mt-7">Client access</h3>
      <div className="mt-2 max-w-[720px] rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className={cn("rounded border px-1.5 text-[11px] font-semibold", ACCESS[state].tone)}>{ACCESS[state].label}</span>
          <span className="text-muted-foreground">
            {state === "none" && "The client has no login to this plan yet."}
            {state === "invited" && <>Link for {r.access.email ?? contact.contact_email}, open until {when(expires)}.</>}
            {state === "expired" && <>The last link ran out on {when(r.access.expiresAt)}. Send a new one.</>}
            {state === "active" && <>{r.access.email ?? "The client"} has been in since {when(r.access.since)}.</>}
            {state === "off" && "Their access is off. You can invite them again."}
          </span>
        </div>

        {link && state === "invited" && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-secondary/40 px-2.5 font-mono text-[12px]" />
              <Button size="sm" variant="outline" onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
              {mail && <Button size="sm" render={<a href={mail} />}>Open in my email</Button>}
            </div>
            <p className="text-[11.5px] text-muted-foreground">Send it from your own email. It works once, for 14 days, and only with {contact.contact_email}.</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {state !== "active" && (
            <Button size="sm" onClick={invite} disabled={busy || !contact.contact_email}>
              {state === "invited" ? "Make a new link" : state === "none" ? "Create invitation" : "Invite again"}
            </Button>
          )}
          {!contact.contact_email && state !== "active" && <span className="text-[12px] text-muted-foreground">Add the contact person&apos;s email above first.</span>}
          {(state === "active" || state === "invited") && !confirmOff && (
            <Button size="sm" variant="outline" onClick={() => setConfirmOff(true)} disabled={busy}>Turn access off</Button>
          )}
          {confirmOff && (
            <>
              <span className="text-[12.5px]">{state === "active" ? "Take the client out of this plan now?" : "Cancel the link?"}</span>
              <Button size="sm" variant="outline" onClick={off} disabled={busy}>Yes, turn it off</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmOff(false)} disabled={busy}>Keep it</Button>
            </>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[13px]">
          <input type="checkbox" checked={allow} disabled={busy} onChange={(e) => download(e.target.checked)} />
          The client may download their own business plan
        </label>
        {error && <p className="mt-2 text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
      </div>
    </>
  );
}
