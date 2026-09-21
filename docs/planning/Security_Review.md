# Security review — 21 September 2026

A read of the whole codebase against the question *"what could someone do to a client's plan that they
should not be able to do?"* Every finding below was proved against the code, not pattern-matched. Two
alarms were raised during the review and killed before they reached this page; they are recorded at the
bottom, because a review that only lists what survived hides how much of it was guesswork.

**Nothing here is built.** This is a document, as asked. Each finding says what to change and why, and the
fixes are small on purpose — better, not larger.

---

## What is already right, and should not be disturbed

This matters as much as the list below. Several of these are the things that most commonly go wrong in a
Supabase app, and they are not wrong here.

**Row-level security is complete.** All 38 plan-scoped tables have RLS, via an `apply_plan_rls(regclass)`
helper applied either directly or inside the `foreach` loops that also create their indexes and triggers.
No table has been added since without it.

More importantly, the predicates scope by **membership**, not by being logged in:

```sql
can_read_plan(p)  -> exists(plan_members where plan_id = p and user_id = auth.uid()) or org advisor
can_write_plan(p) -> the same, and role in ('owner','advisor')
```

The commonest RLS failure in the wild is a policy reading `auth.uid() is not null`, which looks correct and
lets every account read every row. That mistake is not here.

**No service-role client exists in application code.** Nothing imports one, nothing constructs one. Every
query in the app runs as the signed-in user and obeys RLS, including the report gather and both AI routes.
This is why a request for someone else's plan id returns nothing rather than their data.

**Storage is private and narrow.** The `plan-logos` bucket is `public = false`, capped at 2 MB, restricted
to PNG and JPEG, with per-object policies that derive the plan id from the object path and run it through
the same `can_read_plan` / `can_write_plan`. SVG is excluded deliberately and the migration says why: it is
a document that can carry script.

**The chart SVG is escaped.** `reports/ReportsModule.tsx` renders chart markup with
`dangerouslySetInnerHTML`, which is the first thing worth checking in any codebase — and chart labels carry
client-typed product names. Every string reaching the SVG goes through `esc()` in `charts.ts`, covering
`&`, `<`, `>` and `"`. The `alt` text bypasses `esc`, but lands in a React `aria-label` and in the docx
`altText`, both of which escape on their own. **No stored XSS.**

**Secrets are handled correctly.** Exactly two `NEXT_PUBLIC_` variables exist, and both are meant to be
public. `OPENROUTER_API_KEY` has no such prefix, is read in one file, and that file throws if it ever finds
itself in a browser. `.gitignore` covers `.env*` with an exception only for `.env.example`, and `git
ls-files` confirms nothing else was ever committed.

**Dependencies are clean.** `npm audit --omit=dev` reports zero vulnerabilities.

---

## 1. Open redirect in the auth callback — **fix first**

`src/app/auth/callback/route.ts`

```ts
const next = url.searchParams.get("next") ?? "/setup";
...
return NextResponse.redirect(new URL(next, url.origin));
```

`next` comes from the query string and is never checked. `new URL()` resolves an absolute or
protocol-relative value against nothing at all:

```
new URL("https://evil.com", "https://bizplanhq.com")  ->  https://evil.com/
new URL("//evil.com",       "https://bizplanhq.com")  ->  https://evil.com/
```

So `https://bizplanhq.com/auth/callback?code=…&next=https://evil.com` is a link on **your** domain that
lands the client on someone else's. The session is established on the real origin first, so this is not a
token leak — it is a phishing primitive, and a good one, because the domain in the link is genuine and the
user has just been told to click it by an email from you.

**Fix.** Resolve, then refuse anything that left the origin.

```ts
const dest = new URL(next, url.origin);
const safe = dest.origin === url.origin ? dest.pathname + dest.search : "/setup";
return NextResponse.redirect(new URL(safe, url.origin));
```

Comparing the *resolved* origin is what makes this correct. Every string-prefix test for this is wrong, as
the next finding shows.

---

## 2. The same hole in sign-in, behind a guard that does not guard

`src/app/(auth)/actions.ts`

```ts
redirect(next.startsWith("/") ? next : "/setup");
```

The intent is right and the test is insufficient. `"//evil.com".startsWith("/")` is `true`, and so is
`"/\evil.com".startsWith("/")`. Both resolve off-origin.

This one is reached through the `next` parameter that `proxy.ts` itself adds when it bounces an
unauthenticated request to `/login`, so the path is entirely ordinary.

**Fix.** The same resolve-and-compare as above. Worth extracting once — `safeNext(next, origin)` in
`src/lib/` — precisely because it has now been written twice and got it wrong both times.

---

## 3. Nothing limits what drafting can cost — **the one that hurts silently**

Already on the open items list as #12 after §6.116. Reading the routes made it sharper than it looked.

There is no rate limit, no per-plan cap and no daily ceiling on `/ai/draft` or `/ai/goals`. And the request
body is unbounded:

```ts
let body: { field?: string; row?: string; answers?: { question: string; answer: string }[] };
```

`answers` is client-supplied, has no length cap on the array or on any string in it, and goes straight into
the prompt. `max_tokens: 700` limits what the model *writes*; it does nothing about what it *reads*, and
input tokens are billed. A scripted POST with a few megabytes of `answers`, in a loop, is a bill.

That this needs a signed-in session and a plan the caller owns is not much protection: signing up is free.

**Fix, in the order that buys the most per line changed.**

1. **Bound the input where it is parsed.** Cap `answers` at the number of questions the field actually has,
   and each answer at something like 2 000 characters. The dialog cannot produce more; only a crafted
   request can, so rejecting it costs a legitimate client nothing.
2. **A per-plan counter with a ceiling.** The `ai_calls` table already exists and already has RLS. One
   insert per request and one count before it is a rate limit that survives a restart, which an in-memory
   counter on Vercel does not.
3. **A per-request timeout** on the provider call, so a hung upstream cannot hold a function open.

---

## 4. Forty-nine places hand raw Postgres errors to the browser

```ts
return { ok: false, error: `Couldn't save: ${error.message}` };
```

Across every module's `actions.ts`. §6.98 was right that a failed save is the one message a client cannot
afford to miss — but `error.message` from PostgREST carries column names, constraint names, table names and
sometimes the offending value, and it goes on screen.

It is not a breach on its own. It is free reconnaissance for anyone probing, and it is confusing for the
client it is shown to: *"duplicate key value violates unique constraint plan_goals_area_key"* tells a
concreter nothing.

**Fix, and it improves the product as well as the security.** One helper:

```ts
/** What the client sees, and what only the log sees. */
const saveFailed = (what: string, e: PostgrestError) => {
  console.error(what, e);
  return { ok: false, error: `Couldn't save ${what}. Try again — nothing was lost.` } as const;
};
```

The detail keeps going to `console.error`, where it is actually useful. This is a smaller codebase
afterwards, not a larger one: 49 bespoke strings become one.

---

## 5. Sign-up confirms whether an email is already registered

`signUp` returns `error.message` unchanged, so Supabase's *"User already registered"* reaches the browser.
That is user enumeration: an attacker can test an address list against your platform and learn who banks
with you.

`signIn` already gets this right — *"That email and password don't match"* — so the codebase disagrees with
itself.

**Fix.** Return the same neutral notice whether the address is new or known: *"We've sent a confirmation
link to <email>. Open it to finish creating your account."* Supabase sends the right mail either way.

---

## 6. No security headers

`next.config.ts` sets `serverExternalPackages` and nothing else. There is no CSP, HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` or `Permissions-Policy`.

The most valuable of these for this app is **`X-Frame-Options: DENY`** (or a CSP `frame-ancestors 'none'`):
without it your signed-in app can be framed by another site, and a business plan is exactly the sort of
thing worth clickjacking a client into sharing or deleting.

**Fix.** A `headers()` block in `next.config.ts`. Start with the four that cannot break anything:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

A real Content-Security-Policy is worth having and is a separate job — Next's inline scripts need a nonce,
and a CSP added carelessly breaks the app in ways that only show up in production. Do the four above now;
do CSP deliberately, later, with `Content-Security-Policy-Report-Only` first.

---

## 7. `SUPABASE_SECRET_KEY` is documented but unused

`.env.example` advertises it, correctly labelled *"bypasses Row Level Security"*. Nothing in `src/` reads
it, which is the right state — but the example invites the next person to set it, and the day somebody
reaches for it to solve an awkward query, every guarantee in this document stops being true.

**Fix.** Delete the line from `.env.example` until something legitimately needs it, and say in one comment
that server code runs as the signed-in user on purpose. If it is set in `.env.local` today, unset it — an
unused RLS-bypassing key in an environment is a liability with no upside.

---

## 8. Two smaller things

**A foreign plan id downloads a blank document.** `reports/download/route.ts` is a route handler, so it does
not run the layout that checks plan membership. RLS means no data leaks — every query returns nothing — but
the client gets an empty Word file rather than a 404. Not a security hole; a confusing one. One
`getSession()` membership check at the top turns it into `notFound()`.

**Prompt injection across the advisor boundary.** Plan text goes into the model, and an advisor
(`is_org_advisor`) can read and draft against plans they do not own. A client could put instructions in
their own plan aimed at a draft an advisor later generates. Low severity while advisors are trusted
colleagues, and worth remembering before advisor access is ever sold to strangers.

---

## What was suspected and is not true

Recorded so nobody re-investigates them, and so the findings above are read knowing what the miss rate was.

**"There is no middleware."** There is. Next.js 16 renamed it, and it is `src/proxy.ts`, which calls
`updateSession` and guards every path except the static matcher. The `middleware.ts` in `.next/` is a build
artefact.

**"26 of 38 plan-scoped tables have no RLS."** They all have it. The first pass grepped for
`alter table … enable row level security` and for direct `apply_plan_rls('name')` calls, and missed the
`foreach t in array array[…] loop … perform apply_plan_rls(t::regclass)` blocks that cover most tables. The
corrected count is 38 of 38.

> This one is worth keeping on the page. It was about to be reported as critical, and it was wrong. A
> security review that reports what a grep suggested is worse than no review, because it spends the trust
> that a real finding needs.

---

## If only three things get done

1. **The two open redirects.** Ten lines, one shared helper, closes a live phishing vector.
2. **The input bound and the `ai_calls` ceiling.** It is the only item that costs money while nobody is
   looking.
3. **The four security headers.** One config block, no behaviour change, and `X-Frame-Options` alone is
   worth it.

Everything else is real and can wait for a quiet afternoon.

---

## What this review did not cover

Said plainly, because an unqualified "it's secure" is the least useful sentence in security.

- **The live database was not inspected.** This reads the 44 migrations, which are the intent. Drift
  between them and the running Supabase project is invisible from here. Worth confirming once, from the
  SQL editor:
  ```sql
  select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relrowsecurity, c.relname;
  ```
  Every row should read `true`.
- **Supabase project settings** — password policy, email confirmation, JWT expiry, leaked-password
  protection, allowed redirect URLs. All of those live in the dashboard, not the repo. The allowed-redirect
  list is directly relevant to findings 1 and 2 and is worth tightening there as well as in code.
- **No penetration testing.** Nothing was executed against a running instance; this is a code read.
- **Vercel deployment configuration** — environment scoping, preview-deployment protection.
