import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/Brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptButton, InviteSignup } from "./InviteForms";

/**
 * AN INVITATION TO A PLAN (§6.183) — the page the consultant's link opens.
 *
 * It says whose plan and from which firm, then gets the reader in: create a login with the email the
 * invitation was sent to, or sign in with it. Accepting is one SQL function that checks the signed-in email
 * matches the invitation and that it is still open (0060); nothing here decides that.
 *
 * Outside the signed-in area on purpose — the person opening it usually has no account yet.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: rows }, { data: { user } }] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const inv = (rows as { business_name: string; firm_name: string; email: string; state: string }[] | null)?.[0] ?? null;
  const here = `/invite/${token}`;

  const shell = (title: string, desc: React.ReactNode, body?: React.ReactNode) => (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-center"><Brand height={30} /></div>
        <Card>
          <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{desc}</CardDescription></CardHeader>
          {body && <CardContent>{body}</CardContent>}
        </Card>
      </div>
    </main>
  );

  if (!inv) return shell("This link doesn't work", "It may have been copied incompletely. Ask your Planner to send it again.");
  if (inv.state !== "open") {
    const why = { used: "It has already been used.", expired: "It has expired — links last 14 days.", revoked: "Your Planner has replaced or withdrawn it." }[inv.state] ?? "";
    return shell("This invitation is closed", <>{why} If you already have a login, <Link className="font-semibold text-primary" href="/login">sign in</Link>. Otherwise ask your Planner for a new link.</>);
  }

  const intro = <>{inv.firm_name} has invited you to <b>{inv.business_name}</b>&apos;s business plan.</>;

  if (!user) {
    return shell("You're invited", intro, (
      <>
        <InviteSignup email={inv.email} next={here} />
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          Already have a login with {inv.email}? <Link className="font-semibold text-primary" href={`/login?next=${encodeURIComponent(here)}`}>Sign in</Link>
        </p>
      </>
    ));
  }

  if ((user.email ?? "").toLowerCase() !== inv.email.toLowerCase()) {
    return shell("This invitation is for someone else", <>It was sent to <b>{inv.email}</b>, and you&apos;re signed in as <b>{user.email}</b>. Sign out, then open the link again and use {inv.email}.</>, (
      <form action="/auth/signout" method="post"><Button type="submit" variant="outline" className="w-full">Sign out</Button></form>
    ));
  }

  return shell("You're invited", intro, <AcceptButton token={token} />);
}
