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

**§6.129 changed what this is next to, not what it is.** Leadership Team → Risk & Succession is now a
built tab, but what it holds is the six BUSINESS-level change-of-owner judgements (`plan_transfer_ratings`),
not per-person succession. The placeholder grid that printed every person's name over four empty columns
was deleted rather than added to — a table of real names holding no data reads as a screen the client has
failed to fill in. So this item is unchanged and slightly sharper: the missing thing is a successor,
a dependency level and a key-person cover figure PER PERSON, and it now has an obvious home to be built
into.

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

### 21. Nine other modules still do not reconcile after a save — **Build**

Plan settings now hands back the row it stored and the screen adopts it, so a clamped value corrects itself
in front of the client and the footer names what changed. **No other module does this.**

Every one of them clamps on the way in — `Math.min(5, Math.max(1, …))` and friends appear about fifty times
across thirteen action files — and clamping is RIGHT: a 99999% tax rate reaching the forecast is worse than
a refusal. The fault is never the clamp. It is that the screen keeps showing what was typed and only
learns the truth on a refresh nobody has a reason to do.

The mechanism is now written once and proven. What is left is applying it, which is a per-module job
because each keeps its own state shape: return the stored row from the action, merge it into the module's
state on success, surface anything adjusted through the footer note the frame already owns.

~~**Start with Sales.**~~ **Sales is done (§6.122)** and its clamps were the ones that bit hardest — typing
9999 into "A client stays (months)" now saves 600, says so, and the box shows 600 without a refresh.

**Funding and Fixed Assets are done too (§6.123)**, and the compare-and-word logic now lives once in
`src/lib/adjusted.ts` with all four modules on it.

The remaining nine are Historic, COGS, Overheads, One-off income & costs, Assumptions, Marketing,
Operations, People and Goals. None of them is as sharp as the four already done — these are mostly row
grids where a clamped value is visible in the row itself — so this is now maintenance rather than a fault
worth chasing. Do them when touching those modules for other reasons.

The shape: `.select("*")` on the write, `adjustments()` against what was sent, `adjustedNote()` for the
wording, merge the stored row into the module's state, and show the note through the footer the frame
already owns.

**One thing to know before doing more of these.** A module whose dialog uses uncontrolled inputs
(`defaultValue` + `onBlur`, as Fixed Assets does) only commits a field on blur. That is fine for a client
clicking Save with a mouse, and it silently breaks any scripted test that clicks Save without moving focus
first. It cost two wrong conclusions while verifying this one.

## Waiting on the domain

### 8. A shared link previews as a blank rectangle — **Build, after the domain**

There is no `metadata.openGraph` and no preview image, so a BizPlanHQ link pasted into Slack,
LinkedIn or a message renders as nothing. Small job — metadata in `app/layout.tsx` and one image —
but it wants the real domain first, and it matters precisely because the people a link gets shared
with are the people worth impressing.

### 9. Point the domain at Vercel — **Nic's own**

Domain is held in GoDaddy and not connected. Vercel issues the certificate; the records are pasted
into GoDaddy. Nothing in the app changes.

### ~~22. The 3-Year and 5-Year goals are not in the report~~ — **done (§6.125.2)**

Closed the same day it was opened. `Goals and Milestones` now carries the big goal, the North Star, a
horizon table (1/3/5 years with the forecast's own revenue and result), the measures with a note saying
which ones the plan answers, the long rungs in the client's own words, the year's commitments and the
90-day list. The assembly moved to `engine/plan/ladder.ts` so the screen and the report read one function
— a report computing a client's three-year revenue for itself is one edit away from printing a different
number to the screen they set it on.

### ~~23. Nothing happens when the 90 days end~~ — **done (§6.137)**

Migration 0052 adds `plan_goals.closed_period_end` and `outcome`. Once the end date has passed (by the
viewer's own clock), Goals shows "These ninety days ended on …" with **Review the 90 days**, and the
dashboard panel reads "ended …" with a link. The review marks each goal Done, Carry forward or Drop (Done
pre-chosen for goals already marked done), sets the next end date (13 weeks on by default), and closes the
period: done and dropped goals are kept under **Earlier 90-day periods** ("Ended 20 September 2026 · 1 of 2
done") and leave every live list — the ladder, dashboard, report, Marketing's goals and What-If's
dedupe. A dropped goal's SWOT line is offered again. Driven live on ZZ Test Walk, which now carries that
closed period and an end date of 20 December 2026.

### ~~24. SEQ has near-duplicate What-If goals and nothing dedupes them~~ — **fixed going forward (§6.134)**

Migration 0051 adds `plan_goals.source_key`; a What-If goal now carries the lever that proposed it, and a
second "Turn into goals" updates that lever's open goal instead of inserting another (done goals are left as
history, and a goal's status is never touched). SEQ's existing pairs predate the key and were not guessed
at — which of the two debtor-day goals to keep is the client's call.

### ~~25. A goal is still saved on blur, and that is still unverified under failure~~ — **driven live and fixed (§6.136)**

Driven on ZZ Test Walk by failing the save request in the browser. A refusal from the server was always
shown; a request that never ARRIVED (Wi-Fi drop, sleep, restart) made the action reject, the rejection
escaped the transition, and the whole Goals screen was replaced by "Failed to fetch" — with what had been
typed lost. Now: `guarded(start, onFail)` (src/lib/guardedStart.ts) catches it; the screen stays, the text
stays in the box, and "Couldn't reach the server, so your last change isn't saved yet…" shows in the note
and — new for Goals — in the footer, which also shows "Saving…" now. Clicking back into the box and out
retried and saved. The redirect on "Save and continue" is deliberately not guarded.

The same fault is on every other screen: see item 44.

### ~~26. Overheads counts two expenses on a plan that has none~~ — **done (§6.134)**

The count is the entered lines plus the two locked lines only once they carry money. A new plan reads
"Expenses 0".

### ~~27. An overhead can be saved with no category, and the table says "Not set"~~ — **done (§6.136)**

Category is required: the dialog offers the eight categories only (no "Not set"), Save stays off until
one is chosen, the hint says "Use Other if none fits", and the action refuses a line without one. Lines
saved before this keep showing "Not set" until they are next edited — SEQ has none; ZZ Test Walk has one
("Rent").

### ~~28. The report says "Figures agree — Yes" on a plan with no figures~~ — **done (§6.134)**

`gather` reports whether the five years hold any money at all; with none, the tile reads "—, Nothing to
reconcile yet" and the not-balancing warning is not shown either.

### ~~29. Goals says nothing at all when AI drafting is off~~ — **done (§6.134)**

Goals shows DraftField's own sentence — "Drafting is off for this plan. Turn it on in Plan settings." — with
the link. Checked live on ZZ Test Walk.

### 30. "ZZ Test Walk" is a test plan, kept on purpose

Plan `75bebd96-8935-4c40-b851-c6519147853e` on the live Supabase project is not a client. It was created
from nothing for the §6.126 walk and holds one product (House Slab, 604,800) and one overhead (Rent,
48,000) — the minimum that makes the forecast run, which is what its two faults needed to show themselves.

It stays. The walk has to be repeatable, and a plan that starts empty is the only thing that catches a
screen quietly reading a year off the wrong field. The name begins with ZZ so it sorts last, and anyone
finding it in the plan list should leave it alone rather than tidy it away.

### ~~31. Capability to sell is not built~~ — **done (§6.128.2)**, rebuilt as display-only (§6.129), one card short

Built the same day it was opened, and the scoping was wrong rather than the work being large: the asking
price, the owner add-backs and the comparable multiples are not plan facts, they are a position in a
negotiation, and they belong where the proposed loan belongs. Eight of ten measures needed no storage at
all, and recurring revenue share came free from `sold_as` on the Sales step.

**What is still missing: largest-customer share.** Nothing in this app records customers — products and
market segments, but not who buys. It is the first thing a buyer's advisor asks. The card is on the page,
unanswered, telling the client to work it out from their own sales ledger. Giving the app customers is a
real piece of work and probably wants to serve more than this one measure.

### 32. The capability bands are general, not per-industry

Every band on the Financial Capabilities screen is a general small-business range. A concreter, a café and
a software business do not share a sensible cash cycle, debtor days or margin. The plan knows the
industry and the screen says out loud that the bands do not — which is honest but not right. Either the
bands come from somewhere real per industry, or the consultant sets them per client.

*§6.130:* the comparable sale range is now the first per-industry figure — searched from the Business
Profile with its sources shown, or typed. The other bands are still general.

### ~~33. Nothing holds a plan's cash buffer~~ — **stored (§6.129)**

§6.128.3 answered this on the capability screen itself and this entry predicted exactly how that would
fail: *"if anything else ever needs a cash floor it should be promoted to a plan setting rather than asked
for twice."* What actually happened was worse and sooner — nothing on that screen was ever saved, so the
floor was gone on refresh and the growth score changed between two visits.

It is now `plan_settings.cash_floor`, collected on **Assumptions → Cash & capital** with the cost of
capital beside it, nullable so that a floor of zero and a floor nobody has set stay different things. The
dashboard's own cash chart is still the obvious next reader and does not read it yet.

### ~~34. A plan's own child rows are invisible to the report but visible to its screens~~ — **no longer reproduces (§6.134)**

Re-tested on ZZ Test Walk on 27 September 2026: a SWOT line typed on the screen appeared in the report
fetched straight after, under Risks and Mitigation, and disappeared from it when removed. People,
competitors and licences on the same plan also saved and read back normally throughout §6.131. Whatever
made that plan's rows invisible during the earlier session is not present now. If it returns, the two
queries to run are: the rows in `plan_swot_items` for the plan, and its `plan_members` rows beside SEQ's.

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

### ~~35. The dashboard cash chart still judges against zero~~ — **done (§6.133)**

The dashboard reads `cash_floor` through `readGrowth`, the reader the growth dial uses. With a floor set, the
cash chart draws it as a dashed line ("Your floor 50,000"), the badge counts months below it, the sentence
says how far the lowest month is under or over it, and the "Lowest cash month" and "Cash at year end" tiles
turn red against it. Unset keeps the zero test, says so, and offers "Set the lowest balance you'll accept →"
to Assumptions. A floor of 0 reads as zero because it is the same test. Checked live on ZZ Test Walk with
a temporary 50,000 floor (then cleared).

### ~~36. Nothing reads `intended_exit_year`~~ — **done (§6.135)**

The price measures read the year the sale is aimed at through `saleYear` (Year 1 until one is chosen, and
Year 1 for anything outside 1–5): the multiple, "What the earnings support", the earnings bridge, and the
printed Price and value section, each labelled with the year. The health measures (margins, cash
conversion, returns) stay on Year 1 with their five-year lines. SEQ, aimed at Year 2: normalised earnings
76,876, the price 13.01× against 111.78× on Year 1, the same on screen and in print.

### ~~37. The sale figures do not print in any report~~ — **done (§6.130.2)**

A "Sale Readiness and Borrowing" section after the Financial Plan: price and value (asking price, the year
aimed at, normalised EBITDA, the similar-sales range with its sources or "the owner's own figure", the value
at that range, the price as a multiple and a sentence on where it sits); the add-back bridge through the
dashboard's own `bridgeFrom`; the six change-of-owner ratings with notes (an overall score only when all six
are judged); and the lender record. Each part prints only when it has something in it, the heading names
only what is under it ("Sale Readiness", "Borrowing Record" or both), and a plan with none of it prints
nothing and is not told anything is missing. On screen and in the Word file.

### ~~38. Security values are per asset and the opening balance sheet is not~~ — **done (§6.135)**

Loan-to-value, dial and five-year line, is withheld until at least three quarters of the plant on the
last balance sheet is listed as already-owned on Fixed Assets (`securityGap`, `MIN_PLANT_LISTED`). It says
"0 of 129,294 of existing plant listed" on SEQ and offers "List the existing plant". A plan with no
history is not held back.

### ~~39. Row grids that save only when focus leaves the ROW~~ — **done (§6.131, §6.131.1)**

The fault: Tab out of a row's last box and focus lands on its own remove button, still inside the row, so
the save never ran and the footer said "All changes saved" (§6.98). §6.131 moved Marketing (segments,
customers, spend, evidence) and Operations (premises, suppliers, steps) to per-box saves through
`useRowSaves`: a queue per row so two quick saves cannot both insert, one name per row across its tmp→stored
id change, a React key that does not change mid-typing, a new row with no name waiting quietly rather than
erroring, removals queued behind a save in flight, and "Save and continue" waiting for the saves before it
redirects. Checked live on ZZ Test Walk: filled a supplier and a customer box by box, tabbed onto the
remove button, reloaded — one row each, every box stored.

*§6.131.1:* People (the team, salaries, Roles & Capability), Competitors, SWOT lines and Licences moved
over the same way. People and capabilities already had a `_key` that never changes, so they use the queue
directly; the others use `useRowSaves`. SWOT's one-click "Use" suggestion now saves through the line's
queue too, so a mitigation typed straight after it cannot insert the line twice. Checked live on ZZ Test
Walk for a person, a SWOT line with its mitigation, a competitor (strength typed before the name) and a
licence: each tabbed onto its remove button, reloaded, stored once, then removed. Roles & Capability was not
exercised live (ZZ has no saved person to hang one on). No row grid in the app saves only on leaving the
row now.

### ~~40. The footer's "All changes saved" does not know about component-level saves~~ — **done (§6.132)**

Capacity measures, debtor ageing and lender history each save on their own transition. They now report it
up through an `onBusy` prop, and the module's single status writer shows "Saving…" while either the module
or the part is saving (two writers to one slot would race, which is why they do not write it directly).
Unmounting mid-save clears it. The add-backs, the licences and the similar-sales accept already ran through
their module's own save state. Checked live on ZZ Test Walk's lender history: the footer went "Saving…" →
"All changes saved".

### ~~41. Money boxes elsewhere still show 1000000~~ — **done (§6.130.1)**

`MoneyInput` (and `money` on FieldInput/CellInput) now on every currency box that showed raw digits: cash
floor, prepayments and accruals, opening tax losses and retained earnings, debtor ageing, premises rent,
weighted pipeline, asset cost / residual / deposit / security, funding opening cash, amount, facility limit,
fees, balloon, deposit, pre-money valuation, minimum payment, and one-off amounts. Works on controlled and
uncontrolled (defaultValue) boxes. Two parsers that choked on a comma (prepayments/accruals, premises rent)
now strip it. Left alone: boxes that already format as you type (sales price, COGS, overheads, historic
lines, salaries, marketing spend) — they show commas already, though they re-format mid-typing — and
percentages, days, months, counts and multiples.

### 42. The searched comparable range clears the two-site minimum by exactly two — **watch**

§6.130's first live runs on SEQ (Commercial concreting, Australia, AUD 1–5 million) came back twice with
the same answer in about 15–20 seconds: 2× to 3.5× EBITDA from two sites — creditte.com.au ("Trade and
construction: typically 2x – 3.5x", drawn from broker transaction data, checked by hand) and
businessvaluationsbrisbane.com.au (could not be opened to check). Two is the minimum, so a narrower
industry or a smaller country will often get "couldn't find" instead. If that is common in practice, the
next step is an SDE-to-EBITDA path using the leadership pay the plan already holds, since most published
small-business multiples are on SDE.

### 43. The What-If "Turn into goals" dialog still offers a quarter

The dialog says goals appear "for the quarter you pick" and offers a quarter for each, but since §6.125
every What-If goal lands on the 90-day rung and the chosen quarter is ignored by the save. Found while
testing §6.134 on ZZ Test Walk. The picker should come out, or become the goal's due date.

### ~~44. A save that never reaches the server takes the whole screen down~~ — **done (§6.138)**

Every screen's save transition now goes through `guarded` (src/lib/guardedStart.ts): Settings, Sales, COGS,
Overheads, Historic (and its import), Assets, Funding, One-off items, Assumptions, Marketing, Competitors,
SWOT, Operations, People, What-If, Goals, and the parts that save on their own (capacity measures, debtor
ageing, lender history, licences, logo, archive/delete, "None to list", the plan list, the Guided/Advanced
switch). A request that never arrives shows "Couldn't reach the server, so your last change isn't saved
yet…" in the module's own error channel and clears itself on the next save that gets through. Next's
redirect and not-found signals are rethrown untouched, so "Save and continue" still moves on. Where a
save cleared its "unsaved" flag before sending — every row grid, Settings' profile and financial tabs,
Historic's years, the market, position and capacity prose — the flag is put back, so leaving a box again
retries. Driven live on ZZ Test Walk: a Marketing segment and the Business profile's industry, each
saved with the connection blocked (message, screen intact, text kept) then retried and stored; and Save
and continue on Marketing still went to Competitors.
