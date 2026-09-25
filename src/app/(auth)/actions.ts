"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

export type AuthState = { error?: string; notice?: string } | undefined;

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "That email and password don't match. Check them and try again." };
  /*
   * This used to be `next.startsWith("/")`, which passes `//evil.com` (§6.119). The parameter is put there
   * by `proxy.ts` when it bounces an unauthenticated request to /login, so the path is entirely ordinary
   * and the hole was reachable without anything unusual happening.
   */
  redirect(safeNext(formData.get("next") as string | null));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback` },
  });
  /*
   * THE SAME ANSWER WHETHER THE ADDRESS IS NEW OR KNOWN (§6.119).
   *
   * Supabase returns "User already registered", and returning it verbatim let anyone test an address list
   * against this platform and learn who banks here. `signIn` already refuses to say which half of the pair
   * was wrong; this screen was disagreeing with that one.
   *
   * Supabase sends the right mail either way — a confirmation to a new address, a "you already have an
   * account" to a known one — so the client who genuinely owns the address is never stuck.
   */
  const sent = { notice: `We've sent a confirmation link to ${email}. Open it to finish creating your account.` };
  if (error) {
    console.error("signup", error);
    return sent;
  }
  if (!data.session) return sent;
  redirect("/setup");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
