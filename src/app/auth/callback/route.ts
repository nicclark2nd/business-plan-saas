import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

/** Email-confirmation and magic-link landing: exchanges the code for a session, then sends the user on. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  /*
   * `next` arrives from the query string of a link in an email, so it is as untrusted as anything gets
   * (§6.119). `safeNext` resolves it and refuses anything that leaves this origin; the result is always a
   * path, which is why it is safe to hand back to `new URL(…, url.origin)` below.
   */
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
