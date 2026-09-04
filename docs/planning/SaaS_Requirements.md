# Business Planning SaaS — Requirements (working document)

Companion to `ABoS_APeX_Menu_Inventory.md` (what the current ABoS/APeX build does).
This file records what the **public SaaS** will do. Decisions are dated; open items are marked.

---

## 0. What this product is — principles (Nic, 4 Sep 2026)

**A business planning application, not a financial tracking application.** It must produce an accurate plan and a finished business plan document. It is not a ledger, not bookkeeping, not a depreciation schedule.

**The core flow**
1. Client uploads historical financials via **Historic** (opening position).
2. Client works through the planning modules; any capital purchases or loans are entered via **Funding** and its sub-tabs — that is the only route by which assets affect the numbers.
3. Forecast engine produces the five statements.
4. **Reports** produces the business plan.

**Where it came from.** The existing APeX build was shaped by the Australian government-funded planning programs — Self-Employment Assistance (the rebranded NEIS: fully funded plan development + 12-month mentoring for startups/micro-businesses ≤4 staff) and the established-business advisory subsidies (Entrepreneurs' Programme Business Growth stream, ASBAS Digital Solutions, state voucher schemes such as NSW Business Connect / QLD Business Boost). That heritage explains the structure: a plan a funding body will accept, built with a coach alongside. The new build is not bound to those programs, but it should still be able to serve them.

**Use cases the SaaS must serve (v1 unless marked)**
| Use case | What "done" looks like | v1? |
|---|---|---|
| Grant / government funding application (US SBA, AU SEA/NEIS, other jurisdictions) | A plan document in the format the funding body expects, with credible financials | **Yes** — output templates per funding body |
| Two-day coach-led workshop, 4–10 businesses in a room | Every business leaves with a completed plan; coach spends the time on strategy, not on how to fill in fields | **Yes** — see §8 Workshop mode |
| Larger business seeking investor funds | Investor-grade plan: 5-year forecasts, funding structure, cap table, unit economics | Yes — already in the engine |
| Startup wanting a solid plan to follow | Guided build from zero, industry template, first forecast fast | **Yes** |
| Owner / CEO running the business off the plan in 90-day cycles | Plan check-ins, quarterly goals, progress tracking | **Later** — §6 is phase 2 |
| Accounting firm adding advisory fees | Firm works many clients, imports their financials, brands the output | Yes — advisor workspace |
| Consultant adding fees | Same as above, single practitioner | Yes — advisor workspace |

**The unifying thread:** every one of these ends in a *plan document a third party will accept* — a grant assessor, a lender, an investor, a coach, or the owner's own future self. The Report is the product; everything else exists to make the Report accurate and fast to produce. That settles the Reports question: **retained, promoted, and templated by audience.**

**Scope discipline.** Build the plan SaaS first — plan build, forecast, report, coach/advisor seat. Expansion (90-day operating rhythm, integrations, deeper AI) comes after v1 ships and only if it doesn't compromise the novice path.

**Design constraints that override everything else**
- *Stickiness.* The client must have a reason to return more than once a year. Annual re-planning alone will not sustain a subscription.
- *Simplicity.* A business owner with no financial skills must be able to complete a plan unaided. Complexity that a novice can't get through is a defect, however clever.
- *Accuracy.* Simplicity cannot come at the cost of a wrong plan. The engine stays rigorous; the interface hides the rigour.
- *Range.* The same product must satisfy a novice owner and a financially sophisticated user. Implication: **progressive disclosure** — a guided/simple mode by default, an advanced mode that exposes the full assumption set (working-capital days, tax timing, prepaids/accruals, CapEx life, etc.).

**Who pays**
| Segment | How they use it | Product implication |
|---|---|---|
| Business owners (novice → expert) | Build and maintain their own plan | Guided mode, plain-language help, templates by industry, AI explanations of every number |
| Coaches | Run planning with many clients | Advisor workspace: many client plans, session notes, client-facing report branding, ability to "drive" a client's plan |
| Consultants | Deliver plans as a paid engagement | White-label / co-branded reports, plan hand-over to client, scenario modelling as a deliverable |
| Accounting firms | Add planning/advisory to compliance work | Bulk client onboarding, Historic import from their accounting package exports, firm-level user management, review/approve workflow |

Every segment pays. Pricing model TBD, but the advisor segments need per-seat + per-client-plan pricing, and owners need a single plan tier.

---

## 1. Scope carried forward from APeX

| Area | Decision | Date |
|---|---|---|
| Plan Dashboard | **Redesigned** — see §3. Existing 16-KPI page is not carried forward. | 4 Sep 2026 |
| Foundations (7 items) | Carried forward; **regrouped** into Strategy & Direction, Assets, People, Market, Goals — see §2. | 4 Sep 2026 |
| Financials (6 items) | Carried forward as-is. | 4 Sep 2026 |
| Forecasts (5 items) | Carried forward as-is. | 4 Sep 2026 |
| 7 Key Drivers | Carried forward; **renamed and relocated** — see §4. | 4 Sep 2026 |
| Strategies (5 library items) | **Dropped.** Replaced by an AI-generated strategy layer — see §5. | 4 Sep 2026 |
| Reports (business plan editor) | **Retained and promoted** — the Report is the product. Re-homed as its own top-level item; gains audience templates (SBA, SEA/NEIS, investor, internal). | 4 Sep 2026 |

---

## 2. Navigation — APPROVED 4 Sep 2026

Rationale: "Foundations" mixed setup, identity, people and market into one group. Split to mirror how an owner thinks about the business. Signed off by Nic 4 Sep 2026 (decisions on the three open items delegated to Mars and recorded below).

| New group | Items | Notes |
|---|---|---|
| *(Setup — out of nav)* | Plan Settings | First-login wizard + gear icon. Configuration, not content. |
| **Dashboard** | Dashboard | See §3. |
| **Strategy & Direction** | **Vision & Purpose** (was "Framework" — renamed 4 Sep 2026: Vision, Mission, Purpose, Brand Promise, AI Direction, Field of Play) | "Who we are and where we're going." Primary qualitative input to the AI layer alongside Goals/SWOT. **"Outcomes" removed as a menu item 4 Sep 2026** — its six statements become the annual level of Goals (see Goals row and §6.7). |
| **Assets** | Outlets, Social Media, Membership, Intellectual Property, Capital Equipment | Registers — "what we own." **Descriptive only; does not touch the financials.** Assets enter the numbers via Historic (opening balances) and Funding (capital loans / purchases). |
| **People** | Key People (List, Salaries, Productivity, Duties, Qualities, Education, Focus) | Renamed from "Key People" to leave room for org structure / hiring plans. |
| **Market** | Marketing (7 tabs), Competitors | Competitors moves in beside Market Research. |
| **Goals** | SWOT, Goals | **SWOT sits here (decided).** SWOT is early in the Guided path (step 4); **Goals moves late (step 11, after the forecast review)** so targets are set with the numbers in hand. Goals is **two-level**: one annual goal per area (Financial, Management, Marketing, Sales, Operational, AI — the former "Outcomes") with quarterly goals beneath. AI drafts the annual goals from the forecast + SWOT; the owner edits. See §6.7. |
| **Financials** | Sales, COGS, Overheads, Funding, Extraordinary, Historic, **What-If Planner** (renamed 7 Key Drivers — §4); Plan Check-in (§6) added in phase 2 | |
| **Forecasts** | Break-Even, Profit & Loss, Balance Sheet, Cash Flow, Unit Economics | |
| **Strategy (AI)** | TBD — §5 | |
| **Reports** | Business Plan editor + audience templates | Top-level. **Validated in mockup v9.** Four audience templates with generic names — *Bank or lender*, *Government loan application*, *Self-Employment Assistance*, *Investor pack* — with **no country in the name and no format picker on the tile** (rejected 4 Sep 2026 — doesn't scale to 82 countries). The template reads *Main Country of Operation* from Plan Settings and applies the matching country/program format where one exists (US → SBA outline, AU → SEA layout), otherwise the generic outline. Country formats are a content library maintained behind the scenes, added per market as the product expands. Section list on the left shows what's in/out per template and jumps to sections; document preview scrolls continuously; every figure is a merge field. Merge-field engine carried forward from APeX. Unit Economics section appears in the Investor pack only. |

Constraint: menu is already ~25 items. Groups must be collapsible; Setup leaves the nav.

---

## 3. Dashboard — REQUIREMENT (layout validated in mockup v2, 4 Sep 2026 — passes the ten-second test)

**Principle.** Every panel must answer one of three questions within ten seconds: *Are we on plan? What needs my attention? What should I do next?* Anything that doesn't is a report and lives elsewhere (Historic, Forecasts).

**Not carried forward:** the 16-ratio wall (Big Picture / Liquidity / Leverage / Efficiency), the 4-period Financial Summary table, Strategic Initiatives list. Ratios remain available on Historic and Forecast pages.

### 3.1 Panels

| # | Panel | Content | Data source | Phase |
|---|---|---|---|---|
| 1 | **Plan Health** | 4–5 headline numbers only: Revenue, Gross Margin %, Net Profit, Cash Balance, Debtor Days. Each shows Plan figure; when actuals exist, Actual vs Plan with variance ($ and %) and a trend arrow. Before actuals: Plan vs prior year and YTD position on the forecast. | Forecast engine (P&L, Balance Sheet); Actuals (§6) | P1 (plan-only) → P2 (actuals) |
| 2 | **Cash Runway** | Months of cash at current burn; projected cash low point (month + value) over next 12 months; alert state if low point < 0 or runway < 3 months. | Cash Flow forecast (monthly); Actuals cash balance when available | P1 |
| 3 | **Plan Completeness** | % complete overall plus per-section progress (e.g. "Marketing 3/7 tabs", "Historic missing Period 4"). Click-through to the incomplete page. | Presence/emptiness of records per module | P1 |
| 4 | **This Quarter's Goals** | Goals where Year/Quarter = current; status (Not started / In progress / Done / At risk); milestone dates. | Goals module (**add a *status* field** — decided) | P1 |
| 5 | **AI Insights** | 3–4 generated observations ranked by materiality, each with the driver and a link to the relevant page. Pre-actuals: pattern observations on the plan/historic data. Post-actuals: variance explanations ("Revenue 12% behind plan in Q2, mostly Retaining Walls"). | AI layer (§5) reading Forecast, Historic, Actuals, Goals, SWOT | P1 (plan-based) → P2 (variance-based) |
| 6 | **Next Action** | Single primary CTA, rule-driven: complete the lowest-completion section → run the monthly actuals upload if overdue → review goals at quarter end → otherwise open Scenario Modeller. | Completeness + Actuals cadence + calendar | P1 |

### 3.2 Behaviour
- Default landing page after login (once Setup wizard is complete).
- Period selector: current month / quarter / YTD / full year. Defaults to current month once actuals exist, otherwise full Year 1.
- Every number links to the page it came from. No dead metrics.
- Empty states are designed, not blank: a new plan shows Completeness and Next Action prominently, Plan Health greyed with "add Sales & Overheads to see your plan."
- Loads from cached forecast output; no recalculation on dashboard load.

### 3.3 Explicitly excluded from dashboard
Interest Coverage, Operating Cash Flow Ratio, Cash Ratio, A/R Turnover, Return on Assets, Debt-to-Equity — analyst ratios; keep on Historic/Forecast pages with Help text.

---

## 4. What-If Planner (was "7 Key Drivers") — REQUIREMENT (design validated in mockup v7, 4 Sep 2026)

**What the human gets out of it:** two answers — *will I make a profit* and *will I run out of cash* — and the levers that change them. Everything else is mechanism and stays out of the way.

**Layout (validated)**
- Two outcome tiles at the top, always visible: **Year 1 operating profit** and **Lowest cash in Year 1 (month named)**. Each shows: Now → With these changes → the difference, a one-line breakdown of which levers produced it, a *Target* box, and a **Suggest** button.
- **Suggest** solves for the smallest, most realistic lever set that reaches the target and explains its reasoning in plain words ("price first, because it costs nothing to try"; "debtor days 42 → 33, no price or cost change needed"). This is the AI/solver entry point for novices and the coach's five-minute conversation.
- Third tile: the two exits (§4 below) plus reality-check warnings.
- Levers in two groups, side by side, all seven on one screen without scrolling: **Profit levers** (Price, Volume, Cost of goods, Overheads — "also move cash") and **Cash levers** (Debtor days, Stock days, Creditor days — "move cash, not profit"). One-line plain-English note under the cash levers explaining what "days" means.
- Every lever translates into the owner's own units beneath the slider (dollars on an average driveway / house slab, jobs per month, dollars a month on overheads, days sooner and dollars back in the bank). Percentages are secondary.
- Reality checks fire inline: volume beyond crew capacity, debtor days below what the customer type pays, price rises above ~5%.
- When growth raises receivables, the cash tile attributes it honestly as "growth ties up cash" — never to a days lever the user didn't touch.
- Guided mode: the above. Advanced mode adds the Baseline / Adjusted / Variance table underneath.

**Exits (validated)**
- **Make this the plan** — confirmation listing exactly which records change (Sales prices, Overhead lines, Settings days), before/after profit, and saves a plan version first.
- **Turn into goals** — one goal per lever with quarter and owner; lands on the Dashboard's quarterly-goals panel and in Goals.

**Carried forward unchanged from APeX:** the seven-driver engine, per-product / per-item scoping, Annual / Quarterly Average, Save / Load scenario, Client Report.

**Rejected in the mockup process (don't revisit):** goal tiles as a separate row; a stacked "goal bar" showing lever contributions; a free "your own scenario" mode; a single seven-lever list; a separate result panel to the right. All three made the client and coach do the mental arithmetic the screen should do.

- **Name: What-If Planner** (decided 4 Sep 2026). Plain language, describes the action, no UK/US spelling split. Rejected: *Scenario Modeller*, *Cash Levers*, *7 Key Drivers*.

---

## 5. AI Strategy Layer — PLACEHOLDER (to be specified)

Replaces the five static strategy libraries. Direction agreed:
- Recommendations are **generated from the client's own plan** — Forecast, Historic, Actuals variances, Goals, SWOT, Framework — not selected from a fixed list.
- Surfaces in two places: the Dashboard *AI Insights* panel (§3.1 #5) and a dedicated *Strategy* section where recommendations can be accepted into actions/goals and tracked.
- Accepted recommendations become trackable items (owner, due date, status) — this replaces the old To-Do/KPI linkage.
- Needs: prompt/grounding design, guardrails (never invent numbers; cite the source figure), cost model per plan, and a human-review step before anything is added to the client's plan.
- **Provider: OpenRouter** (see §7.3) — model per task, server-side only, usage metered per plan.
- **AI credits (later, not v1):** advisors buy AI credits; each new client plan may come with an initial credit allowance. v1 only needs the metering in place — every AI call logged against a plan with its token cost — so credits can be switched on without re-plumbing. Decided 4 Sep 2026.

---

## 6. Plan Check-in (Actuals vs Plan) — PHASE 2 (design the data model now, build later)

**Framing.** This is *not* financial tracking. It is the mechanism that makes the plan sticky: a light, periodic "how are we going against the plan?" touchpoint that pulls the client back in and re-uses the plan they already built. Keep it to headline lines, keep it optional, and let the AI do the interpretation. If it starts to feel like bookkeeping, it has gone too far.

**Cadence.** Monthly by default (quarterly acceptable). Reminder-driven — the app asks; the client (or their advisor / accountant) answers in minutes.

**Data model (Phase 1, day one):** the plan already has monthly projections; add a parallel *actual* value keyed to (line, year, month) for a **short list of headline lines only** — Revenue (total or by product), Total COGS, Total Overheads, Net Profit, Cash Balance, Debtors, Creditors, Inventory. Not every expense line. Variance = Actual − Plan, computed not stored. Advanced mode may expose more lines later if demand exists.

| Phase | Input method | Notes |
|---|---|---|
| **P1** | Simple form (8–10 numbers) **or** upload of a short template mirroring the Historic Input Form headline lines | Novice types eight numbers; advisor uploads a file. Reuse existing "Upload Excel" parser. Re-entry replaces the month. |
| **P2** | Mapping layer for accounting-package exports (Xero, MYOB, QuickBooks P&L / Balance Sheet exports) | User maps their chart of accounts to plan lines once; mapping saved per client. |
| **P3** | Direct API integration (Xero, QuickBooks Online) with scheduled monthly sync | The SaaS moat. Requires OAuth, account mapping UI from P2, and reconciliation of plan lines to ledger accounts. |

Downstream once check-ins exist: Dashboard Plan Health flips to Actual vs Plan; AI Insights become variance-driven ("you're behind plan on revenue — here's what to look at"); Reports can include a Plan vs Actual page for the advisor/client meeting. A rolling "Actual + Forecast" view is **advanced mode only**, if at all.

---

## 6.5 Forecast Review step — validated (mockup v8, 4 Sep 2026)

- Guided step 11 shows the five-year P&L summary with Historic alongside Year 1–5, a revenue/net-profit chart, and **"Three things to check"** — plain-language prompts generated from the numbers (e.g. "Year 1 profit relies on a one-off $129,135 item — is it real and is it cash?"). Two exits: *Looks right — continue* and *Something's off — open What-If*.
- Statement switching is a **flat button group** (Full P&L · Balance Sheet · Cash Flow) — keep this pattern for switching between related views everywhere; no dropdowns for 2–5 choices.
- Break-Even is not on the Guided review step; it stays a Forecast page in Advanced and can be added to the review later.
- **Unit Economics** (contribution margin per unit, CAC, LTV, payback) is kept in the engine as APeX has it, but surfaces only in the **Investor pack** report template and in **Advanced** mode. Never a Guided step, never on the dashboard. Investors expect it; banks, grant bodies and most owners don't. *Decided 4 Sep 2026.*

## 6.7 Goals — two-level, AI-drafted (replaces "Outcomes"; decided 4 Sep 2026)

**Why.** APeX collected "12-month outcomes" for six areas on one page of blank text boxes, then collected Goals separately with a Category field covering the same areas — the same question asked twice, in consultant language, before the numbers existed. Distributing the outcomes into their areas was considered and rejected (Operational/Management have no home; targets can't be set before the forecast; the coach loses the six-together view). Renaming was rejected (same box, new label).

**Structure**
- **Annual goal** — exactly one per area: Financial, Management, Marketing, Sales, Operational, AI. One or two sentences each. These head the corresponding sections of the Report (as the old Outcomes did).
- **Quarterly goals** — any number under each annual goal, with Quarter, Owner, Status (Not started / In progress / Done / At risk) and milestone date. These feed the Dashboard's *This quarter's goals* panel and receive the output of What-If → *Turn into goals*.

**Guided path position** — step 11, after the forecast review and before the Report. By then Vision & Purpose, SWOT, Historic, Sales, COGS, Overheads, Funding and the forecast all exist.

**AI drafting** — on entering the step, the AI proposes all six annual goals from the plan's own data: forecast figures ("Sales: grow revenue to $2.12M, led by house slabs and mining works"), SWOT items, Vision & Purpose, and the historic trend. Every proposed number must trace to a plan figure; the owner edits or replaces; the coach challenges. Nothing is saved until the owner accepts. This is the first concrete piece of the AI Strategy layer (§5).

**Result** — one fewer menu item, no duplicated question, targets set after the numbers, and a structure (annual objective → quarterly goals with owners) that reads as enterprise practice rather than coaching vocabulary.

## 6.6 Visual direction — confirmed

Flat, enterprise feel (NetSuite-inspired): slate nav, one blue accent, Open Sans, no gradients or heavy shadows, semantic colours only for state. Nic: "feels more professional, more like an enterprise app." Keep it.

---

## 7. Platform requirements (from the inventory review)

- Multi-tenant: Organisation → Cohort (optional) → Plan(s) → Users with roles (Owner, Advisor, Viewer). Client and advisor both log in. Current build is single-client.
- Plan versioning / snapshots (annual re-plan without losing last year).
- Advisor workspace: one advisor/firm, many client plans; advisor can work inside a client's plan; client sees advisor branding on reports (Nic's own use case and the coach/consultant/accountant channel).
- Two interface modes on the same engine: **Guided** (default — plain language, one question at a time, sensible defaults for every assumption) and **Advanced** (full assumption grid, as per current Plan Settings). Mode is per-user, switchable anytime, and never changes the numbers — only what is exposed.
- Industry starter templates (chart of products/COGS/overheads pre-filled) to get a novice to a first forecast fast.
- Remove ABoS/ActionCOACH-specific naming throughout (Scorecard, L.I.O.N.S, Frogs, 6 Ways / 4 Ways).

---


### 7.1 Advisor Workspace — context captured, design LATER

Source: screenshot of the legacy planning system APeX was derived from (ActionCOACH coach's "My Clients" view). Recorded so the model is right from day one; the screens themselves are a later work package.

**What the legacy advisor view had (keep the concepts, not the UI)**
- Client list (search / Show All) with a detail pane: business name, address, contact person, email.
- **Access Details**: a client ID + access code, with an *Activate & Email It* button — i.e. the coach creates the business, then invites the owner, who gets their own login. Confirms the two-login model.
- **View Plan** — coach opens the client's plan directly.
- **Client's Plan Type** dropdown (e.g. "Business PlanPlus") — plan tiers existed per client.
- **"Your client can print their own reports" Y/N** — per-client permission controlling whether the owner can self-serve the Report or must go through the coach. Worth keeping: it's a lever coaches use to stay in the loop (and to bill).
- **Business Plan Credits Remaining: 109** + *Add New Business* — advisor pricing was **credit-based, one credit per client plan**. A proven model with this audience; strong candidate for the advisor tier.
- Left nav: My Clients, My Details, Diag Setup, Admin.

**What it lacked — and the new advisor workspace must have**
- A dashboard: number of plans, active vs dormant, plans completed this month, credits used / remaining, revenue attributable to plans, per-client status (not started / in progress / complete / report issued), last activity date, upcoming workshop cohorts.
- Filtering by status, cohort, plan type; sort by last activity.
- Cohort (workshop) grouping — see §8.
- A simpler advisor UI. The legacy view was one dense screen; the new one should be list → client card → plan, with the dashboard as the landing page.

**Role model this confirms:** Advisor and Owner are separate logins with separate views. Advisor sees many plans and a practice dashboard; Owner sees one plan and the plan dashboard (§3). Same engine, same data, two front doors.

---

## 7.2 Funding — Guided pattern (validated form design, mockup v7)

- All five funding types carried forward from APeX: **Owner Funding, Debt, Equity Investment, Grants, Revenue-Linked**. Fields per type as in the inventory. The Debt form (lender, type, amount, rate, term, repayment type, frequency, first drawdown, residual) tested well with the "worked out for you" line showing repayment, Year 1 interest and closing balance — keep that pattern on every funding form.
- **Guided mode** opens with one question — *"Where is the money coming from?"* — and five plain-language cards: *My own money*, *A loan*, *An investor*, *A grant*, *Revenue-based finance*, each with a one-line description. Only ticked types become sub-steps. Nobody sees a form they didn't ask for.
- **Advanced mode** keeps the five tabs as they are in APeX.
- Loan type list (Term loan, Equipment finance, Vehicle finance, Overdraft / line of credit, Director loan) is the v1 set; equipment and vehicle finance land in Fixed Assets automatically.

---

## 7.3 Build & deployment pipeline (Nic, 4 Sep 2026)

- **Local git repo** in the project folder on Nic's Mac — every change committed locally first.
- **GitHub** as the remote (Nic's account — github.com/dashboard). Main branch protected; feature branches → pull request → merge.
- **Vercel** hosting under Nic's Vercel team (vercel.com/nics-projects-a506f87b), connected to the GitHub repo: every PR gets a preview deployment, main deploys to production. Same pattern as the existing APeX deployment (abos-26-may-2026.vercel.app).
- **AI provider: OpenRouter** (Nic has an account). One API, many models — lets us pick a strong model for drafting (goals, insights, Suggest explanations) and a cheap one for small tasks (field hints, validation messages) without changing code; also avoids lock-in to a single vendor. Key lives in Vercel env vars as `OPENROUTER_API_KEY`; all calls go through one server-side helper so model choice, cost logging and per-plan usage caps sit in one place. Never called from the browser.
- Environment variables (database, auth, AI keys) live in Vercel project settings and a local `.env.local` that is git-ignored — never committed.
- Stack to be confirmed before build starts, but the Vercel + GitHub choice points to Next.js (as APeX) with a hosted Postgres (Vercel Postgres / Neon / Supabase) for multi-tenant data.

---

## 8. Workshop Mode — REQUIREMENT (v1)

The two-day, 4–10 business, coach-facilitated workshop is a core v1 use case and drives the permissions model.

- **Both the coach and each client log in.** The coach owns a *cohort*; each business owns its own plan inside it. The client keeps their plan (and login) after the workshop; the coach keeps visibility for the mentoring period.
- **Coach cohort view:** all plans in the room on one screen — completion % per section per business, who is stuck, who is finished. Lets the coach spend time on direction rather than data entry.
- **Guided path is the workshop path.** The 12 steps: 1 Vision & Purpose → 2 Key People → 3 Marketing → 4 SWOT → 5 Historic → 6 Sales → 7 COGS → 8 Overheads → 9 Funding → 10 Review forecast → 11 Goals (AI-drafted) → 12 Report. Each step must be completable by a novice in the time a facilitator would allow (target: no single step > 20 min unaided).
- **Coach can step into any plan** to demonstrate or correct, with an audit trail of who changed what.
- **Facilitator content hooks:** each step has a short "what good looks like" prompt the coach can present (and the AI can echo for solo users).
- **End of day two:** every business generates a Report. That is the success metric of the workshop and of the product.

Permissions model that falls out of this: Organisation (coach / firm / consultant) → Cohort (optional) → Plan → Users with roles *Owner*, *Advisor*, *Viewer*. A solo owner is simply an Organisation of one with no advisor.

---

## Open decisions

*None outstanding as of 4 Sep 2026. Next: AI Strategy Layer specification (§5) and Guided-mode step design (§8).*

### Closed
9. **Nothing important below the fold (from mockup v8):** on every Guided step the Back / Save footer is sticky at the bottom of the pane, and any choice that shapes the step (e.g. which funding types apply) sits at the top, before the form — never as a strip after it. Nic missed the "other funding" chips entirely when they were at the bottom.
8. **List/table UX rule (from mockup v3):** the "Add" control sits at the top of every list, new rows insert at the top with focus in the first field, and tables scroll inside their own box with header and totals pinned. Never put the add button below a list that can grow. Price/units entry confirmed simple enough for novices.
7. ~~"Framework" naming~~ **Closed: renamed Vision & Purpose.** Consultant language replaced with what the page holds. Mockup finding: with six fields stacked, a novice sees only the first and assumes the step is done — every multi-field Guided step needs a visible "n of n" strip at the top.
1. ~~Reports — retain?~~ **Closed 4 Sep 2026: retained, promoted, templated by audience.**
2. ~~Navigation regrouping~~ **Closed: approved as drafted.**
3. ~~Scenario Modeller name~~ **Closed: What-If Planner.**
4. ~~SWOT placement~~ **Closed: Goals group, ordered SWOT → Goals.**
5. ~~Goals status field~~ **Closed: add it** (Not started / In progress / Done / At risk).
6. ~~Capital Equipment → forecast?~~ **Closed 4 Sep 2026: stays descriptive.** Financial effect of assets flows Historic → Funding only. No standalone depreciation module — this is a planning app, not a tracking app.
