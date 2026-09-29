"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelTeamInvite, inviteTeammate, removeTeammate, setTeamRole } from "../actions";

export type Teammate = { user_id: string; full_name: string | null; title: string | null; email: string; role: "admin" | "advisor"; clients: number; joined: string };
export type TeamInvite = { id: string; email: string; role: "admin" | "advisor"; token: string; expires_at: string };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
const ROLE: Record<"admin" | "advisor", { label: string; what: string }> = {
  admin: { label: "Admin", what: "Sees every client. Runs the firm's details, the team and who looks after whom." },
  advisor: { label: "Advisor", what: "Sees only the clients they look after, and the ones they add." },
};

/**
 * TEAM (§6.184). No email leaves the app: an invitation is a link, copied or opened in the admin's own email,
 * the same as a client's (§6.183).
 */
export function TeamModule({ team, invites, isAdmin, me, firm, myName, origin }: {
  team: Teammate[]; invites: TeamInvite[]; isAdmin: boolean; me: string; firm: string; myName: string | null; origin: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "advisor">("advisor");
  const [fresh, setFresh] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const run = (f: () => Promise<{ ok: true } | { ok: false; error: string }>) => { setError(undefined); start(async () => {
    const res = await f();
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }); };
  const invite = () => { setError(undefined); start(async () => {
    const res = await inviteTeammate(email, role);
    if (!res.ok) { setError(res.error); return; }
    setFresh({ email: email.trim(), link: `${origin}/join/${res.token}` }); setEmail(""); router.refresh();
  }); };
  const copy = async (link: string) => { try { await navigator.clipboard.writeText(link); setCopied(link); } catch { setError("Couldn't copy — select the link and copy it by hand."); } };
  const mail = (to: string, link: string) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Join ${firm} on BizPlanHQ`)}&body=${encodeURIComponent(
    `Hi,\n\nI've added you to ${firm}'s team. Use this link to set up your login — it works for 14 days, and only with this email address:\n\n${link}\n\n${myName ?? ""}\n${firm}`,
  )}`;
  const admins = team.filter((t) => t.role === "admin").length;

  return (
    <div className="pb-10">
      <div className="border-b border-border px-5 py-4">
        <div className="eyebrow">Team</div>
        <h1 className="text-[22px] font-semibold">{team.length === 1 ? "1 person" : `${team.length} people`} in {firm}</h1>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
          An <b>admin</b> sees every client; an <b>advisor</b> sees the clients they look after. Choose who looks after each client in My Clients.
          {!isAdmin && <b className="text-foreground"> Only your firm&apos;s admin can change the team.</b>}
        </p>
        {error && <p className="mt-2 text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
      </div>

      <div className="px-5 py-4">
        <table className="w-full max-w-[980px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-[.05em] text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Name</th><th className="py-2 pr-3 font-semibold">Role</th>
              <th className="py-2 pr-3 text-right font-semibold">Clients</th><th className="py-2 pr-3 font-semibold">Joined</th>{isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.user_id} className="border-b border-border align-top">
                <td className="py-2.5 pr-3">
                  <div className="font-semibold">{t.full_name || t.email}{t.user_id === me && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}</div>
                  <div className="text-[12px] text-muted-foreground">{[t.title, t.email].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="py-2.5 pr-3">
                  {isAdmin ? (
                    <select value={t.role} disabled={busy || (t.role === "admin" && admins === 1)}
                      title={t.role === "admin" && admins === 1 ? "The firm needs at least one admin." : ROLE[t.role].what}
                      onChange={(e) => run(() => setTeamRole(t.user_id, e.target.value as "admin" | "advisor"))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-[13px]">
                      <option value="admin">Admin</option><option value="advisor">Advisor</option>
                    </select>
                  ) : ROLE[t.role].label}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{t.clients}{t.role === "admin" && <div className="text-[11px] text-muted-foreground">sees them all</div>}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{date(t.joined)}</td>
                {isAdmin && (
                  <td className="py-2.5 text-right">
                    {t.user_id !== me && (confirm === t.user_id ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        <span className="text-[12px]">Remove, and take them off {t.clients === 1 ? "their client" : `their ${t.clients} clients`}?</span>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => { setConfirm(null); run(() => removeTeammate(t.user_id)); }}>Yes, remove</Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Keep</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(t.user_id)}>Remove</Button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="px-5">
          <h2 className="mb-2 mt-2 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">Invite someone<span className="h-px flex-1 bg-border" /></h2>
          <div className="flex max-w-[980px] flex-wrap items-end gap-2">
            <label className="min-w-[260px] flex-1">
              <span className="mb-[3px] block text-[11.5px] font-semibold text-muted-foreground">Their email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@yourfirm.com"
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px]" />
            </label>
            <label>
              <span className="mb-[3px] block text-[11.5px] font-semibold text-muted-foreground">As</span>
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "advisor")} className="h-8 rounded-md border border-input bg-background px-2 text-[13px]">
                <option value="advisor">Advisor</option><option value="admin">Admin</option>
              </select>
            </label>
            <Button onClick={invite} disabled={busy || !email.trim()}>Create invitation</Button>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">{ROLE[role].what} The link works once, for 14 days, and only with that email. Send it from your own email.</p>
          {fresh && (
            <div className="mt-3 max-w-[980px] rounded-md border border-good/40 bg-good/5 p-3">
              <div className="text-[12.5px] font-semibold">Invitation for {fresh.email} — send them this link:</div>
              <LinkRow link={fresh.link} copied={copied === fresh.link} onCopy={() => copy(fresh.link)} mail={mail(fresh.email, fresh.link)} />
            </div>
          )}

          {invites.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground">Waiting to join<span className="h-px flex-1 bg-border" /></h2>
              <ul className="max-w-[980px] space-y-3">
                {invites.map((i) => (
                  <li key={i.id} className="rounded-md border border-border p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{i.email}</b><span className={cn("rounded border px-1.5 text-[11px] font-semibold border-warn/50 text-warn")}>Invited · {ROLE[i.role].label}</span>
                      <span className="text-muted-foreground">open until {date(i.expires_at)}</span>
                      <span className="flex-1" />
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => cancelTeamInvite(i.id))}>Cancel</Button>
                    </div>
                    <LinkRow link={`${origin}/join/${i.token}`} copied={copied === `${origin}/join/${i.token}`} onCopy={() => copy(`${origin}/join/${i.token}`)} mail={mail(i.email, `${origin}/join/${i.token}`)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LinkRow({ link, copied, onCopy, mail }: { link: string; copied: boolean; onCopy: () => void; mail: string }) {
  return (
    <div className="mt-2 flex gap-2">
      <input readOnly value={link} onFocus={(e) => e.target.select()} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-secondary/40 px-2.5 font-mono text-[12px]" />
      <Button size="sm" variant="outline" onClick={onCopy}>{copied ? "Copied" : "Copy link"}</Button>
      <Button size="sm" render={<a href={mail} />}>Open in my email</Button>
    </div>
  );
}
