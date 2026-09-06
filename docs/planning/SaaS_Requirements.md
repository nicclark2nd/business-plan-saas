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
| **Plan** (last group, bottom of the left menu) | Plan settings — Business profile · Financial year & tax · Branding | **Changed 6 Sep 2026.** Was "gear icon, out of nav"; never built, and business name / industry / country / legal structure / customer & product type had no screen at all. Findability wins: settings sit at the bottom of the left menu like every accounting product. See §6.12. |
| **Dashboard** | Dashboard | See §3. |
| **Strategy & Direction** | **Vision & Purpose** (was "Framework" — renamed 4 Sep 2026: Vision, Mission, Purpose, Brand Promise, AI Direction, Field of Play) | "Who we are and where we're going." Primary qualitative input to the AI layer alongside Goals/SWOT. **"Outcomes" removed as a menu item 4 Sep 2026** — its six statements become the annual level of Goals (see Goals row and §6.7). |
| **Assets** | Outlets, Social Media, Membership, Intellectual Property, Capital Equipment | Registers — "what we own." **Descriptive only; does not touch the financials.** Assets enter the numbers via Historic (opening balances) and Funding (capital loans / purchases). |
| **People** | Leadership Team (People, Salaries, Roles & Capability, Risk & Succession — §6.11) | Renamed from "Key People" 5 Sep 2026 (via "Management Team"): a subset, never the whole payroll; "Leadership" reads right to a CEO as well as a tradie. Report headings stay audience-driven — "Management Team" in investor and SBA output, "Key Personnel" where a government template demands it. Room for *Advisors* later. |
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

## 7.3 Build & deployment pipeline (Nic, 4 Sep 2026) — LIVE

**Status 4 Sep 2026:** repo `github.com/nicclark2nd/business-plan-saas` (local copy `Biz_Plan_New/app`), Vercel project `business-plan-saas` deploying green from `main` at **business-plan-saas-beta.vercel.app**. Dev server on port 3100. Same first-build failure was a transient Vercel-side issue — the redeploy of the identical commit succeeded.

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
- **Guided path is the workshop path.** The 13 steps (Competitors added 6 Sep 2026): 1 Vision & Purpose → 2 Leadership Team → 3 Marketing → 4 Competitors → 5 SWOT → 6 Historic → 7 Sales → 8 COGS → 9 Overheads → 10 Funding → 11 Review forecast → 12 Goals (AI-drafted) → 13 Report. Each step must be completable by a novice in the time a facilitator would allow (target: no single step > 20 min unaided).
- **Coach can step into any plan** to demonstrate or correct, with an audit trail of who changed what.
- **Facilitator content hooks:** each step has a short "what good looks like" prompt the coach can present (and the AI can echo for solo users).
- **End of day two:** every business generates a Report. That is the success metric of the workshop and of the product.

Permissions model that falls out of this: Organisation (coach / firm / consultant) → Cohort (optional) → Plan → Users with roles *Owner*, *Advisor*, *Viewer*. A solo owner is simply an Organisation of one with no advisor.

---

## Open decisions

*None outstanding as of 4 Sep 2026. Next: AI Strategy Layer specification (§5) and Guided-mode step design (§8).*

### Closed
9. **Nothing important below the fold (from mockup v8):** on every Guided step the Back / Save footer is sticky at the bottom of the pane, and any choice that shapes the step (e.g. which funding types apply) sits at the top, before the form — never as a strip after it. Nic missed the "other funding" chips entirely when they were at the bottom.
8. **List/table UX rule (from mockup v3, extended 6 Sep 2026):** the "Add" control sits at the top of every list, new rows insert at the top with focus in the first field, and tables scroll inside their own box with header and totals pinned. Never put the add button below a list that can grow. **An empty grid starts with one blank row ready to type in** — no "nothing here yet" message, no hunting for a button; the row only saves once its first column is filled (Nic: an empty grid with a sentence in the middle "seems unfinished"). Price/units entry confirmed simple enough for novices.
7. ~~"Framework" naming~~ **Closed: renamed Vision & Purpose.** Consultant language replaced with what the page holds. Mockup finding: with six fields stacked, a novice sees only the first and assumes the step is done — every multi-field Guided step needs a visible "n of n" strip at the top.
1. ~~Reports — retain?~~ **Closed 4 Sep 2026: retained, promoted, templated by audience.**
2. ~~Navigation regrouping~~ **Closed: approved as drafted.**
3. ~~Scenario Modeller name~~ **Closed: What-If Planner.**
4. ~~SWOT placement~~ **Closed: Goals group, ordered SWOT → Goals.**
5. ~~Goals status field~~ **Closed: add it** (Not started / In progress / Done / At risk).
6. ~~Capital Equipment → forecast?~~ **Closed 4 Sep 2026: stays descriptive.** Financial effect of assets flows Historic → Funding only. No standalone depreciation module — this is a planning app, not a tracking app.

## 6.8 Component library — RULE (4 Sep 2026)

All UI is built from **shadcn/ui** components in `src/components/ui` (Button, Input, Label, Select, Card, Badge, Textarea, RadioGroup, Separator, …), themed once in `src/app/globals.css` with the NetSuite-style palette. No hand-rolled button/input/card classes anywhere; no literal colours in components — only theme tokens (`primary`, `muted-foreground`, `good`/`warn`/`bad`, `sidebar-*`). Add a component with `npx shadcn@latest add <name>`; change a colour in one place. Nic: "components come from a library, not produced each time."

## 6.9 Form field rules (4 Sep 2026)

- **No `type="number"` inputs anywhere.** Numeric fields are text inputs with `inputMode="numeric"` / `"decimal"`, right-aligned, tabular figures. No spinner arrows. (Nic: spinners are annoying; they also make fat-finger edits easy.)
- **Password managers are told to ignore every field** except sign-in/sign-up (autoComplete off + the ignore attributes for Keeper, 1Password, LastPass, Bitwarden). Set once in the Input and Textarea components.
- Plain text fields are plain text fields — no dropdown unless the values are a fixed list.
- **Grid cells (added 6 Sep 2026, Marketing review).** Short things — names, titles, amounts, dates, choices — are one-line cells. Anything that is a sentence — an approach, a strength, a finding, a note — is a *growing cell*: two lines tall from the start so it reads as a place to write, fixed column width, grows downward as you type. Columns never widen to fit content (`table-layout: fixed`); a row gets taller, the row beside it never moves. One rule, every grid — Nic: "an entirely different UI/UX for the user" between two areas is not acceptable.

## 6.10 Save policy for editable lists (5 Sep 2026)

Typing never hits the server. A row (or detail panel) saves **once, when focus leaves it**; dropdown choices save on selection; *Save and continue* flushes anything still dirty. Status per row: Editing → Saving… → Saved / Error. This keeps traffic to one request per edit session per row, so a plan with 200 people or 300 overhead lines costs the same per edit as one with three. (Nic, People step.)

## 6.11 Leadership Team (formerly Key People) — four areas, and the module-bar pattern (5 Sep 2026)

Validated in mockup `docs/mockup/record-pattern.html` (artifact v5.1). Supersedes the People master–detail build.

**Layout pattern (applies to every module, not just People).** A *module bar* sits directly under the top bar, spanning the work area, in the same place on every screen. Its items belong to whatever is selected in the left nav and each item is a **data area** — a dense, editable grid — not a form or a tab hidden inside the data. A *scope chip* on the right of the bar shows "All people" or one person; clicking a name anywhere sets the scope and every area filters to that person (counts on the bar follow). There is no separate record page. Page title strip (Help toggle, + New) sits under the bar; the pinned footer stays.

**The four areas of Leadership Team** (left menu: PEOPLE → Leadership Team; page subtitle carries "not the whole payroll")
1. **People** — First name, Last name, Position (free-text job title), Role (Owner / Director / Employee / Contractor — the legal relationship; decides which report table the person appears in), Share %, **Started** (month-year), Tenure (calculated). Footer totals shareholding. A future Started date shows "Joins Y*n*" and *derives* the salary start year — there is no separate "starts in" field. Planned hires are simply people with a future Started date.
2. **Salaries** — two rows per person: *Adjust %* (five inputs, compounding, negative = cut) over *Salary* (calculated); Base on the left; "Total → Overheads" footer. Years before a future Started date show "—". Contractors have no salary row.
3. **Roles & Capability** — one list per person with a Type column: Responsibility, Skill, Strength, Expertise, Licence & certification, Education, Development area. Replaces the Duties / Qualities / Education tables. Institution and year live in the description. **Development areas are internal** (hatched, never printed in an external report). Reports write the management-team bio from this list.
4. **Risk & Succession (phase 2, after forecast is live)** — per person: Dependency (Low / Medium / High), Successor (another person / external hire / none identified), Key-person cover (None / Quoted / Insured [+ amount]), Notes (multi-line, grows). Feeds the key-person risk section of funding, SBA and sale reports.

**Removed from Leadership Team.** *12-Month Focus* moves to Goals (§6.7): every goal has an owner from the Leadership Team. *Productivity* (six-level scale) is dropped from the product — it is a coaching construct, not plan content; if coaches want it later it belongs in the advisor workspace (§7.1) as a coach-private note.

**Financial treatment — the double-count rule.** Overheads shows **"Leadership team salaries — from Leadership Team"** as a locked, calculated line and **"Other wages"** as a separate input beside it. On-costs (superannuation, pension, payroll tax) are **one % rate applied in Overheads to both lines**, never per person. Role = Contractor: identity in People only; costed in COGS or Overheads like any other contract cost.

**Report detail by template.** Government / SBA: full key-person salary schedule. Bank / investor: remuneration when material. Business sale: summarised management cost, detail reserved for due diligence. Internal growth plan: full schedule.

### 6.11.1 Data-screen rules (6 Sep 2026, after reviewing the Codex concept)

Reviewed an alternative concept (read-only grid + edit drawer, summary tiles under the data, popover help, card-and-whitespace styling). Decision: **our structure stands** — inline editing with save-on-leave, module bar, help rail, dense flat grids. Four things adopted from the review:

1. **One line above a grid, no more.** Anything longer than a sentence of guidance lives in the Help rail, never in the toolbar or under the table. Data screens explain themselves through the data.
2. **Missing-data cue per row.** A small amber dot on a person whose position, start date or salary (non-contractors) is blank, with the missing fields in the tooltip. This is the same signal the coach cohort view (§8) will roll up.
3. **Plan status and currency in the top bar** ("● Working draft · AUD"), next to the mode toggle. Factual, always visible, costs nothing.
4. **Help rail: open on first visit to a step, then remembers the user's choice per step.** Advanced mode still defaults off.

Rejected, with reasons: edit-in-a-drawer (two clicks per change, covers the data being compared, and it destroys the Excel-style Salaries schedule); summary tiles and charts under a data grid (that is the Dashboard's job; on a data screen it pushes the data up and reads as a landing page); a persistent right-hand "person overview" panel (the scope chip does this with less chrome); rounded-card, 16px, whitespace-heavy styling (reads as a website — §6.6 flat enterprise stands); native month picker for Started (calendar glyph in a cell; free text with the month parser stays).


## 6.12 Plan settings (6 Sep 2026)

APeX put 62 inputs on one Plan Settings page. Split by what the field *is*:

- **Business profile** (Plan settings → first area): business name, industry, date established, main country of operation, legal structure, type of customer, type of product sold, products & services statement. One place — the client who needs to change "who we are" goes to settings. The dashboard shows a nudge with a link while the fields a report's business overview needs (name, industry, country, legal structure, statement) are blank; the area's count on the module bar shows the same number. Type of customer / product only change the words the app uses ("clients" vs "customers") — kept because that wording is what makes a physio or a law firm feel the product fits them.
- **Financial year & tax**: financial year end month, first projected year (blank = plan year), currency, company tax rate %, dividend %. The toolbar states in words which twelve months Year 1 covers. *Months projecting* dropped: the plan is five years; monthly detail is a later Advanced concern, never a workshop question.
- **Branding**: logo, for the report cover and headers. Built with the Reports step so it lands where it is seen.
- **Not settings, deferred to where they are used:** customer acquisition cost and monthly churn → Unit Economics inputs; working-capital days, tax timing, prepaid/accrued balances, maintenance CapEx and disposals → a *Forecast assumptions* area under Review forecast, defaulted from Historic ("use historical for all years" is the default, not a button), with What-If's "Make this the plan" writing back there.

Same ModuleFrame as the steps (no step number, no progress line), same save policy (§6.10), same FieldGrid primitive as any one-record area.

## 6.13 Marketing — four areas (6 Sep 2026)

APeX had seven tabs. Reduced to four data areas on the module bar, same pattern as Leadership Team:

1. **Market** — target market, market size, market trends, customer needs, plus an optional one-line positioning. Field grid; the bar count shows how many of the four are written.
2. **Competitors** — a grid: Competitor · What they do well · Where they're weak · How we win. Replaces APeX's prose "competitive analysis" plus its separate list; the Advanced left-menu item *Competitors* deep-links here.
3. **Channels & spend** — one row per channel actually used: Type (Distribution / Advertising / Content / Sales promotion / PR / Partnerships & referrals / Retention) · Approach · Annual budget; total in the footer. Replaces Distribution + the six fixed Promotion blocks + the read-only Budget roll-up. Nic: APeX's promotion was rigid — every block had to be considered; here only the channels in use get a row. **The total feeds Overheads as a locked "Marketing — from Marketing" line** (same double-count rule as salaries, §6.11).
4. **Evidence** — Source or method · What it showed · When. Replaces the four Research essays. Kept because grant and SBA templates ask "what market research did you do" by name; a grid of real sources answers it better than prose.

Removed: **Branding** (brand purpose duplicates step 1; values/personality appear in no lender's or broker's checklist; visual identity is the logo, in Settings). **Action Plan** → Goals (marketing actions are goals with owners and dates; rows kept in `plan_marketing_actions` until Goals absorbs them). Migration 0008 carries existing distribution/promotion rows into the spend grid and research text into one evidence row.

### 6.13.1 Competitors — its own module, step 4 (6 Sep 2026)

Started as an area under Marketing; Nic: cramming facts, three written columns and the position fields under one tab looked messy. Competitors is now **its own left-menu module in both modes and step 4 of the Guided path** (SWOT → Reports shift to 5–13). Marketing is back to three areas: Market · Channels & spend · Evidence. The SBA competitive-analysis section asks for five things; the module answers all five without a matrix being typed by hand:

- **Competitors area** — one block per rival, two lines: facts on the first (Competitor · Type Direct/Indirect · Reach · Pricing vs us · Threat), the three written columns on the second at a third of the width each (What they do well · Where they're weak · How we win). Nine columns on one line squeezed the words to nothing at 1400px. The four choice columns are one click each; **the report generates the SBA comparison matrix from them**, with the plan's own business as the first column (from Business profile and "Our advantage").
- **Our position area** (three growing fields, plan-level): *Our advantage* (the USP — absorbs "Positioning" from Market), *Barriers to entry*, *What could change* (new entrants, regulation, technology — pre-fills SWOT Threats in step 4).
- **Deliberately left out:** competitor revenue vs yours, market share %, financial health. A small business rarely knows these; a guessed number in a lender's document is worse than none. If known, it goes in words under "What they do well".

Migration 0009: enums on `plan_competitors` (kind, reach, pricing, threat); `plan_marketing.positioning` → `our_advantage`, plus `barriers_to_entry`, `future_threats`.

## 6.14 SWOT — one 2×2, half-written from the plan (6 Sep 2026)

One area: Strengths · Weaknesses · Opportunities · Threats as four dense lists on one screen (2×2, stacking on narrow windows), one line per item, blank starter line in every empty quadrant, "+ Line" per quadrant. No priority columns, no implication fields, no quadrant commentary — a SWOT is a list.

**Suggestions without AI.** Each quadrant shows faint lines drawn from what the plan already says, in the owner's own words, each with a *Use* link and its source: Strengths ← Our advantage, Barriers to entry, each competitor's "How we win"; Weaknesses ← team Development areas, any High-dependency person with no successor, a one-person leadership team; Opportunities ← each competitor's weaknesses, Market trends; Threats ← "What could change", competitors rated High/Critical. Nothing enters the SWOT without the click; a used suggestion (matched on a stable `source` key, migration 0010) is not offered again; an accepted line is tagged *plan*. The AI layer (§5) can add its own suggestions later on top of these, but the plan-derived ones cost nothing and are always true.

## 6.15 Historic — two entry paths, one record (6 Sep 2026)

Corrected after reading APeX's `excelImport.ts` / `financialCalculations.ts` and the DesignOne loading file: APeX does **not** make users type subtotals, and its upload template works *totals-first*. Both carried across.

- **Grid (components path):** Profit & loss and Balance sheet areas, lines down, up to four periods across, **Period 1 = newest year = the opening position**. The user types the plain lines (revenue, COGS, overheads, D&A, extraordinary, interest, tax, dividends; cash, debtors, stock, other CA, fixed, other NCA, creditors, bank loans current / non-current, other CL, other NCL). Bold lines calculate: gross margin, operating profit, NPBT, net profit, retained; current / non-current / total assets and liabilities; **equity = assets − liabilities**, so the sheet always balances. Saves per column when focus leaves it. Under each grid a fact row: GM % and net margin % (P&L); debtor / inventory / creditor days and current ratio (balance sheet) — Period 1's days are the forecast's working-capital defaults.
- **Import (totals path):** the APeX template unchanged — Revenue, Gross Margin, NPAT, Total Assets, Total CA, Total Liabilities, Total CL plus the lines a lender wants separately. `engine/historic/derive.ts` ports `calculateFinancials` step for step (COGS = revenue − GM; NPBT = NPAT + tax; operating profit = NPBT + interest + extraordinary; overheads = GM − operating profit − D&A; residual "other" assets and liabilities; equity). Unit-tested against DesignOne 2026: COGS 1,229,527 · overheads 819,835 · operating profit −52,362 · equity 73,325 · 46 / 2 / 6 days — the same figures APeX shows. Parsed in the browser (SheetJS), previewed, then loaded; replaces all four periods. Template downloadable from the area.
- **New business:** a toggle marks the plan as having no accounts yet; the step counts complete and the opening position comes from Funding. Migration 0011 (`plan_settings.has_history`).
- Dropped: APeX's Charts tab (trend lives on the dashboard and in reports); "Calculate Results" button (everything calculates as you type).

## 6.16 Sales — list → record (6 Sep 2026, fourth cut; this one stands)

APeX: Products · Annual Projections · Monthly Projections · Charts, with edit dialogs. Three grid cuts in one day failed the brief (Nic: "there is no real indication anything is a field … even an accounting firm partner would have no idea what to do"). What stands is the pattern from Nic's own planning system of seven years earlier: **one product at a time, showing the working.**

**List** — the only tab, *Products*: one line per product — Product · Lifecycle · Sells for · Units · This year (Year 1 for a start-up) · Year 5 · "Not set up yet" when price or units are missing · ×. Footer totals; toolbar reconciles this year against **Historic Period 1 revenue** (grey within 10 %, amber beyond). Amber dot for a product with no description. Scales to fifty lines because it is only an index.

**Record** — click a name or *+ Product* and the page is that product, real boxed fields with labels (FieldGrid, as Plan settings), top to bottom:
1. *About this line* — What it is · Why they buy it, margin, weaknesses · Lifecycle.
2. *What it sells for* — Sells for · Units sold this year (or "in Year N") · Starts selling · "= sales this year".
3. *Change each year* — Price change % and Units change % for Years 1–5, empty = 0 %, negative allowed, % sign inside the box; years before the start year read "—" / "starts".
4. *What that gives* — Sells for × Units = Sales for Years 1–5, read-only, the working a lender does in their head.
5. *Seasonality* — a Pattern select (Even / Moderate / Ramp-up / Custom); the twelve boxes appear only for Custom; a line starting after Year 1 says so instead.
Prev / Next walk the list; the chip × or *All products* returns to it. An abandoned new record (no name) vanishes. Text saves when focus leaves its section; choices save on selection.

**Start-ups** (`plan_settings.has_history = false`): nothing is "now" — Starts offers Year 1–5 only and defaults to Year 1; labels read "Year 1" where they would read "this year"; no Historic reconciliation.

Engine `engine/sales/projection.ts`: `start_selling_year` 1 = now, 2–6 = Year 1–5; the base price and units belong to the start year and growth compounds from the year after, nothing compounds through the empty years; DesignOne parity holds (House Slab 604,800 → 921,484; Carports 122,400 → 201,669); units carried unrounded, shown and multiplied at 2 dp. No all-products growth or seasonality grid — side-by-side years are Review forecast's job.

Cost per unit and cost increases stay on the COGS step (variable COGS), where the product list reappears. Migration 0012: `lifecycle`, `notes` on `plan_products`.
