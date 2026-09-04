"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormMessage";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.notice) {
    return (
      <Card>
        <CardHeader><CardTitle>Check your email</CardTitle><CardDescription>{state.notice}</CardDescription></CardHeader>
        <CardContent><Link className="text-[13px] font-semibold text-primary" href="/login">Back to sign in</Link></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Create your account</CardTitle><CardDescription>Takes a minute. You&apos;ll set up your business on the next screen.</CardDescription></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="full_name">Your name</Label><Input id="full_name" name="full_name" autoComplete="name" required /></div>
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /><p className="text-xs text-muted-foreground">At least 8 characters.</p></div>
          <FormError>{state?.error}</FormError>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">Already have an account? <Link className="font-semibold text-primary" href="/login">Sign in</Link></p>
      </CardContent>
    </Card>
  );
}
