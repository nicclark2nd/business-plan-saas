import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/Brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteSignup } from "@/app/invite/[token]/InviteForms";
import { JoinButton } from "./JoinButton";

/**
 * AN INVITATION TO JOIN A FIRM'S TEAM (§6.184) — the page an admin's link opens. The same shape as a client's
 * invitation (§6.183): whose firm and which role, then create a login with that email or sign in with it.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: rows }, { data: { user } }] = await Promise.all([
    supabase.rpc("team_invitation_preview", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const inv = (rows as { firm_name: string; email: string; role: string; state: string }[] | null)?.[0] ?? null;
  const here = `/join/${token}`;

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

  if (!inv) return shell("This link doesn't work", "It may have been copied incompletely. Ask your firm's admin to send it again.");
  if (inv.state !== "open") {
    const why = { used: "It has already been used.", expired: "It has expired — links last 14 days.", revoked: "It was replaced or cancelled." }[inv.state] ?? "";
    return shell("This invitation is closed", <>{why} If you already joined, <Link className="font-semibold text-primary" href="/login">sign in</Link>. Otherwise ask for a new link.</>);
  }

  const intro = <>You&apos;re invited to join <b>{inv.firm_name}</b> as {inv.role === "admin" ? "an admin" : "an advisor"}.</>;

  if (!user) {
    return shell("Join the team", intro, (
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
  return shell("Join the team", intro, <JoinButton token={token} firm={inv.firm_name} />);
}
