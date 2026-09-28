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

### ~~2. `plan_people_succession` is a table with no screen~~ — **done (§6.146)**

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

Built (§6.146, 27 Sep 2026). Leadership Team → Risk & Succession now opens with **Key people**, one row per
person (contractors left out): Dependency (Not judged / Low / Medium / High), Successor (None identified /
External hire / someone else on the team), Key-person cover (None / Quoted / Insured, with an amount), Notes.
A row is stored only once a dependency is chosen, so "not judged" never prints as Medium; setting it back
clears the row. The six business-level ratings sit under it as "The business without its owner". The SWOT
weakness is back — High dependency with no successor — and the report prints a "Key-person risk" part under
Our People for anyone rated Medium or High, High first, notes included. No migration: the table is from 0007.
Live on ZZ Test Walk: two test people; High + Insured 500,000 + a note saved and survived a reload; SWOT
offered "The business depends heavily on Test Owner and no successor is identified"; naming Test Deputy as
successor took it away; the report printed the row and the note. Both test people removed afterwards.

### ~~3. The Assets group is three stubs~~ — **done (§6.147)**

`social`, `memberships` and `ip` all carry `tag: "soon"` in the nav. A client sees three menu items
that go nowhere. Either build them or take them out of the nav until they exist; a "soon" that has
been soon for a while is a promise with no date on it.

Built (§6.147, 27 Sep 2026). One **Assets** screen with three areas — Social media (platform, address or
handle, what it is for), Memberships (organisation, what it gives the business) and Intellectual property
(name, type, description) — on the tables from 0002, so no migration. The three menu items lose their
"soon" tag and each opens its own area; switching area moves the URL so the menu lights the right one; old
/social, /memberships and /ip links redirect. Descriptive only: nothing reaches the forecast. In the report,
Memberships and accreditations and Intellectual property print under The Business after Licences; social
media stays on screen (Nic's call). Live on ZZ Test Walk: a row in each register saved and survived a reload,
the report printed the membership and the trade mark and not the social account, and all three were removed.
The menu itself shows these items only in Advanced mode, which was not switched on for the check.

**Route is `registers`, not `assets`.** `assets` is Fixed Assets (step 12). The first version of this screen
was written into that folder and replaced Fixed Assets' four files; caught from `git status` before the
commit left the machine, Fixed Assets restored byte for byte from the commit before, and this screen moved
to its own route. Checked live afterwards: /assets is Fixed Assets step 12 again; /ip lands on
/registers?area=ip, and a row there saved, reloaded and was removed.

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

### ~~32. The capability bands are general, not per-industry~~ — **done (§6.140)**

Plan settings → **Capability ranges** (migration 0053, `plan_settings.capability_ranges`). Every measure with
a plain weak / watch / strong range — 23 across the three tabs — has two boxes for its two lines, the general
range as placeholder and in words beneath the name. Stored per tab and measure (`grow:operatingMargin`),
only what was changed; "Use general" puts one back. The dials apply the plan's lines before scoring; a card
using one says "Set for this plan: …" with a Change link. Not adjustable: the price multiple, return on
growth and lowest cash month (their lines already come from the plan) and debt cover (its middle line is the
lender's minimum used in the borrowing arithmetic). Driven live on ZZ Test Walk: Operating margin 92.1% went
Healthy → At risk under a 95 / 98 range and Capability to grow 78 → 49; "Use general" put both back.

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

### 42. The searched comparable range clears the two-site minimum by exactly two — **steps 1–3 done (§6.143, §6.145); watch**

§6.130's first live runs on SEQ (Commercial concreting, Australia, AUD 1–5 million) came back twice with
the same answer in about 15–20 seconds: 2× to 3.5× EBITDA from two sites — creditte.com.au ("Trade and
construction: typically 2x – 3.5x", drawn from broker transaction data, checked by hand) and
businessvaluationsbrisbane.com.au (could not be opened to check). Two is the minimum, so a narrower
industry or a smaller country will often get "couldn't find" instead. If that is common in practice, the
next step is an SDE-to-EBITDA path using the leadership pay the plan already holds, since most published
small-business multiples are on SDE.

**Measured 26 Sep 2026** — nine more searches on ZZ Test Walk (industry and country changed per run, then put
back; AI switched off again afterwards):

| Industry, country | Sites | Range | Set aside (SDE/revenue) |
|---|---|---|---|
| Cafe, Australia | 3 | 2× – 3× | 0 |
| Plumbing, Australia | 5 | 2.9× – 5× | 1 |
| Accounting practice, Australia | 5 | 4× – 6× | 1 |
| Landscaping, Australia | 2 | 2.8× – 4× | 0 |
| Physiotherapy clinic, Australia | 2 | 1.8× – 3.8× | 2 |
| Mobile dog grooming, Australia | miss | — | 0 |
| Electrical contracting, New Zealand | miss | — | 0 |
| Cafe, New Zealand | miss | — | 0 |
| IT managed services, United Kingdom | 5 | 5× – 9× | 0 |

What it shows:
- **Misses come from country and niche, not from SDE.** All three misses had nothing set aside, so an
  SDE-to-EBITDA path would not have rescued one of them. It drops down the list.
- **New Zealand missed twice out of two**, including a cafe, which Australia answers easily.
- **Quality, not only count.** Physiotherapy counted a LinkedIn post as one of its two sites. The UK IT
  range included a mid-market M&A report (9×–12×), which is not a small-business sale. CT Acquisitions
  supplied one of the sites in four of the six hits, so many ranges lean on one acquirer's marketing pages.
- The set-aside count is already shown on the card ("One other figure was quoted on owner earnings…").

Candidate next steps, in order: (1) on a miss, one broader search clearly labelled as broader — a
neighbouring market (New Zealand → Australia) or the parent industry — never passed off as a close
comparable; (2) tighten what counts as a site: drop social and forum hosts (LinkedIn, Facebook, Medium,
Reddit, Quora) and ask for small-business figures only; (3) SDE-to-EBITDA, only if misses with SDE set
aside start to show up.

**Steps 1 and 2 built (§6.143, 27 Sep 2026).**
- A miss runs one wider search: the wider sector, plus only the market written down in `NEARBY`
  (Australia ↔ New Zealand, UK ↔ Ireland, US ↔ Canada, Singapore ↔ Malaysia; any other country widens
  the sector at home only). Each wider figure must name its market, and one outside those countries is
  dropped. The card, the accepted line, the Financial Capabilities line and the report all say "wider".
  Each search is metered, so a widened search counts as two.
- Social and forum hosts are never a site. Each figure carries a size; "larger" (mid-market, private
  equity, listed, a corporate or overseas buyer) is left out and counted on the card.

Live on ZZ Test Walk after the change (debug field used, then removed):
- Cafe, New Zealand: first build widened to "Coffee, New Zealand" (a NZ Herald story on a corporate
  buyout) and "Cafes, Thailand" — which is why the market list is fixed in code and news is ruled out.
  After: an honest miss — one qualifying site (creditte, Australia); 4–5 SDE figures and 2–3 larger deals
  left out.
- Mobile dog grooming, Australia: miss. The wider pass offered "Automotive services, Australia" as the
  sector; the prompt now says only a sector a buyer would compare with, and the card names each figure's
  market, but code cannot judge sectors.
- Physiotherapy clinic, Australia: the LinkedIn post is gone, leaving one site (Brandcom) — a miss rather
  than a range resting on a post.
- IT managed services, UK: found, 5× to 8.5×. The model labelled ICON's M&A snapshot "small", so the size
  filter is only as good as that label.

**Correction to the first measurement.** The first nine runs showed nothing set aside on the misses, and
this note concluded SDE would not have rescued them. The second runs of the same misses set aside 2–5 SDE
figures each — New Zealand's own transaction data (Bizstats) is quoted on SDE. Step 3 (SDE-to-EBITDA from
the plan's leadership pay) is now the step most likely to turn a miss into a range.

**Southeast Asia (§6.144, 27 Sep 2026).** `NEARBY` gains Malaysia → Singapore and Thailand; Thailand →
Malaysia; Indonesia and the Philippines → Malaysia and Thailand. Malaysia and Thailand are the nearest in
income and publish the most small-business sales; Singapore stays Malaysia's only, since its prices would
flatter the others. Live on ZZ: Cafe, Thailand found 3 sites on the first search (2× to 3.5×) without
widening; Cafe, Indonesia widened to "the wider sector, Malaysia and Thailand" and still missed, with 5
larger-deal figures left out.

**Step 3 built (§6.145, 27 Sep 2026): SDE converted in the open.** SDE is earnings before one owner is
paid, so with this plan's normalised EBITDA for the sale year (E) and one owner's pay that year (P), an SDE
multiple m is m × (E + P) / E in EBITDA terms. One owner, not the leadership wage bill — that is what SDE
adds back, and the leadership total would have inflated it. The owner is the largest shareholder on the
payroll, or the only paid person; with neither, or E not positive, SDE stays set aside and the card says
what would allow it ("mark who owns the business…"). Worked out on the server from the same forecast and
add-backs the price dial uses; nothing about it goes to the search. Each converted figure keeps its SDE
numbers and factor, and the card, the accepted line, Financial Capabilities and the report show them. The
card warns that pay already added back makes it read high. A figure that converts above 30× is dropped.

Live on ZZ Test Walk (Cafe, New Zealand): with nobody on the leadership team, the card asked for the owner
to be marked. With a test owner (100%, 120,000) it found New Zealand's own figures — Bizstats 2×–2.2× SDE
and Auxo 2×–3× SDE — converted at ×1.27 (436,800 + 120,000 over 436,800) to 2.5× to 3.3×. Accepted, it
showed "2 converted from owner earnings at ×1.27" in settings and on Capability to sell. The test owner,
the range, the industry and the AI switch were then put back. The report wording is covered by its test.

Known limit: the conversion is fixed when the range is found. If the owner's pay or the earnings change a
lot later, search again.

### ~~43. The What-If "Turn into goals" dialog still offers a quarter~~ — **done (§6.139)**

The quarter pickers are gone. In their place a due date — once at the top for all, then per goal — which
is saved as the goal's due date on the 90-day rung. The dialog now says the goals land in the next ninety
days. Checked live on ZZ Test Walk (goal created with its date, then removed).

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

### ~~45. A card's one-line comment can still quote the general range~~ — **done (§6.141)**

When a plan's own range puts a figure in a different band from the general one, `applyRanges` now writes
the card's sentence from the plan's lines ("At 92.1%, below the 95% this plan sets as its floor — the weak
end of its own range."), and the growth summary above the cards picks it up. Where the band is the same,
the measure's own, more specific sentence stays. A sentence that quotes the general figure itself
(loan-to-value's "75% most lenders stop at") is marked `citesGeneral` and always rewritten under a plan
range. Loan-to-value also gained a watch sentence for 65–75%, which used to read "security to spare".
Checked live on ZZ Test Walk: Operating margin 95 / 98 turned the card and summary to At risk with the
plan's sentence; "Use general" put back Healthy, the original sentence and a grow score of 78. ZZ has no
security value, so the loan-to-value change rests on its unit test.

### ~~46. A profile edit is lost when the State box is left next~~ — **done (§6.142)**

Business profile tracks unsaved work in one slot (`dirty`: "profile" | "financial"). The "Main state of
operation" box sits on the profile tab but saves through the financial saver, and leaving it calls
`commit("financial")`, which clears the slot. Anything typed into the profile just before (industry,
name, tagline, email) is never sent, and the footer says "All changes saved". Reproduced on ZZ Test Walk
26 Sep 2026: typed an industry, clicked into State, pressed Tab — the only request was the financial save,
and the industry was gone after a reload. Choosing a state from the list (`edit(…, "financial", true)`)
takes the same path. Fix: track the two as separate flags so one save cannot clear the other's.

Fixed: `dirty` is two flags; each saver clears only its own, and a tab change saves whichever are set.
Checked live on ZZ: the same sequence now keeps the industry (footer says "Unsaved" until it saves); an
industry and a state typed together both saved on leaving the section.

### ~~47. After a country change, the State box still shows the old state~~ — **done (§6.144.1)**

Changing country clears the stored state on the server (§6.39.1), but the screen keeps showing it — the
legal-notice line read "Victoria, New Zealand" until a reload — and the next Financial save would write
it back. Seen on ZZ Test Walk 27 Sep 2026. The profile save should hand back what it cleared, and the
screen adopt it (§6.121).

Fixed: the profile save says when the move cleared the state and its taxes (`clearedTax`), and the screen
adopts the cleared row, including the copy the next Financial save reads. Checked live on ZZ Test Walk:
Auckland under New Zealand, country changed to Australia — the box emptied and the notice read "Australia"
without a reload; the tax save that followed stored `tax_region: null`. Tax rate put back to 25.

### ~~48. Tax losses and accumulated profit were typed, not read from Historic~~ — **done (§6.148)**

Nic, 27 Sep 2026: with the accounts already in Historic, "Tax losses brought forward" and "Accumulated
profit at the start" on Plan settings → Financial year & tax should come from them, not be typed. SEQ had
0 in the first while its latest year (Period 1) lost 71,000 with no tax paid.

- **Tax losses** are worked out from the Historic profit and loss (`engine/historic/opening.ts`): each loss
  carried forward and used against the next profit, oldest year first. The tab shows the figure and where it
  came from; "Use my accountant's figure instead" puts a typed figure in its place (a tax return can differ
  from the accounts), recorded as `tax_losses_from_accountant`. Anyone who had typed a figure keeps it — 0054
  marks those rows as the accountant's.
- **Accumulated profit** is equity less share capital from Historic Period 1, shown read-only. Historic →
  Balance sheet gains "of which share capital (what the owners put in)" and a calculated "of which
  accumulated profit". Until share capital is given it is not guessed: nil, so each year's dividend is limited
  to that year's own profit. The template import carries share capital across a reload.
- The forecast (`planLoad`) and the tab call the same functions, so the tab shows what the forecast uses.

Migration 0054 (share_capital, tax_losses_from_accountant). Checked on SEQ without saving: the tab shows
71,000 "Period 1's loss, 71,000 still unused" and asks for share capital; Historic shows the two new rows.
SEQ's own Years 1 and 2 are losses, so the 71,000 is used in Year 4: taxable profit there falls from 86,874
to 15,874 (17,750 less tax).

### 49. Share capital is not in the upload, and the app has not been checked for double entry — **Done: share capital (§6.149), sweep, fix 1 (§6.150), fixes 2–5 (§6.151)**

The "never ask twice" rule (SaaS_Requirements §0, Nic 27 Sep 2026) leaves two follow-ups from §6.148:
- **Share capital** is the one figure accumulated profit needs that the Historic upload template does not
  carry (it has Equity as one line). It should come in with the upload: an optional "Share Capital" line
  beside Equity in the template, read by the importer, so the owner is never asked for it separately. The
  Historic row stays for owners who type their accounts in.
- **A sweep of every screen** for inputs the plan already holds or can calculate, reported before anything
  is changed.

Share capital in the upload, done (§6.149): the Historic template gains an optional "Share Capital" line under
an "Equity" heading; the importer reads it per period and shows it in the preview. A file without it leaves
Historic → Balance sheet to ask, once, as before (Nic: "if this is not uploaded … they can be asked to answer
the question in its current form"). A reload keeps what was already given when the new file has no line.
Unit-tested; not driven live, because the browser pane here cannot choose a file to upload.

**The sweep, 27 Sep 2026 — findings, nothing changed yet.** Every screen's inputs were checked against what
the client has already entered or uploaded, or what could be worked out from it.

Already right (derived, not asked): opening cash (Funding reads Historic), tax losses and accumulated profit
(§6.148), working-capital days (defaults from Historic), Leadership Team salaries in Overheads, the cap table
(People + Funding composed once), products and services statement (asked once, on Sales).

Asked again or not used — in priority order:
1. **Existing bank loans.** Historic holds them (SEQ: 98,849 due within a year, 89,974 after). The forecast
   carries the balance flat — no interest, no repayments (SEQ's 4,433 of Year 1 interest is the two new
   equipment loans only). The only way to cost them is to add them again on Funding, which counts the debt
   twice and books the money as fresh cash. Both a double entry and a wrong forecast. Fix: Funding shows the
   loans already on the balance sheet and asks only what the accounts cannot give — rate, term, repayment.
2. **Historic period ends.** Set-up asks the financial year end and the first projected year; Historic then asks
   "Period end" for each of four years (SEQ typed 2026, 2025, 2024, 2023). They follow from set-up: Period 1
   ends the year before Year 1. Fix: filled in, changeable when the accounts are a different year.
3. **Currency.** Set-up and Plan settings ask country and currency separately; changing country leaves the
   currency alone. Fix: currency follows the country, changeable for a business that trades in another.
4. **Company tax rate.** Every plan starts at 25% whatever the country (New Zealand 28%, United States 21%).
   Fix: default from the country, with a note that small-business rates vary, and changeable.
5. **Small ones.** Contact email on the cover could start as the sign-in email; the first Leadership Team row
   could start with the signed-in person's name.

**Fix 1 done, 27 Sep 2026 (§6.150) — the loans already owed.** Funding shows them in a block above the list:
the balance from Historic, and the three terms worked out from the accounts, each saying where it came from.
- Rate: last year's interest paid over the average of this year's and last year's loan balances
  (SEQ: 18,638 on about 180,412 → 10.33%).
- Term: the balance over what falls due within twelve months (SEQ: 188,823 against 98,849 → 23 months).
- Repayment: paid down if any falls due within the year, otherwise interest only (then running past Year 5).
The client changes one only if the accounts got it wrong, and "Use the Historic figure" puts it back. Only the
changes are stored (`plan_settings.existing_debt`, migration 0055) — never the balance. The one thing ever
asked is the rate, and only when Historic has no interest paid; until then the debt is carried flat, as before,
and the block and Financial Capabilities both say so.

Engine: one more loan on the funding list with nothing arriving in the bank (`amount: 0`, `existing: true`),
and `opening.bankLoansModelled` stops the balance sheet adding the Historic balance a second time. The same
reading (`existingDebtFromHistory`) feeds `loadPlan` and the Funding screen. It is not money raised: funding
totals and the report's funding table leave it out. Financial Capabilities lists it as a facility and drops
the "brought forward" line, which would now count it twice.

Checked on SEQ without saving: Year 1 interest 4,433 → 19,577; loans owed at Year 1 131,132 (94,954 of it the
old loans), gone by Year 2; the balance sheet balances every year. **SEQ's cash now goes negative** —
(25,019) at Year 1 and (162,372) at Year 2 — because 93,869 of real repayments are now in Year 1. That is the
forecast telling the truth, not a fault. 12 unit tests.

**Fixes 2–5 done, 27 Sep 2026 (§6.151).**
- **Historic period ends.** Period n ends in the financial year `first projected year − n`
  (`historicPeriodYear`). An empty box shows that year in the same ink as a typed one, and a save or an
  upload without a period end stores it. Typing over it is for accounts that end in a different year. On ZZ
  (Year 1 ending June 2027) the four read 2026, 2025, 2024, 2023, which are the years SEQ had to type.
- **Currency and tax rate follow the country** (`engine/plan/countryDefaults.ts`). Set-up now offers the
  same 13 countries as Plan settings (its own copy had drifted to 7), the currency follows the country
  there, and a new plan gets that country's rate. Changing the country in Plan settings moves the currency
  and rate with it, but only while they are still the old country's defaults, so a choice made on purpose
  is kept. Settings says where the rate came from, what moves it, and offers "Use X%" when it has been
  changed. Checked on ZZ: Australia → New Zealand gave NZD and 28% after a reload; back to Australia gave
  AUD and 25%. Existing plans keep their stored rate. Nothing is changed behind the client's back.
- **Rates used** are the usual small-company rates (checked Sep 2026), each with its note in the app:
  AU 25, NZ 28, US 21 (federal), UK 19 (small profits; 25% by £250k), CA 12 (federal + provincial small
  business), SG 17, IE 12.5, ZA 27, IN 25, PH 20, TH 20, MY 17, ID 22.
- **Contact email and first person.** An owner's new plan starts with their sign-in email as the cover
  contact. An empty Leadership Team starts with their sign-up name on the first row as Owner, which saves
  when they leave the row. An adviser's plans start blank for both, because the adviser is not the client.

### 50. Financial Capabilities speaks to the reader's question, not to the number — **1, 2 done (§6.152); 3 done for Grow (§6.153); 4 open**

Nic, 27 Sep 2026: these tabs exist to show whether the business CAN grow, borrow, or sell, and "At risk" or "Not
yet" on a card does not answer that. Four parts:
1. **A loss that growth is closing was described as one growth makes bigger.** SEQ: operating loss 87,248 in
   Year 1, 19,791 in Year 2, and a 72,198 profit in Year 3. The card said "Growing it makes the loss bigger". It
   now says which way the loss is moving, how much of each extra dollar comes off it, and when profit arrives.
   Its next step becomes "Keep the growth … the work is funding the months until then". The band is unchanged,
   because a loss is still a loss.
2. **"Not yet" covered three different things.** (a) Measures that mean nothing on a loss (operating leverage,
   cash conversion) now show a "Loss year" label with the reading that applies: 53¢ of each extra dollar off
   the loss, 55¢ kept as profit from Year 3 to 4, and 74% cash conversion in Year 3. These stay unscored.
   (b) The cost of capital was asked for although the plan's loans already state what money costs. The dials
   now use the dearest loan rate (12% on SEQ) and say so; a figure typed on Assumptions still wins, and
   Assumptions itself is unchanged. SEQ's return on the growth plan is now judged (433%, 7 of 9 measures).
   (c) Genuinely missing inputs (pipeline, retention) are still asked for.
3. **Status words per tab — done for Capability to grow (§6.153).** Nic chose the words. Cards: Supports growth /
   Needs attention / Holding you back (were Healthy / On track / At risk). Dial: Ready to grow / Needs attention /
   Not ready to grow. "Held in the at-risk band by" now reads "Held under 50 by". Bands, colours and scores are
   unchanged. Borrow and Sell keep the general words until they get their own.
   **Loss-year charts hidden (§6.154).** Nic: "if they do not affect the business at all … why are they on my
   screen". Operating leverage and cash conversion no longer appear while the plan makes a loss; the line under
   the dial reads "From 7 measures — 2 more apply once the business makes a profit". What they could say about
   the loss is on the Operating margin card. The score is unchanged (49 on SEQ).
4. **Messages for the consultant** — wording proposed, not built.

### 51. Assumptions → Cash & capital asked for what the plan already knew — **done (§6.155)**

Nic, 27 Sep 2026: the screen quoted the dearest loan (12%) and the worst month (−25,019) and still asked for both.
- **Cost of capital** now shows the dearest loan's rate in its own ink, the figure the dials already used
  (§6.152). Typing over it wins, and "Use 12%" puts it back.
- **Cash floor** is a choice, not a fact: the worst month is the forecast's answer and is never offered as the
  floor. Instead, one month of Year 1 overheads is suggested (SEQ 78,048) with a "Use" button. Nothing is saved
  unless the client clicks or types.
- **When the worst month is below the floor** (or below zero with none), an amber box names the month and the
  shortfall and links the four places that move it: Funding, debtor days, Fixed Assets, Sales/Overheads.
- **Plain words first** (Nic: the person is likely overwhelmed by terms): "Lowest bank balance you're
  comfortable with" (the cash floor) and "What your money costs you (% a year)" (the cost of capital). "Target
  value" was considered and not used, because a floor is a limit and a cost of capital is a bar to beat. A note
  says neither box changes the forecast.
Checked on SEQ (read only) and ZZ ("Use 4,000" saved, then cleared back to unset).

### 52. The worst-month picture on Capability to grow had no urgency — **done (§6.156)**

Nic, on SEQ with a 78,048 floor: "a little bit of red, a little bit of yellow and a lot of green AND so what?" The
gauge's scale ran to three times the floor, so most of it was green on a plan that goes overdrawn, and the
shortfall itself was not shown. Replaced by (A) a headline, "103,067 short of your floor in Jun", with how many
months are below the floor, when it starts, and a link to where to fix it (Assumptions → Cash & capital); and
(B) the twelve months as columns under it, red below the floor and green above, with the floor as a dashed line.
Above the floor it turns green and says how much room there is at the tightest point. The duplicate "Cash, month
by month" panel further down the tab was removed.

### 53. A "current" year the plan does not have — **done (§6.157)**

Nic: "there are no current years — there is historical or projected." Sales → Annual projections showed a
"Current" column (price × units, identical to Year 1) in front of five plan years, the start dropdown read "Year 1 —
the year you're in now", and the Services tab said "this year". The forecast itself was never affected: the
engine runs years 1–5 only, and SEQ's Sales and P&L agree (2,182,240 Year 1; 2,892,354 Year 5). Overheads had the
same column once (§6.47). Fixed app-wide:
- "Current" column removed from Sales.
- Every plan-year column, dropdown and chart axis reads "2027 · Year 1" … "2031 · Year 5" (Sales, COGS, Overheads,
  Salaries, Fixed Assets, One-offs, Funding, Assumptions, Forecast checks, P&L, Cash flow, Balance sheet,
  Break-even, Dashboard, Plan settings' exit year). One source: `PlanYearsProvider` / `yearLabel`.
- "The year you're in now" / "the year the business is in" removed from Sales, Plan settings and set-up. Settings
  now says "Plan years 2027–2031 … the last actual year, in Historic, is 2026".
- Sales header: "2026 actual 1,997,000 → 2027 plan 2,182,240 (+9.3%)", the whole of the last actual year against the
  whole of Year 1.
- The header bar shows "Plan 2027–2031" rather than the report cover year "FY2026", which read as a year in front
  of Year 1.
- The set-up form's "Financial year ends in" shows the month name, not "6".
The printed report already labels its columns by year end ("Jun 2027") and was left as it is.

### 54. Financial Capabilities reads the accounts first — **done (§6.158, §6.159)**

Nic: "If the plan has historical information then I want the last two historic financial years as the financial
capabilities." Agreed design: two views at the top of the page, **Actual: 2025 → 2026 (from your accounts)** and
**Plan: 2026 → 2027 onward (from your projections)**, each showing its score for the tab. With accounts the page
opens on Actual; with none it shows the plan only and says why.
- The measures are unchanged. Historic is turned into the same year-slot input (`engine/capability/actual.ts`):
  cash from operations by the indirect method, capex from the fixed-asset movement plus depreciation, principal
  from the prior year's current portion, and days from the balance sheet.
- Every card names its years ("2026", "2026 actual") and, on the actual view, speaks about the business
  rather than "the plan".
- Annual accounts have no months, so on the actual view the lowest month is replaced by **cash at the end of the
  year**, in months of overheads, with a note that the tightest month cannot be seen. The picture shows the four
  year-end balances against the floor.
- The plan's growth now starts from the last actual year (2026 actual → 2027). SEQ: sales +9.3%, operating loss
  52,362 → 87,248, so "Growing it makes the loss bigger".
- The plan's charts (monthly cash, cash cycle, by product) stay on the Plan view and are named by year.
- **Bug found and fixed:** debt service cover added interest back to cash from operations that was already
  before interest (the forecast keeps interest under financing), so every cover figure was flattered by a year's
  interest.
SEQ, Actual: grow 40, borrow 35, sell 37 · Plan: grow 49, borrow 30, sell 37.
Stage 2 done (§6.159): every card that exists in both views carries the other view's figure — "Track record,
2025 → 2026: 5.7%" on the plan, "The plan, 2026 → 2027: 9.3%" on the accounts. When the plan reads better than
the track record (a better band, or sales growth half as much again) the line turns amber and asks "What changes
to make it true?". On SEQ it fires on sales growth (9.3% vs 5.7%), incremental margin (50.2% vs −24.6%) and cash
tied up per extra $1 (11¢ vs 91¢).

### 55. Capabilities summary box, Borrow and Sell words, a bad year in plain words — **done (§6.160–§6.162)**

- **§6.160 Summary box.** Three lines above the verdict on every tab, reading both views at once: "What happened"
  (the accounts), "What the plan asks", and "Talk about first". Written to the consultant ("Talk to the owner
  about …") for coach, consultant and firm plans, and to the owner otherwise. Every line is chosen by a rule
  (`engine/capability/summary.ts`), so the same plan always gets the same words. SEQ, Grow: "In 2026 sales grew
  5.7% and profit fell into a 52,362 loss. / The plan asks for 9.3% growth in 2027 and a bigger loss, with the
  bank below your floor for 6 of 12 months. / Talk to the owner about how 2027 gets funded before talking about
  growth."
- **§6.161 Borrow and Sell words.** Borrow cards: Lender-ready / Needs attention / Lender will decline; dial:
  Ready to borrow / Needs attention / Not ready to borrow. Sell cards: Adds value / Needs attention / Cuts the price;
  dial: Ready to sell / Needs attention / Not ready to sell.
- **§6.162 A bad year.** The Assumptions tab "Downside" is now "A bad year", and each box asks its question in
  plain words. One "Use these" button fills all three with the worse of the business's own worst year and the
  common bank test, field by field, and each hint says which it is (SEQ: sales 10%, the bank test, because sales
  never fell; margin 3.6 points, its own 2026; customers 16 days later, its own 2026). "Downside" wording on
  Capabilities now reads "a bad year". Checked on ZZ ("Use these" saved the bank test; cleared back to unset).

### 56. Financial Capabilities for the Planner — review and rebuild — **done (§6.163–§6.167)**

Nic's critical review brief, 28 Sep 2026: the Planner (the app's name for the consultant) must be able to read
each tab, understand the business's position, see which areas to address and how to work with the client, and
set the projections in the right direction. Then the workflow: with accounts, the Planner assesses grow / borrow
/ sell from the accounts FIRST and builds the plan after; with none, the plan comes first and is assessed
afterwards across the five years.
Review findings: the page diagnosed but did not say why, how much, or what to change in the plan; actions had no
numbers; nothing carried into the projections; too many equal-weight cards; plus six errors.
Agreed order: (1) fix the six errors; (2) a guided "Planner's assessment" step after Historic; (3) agreed targets
(the app proposes, the Planner agrees); (5) the capability timeline on the Plan view. (4, targets shown on each
projection step and scored on the Plan view, after.)
- **§6.163 (1)** Sell reads one year throughout (the sale year); one revenue-growth figure on the page; a negative
  runway says overdrawn; the lender checklist no longer calls +9.3% "close"; leadership pay above earnings reads
  "15.8× earnings"; "Reported EBITDA, Year 2" names its year.
- **§6.164 (2)** Step 8 "Planner's assessment" (steps after it renumbered 9–18). From the accounts alone: the three
  scores; why operating profit moved (sales, margin, overheads, depreciation — sums exactly); where the cash went
  (lands on the actual balance); up to five issues, urgent first then by money, each with the finding, likely
  cause, direction for the plan with a number and a link, and the question to ask the client; and the list of
  what is still to collect from the client. No accounts: says so and points to Financial Capabilities at the end.
  Capabilities' facts are now gathered once (`lib/capabilityFacts.ts`) and read by both pages; the view builder
  moved to the engine (`engine/capability/views.ts`). Summary box heading is now "For the Planner".
  SEQ reads: loans cannot be repaid (98,849 due in 2027, trading used 149,459) → spread 188,823 over five years,
  about 50,233 a year against 117,487; overheads +128,270 (+18.5%) against sales +5.7%; debtors 30 → 46 days;
  margin 42% → 38.4% (71,267); 21,315 in the bank, 0.3 months of overheads.
  Completeness: the step counts as done with no accounts; with accounts it stays open until targets are agreed (3).
- **§6.165 (3)** Each issue on the assessment carries a target proposed from the accounts (loan term 60 months,
  overheads no more than last year's, debtor days back to the year before, gross margin back to the year before,
  a cash floor of one month's overheads, operating profit of at least nil). The Planner agrees it, or types their
  own figure and agrees that; "Take back" removes it. Stored on `plan_settings.agreed_targets` (migration 0056),
  one key per kind: `{ value, proposed, agreed_at }`. The cash floor and the loan term ARE plan settings, so
  agreeing writes them through (`cash_floor`, `existing_debt.term_months`) — never asked twice — but only into an
  empty setting or one still holding what was last agreed; a figure typed on Assumptions or Funding since is left
  alone and the screen says so. The step is done once anything is agreed, or when the Planner continues past
  accounts that showed nothing to fix (stored as `{}`). Taking back the last target returns the column to null, so the step
  reopens (caught testing on SEQ: it had stayed ticked). `agreed_targets` is read in its own query in `plan.ts`, so
  a database without 0056 does not blank the rest of the completeness read.
- **§6.166 (5)** "When the business is ready" on the Financial Capabilities Plan view: grow, borrow and sell scored
  for each plan year on its own (that year moved to slot 1, through the same `buildView`), with the year each one
  arrives — "Ready to borrow from 2029", "briefly in 2028 too", "slips back in 2030", or "not ready in any year".
  The first column equals the page's own grow and borrow scores; sell is read as if sold that year. Works the same
  for a plan with no accounts. Every plan year's months now come from the forecast (`monthsByYear`), so each
  year's lowest-cash test uses that year's months. SEQ: grow and borrow ready from 2029, sell from 2030.
- **§6.167 (4)** Each agreed target is read against the plan (`checkTargets`, one function for every screen) and
  shown on the step that delivers it, as a strip above the step's content: "Target: Gross margin 42% · Plan has
  39.4% in 2027 — 2.6 points short — about 56,021 of gross profit on 2027's sales". Gross margin on Sales and COGS;
  overheads and operating profit on Overheads; debtor days and the cash floor on Assumptions; the loan term and
  the cash floor on Funding. Year 1 for the P&L and days targets; the cash floor against the lowest month-end
  across all five years. The Plan view of Financial Capabilities lists them all — "0 of 4 met" — each with the
  step that fixes it, and the assessment shows the plan's figure under each agreed target. Counted, not blended
  into the 0–100 dials. Pages wrap their module in `TargetsProvider`; `ModuleFrame` draws `TargetStrip`; the
  forecast only runs for it when a target shown on that step is agreed. Tested on SEQ with four targets agreed,
  then all taken back.
- **§6.168** Nic, on the Actual view's Operating margin: "The plan, 2026 → 2027: −4%" — is that a projected
  year? The tile is 2026 actual; the comparison line is the plan's 2027 alone. Single-year measures now name
  their single year ("The plan, 2027" / "Actual, 2026"; the sale year on Sell); only the measures that compare
  two years keep the span. Checking this found Operating cash conversion on the Grow tab reading slot 1 — the
  year BEFORE the one judged: on the accounts it scored 2025's 67.7% against a 2026 that made a loss, and on
  the plan it read 2026 actual. It now reads the growth year like Operating margin; SEQ's actual grow score moves
  40 → 42 (the card waits for a profit instead of scoring the wrong year). Plan score unchanged at 49.
- **§6.169** RULE (Nic, 28 Sep 2026): "We are on the button 'Actual: 2025 → 2026' therefore no data or comments
  should be about the projected year." The Actual view now reads the accounts and nothing else:
  the For-the-Planner box says What happened / What it means (the accounts' verdict and the measure holding the
  score down) / Talk about first (the top problem the Planner's assessment found for that capability, so step 8
  and this page agree); the plan comparison lines are gone from the cards (they stay on the Plan view as
  "Actual, 2026"); the three Sell cards that only the plan can answer (ongoing-client revenue, largest product,
  leadership pay — all the plan's Year 1) are left off; no undrawn Funding facility in the runway; security only
  from assets already owned; help, footer and year-end-cash wording no longer point at the plan. Also: a runway
  under half a month says "about N days", not "about a month". SEQ actual sell moves 37 → 33 (the three
  plan-sourced cards no longer count).
- **§6.170** Nic: why is Borrow still saying "Not yet"? It was the one label left from before §6.153/§6.161, and it
  covered two different things. A blank tile now says INFORMATION MISSING when the Planner can add what it needs
  (the pencil says what and where), and NO EARNINGS TO MEASURE when the business makes a loss (Net debt ÷ EBITDA,
  cash conversion, price multiple, leadership pay) — Nic chose both words. Also: "What this cash flow would still
  support" had a single band, so it read green "Lender-ready" beside 0 and added a full 100 to the borrow score
  whatever the figure. It is context: now "No room to borrow" / "Room to borrow", a plain arc, and left out of the
  score (`score()` skips any unscored measure, and the "from N measures" count excludes them). SEQ actual borrow
  37 → 31.
- **§6.171** Nic: on the Actual Grow tab the cash cycle read 42 days, green, "Supports growth", while cash tied up per
  extra $1 read 91¢, red — in conflict? Both were arithmetic, but the second blamed growth for the whole rise in
  working capital: ~97,000 on ~107,000 of extra sales. At 2025's terms those sales tie up ~8,000; ~89,000 was
  existing customers paying 46 days instead of 30. Now (`workingCapitalSplit`): the card charges growth only with
  what the extra sales tie up at the earlier year's terms (SEQ 8¢, green) and names the rest — "A further 89,034
  was tied up by the terms moving — customers took 46 days to pay instead of 30. That is a collections problem,
  not a growth one." The cash cycle compares with the year before (`priorDays`: 2025 on the accounts, 2026 actual
  on the plan, the previous plan year in the timeline) — "Up 17 days from 2025, because customers took 46 days to
  pay instead of 30" — and a rise of 10+ days is at best Needs attention. Its 45–70-day band was red while its own
  sentence said "a normal cycle"; now amber. Return on growth spending counts only growth's own working capital
  as invested; a return below −100% reads "Profit fell". A comparison line is never "better than the business
  has done" on the same figure. SEQ actual grow 42 → 47.
- **§6.172** ZZ (no accounts): the summary box said "0% growth in 2027" while the Grow tab measured 2027 → 2028.
  With no accounts the growth year is Year 2, so the line now names it ("0% growth in 2028 and 556,800 of operating
  profit" — Year 2's profit too); the month count names 2027 when it is not the growth year. Also: cash conversion
  of 70–85% is amber, but its sentence called it fine while the action said "chase the gap" — it now says how much
  arrives and where the rest sits (Grow and Sell).
- **§6.173** What fixes it — Capability to grow. Nic, 29 Sep 2026: the text under each dial states facts but must also
  say what the Planner can do, and each dial must take the others into account; the big space beside the score
  could be more substantial. AI button or other? Decided: the levers are worked out by the engine now (exact, the
  same every time, free); an AI "Planner's briefing" button comes later, written from these same figures.
  `engine/capability/levers.ts`: `growLevers` finds the levers the dials point to — overheads that outran sales,
  margin that slipped, customers paying slower, stock held longer — each with its profit and cash; `withLevers`
  re-runs the judged year with them pulled and `buildView` re-scores it, so "what it would take" is measured
  exactly as the score is. On the page: the paragraph under the headline now tells how the dials connect
  (`growStory`); a table shows the year now and with every lever pulled (margin, profit, cash, cycle, score); "What
  to do next" lists the levers with their money, the dials each moves, and "Agree as a target"; every card not in
  its best band says what would move it and how far ("would take it to 5.4%"); and when every lever still leaves a
  loss, it says how much more has to come from prices, volume or costs. On the accounts the levers aim at the year
  before; on the plan at the agreed targets, or else the better of the two actual years (as step 8 proposes).
  SEQ actual: overheads +89,118, margin to 42% +71,267, debtors to 30 days frees 89,802 → margin −2.6% → 5.4%, grow
  47 → 97. The slower-payment figure is now one number app-wide (lever, tile, step 8: 89,802).
- **§6.174** RULE (Nic, 29 Sep 2026): "Most of the time the English needs to be about grade 9 standard, not PhD
  standard." Capability to grow rewritten in plain words: short sentences, everyday verbs, jargon named or replaced.
  Fixes now read as actions ("Bring overheads down to 730,717", "Lift gross margin back to 42%", "Get customers to
  pay in 30 days"); each tile says "How to improve it: … That would take this to 5.4%"; the story is short
  sentences, past tense on the accounts and present on the plan; "floor" is always "cash floor" (the name on
  Assumptions); "overheads" in cash cover reads "running costs"; the verdict headlines, next-step actions and the
  score notes are plain. Borrow and Sell get the same pass when their levers are built.
- **§6.175** Nic: "It worked well, please expand to the other tabs." The same plain-English pass across the rest of
  Financial Capabilities and step 8: every Borrow and Sell card (notes, benchmarks, pencils), the verdict headlines,
  questions and next-step actions, the For-the-Planner box on both views, the Borrow and Sell pictures and panels
  (lender checklist, loans table, customers, add-backs bridge, buyer questions), the help, the readiness timeline,
  the target checks, and the Planner's assessment (issues, bridges, the list of things to collect, help). Terms kept
  as names (debt service cover, EBITDA) with plain sentences around them; "debtors" → unpaid invoices / getting paid,
  "facility/drawn/undrawn" → loan/borrowed/not yet used, "covenant breaches" → broken loan conditions, "customer
  concentration" → biggest customer, "security" → what a lender could lend against, "base case" → normal year.
- **§6.176** What fixes it — Capability to borrow. The same engine as Grow, judged on the position year: `borrowLevers`
  adds the lever only Borrow has — spread the loans over 5 years (or the agreed term): on the accounts from what is
  owed, the rate the interest implies and the years left from what falls due within a year; on the plan from each
  Funding loan shorter than the target — never below what the spread loans would cost — plus Grow's profit and
  payment levers (each is more cash to pay loans from) and, on the plan only, an overdraft sized to the worst month.
  `withLevers` now changes either Grow's year or Borrow's (loan payments, debt due within a year, cash, undrawn);
  a dial no single lever moves (loan cover stays nil until trading turns positive) is shown with all of them.
  Story in plain words; table of loan payments, cash from trading, cover, interest cover, runway and score; a line
  when even every fix leaves cover under 1.25×, or when the bad year still holds the score down (with the bad year
  shown and a link to check it). SEQ actual: payments 103,638 → 50,233, cash from trading −149,459 → +100,727,
  cover 0× → 2.01×; score stays 49 because the bad year (margin −40 points) still fails. SEQ plan 2027: cover 0 →
  0.88× with every fix, overdraft 30,000 for the −25,019 month.
- **§6.177** What fixes it — Capability to sell. A buyer prices one year (the sale year; the latest actual year on the
  accounts), so the levers are pulled there: the profit and payment levers against the year before it (profit first,
  since a buyer prices profit), then the price — what the fixed-up profit supports at the top of what similar
  businesses sold for (`sellLevers`). Beneath the table, what profit the asking price would need (`profitForPrice`).
  Story in plain words; "normalised EBITDA" renamed on the cards to "Asking price ÷ profit" and "Profit margin after
  add-backs". SEQ actual: profit after add-backs 32,638 → 193,023, price 1,000,000 → 670,000, sell 33 → 88; keeping
  1,000,000 needs 285,714 of profit a year. SEQ plan (sale year 2028): 76,876 → 110,024, price → 380,000.
- **§6.178** Check of all three tabs (Nic: "can you check we have done the three tabs?"), both views, SEQ and ZZ, by
  script: story, before/after table, fixes and a "How to improve it" on every card not in the green. Three cards had
  none because no money lever moves them — Borrow's bad-year cover (the −40-point bad year), Sell's revenue from
  ongoing clients, and ZZ's largest product share. Every such card now carries its plain action (`actionFor`), and
  the bad-year card also says to check the bad year. Also fixed: the buyer question on leadership pay matched the
  old wording of its card and had stopped appearing.
- **§6.179** The Planner's briefing (Nic: an AI "Planner's briefing" button, then a branded report). One note per
  tab (Grow, Borrow, Sell) per view (Actual, Plan): written with AI or typed, edited, and saved; the saved note is
  what the branded report will print. The tab's verdict, "In short" box, story, fixes and table moved out of the
  page into `engine/capability/read.ts` (`readTab`), so the page, the briefing and the report read one assembly.
  The model is handed a fact sheet of exactly what the tab shows (`briefingSheet`) — on the Actual view nothing from
  the plan — with grade-9 rules; `unknownFigures` flags any figure in the note that is not on the tab. Same gates
  as drafting (signed in, AI on for the plan, daily ceiling), zero-retention, 1,000 tokens. Saved in
  `plan_briefings` (migration 0057) with the score and verdict at the time, so the page says when the figures have
  moved on since. Next: the branded Word report (firm logo, name and colour — its own migration).
- **§6.180** The Planner's report — Financial Capabilities as a Word file under the firm's letterhead. Download on
  the Financial Capabilities page ("Download the Planner's report", with how many of the six briefings are saved
  and how many are out of date). Contents: At a glance (the three scores on both views, the plan's scores year by
  year and when each capability is ready, the agreed targets against the plan); then Grow, Borrow and Sell, each
  with "From the accounts" and "From the plan" — score and verdict, the Planner's saved briefing, the "In short"
  lines, the story, the fixes in order, the before/after table and every measure with how to improve it; then the
  information still needed. Built by `capabilityReport` from `readTab`, rendered by the business plan's own Word
  renderer (now taking an accent colour). The firm's letterhead — name, colour, logo — is set once on Plan
  settings → Branding, by a firm admin (migration 0058: `organisations.logo_path`, `brand_colour`, private bucket
  `firm-logos`). A light colour prints a shade darker so headings stay readable (`readable`, 3:1 on white). A
  business planning for itself gets its own logo and the app's navy.
- **§6.181** The consultant's firm never appears in a client's plan. Nic: "The Nic Clark coaching should never go
  in the clients plan. This is a fatal mistake… There should be a separated area for me as the consultant."
  The firm letterhead section is removed from Plan settings → Branding (the client's own logo stays). The
  Planner's briefing and the Planner's report are now shown, saved, drafted and downloaded only by a Planner —
  an admin or advisor of the firm the plan belongs to (`loadFirm().isPlanner`), checked on the server in the
  page, the save action, the AI route and the report route. A client given their own login (a plan member, not
  a firm member) sees neither. `FirmSection.tsx` and `firmActions.ts` are unreferenced and parked for the firm
  area, where they will be reworked to act on the firm rather than on a plan. Migration 0058's columns and
  bucket are right as they are: the letterhead belongs to the organisation. NEXT: the firm area — the
  consultant's brand, team, details and client list, with clients opened from it (rule recorded in the
  project's product-rules).
- **§6.182** The consultant's own area, part 1 (design: project doc "consultant-area"). A consultant — an admin
  or advisor of a firm that is not a business planning for itself — now lands on **My Clients** (`/firm/clients`),
  not on a list of plans. Three screens under their own menu and header: **My Clients** (search; the business
  picked, with its address, email, website and country READ FROM ITS PLAN rather than asked again, and the contact
  person — the one thing the plan does not hold — typed here; Open plan; Add new business, into the firm);
  **My Firm** (name, business number, address, phone, website, country, colour, default paper, the "Prepared by"
  line built from those details unless the firm writes its own, logo — admin-only to change); **My Profile**
  (name, title, direct phone, photo; sign-in email shown, never edited here). ONE FIRM PER CONSULTANT: setup used
  to create a new organisation for every business, so a coach with twenty clients had twenty firms; a consultant
  who has a firm now adds the business to it (`createPlan`, shared by setup and My Clients). Inside a client's
  plan, the firm's Planners get "← My Clients" in the header; a client never does. The Planner's report cover now
  carries the firm's "Prepared by" line. One image box (`ImageUpload`) serves the plan's logo, the firm's logo and
  the photo. Migration 0059: firm details on `organisations`, title/phone/photo on `profiles`, the contact person
  on `plans`, private `profile-photos` bucket (read by anyone who shares a firm with the person). Next: part 2 —
  client access (invite, turn off, "Your Planner" card, may-download switch).
- **§6.183** The consultant's own area, part 2 — client access. No email leaves the app (Nic: the email comes from
  the consultant; all email is built last). In My Clients each business shows Not invited / Invited / Link expired
  / Active / Access off. "Create invitation" makes a link for the contact person's email (14 days, one use, that
  address only; "Make a new link" closes the old one), shown with Copy link and Open in my email — a message
  already written, sent from the consultant's own mailbox. The link opens `/invite/[token]`: whose plan and which
  firm, then create a login with that email or sign in; accepting puts the client in that plan only. "Turn access
  off" takes every client out and closes any open link. "The client may download their own business plan" is
  enforced on the Word download route, not just hidden. Inside the plan a client sees the "Your Planner" card
  (name, title, phone, email, photo of the Planner who invited them); a Planner never sees it. Migration 0060: no
  service key — each step is a SECURITY DEFINER function that checks one thing (the caller is the firm's Planner,
  or is the invited email): `create_plan_invitation`, `invitation_preview`, `accept_plan_invitation`,
  `revoke_client_access`, `set_client_download`, `firm_client_access`, `plan_planner`; the photo is readable by
  the Planner's clients. New `supabase/tests/client_access.sql` (12 blocks: who may invite, resend closes the old
  link, only the invited email accepts, a link works once, the client sees no firm, the card, the switch, the
  photo, access off) — passes on a fresh database; the test stub gained `storage` and `anon`. NOTE: the older
  `tenant_isolation.sql` fails at "only one annual goal per area" on current migrations — pre-existing, from the
  goals-ladder change, not this work. Open: a brand-new client's "confirm your email" message still comes from
  Supabase until email is built.
- **§6.184** The consultant's own area, part 3 — Team. The rule: an ADVISOR SEES THEIR OWN CLIENTS, an ADMIN
  SEES ALL. `can_read_plan` / `can_write_plan` now give firm-wide reach to the firm's admins only; an advisor
  reaches a client by being assigned to it (a `plan_members` advisor row — what 0001 already writes for whoever
  creates a client). Migration 0061 backfills every existing advisor onto every plan of their firm, so nobody
  loses a plan they could open before; the admin then takes them off. **Team** (`/firm/team`): everyone in the
  firm, role, clients looked after, joined; the admin invites (a link sent from their own email, `/join/[token]`,
  14 days, once, that address only), changes a role, cancels an invitation, and removes someone — which also
  takes them off every client, so a plan membership does not outlive the job. The firm always keeps one admin.
  **My Clients**: "Looked after by" on each client (admin ticks teammates; an advisor sees the names), the names
  under each client in the list, and an admin filter "Looked after by …" / "Nobody looks after yet". The "Your
  Planner" card now prefers the assigned Planner. ALSO CLOSED: 0005 let a plan's or firm's creator read its row
  for ever (for INSERT … RETURNING); with a team that let a removed or unassigned consultant still see the row.
  It now holds only inside the creating transaction (`created_at = now()`). Database tests: new
  `supabase/tests/team.sql` (8 blocks); `client_access.sql` updated for assignment; the stale "one annual goal
  per area" assertion in `tenant_isolation.sql` corrected (0046 removed that rule on purpose). `scripts/test-db.sh`
  now runs each test file on a fresh database. All three pass.
