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

### 12. Nothing limits how much a plan can spend on drafts — **Build**

No rate limit, no per-plan cap, no daily ceiling. A client holding *Try again* costs real money, and the
Goals drafter (§6.115) made the worst case six times larger: one press writes six passages. Nothing has
gone wrong yet because one plan has been used by one person who was watching. That is not a control.

This is the one item on this list that can hurt before anybody notices it.

### 13. An accepted written draft records nothing — **Nic**

A goal taken from the drafter writes `source: "ai"` and the screen can say so. A vision, a brand promise or
a positioning line taken from a draft button records nothing at all — the tables have no column for it, so
this is a migration and not a tweak.

The question underneath is whether a client WANTS it visible. It is honest, and it is also a label on their
own business plan saying a machine helped write it. Worth asking one before building either.

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
