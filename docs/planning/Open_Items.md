# Open items

Everything known to be unfinished, and who has to decide it. Kept here rather than in a conversation
because a conversation is not a record — this list has been carried in someone's head across every
session so far, which is exactly how an item gets quietly dropped.

An item leaves this list when it is **built and seen working**, not when it is decided.

**Legend** — **Nic** needs a decision from Nic before anything can be built. **Build** is specified
well enough to start. **Nic's own** is outside the codebase.

---

## Promises the app has made and not kept

These are §6.87 faults: a field, a column or a step exists, so a client reasonably expects it to do
something, and it does not.

### 1. The guided path can never reach 17 of 17 — **Nic**

`lib/nav.ts` has seventeen steps. The completeness panel has no row for step 17 (the business plan
itself), so the path tops out at sixteen and a client who has done everything is never told so.

The question is what "done" means for the last step: the document has been downloaded once? Every
prior step is complete? Something the client ticks themselves? Each is defensible and they behave
differently, which is why this is a decision and not a build.

### 2. `plan_people_succession` is a table with no screen — **Build**

A column with no editor is not data (§6.89). The table exists, nothing writes to it, and the SWOT
weakness that §6.94 deleted comes back the moment it does — a plan that names no successor for a
key person has a real weakness, and the app should say so rather than quietly not asking.

### 3. The Assets group is three stubs — **Build**

`social`, `memberships` and `ip` all carry `tag: "soon"` in the nav. A client sees three menu items
that go nowhere. Either build them or take them out of the nav until they exist; a "soon" that has
been soon for a while is a promise with no date on it.

---

## Verification owed

### 4. Error surfacing was only ever driven on one module — **Build**

§6.98 put a failed save next to the field that failed, with the footer as the summary, across all
thirteen modules. Exactly one of them — Plan settings — was driven live with a real failure. The
other twelve are covered by tests, and a green suite proves nothing about what a client sees
(§6.92.1). Each needs a save forced to fail while someone watches the screen.

### 5. Nobody has taken a fresh plan from step 1 to step 17 — **Build**

Every module has been checked in isolation, on a plan that already had data in it. No one has
started an empty plan and walked it the way a client will, which is the only way the joins between
steps get tested. Recommended several times; still not done.

---

## Decisions with no deadline

### 6. `tax_region` is a state for one country — **Nic**

§6.95.1 captures a main state of operation so the plan can name the governing law. The column only
carries a meaningful list for some countries. Widening it to every country is real work and may not
be worth it; the fallback ("local laws") is honest. Decide whether to widen it or leave it.

### 7. The Word document is not in the app's typeface — **Nic**

The document sets Calibri and `#1F3A5F`. The app is Open Sans and `#1F6FCB`. Neither was chosen —
both were inherited, and they disagree. Aligning the document to the app is a small change with a
visible result; leaving it is defensible if a bank-facing document is meant to look like every other
Word document a bank receives. What is not defensible is not having decided.

---

## Loose ends from a fix that was only half taken

### 10. Two downloads in the same month still collide — **Build**

§6.102 put *"This version prepared 18 September 2026"* on the notice page, so two copies of a plan can now
be told apart once they are open. The filename still cannot: `docxFileName` is built from the cover's
month-and-year, so both are `Name-Business-Plan-September-2026.docx` and the second saves as `(1)` or
overwrites the first. A Downloads folder is where a client looks before they open anything.

### 11. Every date in the document is formatted `en-AU` — **Nic**

Including for a plan whose country is somewhere else. §6.93 made the paper size follow the country; the
date format never did. It is all of them or none — one document with two conventions in it is worse than
one with the wrong convention — so it needs a decision before it needs work.

---

## The AI, now that it is built

§6.105 to §6.115 shipped the drafting. Two things were deliberately left, and they are here rather than in
Note 4 because neither is a design question any more.

### 13. An accepted written draft records nothing — **Nic**

A goal taken from the drafter writes `source: "ai"` and the screen can say so. A vision, a brand promise or
a positioning line taken from a draft button records nothing at all — the tables have no column for it, so
this is a migration and not a tweak.

The question underneath is whether a client WANTS it visible. It is honest, and it is also a label on their
own business plan saying a machine helped write it. Worth asking one before building either.

## From the security review — 21 September 2026

> **Built and seen working, so removed from this list (§6.119):** the drafting ceiling (was #12) and the
> security headers (was #16). The ceiling was verified by a real draft after migration 0045 — which proved
> both halves of it, since a failed count or a refused meter insert would have returned 503 — and by a 10MB
> hostile body with 204 answers, malformed entries and a 50KB row name, which came back as a normal
> 260-character draft in 3.8 seconds, the same as a legitimate request. The headers were read off a live
> response.
>
> **What is NOT proven:** the 120-a-day threshold actually firing. That needs 120 calls and has not been
> done. The count query is known to run and the insert is known to land; the comparison between them is
> arithmetic nobody has executed.

Full reasoning in `Security_Review.md`. Listed here because this file is the record of what is unfinished.

### 14. Two open redirects — **built §6.119, one half not yet seen working**

Closed by `safeNext()`, which resolves the URL and compares origins. The function is proved by tests on the
exact payloads that defeated the old check (`//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:`).

**What has not been seen working:** the callback's `next` only applies after a SUCCESSFUL code exchange, so
exercising it live needs a real magic link from a real email. The wiring is one line at each of two call
sites and the function beneath it is tested, but the live path has not been walked. Worth doing once, the
next time a confirmation email is going out anyway.

### 15. Raw Postgres errors reach the browser in 49 places — **Build**

`Couldn't save: ${error.message}` carries column names, constraint names and sometimes values onto a
client's screen. One helper replaces all 49, keeps the detail in `console.error` where it is useful, and
leaves the codebase smaller.

### 17. Sign-up confirms whether an email is already registered — **built §6.119, not yet seen working**

Sign-up now returns the same notice whether the address is new or known, and logs the real error rather
than showing it.

**What has not been seen working:** proving it needs a sign-up attempt with an address that already has an
account, on a deployment that sends real mail. Two minutes when there is a spare moment, and worth doing —
this is the kind of fix that looks right in the diff and can still be wrong about which branch Supabase
takes.

### 18. `SUPABASE_SECRET_KEY` is advertised and unused — **Nic**

`.env.example` invites the next person to set an RLS-bypassing key that nothing reads. Delete the line, and
unset it in any environment that has it.

### 19. Confirm the live database matches the migrations — **Nic's own**

The review read 44 migrations, which are the intent, and found RLS complete on all 38 plan-scoped tables.
Drift between that and the running project is invisible from the repo. One query in the SQL editor settles
it; it is in `Security_Review.md`.

## Found while fixing the dashboard margin (§6.118)

### 20. Two page frames, two gutters, two backgrounds — **Nic**

The dashboard's phantom 140px margin is fixed. Behind it sits the same fault one layer down:

| Frame | Used by | Gutter | Background |
|---|---|---|---|
| `StepFrame` | the guided steps (Vision, and the rest of the 1–17 path) | `px-7` | `bg-background` |
| `ModuleFrame` | Marketing, Competitors, Operations, Sales, Goals, the financials | `px-5` | `bg-card` |

Nobody notices because the two are never on screen together — you navigate from one to the other and the
content shifts 8px and the panel colour changes. It is not broken and it is not designed either.

Needs a decision before it needs work: **one gutter for the app**, and whether a module screen should keep
its own card background or sit on the page like a step does. Then it is a five-minute change in two files.

## Found by Nic typing 99999 into a box (§6.121)

### 21. Twelve other modules still do not reconcile after a save — **Build**

Plan settings now hands back the row it stored and the screen adopts it, so a clamped value corrects itself
in front of the client and the footer names what changed. **No other module does this.**

Every one of them clamps on the way in — `Math.min(5, Math.max(1, …))` and friends appear about fifty times
across thirteen action files — and clamping is RIGHT: a 99999% tax rate reaching the forecast is worse than
a refusal. The fault is never the clamp. It is that the screen keeps showing what was typed and only
learns the truth on a refresh nobody has a reason to do.

The mechanism is now written once and proven. What is left is applying it, which is a per-module job
because each keeps its own state shape: return the stored row from the action, merge it into the module's
state on success, surface anything adjusted through the footer note the frame already owns.

**Start with Sales.** Its clamps bite hardest — `start_selling_year` snaps to 1–5 and `client_life_months`
to 1–600 — and a product line quietly starting in a different year than the client typed changes the
forecast without ever showing on the screen they typed it on.

## Waiting on the domain

### 8. A shared link previews as a blank rectangle — **Build, after the domain**

There is no `metadata.openGraph` and no preview image, so a BizPlanHQ link pasted into Slack,
LinkedIn or a message renders as nothing. Small job — metadata in `app/layout.tsx` and one image —
but it wants the real domain first, and it matters precisely because the people a link gets shared
with are the people worth impressing.

### 9. Point the domain at Vercel — **Nic's own**

Domain is held in GoDaddy and not connected. Vercel issues the certificate; the records are pasted
into GoDaddy. Nothing in the app changes.

---

## Closed, so nobody investigates it twice

### Word's "fields that may refer to other files" dialog — **not a fault, do not chase**

Opening a downloaded plan shows: *"This document contains fields that may refer to other files. Do you want
to update the fields in this document?"*

**The file contains no external links.** Every relationship in it was audited: styles, settings, fonts,
numbering, headers, footers, and the logo embedded at `word/media/`. Zero external targets. The only fields
are `TOC`, `PAGE` and `NUMPAGES`, all internal.

The dialog comes from the TOC field's own `w:dirty="true"` marker — Word's way of being told "refresh this
when you open the document". It was first blamed on `<w:updateFields w:val="true"/>` in settings.xml; two
otherwise identical files were built, one with that flag and one without, and **both showed the dialog**,
which ruled it out.

> **THE DIALOG AND THE CORRECT PAGE NUMBERS ARE THE SAME FEATURE. Removing `dirty` removes the prompt and
> the automatic refresh with it, and the contents goes back to needing a manual update.**

Nic's decision: keep the dialog, keep the working contents. A PDF export was scoped as the version with no
dialog and no stale numbers — it needs LibreOffice running somewhere off Vercel, and the conversion must
refresh the document's indexes explicitly or the contents page comes out blank — and was judged too much
machinery for a second copy of a document that already works. **Word stays the only export.**
