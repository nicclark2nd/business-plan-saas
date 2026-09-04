"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.notice) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-[13px] text-muted">{state.notice}</p>
        <p className="mt-4 text-[13px]"><Link className="font-semibold text-primary" href="/login">Back to sign in</Link></p>
      </div>
    );
  }
  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-[13px] text-muted">Takes a minute. You&apos;ll set up your business on the next screen.</p>
      <form action={action} className="mt-5 space-y-4">
        <div className="field"><label htmlFor="full_name">Your name</label><input id="full_name" name="full_name" autoComplete="name" required /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /><p className="mt-1 text-xs text-muted">At least 8 characters.</p></div>
        {state?.error && <p className="rounded bg-bad-soft px-3 py-2 text-[13px] text-bad">{state.error}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">Already have an account? <Link className="font-semibold text-primary" href="/login">Sign in</Link></p>
    </div>
  );
}
