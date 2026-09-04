"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormMessage";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const next = useSearchParams().get("next") ?? "";
  return (
    <Card>
      <CardHeader><CardTitle>Sign in</CardTitle><CardDescription>Welcome back. Pick up your plan where you left it.</CardDescription></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          <FormError>{state?.error}</FormError>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">New here? <Link className="font-semibold text-primary" href="/signup">Create an account</Link></p>
      </CardContent>
    </Card>
  );
}
