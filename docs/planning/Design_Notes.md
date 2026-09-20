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
with the caption *"Will use your industry, products and goals"*. No AI code anywhere in the repository. The
goals model already carries `source: "manual" | "ai" | "whatif"`, so the shape was anticipated.

Six buttons promising a capability that does not exist is §6.87. Either it ships or the caption goes.

**And the caption is wrong for a second reason, which turned out to drive the whole design.** Vision is step
1. Products are step 8. Goals are step 16. A client who does everything in perfect order still has no
products and no goals when they reach Vision, so that sentence promises data from steps that have not
happened and, at that point in the path, never will have.

## What a plan actually holds at step 1

Plan settings comes before Vision, and `industry` is already a required profile field
(`PROFILE_REQUIRED`). So by the time anyone reaches a draft button the plan knows: business name, industry,
country, main state, legal structure, type of customer, type of product, date established and the tagline.

That is a real grounding set. What is absent is everything the later steps collect.

## The mechanism: one thing, not two

An earlier draft of this note had each field declare itself **grounded** (the plan can answer it) or
**ask-first** (only the owner knows). That was wrong, and Nic's objection is what corrected it: the same
field is grounded at step 12 and ungrounded at step 1. It is not a property of the field.

> **A FIELD DECLARES WHAT IT WOULD LIKE. AT THE MOMENT THE BUTTON IS PRESSED, WHATEVER IS PRESENT BECOMES
> CONTEXT AND WHATEVER IS MISSING BECOMES THE QUESTIONS.**

Mission wants profile, an overview of what is sold, and who it is sold to. Press it at step 1 and the
profile is there but the rest is not, so it asks. Press it at step 12 and it drafts without asking anything.
One button, one code path, correct in both places — and no static classification for anyone to maintain or
get wrong.

**The caption is computed from the same check**, so it can no longer lie: *"Will use your industry and
business profile"* early, *"Will use your industry, products and goals"* once those exist. It describes what
it will actually use because it is reading the same thing the drafting reads.

## The prompt is built from the field, never written per field

Every field already carries a label, a sub-line, a hint and a placeholder, and they are sharp. Brand
promise, for instance: *what you guarantee every customer, every time* — *"A commitment you would honour at
your own cost. Not what makes you better than the competition — that is Our advantage, on the Competitors
step."*

That is better field guidance than a hand-written prompt would be, and it is already on the screen in front
of the client.

> **FORTY HAND-WRITTEN PROMPTS ARE FORTY COPIES OF GUIDANCE THAT ALREADY EXISTS, AND THEY WILL DRIFT FROM IT
> (§6.41). ONE DRAFTING FUNCTION READS THE FIELD DEFINITION.**

A new field then gets drafting for free, and a hint edited on the screen changes what the model is told in
the same commit. The popup is headed with the field's own label and sub-line — *"Mission — what you do, for
whom, every day"* — so there is never a question about which box is being filled, and no second copy of that
wording to drift.

## What the AI may not invent

> **A GENERATED SENTENCE THE OWNER DID NOT MEAN IS WORSE THAN A BLANK FIELD.**

"Purpose: why the business exists beyond profit" is not in a products table. Where the plan cannot ground an
answer the model asks rather than guesses, because the alternative is the app putting words in a client's
mouth that they will then sign and send to a bank.

## The questions

At most **three**, ranked by how much each would change the draft, and only ever for what is genuinely
missing. Each one must be answerable in a sentence: *"What are the main things you sell?"* is a question;
*"Describe your market"* is homework.

**They are asked at the granularity of an overview, never of a list.** Nic's correction, and it matters:
step 1 wants *"I sell driveways, patios and housing slabs to the domestic market"* — enough for the model to
get a grasp. Step 8 wants every product with a price, a volume and a growth curve, because that is what the
forecast is built from. Those are different questions at different depths and neither substitutes for the
other.

## The overview field — done, §6.103

`plan_settings.products_services_statement` already existed and was already asked, on the Sales screen at
step 8 — so the one field that would ground every draft in the app sat two-thirds of the way through the
path. **Moved to Plan settings in §6.103**, with the text still shown read-only on Sales.

That was the prerequisite for everything above: a draft button at step 1 now has a paragraph describing the
business behind it, instead of an interrogation repeated at five separate steps.

## Always a button, and it never overwrites

The client decides, every time. Nothing drafts automatically.

And **if the field already has text, the draft appears as a suggestion to accept or discard, never straight
into the box.** Someone pasting from an existing plan must not be able to lose it to a mis-click.

## Context comes from the loader, and only what the field asks for

`gatherReport(planId)` already assembles the whole plan — every module, the forecast, the figures — into one
object. The AI context is a projection of that. **It is not a second reading** (§6.41, §6.67): a "fetch plan
data for AI" function would recreate the fault this codebase has spent its life fixing.

Each field declares what it needs. Sending forty pages to draft one sentence is expensive and makes the
model worse, not better.

## The protection that actually works is sending less

Nic's correction, which reframed the disclosure question: **the confidentiality statement on page 2 is the
client's notice to whoever they hand the plan to. It is not our notice to them.** The two had been
conflated.

So disclosure is answered honestly in its own place — and separately, the app simply does not send most of
what would worry anyone:

> **ONLY THE CONTEXT A FIELD DECLARES IS SENT. PEOPLE'S NAMES, SALARIES AND FUNDING SOURCES ARE IN NO
> FIELD'S CONTEXT.**

Drafting a vision statement needs the industry, the overview and the segments. It does not need what the
operations manager is paid or which bank holds the loan. This is enforceable in code and testable, which a
consent paragraph is not.

## The toggle

Per plan, in Plan settings, beside the print settings — per plan for the reason already written into
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

Terms at purchase are the proper home for the general version. This toggle is not a substitute for that — it
is what puts the disclosure where the decision is being made.

## The provider

**Checked in September 2026 rather than remembered:**

- **OpenAI direct** does not train on API data by default, but retains abuse-monitoring logs up to 30 days
  as standard; zero data retention requires approval by their sales team.
- **OpenRouter** retains nothing unless prompt logging is opted into, offers ZDR toggles per model group in
  account settings, and — the part that matters — a **per-request** parameter: `provider: { zdr: true }`.

> **A GUARANTEE THAT TRAVELS WITH EVERY REQUEST LIVES IN THE CODE AND CAN BE TESTED. A GUARANTEE THAT LIVES
> IN A DASHBOARD TOGGLE DEPENDS ON NOBODY CHANGING IT IN EIGHTEEN MONTHS.**

OpenRouter also keeps model choice, which matters here: drafting a vision statement and drafting an
operations narrative may want different models, and cost and quality will want comparing per field.

**Keep the distinction straight in the wording:** OpenRouter separates retention from training. Some
providers do not train but do retain. `zdr` addresses retention; training is a separate control. The consent
statement must describe what is actually configured.

**Build so the choice does not matter.** `engine/ai/` with a provider interface; model and provider in
config; the key server-side and never `NEXT_PUBLIC_`. Swapping vendor becomes configuration rather than a
rewrite, which is the right posture for a field moving this fast.

Two caveats held lightly: confirm what the OpenRouter account's privacy settings actually say before the
wording is finalised, and remember that a vendor toggle is a policy rather than a contract.

## Security: the model never touches the database

> **THE AI IS HANDED TEXT AND RETURNS TEXT. IT GETS NO CONNECTION, NO TOKEN, AND NO TOOL THAT CAN QUERY.**

The server loads the plan through the same Supabase client with RLS that every page uses, under the
signed-in user's own session. The model only ever sees what that loader returned.

So the guarantee is not "we instructed it not to read other plans" — there is nothing for it to read from.
If "ask the AI about my plan" is ever built, it goes through the same loader. **Never give the model a tool
that runs a query.**

## Open questions

1. **Waiting.** This app has no spinners, and that rule holds because every save is milliseconds. A draft is
   five to ten seconds. That is a state the app has never had to express, and it needs an answer before the
   first button works rather than after — otherwise the first AI feature is also the thing that breaks the
   app's one consistent interaction rule.
2. Rate limiting and a per-plan cap, so a stuck button cannot spend a fortune.
3. Does an accepted draft record that it came from AI? Goals already have `source: "ai"`; written fields do
   not. Worth it for honesty, and worth asking whether a client wants it visible.
4. Whether an answer given to a question at step 1 is kept anywhere beyond that draft, or asked again later.
   The overview move above removes most of this, since the commonest question now has a home.


## Which fields get a button — the sweep, step by step

Nic, starting it: *"the button works well for Vision, Mission, Purpose, Brand promise. But not good for
anything in Historic, or Average price, Base units sold, Base annual sales."* Then: *"start at the top and
work downwards."*

Recorded as it is decided, because the refusals are the part somebody will otherwise re-open in six months
and get wrong. **A refused field shows nothing at all** — no greyed button, no "drafting is off" line. That
line points at Plan settings, and sending a client there to switch on something that was never going to
appear is worse than silence.

| Step | Screen | In | Out |
|---|---|---|---|
| — | Plan settings | About what you sell | — |
| 1 | Vision & Purpose | all six | — |
| 2 | Leadership Team | — | every field: names, roles, wages |
| 3 | Marketing | positioning, 3 × brand, sales process | market size, market trends, who sells |
| 4 | Competitors | our advantage, barriers, what could change | the rival grid, all of it |
| 5 | SWOT | — | the whole step, see below |
| 6 | Operations | what limits it, how we lift it, quality | operating hours, what we can deliver today |
| 7, 9–15 | the financials | — | every field, on Nic's instruction |
| 8 | Sales | **blocked**, see below | the numbers |
| 16 | Goals | **not this mechanism**, see below | — |
| 17 | Business plan | — | it has no input fields |

### The four reasons a field is refused

1. **It is a fact about the world.** Market size, market trends. A model supplies one fluently and without
   a source, which is the single thing a grant assessor reads that section to check.
2. **It names a person.** Who sells, and everything on Leadership Team. No slice of the plan is allowed to
   read a person (`engine/ai/slices.ts`, rule 2), so a draft would either invent staff or be handed the
   very thing the consent wording promises never leaves.
3. **It is a claim about a named third party.** A competitor's strengths and weaknesses. Market size at
   least fails towards a number somebody can check; this fails towards defamation.
4. **The plan holds a number for a different question.** `capacity_now` is the sharp one: the sales lines
   DO carry volumes, but those are the forecast — what the business intends to sell. Capacity is what it
   could deliver. Hand a model 36 slabs a year and it writes "we can deliver about 36 slabs a year", which
   states that the business is running at exactly 100% and always has. Nobody meant to claim that, and it
   lands in the section a lender reads to find out whether the forecast is possible at all.

### Step 5 is refused whole, and not for any of those reasons

SWOT has no prose boxes — it is a 2×2 of one-line items, each with a response. And it already has
`suggest.ts`: every line is drawn from a field the client typed, carries the screen it came from, and
enters only on a click. **That is strictly better than a draft, because it has provenance.** Putting an AI
button beside it would offer plausible lines with no source, next to grounded lines with one, and the
client cannot tell them apart once they are both in the grid.

The `response` boxes ("How you'll fix it") are a fair question and still a no for now. A response becomes a
**goal** at step 16 — an owner, a quarter, a status. A model writing "hire a second estimator in Q3" is not
suggesting prose, it is inventing a commitment.

### Where the sweep stops, and why it is finished rather than abandoned

**The per-field drafter is done.** Every plan-level prose box in the app either has a button or has a
written reason not to. What is left needs different machinery, and both cases were visible from outside
before any of it was built.

**Step 8, Sales — a per-row drafter, and a question about prices.** The three boxes Nic named himself
(*"Why they buy it, margin, weaknesses field or the field Why this price"*) all live inside the per-product
dialog, one set per line. So do `how_we_win` per competitor, a SWOT `response` per line, and `detail` per
process step: five fields across four screens now want the same missing thing. A row's own name and notes
have to reach the model, which the per-field drafter has no way to carry.

That part is buildable and not large — `ReportInput` already holds the lines, so it is a subject block and
a row id on the request, not a second query (§6.41). **The part that is not mine to decide is the price.**

> `whatYouSell` deliberately sends names and words and NOT prices — the smallest context that answers the
> question. But "Why this price" cannot be drafted without the price. Building it means sending a figure
> the slices currently refuse to send, which changes what the consent wording promises.

So it waits for Nic, as a deliberate choice about the redaction rule rather than a detail inside a feature.

**Step 16, Goals — never this mechanism.** The nav has tagged Goals **AI-drafted** since before any of this
existed, and Note 4 says the model reads all four SWOT quadrants when it drafts them. That is a drafter
that proposes a SET of goals — an area, a quarter, an owner, a milestone — from the SWOT responses and the
finished forecast. A "suggest a draft" button on a goal's title would be a much smaller thing wearing the
same name, and shipping it would make the real feature harder to add later, not easier.

---

# Note 5 — Whether the financials should come first

**Status:** open. Raised, not decided. **The empty-plan walkthrough is what settles it.**

Nic: *"we are forcing the clients to start on areas they might not want to as we don't have an intelligent
AI."*

## The order today

Plan settings, then Vision (1), Leadership Team (2), Marketing (3), Competitors (4), SWOT (5), Operations
(6), then the financials from Historic (7) through One-off income and costs (13), then Assumptions (14),
Review forecast (15), Goals (16), the plan itself (17).

So **six narrative steps come before a single number.** The hardest writing in the whole app — a vision, a
purpose, a brand promise — is what a client meets first, cold, with nothing behind them.

## The case for turning it round

Most owners know what they sell and roughly what it costs. Very few have ever written down why the business
exists. The numbers are the part they can answer; the narrative is the part they have never articulated —
and it is far easier to write once the forecast is in front of you, with or without a model helping.

It would also change what AI drafting can do. Under the current order the model is close to blind for six
steps. With the numbers first it would reach every narrative field knowing the business properly.

## The case against, and it is not nothing

**Real dependencies run the other way.** Leadership Team feeds salaries into Overheads; Marketing feeds
spend into Overheads. Both must precede step 10, or a client enters overheads with synced lines sitting at
zero and never comes back to them.

And a plan's logic is strategy then numbers: you decide what you are doing, then you forecast it. Reversing
that means forecasting before deciding — though it is worth being honest that this is partly a consultant's
idealisation, since the real plan is usually already in the owner's head.

**The report order does not have to match the entry order.** The document reads Executive Summary, strategy,
then financials whatever order the screens were filled in. So nothing about the document constrains this.

## Where this actually lands

Three things are true at once, and they point at different sizes of change:

1. **Advanced mode already exists.** Clients are not locked in; the guided path only suggests an order. Some
   of this complaint may be about how firmly it suggests it.
2. **Moving the overview to setup (Note 4) removes much of the pain without touching the order**, because
   the reason the early steps feel cold is not their position — it is that nothing has yet captured what the
   business does in prose.
3. **Reordering seventeen steps is not a small change**: the nav, `stepAfter`/`stepBefore`, completeness,
   the guided path's whole shape, and the two sync dependencies above.

> **REORDERING A PATH NOBODY HAS WALKED IS GUESSING WITH THE EXPENSIVE OPTION.**

Do the overview move first. Then walk an empty plan from step 1 to 17 and find out where a client actually
stalls, which is the only evidence that could justify the larger change.
