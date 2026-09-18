# Design notes

Things worked out in discussion and **not built**. A note lives here so the reasoning survives the
conversation it came from — the alternative is re-deciding the same question in six weeks with none of the
evidence that settled it the first time.

A note is not a commitment. When one is built it moves to `SaaS_Requirements.md` as a numbered section and
the note is deleted, so nothing is described in two places (§6.41).

---

# Note 1 — The marketing funnel, run backwards

**Status:** designed, not built. Waiting on a decision about sequencing.

## Where it came from

A review of LivePlan (the main marketplace competitor) proposed three differentiators: connect the plan to
the owner's personal goals; show how the numbers will actually be achieved; and turn the plan into weekly
action. The review was written without access to the app and said so. Two of the three turned out to be
partly built already.

**What is already here.** Quarterly goals across six areas, each with an owner, a status, a milestone date
and a parent annual goal. SWOT lines a client committed to become goals at step 14. What-if scenarios
become goals. The dashboard already shows this quarter's goals with owners and statuses. The what-if levers
are price, volume, COGS, overheads and the three working-capital days.

**What is not.** Nothing anywhere asks what the owner wants out of the business — Vision asks six questions
and every one is about the business. And **marketing spend is a cost with no other end**: a client can
budget $50,000 across advertising, content and referrals, set 0% growth in Sales, and nothing objects. Those
two screens are strangers, which is the same fault as the overheads table that did not sum to its own total
(§6.93.1), spread across two steps instead of one.

## The decision: it runs backwards

A forward calculator asks a client to invent four numbers — leads, qualification rate, win rate, average
value — and presents their product as though it were a finding. That is four guesses multiplied together
with the error compounding, dressed as arithmetic.

> **THIS APP DOES NOT TELL A CLIENT WHAT WILL HAPPEN. IT TELLS THEM WHAT WOULD HAVE TO BE TRUE.**

So the funnel reads the forecast the client has already built and checks whether it can be delivered:

> *Your plan sells 340 driveways in Year 1. At the 25% you entered, that needs about 1,360 quotes — 26 a
> week. You told us you do 12.*

Running it backwards also **dissolves the hardest design question**. A forward calculator has to allocate
leads to products. A backward check never does: it adds up what the plan already implies.

## Where it attaches, and why not per product

Per plan, not per product. **A lead is not attached to a product, because the product is chosen after the
conversion, not before it.** Nic's example, which settled it: a business coaching firm runs a workshop, the
workshop produces sales calls, and at the call they work out which programme fits. A legal firm's enquiry is
"I think I need help". Even a concreter: the call is "can you quote a driveway" and half become slabs.

Some businesses genuinely promote per product line. They are the minority, and a per-product funnel would
put a question in front of every other owner that is fictional for them.

Noted for later: `clients_from_product_id` already exists on the product model — one product can source its
clients from another. That is the workshop-feeds-programme case, already half modelled.

## The input: two fields, and nothing else

On the Marketing screen, beside the spend:

- *Roughly how many enquiries do you get in a typical month?*
- *Roughly what share of them become customers?*

That is the whole input. The plan already knows how many new customers it needs and when, so asking for
average value, frequency or a qualification stage would be asking a client to re-enter what they have
already told us (§6.41).

Both blank means no check and nothing lost. A blank field is honest; a field that invents a number is not.

## Cost per enquiry is derived, never asked

Marketing spend ÷ enquiries. Derived, so it cannot disagree with the plan, and it is one fewer question at
nine o'clock at night. It also finally gives the marketing budget somewhere to land:

> *You spend $50,000 a year and get 12 enquiries a month — $347 an enquiry. Your plan needs 31 a month. At
> today's cost, that is $129,000, not $50,000.*

**Two things the wording must get right.**

It is **"marketing spend per enquiry"**, not "cost per lead". The spend kinds include retention and public
relations, which buy no enquiries at all. Naming it bluntly is cheaper than sharpening it — asking which
activities generate leads adds seven questions.

And **never as a prediction.** "At today's cost, that is $129,000" is a check. "That will cost $129,000" is
false, because lead costs are not linear: the fifth ten thousand of advertising never buys what the first
did.

## The units differ, and the check must say so

The engine computes `newClients` per product per year and per month — but only for recurring products. A
one-off sale is a JOB, not a customer; the same person may buy twice.

So the check speaks in the plan's own units: "340 driveways" for one-off, "24 new maintenance clients" for
recurring, shown **separately** in a mixed plan rather than summed.

> **ADDING 340 JOBS TO 24 CLIENTS AND CALLING IT 364 CUSTOMERS WOULD BE A MADE-UP NUMBER, WHICH IS THE ONE
> THING THIS APP DOES NOT DO.**

## The rule that guarantees it cannot break the plan

> **THE FUNNEL WRITES NOTHING. IT READS THE FORECAST AND COMMENTS ON IT. IT CANNOT CHANGE A FIGURE, AND NO
> FIGURE IN THE PLAN MAY DEPEND ON IT.**

Every feature that has hurt this codebase hurt it by becoming a second source for a number that already had
one. A read-only check cannot join that list: delete it tomorrow and every figure is unchanged.

## Deliberately excluded

- **A qualification stage** (leads → qualified → won). More honest for businesses that quote, and it tells
  the owner almost nothing the blended rate does not. One more question for no new sentence.
- **Seasonal enquiries.** Real for a concreter in the wet. Twelve fields is the exact shape of "the owner
  gives up".
- **Per-activity lead costs.** Seven questions to sharpen one number.
- **Lag** — see below. This is the only exclusion that costs something real.

## The monthly shape comes free

The plan already knows when new customers arrive (`monthly_new_clients`, opening clients, the products' own
monthly distributions), so the check can be quarterly or monthly without a single monthly input:

> *Your plan needs 12 enquiries a month in Q1 and 38 by Q4. You said you get 12.*

More useful than the annual version, because it says **when** the wheels come off.

Marketing spend by month is already solved: it arrives annual, becomes a synced overhead line, and spreads
evenly unless the row carries a monthly distribution. Nothing to build.

## The one thing left out that costs something: lag

An enquiry in month 3 becomes a customer in month 4 and revenue in month 5. The workshop case is worse —
workshop in March, calls in April, programme starts in May. **Marketing loaded into the last quarter of a
plan year buys revenue that lands in the next one**, and nothing in the app would say so.

It needs a field ("how long from enquiry to sale?") and it only means anything once marketing spend is
monthly rather than annual. Two changes to tell one truth, so it waits — and it is the one thing that would
earn a third field later.

## Scope

One migration (two numeric columns on the marketing record), two fields on the Marketing screen, one pure
engine module, a check block showing the gap annually and by quarter, and tests including the mixed
one-off/recurring case. About half a day, most of it engine and tests.

## Open questions

1. **Does the check print in the Word document?** A lender reading "the plan needs 31 enquiries a month and
   the business gets 12" is reading an argument against lending. Honesty is this app's character, but the
   check was designed for the owner, not the bank. Undecided; default is screen only.
2. **The dashboard** — does the gap belong there, or only on Marketing?
3. **Lag**, as above, once anyone actually trips on it.

---

# Note 2 — Owner goals as checks, not as a module

**Status:** assessed, not designed.

Nothing in the app asks what the owner wants out of the business. Vision asks vision, mission, purpose,
brand promise, AI direction and field of play — all six about the business.

The value is not the feature, it is that **it fits the voice the app already has**. This app's whole
personality is telling a client what does not add up. Owner goals slot straight into that idiom:

> *Your plan pays you $95,000. You said you wanted $150,000 and to work three days a week — the plan has you
> working five and carrying no manager.*

Three or four questions at step 1 (desired income, days a week, exit horizon) and a check against the
forecast. Not a module. Same read-only rule as Note 1.

---

# Note 3 — The weekly loop, and why it waits

**Status:** assessed. Recommended NOT to build yet.

The structure is about 70% there: quarterly goals, owners, statuses, milestone dates, SWOT-to-goal,
what-if-to-goal, and the dashboard already surfacing this quarter.

**What is missing is not structure. The app has no concept of what actually happened.** There are no
actuals anywhere — no month-end figures, no "we did 180k against a plan of 200k". Historic is prior years
entered once, not a feedback loop.

Without actuals a weekly review is a to-do list with plan numbers printed beside it, and this is the one
place the competitor has a structural advantage, because it syncs to Xero and QuickBooks. Matching that
means becoming an accounting integration — a different company, with a different support burden.

---

# The constraint over all three

Nic's words, and they are better than mine: *keep it functional but simple; we run the risk of getting too
smart and too complicated and the business owner gives up.*

The concrete form of that: every field is a question a tired person answers at nine at night, and a promise
the app then has to keep (§6.87).

> **THE STOPPING RULE: A NEW FIELD EARNS ITS PLACE ONLY IF THE APP CAN SAY SOMETHING USEFUL WITH IT THAT IT
> COULD NOT SAY WITHOUT IT.**

Two fields let the app tell an owner their plan needs two and a half times the enquiries they get. A third —
qualification rate — tells them almost nothing extra and costs a question. That is where it stops.

It is the same test that condemned the Assets stubs and the succession column: things that sit on a screen
without doing anything.

---

# Note 4 — AI drafting

**Status:** designed, not built. The provider account exists; nothing is wired up.

## What is there today

**One** stub, in `vision/VisionForm.tsx`, rendered six times — a disabled button reading *✦ Suggest a draft*
with the caption *"Will use your industry, products and goals"*. No AI code anywhere in the repository.
The goals model already carries `source: "manual" | "ai" | "whatif"`, so the shape was anticipated.

Six buttons promising a capability that does not exist is §6.87. Either it ships or the caption goes.

## The prompt is built from the field, never written per field

Every field already carries a label, a sub-line, a hint and a placeholder, and they are sharp. Brand
promise, for instance: *what you guarantee every customer, every time* — *"A commitment you would honour at
your own cost. Not what makes you better than the competition — that is Our advantage, on the Competitors
step."*

That is better field-specific guidance than a hand-written prompt would be, and it is already on the screen
in front of the client.

> **FORTY HAND-WRITTEN PROMPTS ARE FORTY COPIES OF GUIDANCE THAT ALREADY EXISTS, AND THEY WILL DRIFT FROM
> IT (§6.41). ONE DRAFTING FUNCTION READS THE FIELD DEFINITION.**

A new field then gets drafting for free, and a hint edited on the screen changes what the AI is told in the
same commit.

## Grounded fields and fields only the owner knows

Two kinds, declared in the field definition:

- **Grounded** — the plan can answer it. "Mission: what you do, for whom" comes from products and segments.
  Press the button, get a draft.
- **Ask first** — only the owner knows. "Purpose: why the business exists beyond profit" is not in a
  products table, and drafting it from one is the app putting words in a client's mouth that they will then
  sign and send to a bank. One or two questions, then draft from the answer.

> **A GENERATED SENTENCE THE OWNER DID NOT MEAN IS WORSE THAN A BLANK FIELD.**

## Context comes from the loader, and only what the field asks for

`gatherReport(planId)` already assembles the whole plan — every module, the forecast, the figures — into one
object. The AI context is a projection of that. **It is not a second reading** (§6.41, §6.67): writing a
"fetch plan data for AI" function would recreate the fault this codebase has spent its life fixing.

Each field declares what it needs — `context: ["products", "segments", "positioning"]`. Sending forty pages
to draft one sentence is expensive and makes the model worse, not better.

## The protection that actually works is sending less

Nic's correction, which reframed this: **the confidentiality statement on page 2 is the client's notice to
whoever they hand the plan to. It is not our notice to them.** The two had been conflated.

So the disclosure question is answered honestly, in the right place — and separately, the app simply does
not send most of what would worry anyone:

> **ONLY THE CONTEXT A FIELD DECLARES IS SENT. PEOPLE'S NAMES, SALARIES AND FUNDING SOURCES ARE IN NO
> FIELD'S CONTEXT.**

Drafting a vision statement needs the industry, the products and the segments. It does not need what the
operations manager is paid or which bank holds the loan. This is enforceable in code and testable, which a
consent paragraph is not.

## The toggle

Per plan, in Plan settings, beside the print settings — and per plan for the reason already written into
migration 0041: these decisions *differ between two plans the same consultant writes in the same week*. A
café and a defence subcontractor are not the same answer.

**DEFAULT OFF**, which is the opposite of `print_key_people_salaries` and for a reason worth stating:

> **A DEFAULT THAT ADDS IS NOT A DEFAULT THAT DISCLOSES.** Salaries default to printing because otherwise a
> client types every figure and never sees them — the app failing to deliver what they entered. Sending a
> client's strategy to a third party is something they turn on, not something they fail to turn off.

**Three columns, not one:** `ai_enabled`, `ai_enabled_at`, `ai_enabled_by`. A lone boolean cannot answer
"did they agree, and when" six months later. That is the difference between a preference and a consent.

**With the toggle off the draft buttons are absent**, with one line offering to turn it on — not greyed out
with a tooltip. A disabled button is a locked door; a missing one with a note is an invitation.

## The consent wording

A first cut. Every sentence has to be one the code actually keeps:

> **Use AI to help draft this plan**
>
> When this is on, you can ask for a draft of any written section. To do that, we send the relevant parts of
> this plan — your industry, products, market and goals — to an AI service, which returns suggested wording.
>
> We never send names, salaries, or funding details. Nothing is sent unless you press a draft button. Every
> suggestion is yours to edit or discard, and nothing is saved to your plan until you accept it.
>
> The AI models are provided by third parties and may change over time.

Terms at purchase are the proper home for the general version. This toggle is not a substitute for that —
it is what puts the disclosure where the decision is actually being made.

## The provider

**Checked, September 2026, rather than remembered:**

- **OpenAI direct** does not train on API data by default, but retains abuse-monitoring logs up to 30 days
  as standard; zero data retention requires approval by their sales team.
- **OpenRouter** retains nothing unless prompt logging is opted into, offers ZDR toggles per model group in
  account settings, and — the part that matters — a **per-request** parameter: `provider: { zdr: true }`.

OpenRouter wins on the strength of that last point. **A guarantee that travels with every request lives in
the code and can be tested. A guarantee that lives in a dashboard toggle depends on nobody changing it in
eighteen months.**

It also keeps model choice, which matters here: drafting a vision statement and drafting an operations
narrative may want different models, and cost and quality will want comparing per field.

**Keep the distinction straight in the wording:** OpenRouter separates retention from training. Some
providers do not train but do retain. `zdr` addresses retention; training is a separate control. The consent
statement must describe what is actually configured.

**Build so the choice does not matter.** `engine/ai/` with a provider interface; model and provider in
config; the key server-side and never `NEXT_PUBLIC_`. Swapping vendor becomes configuration rather than a
rewrite, which is the right posture for a field moving this fast. Coupling to one vendor is the mistake, not
picking the wrong one today.

Two caveats held lightly: confirm what the OpenRouter account's privacy settings actually say before the
wording is written, and remember that a vendor toggle is a policy rather than a contract — a client who
needs a contractual guarantee is a procurement conversation, not a setting.

## Security: the model never touches the database

> **THE AI IS HANDED TEXT AND RETURNS TEXT. IT GETS NO CONNECTION, NO TOKEN, AND NO TOOL THAT CAN QUERY.**

The server loads the plan through the same Supabase client with RLS that every page uses, under the signed-in
user's own session. The model only ever sees what that loader returned.

So the guarantee is not "we instructed it not to read other plans" — there is nothing for it to read from.
If "ask the AI about my plan" is ever built, it goes through the same loader. **Never give the model a tool
that runs a query.**

## Open questions

1. Which fields are grounded and which must ask first — a pass over every written field in the app.
2. Rate limiting and a per-plan cap, so a stuck button cannot spend a fortune.
3. Does an accepted draft record that it came from AI? The goals model already has `source: "ai"`; written
   fields do not. Worth it for honesty, and worth asking whether a client wants that visible.
4. What happens when the provider is down or slow — this app has no spinners (§ house rule), and a draft
   takes seconds rather than milliseconds. That needs its own answer before the first button works.
