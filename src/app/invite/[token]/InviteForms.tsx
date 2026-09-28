"use client";

import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { acceptInvitation } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormMessage";

/** A new client's login, with the email the invitation was sent to — the one address it will accept. */
export function InviteSignup({ email, next }: { email: string; next: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.notice) {
    return <p className="text-[13px]">{state.notice} The link in that email brings you straight back here.</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={email} />
      <div className="space-y-1.5"><Label htmlFor="email_shown">Email</Label><Input id="email_shown" value={email} disabled /></div>
      <div className="space-y-1.5"><Label htmlFor="full_name">Your name</Label><Input id="full_name" name="full_name" autoComplete="name" required /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Choose a password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /><p className="text-xs text-muted-foreground">At least 8 characters.</p></div>
      <FormError>{state?.error}</FormError>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating…" : "Create my login"}</Button>
    </form>
  );
}

export function AcceptButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormError>{state?.error}</FormError>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Opening…" : "Open my plan →"}</Button>
    </form>
  );
}
