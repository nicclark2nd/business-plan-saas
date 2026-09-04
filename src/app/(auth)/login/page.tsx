"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const next = useSearchParams().get("next") ?? "";
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-[13px] text-muted">Welcome back. Pick up your plan where you left it.</p>
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {state?.error && <p className="rounded bg-bad-soft px-3 py-2 text-[13px] text-bad">{state.error}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">New here? <Link className="font-semibold text-primary" href="/signup">Create an account</Link></p>
    </div>
  );
}
