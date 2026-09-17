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

> **Partly reversed 16 Sep 2026 by §6.59.** The rule below — no fields under a line — no longer describes the screen. Every written line now carries a response: what the business will do about it. The rest of this section still stands. Read §6.59 for what changed and why.

One area: Strengths · Weaknesses · Opportunities · Threats as four dense lists on one screen (2×2, stacking on narrow windows), one line per item, blank starter line in every empty quadrant, "+ Line" per quadrant. ~~No priority columns, no implication fields, no quadrant commentary — a SWOT is a list.~~ *(Reversed for the response field only; priority columns and commentary are still out.)*

**Suggestions without AI.** Each quadrant shows faint lines drawn from what the plan already says, in the owner's own words, each with a *Use* link and its source: Strengths ← Our advantage, Barriers to entry, each competitor's "How we win"; Weaknesses ← team Development areas, any High-dependency person with no successor, a one-person leadership team; Opportunities ← each competitor's weaknesses, Market trends; Threats ← "What could change", competitors rated High/Critical. Nothing enters the SWOT without the click; a used suggestion (matched on a stable `source` key, migration 0010) is not offered again; an accepted line is tagged *plan*. The AI layer (§5) can add its own suggestions later on top of these, but the plan-derived ones cost nothing and are always true.

## 6.15 Historic — two entry paths, one record (6 Sep 2026)

Corrected after reading APeX's `excelImport.ts` / `financialCalculations.ts` and the DesignOne loading file: APeX does **not** make users type subtotals, and its upload template works *totals-first*. Both carried across.

- **Grid (components path):** Profit & loss and Balance sheet areas, lines down, up to four periods across, **Period 1 = newest year = the opening position**. The user types the plain lines (revenue, COGS, overheads, D&A, extraordinary, interest, tax, dividends; cash, debtors, stock, other CA, fixed, other NCA, creditors, bank loans current / non-current, other CL, other NCL). Bold lines calculate: gross margin, operating profit, NPBT, net profit, retained; current / non-current / total assets and liabilities; **equity = assets − liabilities**, so the sheet always balances. Saves per column when focus leaves it. Under each grid a fact row: GM % and net margin % (P&L); debtor / inventory / creditor days and current ratio (balance sheet) — Period 1's days are the forecast's working-capital defaults.
- **Import (totals path):** the APeX template unchanged — Revenue, Gross Margin, NPAT, Total Assets, Total CA, Total Liabilities, Total CL plus the lines a lender wants separately. `engine/historic/derive.ts` ports `calculateFinancials` step for step (COGS = revenue − GM; NPBT = NPAT + tax; operating profit = NPBT + interest + extraordinary; overheads = GM − operating profit − D&A; residual "other" assets and liabilities; equity). Unit-tested against DesignOne 2026: COGS 1,229,527 · overheads 819,835 · operating profit −52,362 · equity 73,325 · 46 / 2 / 6 days — the same figures APeX shows. Parsed in the browser (SheetJS), previewed, then loaded; replaces all four periods. Template downloadable from the area.
- **New business:** a toggle marks the plan as having no accounts yet; the step counts complete and the opening position comes from Funding. Migration 0011 (`plan_settings.has_history`).
- Dropped: APeX's Charts tab (trend lives on the dashboard and in reports); "Calculate Results" button (everything calculates as you type).

## 6.16 Sales — APeX's shape, rebuilt (6 Sep 2026, fifth cut; this one stands)

Four grid/record cuts in one day failed the brief. Nic's call: review APeX's Products · Annual Projections · Monthly Projections and their dialogs, and rebuild to that shape. Lists never hold inputs; every edit is a dialog with Save and Cancel. **Dialogs are allowed** — the earlier "no popups" rule is withdrawn for calculations with several inputs and a visible result.

1. **Products** (list) — Product · Lifecycle · Average price · Units sold · Annual sales · ✎ · ×; footer totals; toolbar reconciles this year against **Historic Period 1 revenue** (grey within 10 %, amber beyond). Name or ✎ → **Product dialog**: Name · What it is · Why they buy it, margin, weaknesses (APeX's features / strengths / weaknesses folded into one) · Lifecycle · Average price · Units sold · Annual sales (calculated live). *+ Product* opens the same dialog empty. APeX's eye (view) and its Edit-mode toggle are dropped — one dialog does both.
2. **Annual projections** (list) — Product · Current · Year 1–5 · ✎ growth · ▦ monthly; footer "Total revenue → forecast". ✎ → **Growth dialog** (APeX "Edit Growth Rates"): Current values box · Starts selling (Now / Year 1–5) · *Change each year* — Price % and Units % for Years 1–5, empty = 0 %, negative allowed, % inside the box · *What that gives* — price × units = sales per year, updating as you type. Years before the start year read "—" / "starts".
3. **Monthly projections** (list) — Product · Jan–Dec · Total · ✎; footer Year 1 by month, the twelve months the cash flow uses. ✎ → **Monthly dialog** (APeX "Monthly Sales Distribution"): twelve % boxes with the month's sales beneath each, Total (red until 100, Save disabled), Even / Moderate rise / Ramp-up presets. A line starting after Year 1 shows one line saying so.

Charts dropped (dashboard). **Start-ups** (`has_history = false`): no "Now" — Starts offers Year 1–5, defaults to Year 1, labels read "Year 1" where they would read "this year". Engine `engine/sales/projection.ts`: `start_selling_year` 1 = now, 2–6 = Year 1–5; base price and units belong to the start year, growth compounds from the year after; DesignOne parity (House Slab 604,800 → 921,484; Carports 122,400 → 201,669); units carried unrounded, shown and multiplied at 2 dp. shadcn Dialog added (`components/ui/dialog.tsx`, flat: card background, 1px border, no rounding beyond the theme).

Cost per unit and cost increases stay on the COGS step (§6.18), where the product list reappears. Migration 0012: `lifecycle`, `notes` on `plan_products`.

## 6.17 Sales — one-off jobs and ongoing clients (6 Sep 2026)

A product is **sold as** a one-off job (invoiced when delivered) or an **ongoing client** who keeps paying — coaching, bookkeeping, legal and consulting retainers, memberships, maintenance contracts. An ongoing line earns from **active clients**, so a year is not price x units: ten clients won through a year bill 138,000 against a 240,000 run rate. It carries an opening book (`opening_clients`, 0 for a new business), month-by-month acquisition (`monthly_new_clients`), and **how long a client stays** — one field covering both a set programme and average retention, read either `as a set programme` (**the default** — a client who signs stays the term, so the months add up the way a planner counts them by hand: a licensee won each month gives 1,000 / 2,000 / 3,000) or `on average` (steady drift from the first month, for a book that genuinely churns; the opening book then needs no age, since remaining life is the same for everyone). The two readings are 25 % apart in Year 1. *Drift was the first default and was wrong: on a ten-year licence it showed 1,990 in month two, which reads as a broken number to anyone who can do the arithmetic.*. `average_price` holds the annual value of one client, entered as a monthly fee.

An ongoing line may take its clients **from another line** (`clients_from_product_id`, one level deep so nothing loops): a franchisor's royalty follows the licences sold, a service plan follows the equipment, support follows the software licence, a membership follows the joining fee. Its acquisition, timing and growth all come from the line that feeds it, and its monthly dialog is read-only.

The link is **shown from both ends** by a small drawn chain (`LinkMark`) beside the product name on every list it appears in — Sales Products, Annual projections, Monthly projections and COGS By product. On the line that follows: *"Clients come from Licence Sales — every one sold becomes a client here."* On the line that feeds: *"Feeds Royalties."* Either one is clickable and opens the other end, because an icon that only says a link exists is half an answer. Deleting a line that feeds another asks first and names the consequence rather than saying "are you sure" — a plain dialog, never `window.confirm`. With the chain carrying the meaning, the Units column shows the derived count (`0 + 12 new`) instead of repeating the source's name. Migrations 0013 and 0014; engine `engine/sales/recurring.ts` and `engine/sales/product.ts`.

**A month's share is a weight; the money is what reconciles.** 100/12 is 8.333333... recurring, so twelve *equal* shares can never sum to exactly 100 at any precision — six decimals gives 99.999996, not 100. Three earlier attempts each failed a different way: the field displayed a 2-decimal rounding (`8.33`), so a user typing back what they were shown produced a 99.996 % split that *also* displayed as 100 while a 600,000 line quietly paid out 599,976; forcing the remainder into the last month produced an odd December (8.3337) that had to be explained; and adding decimals only makes the odd month longer. What stands: shares are stored and shown to four decimals so a field never lies about what it holds; `monthlySales` divides by the shares' **actual total** and puts the final cent in December, so any split — twelve 8.33s, twelve 8.3333s, a preset — always adds to the year exactly and twelve equal shares give twelve equal months; `evenDistribution` is a plain 8.3333 twelve times; `exactHundred` still squares an uneven hand-typed split for storage but leaves equal shares alone. The dialog footer states the guarantee ("Twelve months add to 600,000") with the share total beside it, rather than a percentage that has to be believed. Five reconciliation tests cover it.

## 6.18 COGS — two lists, three dialogs (6 Sep 2026)

APeX: COGS Variable / Fixed / Combined / Monthly / Charts, with a per-product Cost Details dialog and per-item growth and monthly dialogs on the fixed tab. Rebuilt as **two** areas; nothing is typed into a list.

1. **By product** — one row per product from Sales: Product · Sold as · Cost · COGS Year 1 · Gross profit · Margin, amber dot on any line with no cost. Name or the pencil opens the **Cost dialog** (APeX's Cost Details): cost, price, gross profit each and margin across the top; *% cost rise each year* with the resulting unit cost beneath each box; *What that gives* — units (or client-months), revenue, COGS, gross profit and margin for Years 1-5. Footer totals are labelled *variable only* so the fixed costs are not read as missing.
2. **Fixed costs** — production costs that do not move with volume: name · this year · Years 1-5, with an **Item dialog** (name, cost a year, % rise each year) and a **Monthly split dialog** (twelve % boxes, Even / Moderate rise / Ramp-up, must total 100). Empty is a legitimate answer and the empty state says so.

**A cost follows how the line is sold** (§6.17): per job for a one-off line, **per client per month** for an ongoing one, where the volume is client-months and `cost_per_unit` stores the cost per client per *year*, mirroring `average_price`. A line with no direct cost — a royalty, a licence fee — sits honestly at zero and reads 100 % margin. Cost rises compound from the line start year, the same rule the price follows.

**Margin is reconciled against Historic** in the toolbar — Year 1 gross margin against Period 1, amber beyond five points ("a cost is missing or a price is optimistic"). APeX does not do this; Historic already holds the COGS to do it with.

**Dropped:** *Combined* is four numbers and becomes a footer line under both lists; *Monthly* holds no inputs at all (the fixed monthly % lives in its own dialog, variable follows the sales split) and belongs to Review forecast with the cash flow; *Charts* to the dashboard.

**Boundary:** anything that would still be there with no sales, and is not part of making the product, belongs in Overheads — said in the help rail and the Fixed costs toolbar, because Overheads already carries locked lines for Leadership Team salaries and Marketing spend and must not double-count. No migration: `plan_products.cost_per_unit` / `yearly_cost_increase` and `plan_fixed_cogs` all exist from 0003.

*Known gap:* a one-off cost of **winning** a client (a referral fee, a sales commission) has nowhere to go on an ongoing line — it folds into the monthly cost for now, and belongs with Unit Economics (CAC) when that is built.

## 6.19 Overheads — one list, two locked lines (6 Sep 2026)

APeX: an Overheads list with a per-item growth dialog and a monthly dialog, plus a separate Monthly view. Rebuilt as **one** area, *Expenses*, on the list → dialogs pattern: Expense · This year · Years 1-5, footer *Total overheads*. Nothing is typed into the list; the pencil opens the **Expense dialog** (name, cost a year, starts in, *this is wages — add on-costs to it*, % change each year with the resulting figure under each box) and the grid icon opens the **Monthly split dialog** (twelve boxes, presets, the dollar guarantee in the footer — the §6.17 weight model).

**Two lines are filled in from the modules that own them** and cannot be typed over: **Leadership Team salaries** (`source = 'people'`) and **Marketing spend** (`source = 'marketing'`), each carrying the chain (`LinkMark`) that opens its own step. They appear whether or not a row exists yet; the row is created on demand the first time a monthly split is saved, which is all a synced line owns here. `upsertOverhead` and `deleteOverhead` both guard on `source = 'entered'`, so the two can never be edited or removed from this screen — they exist as long as their source does.

**A synced figure is never grown here.** APeX takes Marketing's 5,000 as a "current value" and then applies this screen's 50 % Year 1 rise to make it 7,500 — a number the client deliberately set on the Marketing page silently becomes something else two steps later. That is the same class of error as the rounding leak (§6.17): a figure the user owns, quietly changed. All five years are locked to what the source says, and the growth boxes are gone from those lines entirely. Leadership Team already models each person's start year and rises, so its five years are real; Marketing sets one budget that holds until they change it there.

**On-costs are one percentage, set once** — superannuation, payroll tax, workers' compensation — in the toolbar (`plan_settings.on_cost_pct`), applied to every line flagged as wages and to the Leadership Team line automatically. It is stated under the total (*including 11.5 % on-costs*) and spelled out beneath the list: what it adds each year, and the wage base it was added to. The "This year" cell computes the same way as the year columns; an on-cost included in one and not the other is a footer that lies.

**A cost can start later.** `start_year` holds the first year a line exists; earlier years read 0 and the % rise compounds only from the year after it starts — except a Year 1 line, where the box marked Year 1 is a rise *on* the current figure, matching how every other module reads its first year.

**Boundary:** production costs that scale with volume are COGS (§6.18); overheads are what would still be there in a month with no sales. Said in the help rail on both sides, because the two locked lines are exactly where a double-count would hide.

Migration 0015: `overhead_source` enum with `source`, `start_year`, `on_cost` on `plan_overheads`, a unique partial index enforcing one synced row per source per plan, and `on_cost_pct` on `plan_settings`. Engine `engine/overheads/expenses.ts`.

## 6.20 Funding, and Fixed Assets — one list and a straight answer (6 Sep 2026)

APeX: five tabs — Owner Funding, Debt, Equity Investment, Grants, Revenue-Linked — each a flat list with an Add/Edit dialog, plus a Cap Table panel on Equity and an RBF Summary on Revenue-Linked, under a header reading *Total Funding Raised: $820,108*.

**The number has nothing to be measured against.** APeX adds the funding up and stops, so the screen never answers the only question a lender, an SBA reviewer or the owner actually has: does this business run out of money, and when? Funding is built as **step 10, after Sales, COGS and Overheads**, precisely so it can answer it.

**One area, `Sources`.** Every source in one list regardless of kind — Source · Type · Amount · Arrives · What it costs · Year 1 effect — because that is how a bank reads a plan, and because five tabs where four are empty is four screens of nothing for a sole trader with his own money and a bank loan. `+ Funding` opens the five plain-language cards from §7.2 (*My own money · A loan · An investor · A grant · Revenue-based finance*) and then the dialog for that kind. Cap Table and RBF Summary survive as footer lines, not panels.

**Every dialog shows its numbers back** — the "worked out for you" line validated in mockup v7. A rate and a term mean nothing to most people until they see the payment: *"3,774 a month. Year 1 costs 9,180 in interest and leaves 163,657 owing. Over the whole loan the interest comes to 26,455."* Equity states what is given up and the post-money valuation; a grant states whether it is counted at once or spread; revenue-based finance states the cap and, separately, the **cost** — 80,000 repaid at 1.5× is 40,000, and that is the number the client has to see.

**Under the list, twelve months of closing cash with the low point marked**, and a verdict in words: *"Short 4,200 in November. Another 4,200 of funding closes it."* One row, not a cash flow — the full twelve-month statement belongs to Review forecast — but a shortfall named without the month is unactionable, and this is the screen where adding a loan fixes it. Trading receipts are taken in the month they are earned; debtor-day timing lives with Review forecast, because two screens answering the same question differently is worse than one answering it late.

**Debt maths.** Payments run at their own frequency — a fortnightly loan really does pay 26 times a year, and monthlyising it understates the cost. Payment *k* falls at the end of period *k*, so the first monthly payment belongs to the month the money is drawn; an earlier cut put it a month later, dropped a payment out of Year 1 and understated Year 1 interest by 8 %. Amortised, interest-only and %-of-balance are all supported, with a balloon, and an annual fee charged on the anniversary and kept **separate from interest** — it is a financing cost, not interest, and the P&L wants them apart. Interest goes to the P&L; principal only moves cash; the closing balance goes to the balance sheet.

### Fixed Assets — step 11

There was no assets table at all, so equipment and vehicle finance bought something the plan could not depreciate. **One area, one dialog**: Asset · Bought · Cost · Life · depreciation Years 1-5 · what is left at Year 5.

**Two kinds of line, and only one is typed here.** A cash-bought asset is entered directly. An asset bought with **equipment or vehicle finance is created by its Funding row** and carries the chain (`LinkMark`) back to it in both directions: what it cost, when it arrived and its residual belong to that loan and cannot be typed over — the same rule as a synced Overheads line (§6.19) — but **how it is written off, the life and the method, stays editable**, because that is a real accounting choice and not a consequence of the loan. Deleting the loan deletes the asset, by cascade.

**Depreciation never moves cash**, and the engine returns the two separately rather than netting them: the cash left when the asset was bought, or leaves monthly as repayments. Capex for a financed asset is nil here — its cash is the loan repayment on the Funding step. Straight line is the default (what a lender expects); diminishing value is 200 % / life and stops at the residual. The monthly rate is never rounded then multiplied — 6,000 over 36 months became 6,000.12 the first time — so each month charges the difference between two running totals and the write-off lands on the cent, the §6.17 rule applied again.

**The guided path grows from 13 steps to 14**: Funding 10, Fixed Assets 11, Review forecast 12, Goals 13, Business plan 14. The old unnumbered *Capital Equipment* item under Assets is replaced by this.

**Parked:** `draw_schedule`, `auto_draw_enabled` and `min_cash_buffer` are in the 0003 schema and in no UI — a revolver that draws automatically to cover a gap belongs with Review forecast. **Extraordinary items** (`plan_extraordinary_items`, and its own APeX nav item) is not funding but a forecast adjustment, and is still homeless.

Migration 0016: `plan_fixed_assets` with `asset_source` / `depreciation_method`, one asset per finance row, a check that a financed asset names its loan and a cash one does not; `start_year` / `start_month` on all five funding tables (a plan is five forecast years, not a calendar, and APeX's absolute `start_date` is the odd one out); `opening_cash` on `plan_settings`. Engines `engine/funding/sources.ts` and `engine/assets/depreciation.ts`, 24 tests.

### 6.20.1 What putting three modules on one screen found (7 Sep 2026)

Funding is the first screen that shows Sales, COGS and Overheads together, and it immediately caught three faults that each screen had hidden on its own. All three are the same disease: **two ways of computing the same number.**

1. **Year 1 units were 10 % light in every monthly view.** `newByYear` read the base year as `first || 1`; for a line selling from Year 1 `first` is 0, which is falsy, so the Year 1 units growth that `yearlyProjection` applies was skipped. The annual columns said 33 units while the twelve months said 30 — COGS costed a different number of jobs than Sales billed, and a linked royalty line inherited the wrong client count. `newByYear` now mirrors `yearlyProjection` exactly, and three tests hold Year 1 to its own months for a one-off line, an ongoing line and the whole plan.

2. **Funding was ignoring the Leadership Team's salaries entirely.** A synced overhead row is only written to `plan_overheads` when someone opens its monthly-split dialog, so a plan can carry a full Leadership Team and no `people` row at all; the Overheads screen draws the line anyway from its own module. Funding read the table and lost 140,490 of salaries — and told the plan its cash held. `planOverheadLines` now builds that list in one place, synced lines included whether or not a row exists, and both screens use it. **Any module that reads overheads must go through it.**

3. **The Funding header and the row under it were computed from different sources** — `planCogsByYear` in the header, `planCogsMonths` in the row. Every figure on the screen is now the sum of the months the row actually spends. Same rule as the Overheads footer (§6.19): a header that adds up differently from the row beneath it is a screen that lies.

Also fixed: both new modules wrapped `FootRow` in a `<tfoot>` of their own, and `FootRow` renders one already — the nested element is reparented by the browser and every footer cell lands a column to the left. And a financed asset was being named after the bank; the loan owns its figures, but what the thing is called belongs to the client, so the name is set once as `Equipment — <lender>` and anything typed over it is left alone.

## 6.21 Monthly Projections, and the plan's own calendar (7 Sep 2026)

**Every financial module carries two tabs: Annual and Monthly.** APeX has always done this — Sales, COGS and Overheads each have Annual Projections and Monthly Projections — and it was removed here twice: from COGS in §6.18 ("Monthly holds no inputs at all… belongs to Review forecast") and from Overheads without being written down at all. Both were wrong, and the reasoning was wrong in the same way both times: *the first twelve months is the part of a plan that gets managed.* It is the cash flow, it is what a lender asks about, it is what the owner reads on a Monday. A plan that shows revenue by month and costs only by year cannot be run. Sales monthly without cost monthly is not a trade-off; it is a hole.

Monthly Projections is the same shape everywhere, following the Sales tab already built: every line down the side, the twelve months across, a Total column that ties to the Year 1 column on the annual tab, and an edit icon per row opening that line's split. Now on **COGS** (products costing as they sell, fixed costs on their own split), **Overheads** (on-costs included), **Fixed Assets** (depreciation by month — the expense that never moves cash), and **Funding** (money in, repayments out in brackets, net, with the cash check beneath it).

### The plan's own calendar

A plan's Year 1 starts the month after the financial year ends: `plan_settings.financial_year_end_month` = June means **July → June**. Six modules each carried a private `["Jan" … "Dec"]` and none of them offset by it, so every monthly grid in the app labelled slot 1 "Jan" whatever the client's year was — on a June year-end plan the column headed JAN was really July, and every column was six months out. APeX gets this right; its DesignOne columns read February → January.

`engine/plan/calendar.ts` is the one definition — `planMonths(fyEndMonth)`, `planMonthNames`, `monthAt`, `planYearLabel` — and Sales, COGS, Overheads, Assets and Funding all take `fyEndMonth` and label from it, dialogs included. **No module may hardcode a month list.** Six tests.

*The lesson worth keeping: three of these faults (this one, the Year 1 units gap, the lost salaries) were invisible while each module was read on its own, and obvious the moment two views of the same figure sat on one screen. Every new view should be checked against the view it duplicates before it is called done.*

### 6.21.1 The reconciliation invariant (7 Sep 2026)

`engine/reconciliation.test.ts` holds one rule across every module: **Year 1 equals its own twelve months** — sales (one-off, ongoing and linked lines together), cost of sales including a fixed cost with its own split, overheads with on-costs and with synced lines that have no row of their own, depreciation straight-line and diminishing with a mid-year start, and loan repayments at all four frequencies with interest and principal checked separately.

Four faults this session were the same shape — one fact with two computations that quietly disagreed — and every one was invisible while a module was read alone. This file is where that disagreement now fails a test instead of reaching a client's plan. **A new monthly or annual view is not done until it is asserted against the view it duplicates here.**

Also swept: the last four hardcoded month lists. Sales' monthly-split dialog was still labelling its twelve boxes January–December (missed in the §6.21 pass); Plan settings and the Historic and People date helpers legitimately want *calendar* order and now take it from `calendar.ts` rather than keeping private copies. No module owns a month list.

## 6.22 Guided vs Advanced is a view preference, not a refetch (13 Sep 2026)

Pressing Guided or Advanced took **just over two seconds** — measured at 2,025 ms, of which 819 ms was waiting on the server and the rest streaming.

`setMode` wrote the preference and then called `revalidatePath(path)`, which throws away the whole route and re-runs the layout *and* the page. One click cost roughly **39 round trips to Supabase** (measured at ~200 ms each): `setMode` 2, `getSession` 3, **`getCompleteness` 17**, plan settings 1, then the page's own `getSession` 3 again and its queries 13. All of it to redraw figures that had not changed — because the mode changes **which items the sidebar lists and whether the help rail starts open, and nothing else**.

**The mode now lives on the client.** `ModeProvider` holds it in plain state, seeded by the server on first render; `Sidebar` and `ModeToggle` read it from context; `setMode` still writes to `profiles` but no longer revalidates, so the write happens where nobody is waiting on it. It returns whether it saved, and the provider reverts only on a genuine failure. **Result: 2,025 ms → 7 ms**, and the preference survives a reload, a new tab and in-app navigation.

*It shipped broken once, and the reason is worth keeping.* The first cut used `useOptimistic`, which holds its value only for the life of the transition and then falls back to whatever the server last rendered. Removing the revalidation meant the server's value never caught up — so the write succeeded and the switch snapped straight back to Guided. The two halves of the same change contradicted each other. **An optimistic value needs a server render to land on; without one, the client has to own the state outright.**

Two things found alongside it and fixed:

- **`getSession()` ran twice per render** — once in the layout, once in the page — each doing an `auth.getUser()`, which is a network call to the Auth API rather than a local check. Both it and `getCompleteness` are now wrapped in React's `cache()`, so they resolve once per request.
- The layout did `await import("@/lib/supabase/server")` **inside the render body** on every request. Now a normal top-level import.

Warm route render after the change: **344–393 ms** (the 2 s seen on a cold route is Turbopack compiling on first hit, not queries).

*Still open, worth doing but not urgent:* `getCompleteness` is 17 separate `count` queries to draw the sidebar's green ticks, and it runs on every page in the plan even though its own docstring says it is for the dashboard. One Postgres function returning all eleven counts would make it a single round trip and speed up every navigation in the app.

**The rule this establishes:** a preference that changes only what is displayed must never invalidate server data. If nothing on the screen can change value, nothing should be refetched.

## 6.23 One-off income & costs — step 12 (13 Sep 2026)

APeX: an Extraordinary Items list with two summary cards and one Add/Edit dialog (description, category, amount, year, month). Unnumbered, so a guided client never sees it. Now **step 12**, because an insurance settlement, an office fit-out or a redundancy payout changes profit, tax and cash, and a plan that leaves them out is wrong.

**APeX's forecast ignores what the client typed.** The card reads *Total Extraordinary Income A$16,500*; only **1,500** of it reaches the P&L or the cash flow. Reconciling backwards: APeX's "Year 1" extraordinary figure of −26,500 is the plan's *2027* items and "Year 2" −25,000 is the 2028 one, so the year dropdown offers a year that sits outside the five-year projection and anything dated there is dropped without a word. Same fault as the lost Leadership Team salaries (§6.21.1). Here the year is a plan year 1–5, enforced by a check constraint in the database, so **there is no date a client can choose that the forecast then ignores**.

**Two areas.** *One-offs* — What it is · Type · When · Amount · Effect on the year, with a block beneath showing money in, money out and the net line per year. *Monthly projections* (§6.21) — all five years by month, because these are lumpy by nature and the month is the whole point of them. The dialog offers example chips (insurance settlement, sold a vehicle, fit-out, feasibility study, redundancy payout) since "extraordinary item" is the one phrase on the screen an owner will not recognise, and it says back what the entry does: *"Year 2 profit comes down by 15,000, and the cash leaves in March. It is taxed with the rest of the year's profit."*

**Where it goes:** one net line in the P&L below operating profit and above interest and tax — verified against APeX, 247,796 − 26,500 − 9,651 = 211,645, their own Net Profit Before Tax — so these are taxed. In the cash flow, separate receipts and payments.

**Disposals name their asset.** APeX runs proceeds from selling a machine through *operating* receipts while its own Asset Disposal Proceeds line under Investing reads zero. An income item can name a `plan_fixed_assets` row (`source_asset_id`, income only, enforced by check constraint) and the engine returns those proceeds separately so the cash flow can put them in investing. *Parked for Review forecast:* actually retiring the asset, stopping its depreciation and booking the gain or loss against written-down value.

**One name in both modes.** The first cut gave the nav item an `advancedLabel` of "Extraordinary items" while Guided read "One-off income & costs" — so toggling the mode looked like one item vanishing and a different one appearing, and it was reported as the step missing from Guided. **A nav item must not change its name with the view mode.** "Extraordinary items" belongs on the printed P&L line for the lender, not in the sidebar.

*Also noted for the forecast build:* APeX's own cash flow currently prints *"Cross-statement checks failed for years 3, 4, 5 — profit, cash and the balance sheet do not agree, so these figures should not be relied on."* We should build that check, and pass it.

Migration 0017: `source_asset_id` / `notes` / `sort_order` on `plan_extraordinary_items`, `year` bounded 1–5, disposals restricted to income. No `apply_plan_rls` — 0003 already applied it, and calling it twice fails on the existing policy (caught by replaying all seventeen against a scratch Postgres). Engine `engine/extraordinary/items.ts`, 9 tests. Guided path now 15 steps.

## 6.24 Deleting a row that carries figures (13 Sep 2026)

The same `✕` meant different things on different screens. Fixed Assets, Funding and One-offs asked first; Sales asked **only** if the product fed a linked line and otherwise deleted on the spot; COGS fixed costs, Leadership Team, Marketing and Competitors never asked at all. A client learns the button is safe on one screen and loses a product on another.

**The rule: a row carrying figures the forecast uses is never deleted silently.** Sales products, COGS fixed costs, people, competitors and marketing spend now confirm, alongside the three that already did. **A single line of free text does not** — SWOT items and marketing evidence still go on one click, because a dialog there is friction that teaches people to click through dialogs without reading, which is precisely what makes the dangerous ones dangerous. A blank row the client has not typed into yet is removed without asking.

**It names the consequence, never "are you sure".** `components/module/ConfirmDelete.tsx` is the single component, and each caller supplies what actually goes: *"Delete Carports? It contributes 141,372 to Year 1 sales. Its price, units, yearly growth, monthly split and cost go with it."* A person's dialog says the Leadership Team total in Overheads will drop; a marketing channel's says the same about the Marketing spend line; a product that feeds another line still says which line detaches. "Are you sure" tells the client nothing they did not already know.

*Found while testing:* the Royalties line — the franchise royalty that took its clients from Licence Sales, and the whole reason linked products were built in §6.17 — is no longer in the plan. Seven products became six. Nobody asked before it went.

### 6.24.1 A line another line is built on cannot be deleted (13 Sep 2026)

Warning was not enough. A product that feeds a linked line was deletable with a warning, and the dependent line was then quietly detached — it carried on winning clients by itself, **its income changed, and nothing said so**. The foreign key is `on delete set null`, so the database did the detaching without a word; there was no guard at any layer.

Now the delete is **refused**. `ConfirmDelete` takes a `blocked` prop: the destructive button is *absent* rather than disabled — a button you cannot press invites hunting for the way round it, a sentence explaining what to do first does not — and the title becomes a statement, not a question:

> **Can't delete Licence Sales**
> 1:2:1 Business Coaching takes its clients from this line. Deleting it would leave that line winning clients alone, so its income would change and nothing would say so. Open 1:2:1 Business Coaching and either point it somewhere else or delete it first.

**The server action refuses too.** `deleteProduct` queries for dependents before deleting and returns the same refusal in words; the screen is not the gate. If the server says no, the list is taken back from the database rather than from whatever the client was holding.

The foreign key stays `on delete set null` rather than `restrict`, because `restrict` risks breaking the cascade when a whole plan is deleted. The application is the right place for this rule; the FK is the fallback, not the guard.

*Verified on the plan:* with a line pointed at Licence Sales the delete is refused and offers only "Got it"; with the link removed the same button gives the ordinary "Delete Licence Sales? It contributes 600,000 to Year 1 sales" and deletes.

## 6.25 A line's base year has to explain itself (13 Sep 2026)

Reported as *"the Price % and Units % entry for Year 1 is not allowing entry as there is no field"*. The maths was right; the screen was not.

**Starts selling** offers *Now — selling today* plus Year 1–5. Picking **Now** means the price and units are this year's trading and Year 1 is a forecast year, so Year 1 gets a % box. Picking **Year N** means the line does not exist yet and starts then — those figures *are* Year N, there is nothing before them to grow from, and Year N correctly has no box. Both readings agree with `yearlyProjection` and, since §6.21.1, with `newByYear` too.

Three things made it unreadable:

- The base panel said **"CURRENT VALUES"** regardless, switching to "Base values" only when the whole *plan* was a startup — never per product. So a line starting in Year 3 announced its figures as current and then refused to let them grow.
- The empty cell said **`starts`** — one grey word, indistinguishable from a field that failed to render, which is exactly how it was read.
- Nothing said that choosing a start year costs you that year's box, so the field simply vanished with no cause on screen.

Now the panel is headed by **that product's own first year** — "Current values" only when it sells today, otherwise "Year 3 values". The cell reads **base year**. And a line beneath the grid says why and what to do: *"This line starts in Year 3, so the price and units above are its Year 3 figures — there is nothing before them to grow from, which is why Year 3 has no box. The first change you can make is Year 4. If it is already selling, set Starts selling to Now — selling today and Year 1 becomes a change on today's figures."*

**The rule: a disabled or absent input must say why it is absent and what to do instead.** A greyed cell with a one-word label is a bug report waiting to happen.

## 6.26 Type the figure, not the percentage that lands on it (13 Sep 2026)

Reported after having to solve backwards for 16.7 %, 14.25 %, 12.5 % and 11.1 % to get twelve, fourteen, sixteen, eighteen and twenty retaining walls. **Nobody plans "16.7 % more retaining walls."** Percentages suit prices and are unnatural for quantities.

It was not only awkward, it was lossy. Units carry unrounded, so 16.7 % of 12 is **14.004** — displayed as 14, and 14.004 is what compounds into the next year. The plan held a quantity the client never typed and would not recognise.

**A year now holds either a % change or the figure itself, per row and per year.** `GrowthYear` gains `priceValue` / `unitsValue`; when present they win and carry forward exactly. `yearly_growth` is already `jsonb`, so **no migration**. `yearlyProjection` and `newByYear` both honour them — they must stay identical (§6.21.1).

**One grid, type either.** The *What that gives* table is editable: type 2 % into the Price row and 12 / 14 / 16 / 18 / 20 straight into Units, and the Units percentages fill themselves in as 16.67 / 14.29 / 12.5 / 11.11, greyed to show they are worked out rather than set. Typing a % clears that year's figure; typing a figure clears that year's %. The two can never disagree about what the year is, and **the figure is stored as given — the percentage is derived for display, never the other way round.** A figure of `0` is a real answer (a year the line sells nothing), so the sanitiser checks for null rather than falsiness.

*Also fixed in the same pass:* typing a % first left the figure box empty, as if the year had no price at all, instead of showing what the % works out to.

**Not yet:** ongoing (recurring) lines still take percentages only — their revenue is a monthly fee times client-months rather than price × units, so a typed figure needs the fee model revisited. Noted in `product.ts`. And Overheads, COGS unit costs and fixed costs keep percentages until this has been used in anger on Sales.

Engine `typed-figures.test.ts`, 7 tests, including the invariant that units by year and by month still agree.

## 6.27 Sorting a list is a view, never a reorder (13 Sep 2026)

Asked for on Sales → Annual projections: sort by product name, and by the current value.

**Every numeric column sorts, not just those two.** Once a list ranks by "this year" the next question is which line is biggest in *Year 5* — and that is the more useful one, because it says what the business becomes rather than what it is. Same mechanism, no extra cost. On Nic's plan, Year 5 descending puts House Slab at 921,484 and Mining Works — flat all five years — down at fourth.

`SortTh` and `sortRows` live in `DataGrid`, so COGS, Overheads, Funding and the rest can take them as they need them. Three rules they enforce:

- **Click, click again, click off.** Ascending, descending, then back to the plan's own order. That third state is the point: `sort_order` decides what the report prints, so there has to be a way back to it.
- **Sorting never writes.** While a sort is on, the toolbar says *"Sorted by Year 5, largest first — the plan's own order is unchanged"* with a **Plan order** button beside it. A table that rearranges itself invites the worry that the plan has just been rearranged with it, and the answer to that worry belongs on the screen rather than in a help page.
- **The arrow shows only on the sorted column**, with a faint one on hover elsewhere, and always *after* the label — left-aligned or right — so the eye looks in one place for it. Eight permanent arrows would cost more in density than they return.

Ties keep the plan's order, so a column of equal values never looks shuffled. Applied to all three Sales tabs at once, because Products, Annual and Monthly are the same list and should behave the same way.

## 6.28 The monthly split has to be typed in whatever unit the client thinks in (13 Sep 2026)

Reported plainly: *"I can fuck around in this screen for a good 20 minutes, and given a large product range, it becomes a mental strain."* Ten products, twenty minutes each.

Twelve percentage boxes is the wrong question. Nobody thinks *"8.33 % of my carports in July"*; they think *"two a month, three through spring, none in July because you can't pour in the wet."* The screen was also hiding the one figure that makes the answer obvious — it showed the dollars under each box but never the **units**, so Carports read 10,200 a month with no hint that this is **1.5 carports a month**, which is the absurdity that tells a builder the shape is wrong.

**Units, dollars or percent — the client picks.** This is only safe because the split has been stored as *weights* since §6.17: `monthlySales` divides by the shares' actual total, so a typed number is never anything but a proportion. Type `2` in each month and `0` in July and you have said the shape; the annual figure still lands exactly, and **changing the annual figure later leaves the shape intact**. Units is the default when the line has any, because that is the unit the trade thinks in. What is typed is never rewritten underneath the client — weights stay as raw text and convert to stored percentages only on save.

**The other readings sit under every box.** In Units you see the dollars, in % you see both, in Dollars you see the units. One screen, no arithmetic.

**Months switch off.** The month name is a button: click it and it goes to zero with the label struck through, and the remaining months take the year between them. A wet season, a shutdown, a trade that stops over Christmas — off is a real answer, not a zero the client has to remember to type. Click again and the month comes back at the average of the live ones rather than at zero, so bringing it back is one click too. The footer counts them: *"Twelve months add to 122,400 · 18 units · 2 months off"*.

**Copy the shape from another line.** This is where the time actually goes on a range: wet season is wet season whether it is a driveway or a patio. **Same as…** lists the other lines that carry a shape of their own — a line with no saved split is implicitly even, and *Even* is already a button, so listing it would be noise. Recurring lines are excluded; their monthly pattern is client-months, not a seasonal shape.

Even / Moderate rise / Ramp-up stay, and now write into whatever unit is selected rather than into percentages only.

**The rule this generalises: when a stored value is a weight, let the client type in the unit they think in and convert on the way out.** Any screen that makes someone reverse-solve for a percentage — here, and §6.26 before it — is asking the wrong question.

*Verified on the plan:* Carports opened in Units reading **1.5 every month** — exactly the figure the old screen hid. July and August switched off left ten months at 12,240 and the footer at "· 2 months off"; the Dollars and % views agreed with each other and with the annual 122,400; **Same as… House Slab** copied that line's shape across, June included, in one click.

### 6.28.1 An affordance nobody can see is not a feature (13 Sep 2026)

Two corrections after using §6.28 in anger.

**Switching a month off was undiscoverable.** *"The click on the month to blank it out may not be discovered by the user."* Correct — the only thing marking the month name as clickable was a `title` tooltip, which nobody hovers a label to find. A feature behind a hover is a feature that does not exist.

Three changes, because one would not have been enough:

- **The month name carries a visible `×`**, muted at 40 % and full strength on hover, sitting after the label. Twelve faint glyphs cost almost nothing in density and say *these are dismissible* at a glance, which is the whole job.
- **Switched off, the glyph becomes a coloured `+`** and the name strikes through. Reversal has to look as available as the action; a struck-out label on its own reads as damage rather than a setting.
- **A line above the grid says it in words**: *"Type 0 in a month — or click its name — to switch it off for a wet season, a shutdown, a month you don't trade. The rest take the year between them."* Typing `0` always worked and is entirely discoverable; the click is the accelerator, so the hint leads with the obvious path and offers the shortcut second.

**The rule: a click target that is not a button shape needs a mark, a changed state and a sentence — the tooltip is the fourth of those, never the first.**

**Per cent is the default for every line, and the order is % · Units · currency.** The default used to follow the line — units where there were units, per cent where there were none — which meant the dialog opened differently product by product. A screen worked through ten times in a row has to open the same way each time; a default that moves costs more in re-orientation than a smart guess returns. The unit reading sits under every box regardless, so opening in per cent hides nothing, and % first matches what the field actually stores.

**"Dollars" is now the plan's own currency code** — AUD, PHP, GBP, whatever `plan_settings.currency` says. The app is not dollar-only and the header chip has been showing the real code all along; the button now agrees with it. `currency` threads from the Sales page through `SalesModule` to the dialog.

*Verified on the plan:* Carports opens in **%** with the switch reading **% · Units · AUD**; clicking July struck the label, turned its mark into a coloured `+` and moved the other eleven to 11,127; AUD mode read 10,200 a month against the same 122,400.

### 6.28.2 A reading that cannot fail is not a check (13 Sep 2026)

Reported as three questions about one line, which is how you know the line was wrong: *"Twelve months add to 56,100 · 11 units · 1 month off — is it to tell the user we are 56,100 short? Is 11 units the total? What does 1 month off mean?"*

**It was confirming that the twelve months sum to the year — and they always do.** The split is stored as weights (§6.17), so whatever is typed gets divided by its own total; the twelve can never add to anything but the year's own figure. It looked like a reconciliation and could never fail, and a number that can only ever say one thing carries no information, so the eye goes hunting for a meaning that is not there — in this case *"am I short?"*.

Worse, it was duplication. The header already says *"56,100 from 11 units"* and the closing line already promises *"the twelve always add to the year exactly"*. Both facts the footer restated were on screen already, and the third — "1 month off" — was shorthand with no subject and no denominator.

**The slot now reads the shape back.** Twelve typed boxes do not show a pattern; one sentence does.

- `Selling in all twelve months · busiest December, quietest August`
- `Selling in 11 of the twelve months · busiest June, quietest August` — the off months are counted into the denominator rather than tacked on as an aside
- `Selling in December only`
- Flat: `Selling in all twelve months · even at 4,675 a month, 0.9 units`

**The flat case carries the reality check.** Eleven slabs spread evenly is **0.9 slabs a month**, which is the figure that tells a builder an even year is fiction — the same absurdity as the 1.5 carports of §6.28, and until now nothing said it out loud. It is stated as a reading, not a warning: the screen reports what the shape means and leaves the judgement to the client.

"Flat" is a tolerance, not an equality — a legacy share of 8.3337 against 8.3333 is rounding, not a season. Half a per cent of the largest month; a real seasonal shape varies far more.

The only failure state left is the real one: every month blank, which still says *"Put a figure in at least one month."*

**The rule: a reading that cannot fail does not belong on the screen. If it can only ever say one thing, say that thing once in prose and give the slot to something that changes.**

*Verified on the plan:* Shed and Tank Concrete Slabs opened flat at *"Selling in all twelve months · even at 4,675 a month, 0.9 units"*; Moderate rise with July switched off read *"Selling in 11 of the twelve months · busiest June, quietest August"*.

### 6.28.3 Three defects in the monthly split (13 Sep 2026)

Found during an external review of Sales. Only the defects were acted on; no part of the review's redesign proposals was built, and the app is otherwise unchanged pending Nic's own read.

**A preset was undoing a month the client had switched off.** `applyPct` wrote all twelve boxes, so turning July off and then reaching for *Moderate rise* quietly brought July back — the preset overwrote a deliberate decision with a default one, and nothing said so. Presets now go through `applyShape`, which reshapes the **months that trade** and leaves the off ones at zero. With nothing live at all there is nothing to preserve, so a preset fills all twelve; that is what makes **Even** the way back from an empty screen. **Same as…** keeps the wholesale behaviour, because copying another line's shape means copying its off months too — that is what the label promises.

**Switching entry mode moved the allocation.** Units were seeded to two decimals, so a shape typed in per cent and viewed in units came back slightly different: on a ramp, the worst month moved by up to **40 of revenue** with nothing typed and nothing said. Units now seed to three decimals, which drops the worst case to **under 4** and leaves the box readable (`0.917`, not `0.9167`). Currency was already immaterial at whole units — half a unit of currency worst case — and stays there rather than putting cents in twelve boxes.

| Line | 2dp (before) | 3dp (now) |
|---|---|---|
| Shed & Tank, 11 units | 23.00 | 3.03 |
| Carports, 18 units | 33.17 | 3.06 |
| A 1-unit line | 37.56 | 3.92 |

*Verified on screen:* Moderate rise with July off left July at zero and ramped the other eleven; a per cent → units → per cent round trip moved no month by more than **3**.

**"1 units".** The flat reading in §6.28.2 did not pluralise, so a line selling twelve a year read *"even at 5,100 a month, 1 units"*.

**Observed, not changed:** after a mode round trip the displayed percentages rescale when a month is off — 7.6453 becomes 8.2636 — because the live months renormalise to 100. The money does not move (that is the §6.17 weight model working), but the numbers on screen change while nothing about the plan has. Raised for Nic rather than fixed, since a fix means choosing between normalising on every render and storing shares that do not add to 100.

**On the review itself, for the record:** its strongest claim — that the *Moderate rise* and *Ramp-up* curves match APeX's *Moderate Growth* and *Exponential Growth* — is correct and understated. The expressions are the same (`0.5 * Math.exp(0.3 * month)`, `0.8 + 0.2 * (month / 12)`), differing only in how month 12 reconciles. This is not a discovery: `APeX_Code_Audit.md` places `salesProductUtils.ts` on the **PORT** list as a deliberate decision. Its claim about shared sample data is wrong — no plan data ships in this repo; the shared figures are Nic's own plan entered into both systems, and the sample plan for release will be a different business entirely.

### 6.29 Saturation is not a life cycle stage (13 Sep 2026)

Reported while editing a product: *"remove saturation as this is not a standard lifecycle for business planning."* Correct — the standard is **Development → Introduction → Growth → Maturity → Decline**. Where "saturation" appears at all it is the late plateau of maturity, so carrying both asked the client to split a hair that no lender, grant assessor or accountant recognises.

**It was not a one-line list edit, because a product was using it.** Mining Works was marked Saturation. Dropping the option alone would have shown it as `—` in the grid, opened the dialog with a blank Lifecycle, and — the real damage — **silently nulled it the next time that product was saved for any other reason**, because the server sanitiser rejects an unknown value. A picker change would have quietly deleted the client's judgement.

Four parts:

- **Migration 0018 rebuilds the enum.** Postgres cannot drop a value from an enum in place, so the type is renamed, recreated with five values, the column recast, and the old type dropped. **The data moves first**, while the column still has the old type, so the cast can never meet a value the new type lacks. Existing rows go to **maturity, not null** — a line marked saturation was marked deliberately.
- **It is guarded and re-runnable.** The whole block only fires if `saturation` is still in the enum. A migration that cannot be run twice is a migration that strands a half-finished push.
- **The reader maps the legacy value.** `lifecycle === "saturation"` reads as `maturity` at the page boundary, so the grid, the picker and a save all agree **whichever side of the migration a deploy is on** — and a product saved before the migration lands on a value the new enum accepts instead of being nulled. Without this, deploy order becomes a data-loss hazard that depends on nobody touching one product at the wrong moment.
- **The server whitelist drops it too**, so nothing can write it back.

*Verified against a scratch Postgres 16 before it went near Supabase:* all eighteen migrations apply in order; a seeded `saturation` row becomes `maturity` while a `growth` row and a `null` row are untouched; the enum ends with five values; the old type is gone; `saturation` is then rejected on insert; and 0018 runs three times in a row without error. On screen, Mining Works reads **Maturity** with the migration not yet run.

**The rule: removing an option is a data migration, not a list edit — and the reader has to bridge the deploy, because the code and the database are never updated in the same instant.**

## 6.30 The plan's currency decides how money reads (13 Sep 2026)

Asked for as a small sweep — "Overheads, COGS, Funding and Fixed Assets still say `$` while Sales reads AUD". **That was wrong, and what was actually there is worse.** There is almost no literal `$` in those modules. What there is, is nine copies of this:

```ts
const fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
```

**Every plan was formatted as Australian, whatever currency the client chose in Settings.** The currency setting reached exactly one place — the header chip that displayed it. This is the money twin of §6.21, where six modules hardcoded January to December while the plan ran July to June: one fact, nine copies, and the copies were wrong.

It matters for **four of the thirteen currencies the app offers**:

| | correct | PlanWell showed |
|---|---|---|
| EUR, IDR | 2.119.240 | 2,119,240 |
| ZAR | 2 119 240 | 2,119,240 |
| **INR** | **21,19,240** | 2,119,240 |

The rupee case is not cosmetic. Indian grouping is in lakh, so a client reading `2,119,240` as twenty-one lakh is **out by a factor of ten before they reach the second column** — in a document going to a bank.

**One provider, not nine props.** `engine/plan/money.ts` maps a currency to the market that spells its numbers and returns a formatter; `MoneyProvider` hangs off the plan layout's existing `plan_settings.currency` fetch — the same query that already fed the chip — and `useMoney()` hands each component the formatter. No page selects currency again and no module takes it as a prop, because nine modules each wiring it themselves is precisely how it came to be ignored.

**No symbol is attached.** The currency is stated once on the header chip; a code in every cell of a dense grid costs more in noise than it returns.

**The type checker did the sweep.** Deleting the module-scope `num` turned every one of the **171 call sites across 44 components** into a compile error, so the work was mechanical and nothing could be missed silently — 25 components needed the hook, and three module-scope helpers (`signedText`, `signed`, `money`) became factories that take the formatter, since a plain function cannot call a hook.

*Verified:* six engine tests, the first of which pins AUD output character-for-character so an Australian plan cannot move. On screen, Sales read identically before and after; the plan was switched to INR and every module regrouped to lakh from that one setting — `21,19,240` — then switched back to AUD and confirmed identical again.

**The rule, twice learned now: if a value comes from the plan, exactly one module may decide what it means. The second copy is already a bug — it is just waiting for a client who is not Australian.**

## 6.31 The plan's own nouns — the word list, before any wiring (14 Sep 2026)

Raised on Settings: *"Type of product sold — the value of this field should be displayed for the tab 'Products', the heading 'Products', and any other value in the app that mentions the word 'Product'."* Right, and the app already half-agreed: `productWord` was threaded into Sales and used in **one sentence** of help text, `customerWord` reached Marketing and Competitors, and nothing else. Nic's own plan was the proof — Settings said **Services**, the tab said **Products**, the column said **PRODUCT**. Three names for one thing, two screens apart.

**The two settings are not the same problem.** All eleven customer types are singular count nouns, so plural is agreement and nothing else. The product types were not.

Sales uses the word in **six grammatical shapes** — tab (plural), column header (singular), button, counted noun (*"10 products"*), scope chip (*"All products"*), and mid-sentence with an article (*"Open a product to describe it"*). COGS adds seven more. Substituting the stored string gives **"+ Produce"**, **"10 produce"** and **"Open a produce to describe it"**. Four of the ten values had no usable singular, and *"Products and services"* had none at all and was far too wide for a dense column.

**A word the app has to inflect cannot be stored as one word.** So each type now carries three: plural, singular, and a column header. Where a type has no natural singular — a mass noun, or a compound — the singular is **"line"**, which is already this app's word for a row that carries figures. Nothing had to be dropped from the list to keep the grammar honest, so coverage went **up**, not down.

**Retired**, each for a better-spoken twin: *Access* (nobody plans in access — Memberships), *Applications* (reads as a form before it reads as software — Subscriptions), *Intellectual Property* (mass noun, too wide — Licences), *Produce* (no singular — Crops); *Jobs* joined them a commit later (→ Services). `product_type` is free text, so **no migration and no enum to rebuild** — but a plan saved under an old value must not open with a blank Settings field, so the four are mapped on read (the §6.29 rule: the reader bridges the deploy).

**Added**, because these are what clients actually think in: Projects, Contracts, Subscriptions, Treatments, Courses, Programmes, Licences, Crops. Fourteen values, three general ones first and then alphabetical, because a client hunting for their own word scans rather than reads.

**"Jobs" was in the first draft of this list and came straight back out**, which is the whole argument for fixing the words before the wiring. The field names a **line**, and the units column beside it counts the **sales**: a concreter's row is *Driveways* with 30 in units — thirty jobs of one job. Every surviving value passes that test because its noun names the line (*a treatment type*, *a membership type*, *a course*); "job" is the client's word for one sale, and it got mistaken for their word for one line. It fails a second test too: the plan has a People section, and a lender or grant assessor reads "jobs" as **employment** — misleading in exactly the document this vocabulary exists to improve. Nothing replaces it, because nothing is missing: trades are covered by **Services**, which is what this plan had chosen unprompted before any of this began.

British spelling — programme, licence — for Australia, the UK, New Zealand, Singapore, South Africa and India.

`engine/plan/vocabulary.ts` holds the table and both lookups; Settings derives its two dropdowns from it, and the naive pluraliser that had grown inside `MarketingModule` (`endsWith("s") ? w : w + "s"`) now calls the shared one. Ten tests, the central one asserting **every value reads correctly in all six shapes** — which is precisely the test the old list would have failed.

**Not wired yet, deliberately.** This commit changes the words and nothing else; Nic reviews the list before any module starts using them. **The rule: fix the vocabulary before the rollout, because every screen inherits whatever the list gets wrong.**

**Where the rollout must not reach:** Settings itself (*"Type of product sold"* cannot rename itself — circular), and anywhere "product" names the app's own concept rather than the client's thing.

**Raised for the rollout, not yet decided:** the reports are the real prize — a physiotherapist's plan going to a bank should say *patients* and *treatments* all the way through the document; `UNITS / CLIENTS` on Sales should follow *Type of customer*, so that plan reads `UNITS / PATIENTS`; and Sales currently defaults an unset `product_type` to *"Products and services"*, the one value in the old list least able to carry a substitution — it should default to *Products*.

### 6.31.1 The vocabulary goes live on Sales and COGS (14 Sep 2026)

§6.31 fixed the words and wired nothing, which is why the tab still said **Products** on a plan set to **Services**. This connects them.

`VocabularyProvider` hangs off the plan layout beside `MoneyProvider` and for the same reason (§6.30): the layout already loads `plan_settings`, so no page selects these again and no module takes them as props. `useProductNoun()` and `useCustomerNoun()` return the noun **already inflected** — `many`, `one`, `head` — because a caller that has to guess a plural is a caller that will guess wrong.

**Sales, sixteen places:** the tab (*Services*), the scope chip (*All services*), the add button (*+ Service*), the count (*10 services*), the column header on all three tabs (*SERVICE*), the empty states (*No services yet*, *Add your first service*, *Add services first*), the note (*Click a service to open it*), the edit tooltip, the delete title, the sort label, and three sentences of help.

**COGS, eight places**, because it names the same lines Sales does and half-doing it would recreate the very inconsistency being fixed: the tab (*By service*), the scope chip, the column header, the empty states, and three sentences of help.

**`productWord` is gone.** It was threaded from `sales/page.tsx` into the module for one sentence of help text, and it is exactly the shape of duplication §6.30 was about — a fact from the plan, delivered by hand, to one place that happened to need it. The page no longer selects `product_type` at all.

*Verified on the plan:* Sales reads **Services · All services · + Service · 10 services · SERVICE · Click a service to open it**, and COGS reads **By service · All services · SERVICE**, from the one Settings field and with no data touched.

**Still on products, deliberately:** Dashboard, Funding, `lib/plan.ts` and the report templates. The reports are the prize — a physiotherapist's plan going to a bank should read *treatments* and *patients* the whole way through — and they are a bigger piece than a label sweep. `UNITS / CLIENTS` on Sales should follow *Type of customer*, and Marketing and Competitors still take `customerWord` as a prop rather than the hook.

## 6.32 The forecast — three statements that have to agree (14 Sep 2026)

Asked for as "let's build the reports". There was nothing to print: `forecast`, `goals` and `reports` were all placeholder routes, and `src/engine/` held sales, cogs, overheads, funding, assets, extraordinary, people, historic and plan — **everything that feeds a forecast and nothing that is one.** Building the report first would have meant either empty financial sections, or computing the forecast inside the report: a second copy of the most important numbers in the app, on the statement a bank reads first.

**Three placements, because they are what a lender checks before anything else.**

- **Extraordinary items sit below operating profit and above tax.** A one-off must not flatter the trading line, and must not dodge the tax on it. The test asserts a 100,000 windfall leaves operating profit *identical* to the next year, moves profit before tax by exactly 100,000, and raises the tax charge.
- **Disposal proceeds are investing, not operating.** Selling the ute is not revenue; only the gain against book value reaches the P&L. 22,000 of proceeds on an 18,000 book value puts 22,000 in investing, 4,000 in profit, and nothing in revenue.
- **Interest is a P&L cost and a financing outflow — once each.** The bridge reclassifies it explicitly rather than hoping it cancels.

**Four invariants a year, computed from the finished statements rather than alongside them:** the balance sheet balances, profit explains the cash, the cash flow agrees with the balance sheet, each year opens where the last closed. Twenty checks, each naming its year and what it is out by.

### 6.32.1 The adapter reads; it never recomputes

`assemble.ts` is deliberately dull. Revenue comes from `planRevenueByYear`, cost from `planCogsByYear`, overheads from `planOverheadLines`, interest and debt from `interestByYear` / `loanByYear`, depreciation from `assetsByYear`, one-offs from `extraordinaryByYear` — the same functions the screens display from. A wrong figure is wrong on its own screen too, and both move together when it is fixed.

Three things it decides, because nothing else answers them: the **debt split** (what the schedule retires in the next twelve months is current; Year 5's balance is all current, because a balance outstanding at the end of the plan is due, not deferred), **money raised** bucketed by whether it must be repaid, and a **disposal's book value**, read from `bookValueByYear` on the asset the item names rather than stored on the item where it would go stale.

**The invariants earned their keep before a screen existed.** The first run was out by exactly 250,000 in all five years — cash arriving with no matching liability, because a test loan used the wrong field names and silently produced no schedule. The second caught a real adapter bug: `planRevenueByYear` returns `{year, value}`, so revenue was reading as **zero** — and the statements still reconciled perfectly, because zero is consistent. **Reconciliation proves the statements agree with each other, not that they agree with the plan.** Both tests are needed; both now exist.

### 6.32.2 An unset assumption is not a neutral one

`working_capital_schedule` and `cash_flow_assumptions` have existed since migration 0002 and **nothing had ever written to them.** Read as zero they say: every client pays on the day of the job, every supplier is paid the same day, nothing sits in stock, tax is settled the instant it is incurred. That is not a conservative cash flow — **it is the most optimistic one that can be drawn**, and a profitable business running out of cash in month seven is the ordinary way a good plan fails.

So the defaults are deliberate and stated. A plan with history gets its opening days from what the business actually did — `daysFromHistory` reads them out of the accounts, because a client should not be asked to guess at something their own books answer, and 58 debtor days tells them something true where a round 30 does not. A startup gets ordinary trade terms, visibly labelled as assumptions. **An explicit zero is a real answer; a missing key never is.**

The screen says what a day is worth: *"45 days — 261,276 sitting in debtors"*. "45 debtor days" means nothing to a builder; the balance is the sentence that gets the number changed.

### 6.32.3 One module, four tabs, and the checks above all of them

Tabs rather than the four separate pages APeX uses, for one reason: **three statements that must agree belong on one screen.** The reconciliation strip sits above every tab and says whether they agree *before* the client reads a figure — naming the check, the years it fails in, and the worst amount.

The whole forecast is built on the server and handed down finished, so nothing on the client recomputes any part of it and a figure can never differ between the statement showing it and the check verifying it. `lib/planSources.ts` was extracted at the moment a second page needed the funding rows and the salary totals — the first time two pages need the same rows is the moment to extract them, not the moment to paste them.

**Verified so far:** 172 tests, `tsc`, `eslint`, and a production build carrying the new route. **Not yet verified on real data** — the browser connection dropped before the screen could be opened against BNE Concreting, which is exactly where column names and null shapes usually bite.

## 6.33 Year 1 is the year you are in — there is no year before it (14 Sep 2026)

Stated plainly: *"The historical is projected... therefore the first projected year is Year 1 of the projections. The stated norm is Year 1 is always the first year and the 'Now' year. Sales are therefore active immediately or they defer to year 2, 3, 4 or 5."*

The code did not agree. `start_selling_year` meant *"1 = now, 2–6 = plan Year 1–5"*, and `firstYear = start - 1` put a line marked **Now** in **year 0** — a year that does not exist. Plan Year 1 was then treated as that line's first *growth* year, so **a line could grow before the first year it existed in**, and Year 1 could read higher than the year the business is actually trading. Every one of this plan's ten lines sat in that phantom year, which is why Current and Year 1 printed the identical total twice.

**`start_selling_year` is now the plan year itself, 1–5.** The figures entered against a line *are* that year's figures; growth starts the year after. *"Now — selling today"* is gone from the picker, because Year 1 is now: the options are Year 1–5, and Year 1 names itself — **"Year 1 — the year you're in now"**.

**The rule had three copies** — in `yearlyProjection`, in `firstYearOf`, and in `SalesModule` — and they did not agree once the meaning changed. There is one now: `firstPlanYear`, which cannot return 0. A new test asserts the invariant directly: **for every start year 1–5, a growth entry against a line's own starting year is ignored, and every year before it is zero.**

**This is a deliberate break from APeX.** Its `productCostYears` applies a Year 1 rise to a line that is already selling, for exactly the same reason — its base sits in a notional year before Year 1. The test that pinned *"APeX Year 1: 3,232 × 18 = 58,176"* now pins **57,600**, the cost as entered, with the first rise landing in Year 2. A plan carried over from APeX will read one compounding step lower in Year 1, and that is the correction, not a regression.

**Migration 0019** remaps 1 and 2 to 1 and shifts the rest down. **No figure moves on any existing plan**, because a line whose base already sat in Year 1 was already showing the base there. The whole remap is **guarded on the CHECK constraint being absent** — the first draft was not, and the scratch database showed a second run shifting every line down *again*, silently, with no way afterwards to tell which years were meant. **A migration that rewrites data has to be unable to rewrite it twice.** Verified: three consecutive runs leave the same result, and 0 and 6 are both rejected.

**On labelling the years.** Considered and rejected: *Now, Year 2, Year 3, Year 4, Year 5*. It reads plainly on screen, but "Now" is not now — a plan written in May is forecasting a year that has not started, and one read six months later cannot be dated at all. These labels go into a document a bank reads, and **"Year 1" survives being put in a drawer**. Year 1–5 also keeps Sales speaking the same language as Overheads, COGS, Funding, Fixed Assets and One-off costs. The comprehension problem is solved where the confusion actually lives — in the picker, and in a line above the columns stating what Year 1 is.

**Open, and not guessed at:** Settings states *"Plan year FY2026: Year 1 runs July 2025 → June 2026"*, while this plan's Historic period also ends in 2026 — so Year 1 and the last historic year are the same twelve months. One of the two is wrong. Rather than shift every date label on a guess, the Year 1 date line currently follows Settings' existing convention, and the contradiction is raised.

### 6.33.1 Two fields define the financial year, and the cover year is not one of them (14 Sep 2026)

*"Under the Financial year & tax tab there is the FINANCIAL YEAR with two fields — 'Financial year ends in' and 'First projected year'. **This is the financial year.** The plan year is the year the plan was produced and will end up on the front cover."*

**`first_projected_year` was stored, editable, and used nowhere.** A dead field. Meanwhile `plans.plan_year` — the cover year — had quietly become the plan's calendar in four places: the Settings summary line, Sales' Year 1 label, and `planYearStart` in Overheads and Funding, which decides which plan year a person's start date falls into. That is why Year 1 read **July 2025 → June 2026**: the twelve months the Historic step already covers.

`firstProjectedYear(stored, fyEndMonth)` in `calendar.ts` is now the single answer, and every one of those four reads it. `plan_year` no longer appears in any financial calculation — three page queries for it were deleted outright.

**Nothing is inferred at read time.** A plan's calendar is something the client states, and a stated answer can be checked; a derived one is a guess wearing a fact's clothes. The fallback — the financial year today falls in — exists only so a plan saved before this mattered does not crash, and Settings says out loud when it is being used: *"First projected year is not set, so this is the financial year today falls in."*

The summary line now reads what it means: **"Year 1 runs July 2026 → June 2027 — the year the business is in. Year 5 ends 2031."** And the hint on the field stops lying: it said *"Leave blank to use the plan year"*, which was the whole confusion in one sentence.

**The naming convention, stated once:** a financial year is named by the calendar year it **ends** in. FY2027 runs July 2026 → June 2027 for a June year end. `planYearEnding(first, n)` gives Year N's name.

**Still to do:** `plan_year` should become an editable field on Business profile — it defaults to the year the plan was created, which is right, but a plan revised and reissued next March should be able to carry the right date on its cover.

### 6.32.4 A balance sheet is short by exactly what you forget to put on it (14 Sep 2026)

The reconciliation strip failed on the first real plan: **the balance sheet was out by 188,823, identically in all five years.** A constant gap is never the forecast — it is the opening position.

`plan_historic_periods` carries **`bank_loans_current`** and **`bank_loans_non_current`**, and `assembleOpening` read neither. The business's existing bank debt was dropped on the way in, so assets exceeded liabilities and equity by precisely what it owes: 98,849 due within the year and 89,974 due later. Both now carry onto the balance sheet alongside anything Funding raises, and all four invariants pass in all five years.

A new test pins it: an opening position that balances has to stay balanced, with the opening debt intact in Year 1.

**What was not a fault:** depreciation and interest both read zero, and both are correct — this plan has **no fixed assets** and its only funding source is 100,000 of owner capital. A zero that is right looks exactly like a zero that is wrong, which is why the invariants matter more than eyeballing the statements.

**Noted, not chased:** Funding's twelve-month cash check closes Year 1 at 26,739 while the forecast closes it at 28,249. They are different models — Funding's adequacy check spends and collects in the month of trade, the forecast applies debtor and creditor days — so they are not obliged to agree. But they are close enough to be mistaken for each other, and two screens quoting a Year 1 closing cash 1,510 apart is the §6.21.1 shape. Worth settling before the reports print either.

### 6.33.2 The financial year is asked once, at the start (14 Sep 2026)

Two changes, both about asking for a fact at the moment the answer is known.

**The financial year is now set when the plan is created.** Setup asks *"Financial year ends in"* and states the consequence before the client clicks the button: **"Year 1 of the plan will run July 2026 → June 2027 — the year the business is in."** `first_projected_year` is stored at the same moment, from the financial year today falls in. A plan therefore knows its own calendar from the first screen, and Settings never has to be found to make Year 1 mean what the client thinks it means.

**`plan_year` is now editable, on Business profile, where it belongs.** It is the year on the front cover of the report — *"not the financial year"*, says the hint, because that confusion cost a whole diagnosis. It still defaults to the year the plan was created, which is right for a plan written once; a plan revised and reissued next March can now say so. Validated as a four-digit year, and `Settings` stopped carrying it as a read-only extra: it is part of the profile, saved with it.

**The rule: a field that defines how everything else is read must be asked for at creation, not left blank with a hint explaining what happens if you skip it.** The old hint — *"Leave blank to use the plan year"* — was the entire confusion in one sentence, and it survived because nothing forced the question.

## 6.34 Settings holds configuration, not prose (14 Sep 2026)

Noticed on review: *"the field 'Products & services statement' — should this be collected in another part of the plan? It now seems out of place."*

It was, and for a sharper reason than placement: **the app asked the same question at three levels of zoom, in three different places.**

| Field | Where | Asks for |
|---|---|---|
| Mission | Vision & Purpose, step 1 | what you do, for whom, every day |
| Brand promise | Vision & Purpose, step 1 | what a customer can count on |
| Products & services statement | **Plan settings** | what you sell, to whom, and why they choose you |

The third is the first two added together — and the Mission placeholder is itself a products-and-services sentence. Below all of it, every Sales line already carries **What it is** and **Why they buy it**. It was also **required**, so it drove *"Reports need 1 more field: products & services"* on Settings and the Dashboard: not merely misplaced, actively nagging.

**It now sits on Sales, under the lines it summarises.** The report section it opens is assembled from those lines, so one screen owns one section of the document. Under the grid rather than above it, because the list is what a client came for: the summary should read as the thing that follows, not the toll for reaching it.

The column stays on `plan_settings` — only the screen that owns it moved, so **no migration**. `PROFILE_REQUIRED` drops it, and the completeness nudge goes with it.

**The rule: Plan settings holds what configures the app — currency, financial year, tax rates, the vocabulary. A narrative belongs with the thing it narrates.**

*Also fixed in passing:* the "all done" message rendered a literal `&apos;` — an HTML entity inside a JavaScript string, which JSX never unescapes — and the missing-field list still carried a rename rule for the field that has just left.

## 6.35 The schema audit — what is stored and never read (14 Sep 2026)

Prompted by §6.34: if one field could sit in the wrong place unnoticed, others could. Every column in every `plan_*` table was checked against whether anything in `src/` reads it. **24 unread columns across built modules, and three whole tables never touched.** Four causes, only one of them dangerous.

*(The first pass reported ten more and was wrong: it counted columns that migration 0006 had already `drop column`-ed. A schema audit that does not replay the migrations is not an audit.)*

**1. A second home for a fact already stored — dropped.** Migration 0016 gave every funding source `start_year` + `start_month` and said why in its own comment: *"APeX stores an absolute start_date. Every other module in this app places money by plan year + month."* The absolute dates stayed behind — `plan_funding_debt.start_date`, `plan_funding_grants.date_received`, `plan_funding_owner.date_injected`, `plan_funding_revenue_linked.start_date`. Alongside them, four columns superseded by §6.20 when financed assets moved to `plan_fixed_assets`: `asset_category`, `asset_purchase_price`, `down_payment`, `depreciation_residual`.

Nothing writes any of them today. **That is the hazard, not the reassurance** — a column nothing writes now is a column something writes later, and then one fact has two answers that disagree. Four faults this fortnight were exactly that.

> **Correction, 16 Sep 2026.** The list below names `plan_marketing.positioning` as dead APeX residue. It was not dead — migration 0009 had already RENAMED it to `our_advantage`, which the Competitors module reads. The audit was written against the wrong migration and the error was then repeated in §6.61 a week later by reading this paragraph instead of the schema. **An audit of what is stored is only as good as the schema it was run against, and it goes stale the next time a column moves.**

**2, 3, 4 — left alone.** APeX features never designed in (`auto_draw_enabled`, `draw_schedule`, `min_cash_buffer`, `opening_balance`, `subject_to_approval`, `plan_marketing.positioning`); `plan_settings.months_projecting`, dead and defaulting to **12** while the app forecasts 60, so it would be wrong the moment anything read it; and three tables built in 0006 for screens that were never built — `plan_people_duties`, `plan_people_education`, `plan_people_focus`. People uses only `plan_people_capabilities`; SWOT reads `plan_people_succession`. These are inert rather than contradictory, and dropping a table is not reversible.

**Migration 0020 refuses rather than destroys.** Each column is checked for *meaningful* data before it goes — and meaningful is not "not null": three are `not null default 0`, where every row holds a zero nobody typed, so the test for those is `<> 0`. If any row holds real data the migration raises and names the table, the column and the row count.

*Verified on a scratch Postgres:* with default data only, all eight drop and a second run is silent. With `asset_purchase_price = 90000` present, it dropped five, hit the guard, **and rolled the whole block back** — every column still there, the 90,000 untouched. All-or-nothing, which is what a destructive migration has to be.

**The rule: a column no code reads is not harmless. It is a second answer waiting for someone to ask the question.**

### 6.35.1 Four questions that had become one (14 Sep 2026)

The second half of the sweep: reading the narrative fields rather than the schema. Three overlaps, one of them bad.

**"Why a customer picks you" was asked three times, and two of them shared a sentence.** Vision's **Brand promise** offered *"Quoted price is the final price. Slab poured within 10 working days of site ready."*; Competitors' **Our advantage** offered *"…quotes a fixed price and a fixed pour date."* We wrote both examples ourselves, two steps apart. In theory they differ — a promise is what you commit to everyone, an advantage is what a rival cannot match — but nothing in the wording kept them apart, so a client reaching step 4 would reasonably wonder why they were being asked again.

**"What is changing" was asked twice**, and two of the four prompt words were identical: Marketing's **Market trends** said *"demand, regulation, technology, costs"*, Competitors' **What could change** said *"regulation, technology or cost shifts"*. Both feed SWOT Threats.

Both kept — they open different sections of the report — but rewritten so they cannot collapse, and each now **names the other and says where it lives**. A field that can be confused with another should point at it.

**And a lesson in the middle of the fix.** The first rewrite made *Our advantage* read *"what the rows below cannot copy next week — a licence, a relationship, a contract, a location"* — which is **Barriers to entry**, the field directly beneath it on the same screen. One overlap removed, a worse one created, between adjacent fields. Caught by reading the finished screen rather than the diff.

The three now divide cleanly, and each says so:

- **Brand promise** — what you guarantee everyone, competitor or not.
- **Our advantage** — why a customer picks you rather than one of these rows.
- **Barriers to entry** — what stops them copying it.

**Left alone:** Vision's *Field of play* against Marketing's *Target market* — both examples say "within 90 minutes of Wollongong", but one is what work you take and the other is who buys. Different questions that happen to share an answer's shape. And Mission still overlaps the products & services statement moved in §6.34; moving it found it a sensible home, it did not resolve the overlap.

**The rule: when two fields could take the same answer, the fix is not to delete one — it is to make each say what the other is for.**

## 6.36 Year 1, month by month — the question that sinks businesses (14 Sep 2026)

The annual cash flow answers whether the year works. This answers the one that actually sinks businesses: **whether every month in it works.** A year that closes on 28,249 can still be underwater in February, and the annual column cannot say so. APeX has no monthly cash flow at all, so there was no screen to copy.

`engine/forecast/monthly.ts` **recomputes nothing.** Every line across is the month series its owning module already publishes — `planYear1Months`, `planCogsMonths`, `overheadsMonths`, `capexMonths`, `assetsMonths`, `loanMonths`, `fundingInMonths`, `extraordinaryCashMonths` — each of which already sums to the year the annual forecast reads.

The one thing it decides is **when** a balance-sheet movement happens inside the year, because no module owns that. Debtors, stock and creditors move from their opening balance to their closing balance on their own driver's cumulative share, so a seasonal business builds receivables through its busy months. Every ramp reaches exactly 1 in month twelve, so **the December balance IS the annual balance** and the twelve add to the year by construction. That is an apportionment of one fact, deliberately **not** an independent lag model — a lag model would produce its own December debtors and the plan would hold two answers to what the business is owed.

The fifth invariant, *"Year 1's twelve months add to Year 1"*, is checked **line by line, not on the total**, because two lines wrong in opposite directions add to a total that looks right. It went on screen and immediately failed on the live plan by **1,207**. Both causes were one fact with two computations:

- `unitsByMonth` divided a monthly split by 100 while `monthlySales` — which the same product's revenue goes through — divides by the shares' **actual total**. A split is weights, not percentages that must add to 100 (§6.17), so on any line whose split did not happen to total exactly 100, revenue by month added to its year and units by month did not. Cost of sales quietly disagreed with itself.
- `assembleBase` passed `() => null` as the COGS source resolver, silently unlinking every ongoing line whose clients come from another line: **28,800 against the COGS screen's 42,247** on the same figures — cost of sales a third light — with the P&L, cash flow and balance sheet all still agreeing perfectly with each other.

**Reconciliation proves the statements agree; it never proves they are right.** That is what the module-against-module invariants are for.

**Two layout faults were found in passing, both older than the screen that exposed them.**

`FootRow` emitted a `<tfoot>`. Written inside a `<tbody>` — which is what a mapped list of rows produces — a `<tfoot>` is not part of that table at all: the browser lays it out as its own anonymous table, takes its own column widths, and **the totals stop lining up with the figures above them**. On the forecast's three statements the total row sat 84 px out of its columns, in a product whose entire claim is that the numbers agree. It is a plain `<tr>` now, which belongs to the table wherever it is written.

`ModuleFrame`'s outer grid had no explicit column, so the implicit one sized to `max-content`: a grid wider than the screen stretched the module bar and the header sideways instead of scrolling inside its own frame. One `minmax(0,1fr)` and the frame contains its contents.

## 6.37 Revenue-linked finance is debt, and a loss does not evaporate (14 Sep 2026)

Two separate faults, both of the kind a CFO tests in the first minute.

**Revenue-linked finance arrived in the bank, was never repaid, and never appeared as a liability.** Every function feeding the forecast asked for `s.loan`, and a revenue-linked source carries `s.rbf` — so the balance sheet came out over by the full amount in all five years.

Each payment splits on the **cap ratio**: a 1.4× cap means 1/1.4 of every dollar retires the principal and the rest is the cost of the money. That is not the easy answer, it is the only honest one — the repayments follow future sales, so unlike a loan there is no term and no rate to amortise against, and **nothing is knowable on day one except the cap**. Splitting on it lands the liability on exactly nil at exactly the moment the cap is reached; the last payment takes the rounding on its cost rather than leaving ten cents of debt on the balance sheet forever.

`interestByYear` and `debtByYear` now **require** the revenue series rather than defaulting it. A default would have let a caller quietly reproduce the original fault; the type checker found all four call sites in one pass. That needed sixty months of revenue where only twelve existed, so `planRevenueMonths` joins `planYear1Months` — each year's twelve settled against that year's own total from `productYears`, so the sixty months and the five years can never disagree.

**A loss year carried no tax charge and the loss then evaporated**, so the first profitable year was taxed in full. On the businesses this app exists to write plans for — the ones that lose money in Year 1 and turn the corner in Year 3 — that overstates the tax bill and understates the cash **in precisely the years a lender is deciding on**. On the live plan it was 21,966 of Year 3 tax where the real figure is 2,921, because 76,179 of Year 1 and Year 2 losses had been thrown away. Relief is given against the earliest profit available. Time limits, continuity-of-ownership tests and group relief are deliberately **not** modelled: those are advice, not arithmetic.

**A dividend was taken off any profitable year regardless of whether the company was still carrying losses.** That is not a modelling choice, it is unlawful everywhere this plan gets written, and it was putting cash out of a business that had none to distribute. It is capped at what is actually distributable, and what the policy asked for but could not be paid is **reported on the statement** rather than quietly dropped.

Both needed a fact the app had nowhere to keep, so **migration 0021** adds `opening_tax_losses` and `opening_retained_earnings` to plan settings. Zero is right for a startup and a stated assumption for anyone else — and without them a going concern with real reserves would be wrongly told it cannot pay a dividend.

The P&L gains **Losses brought forward** and **Taxable profit**, so the tax charge can be followed rather than taken on trust, and a note says in words what was relieved, what is still unrelieved, and what dividend could not be paid.

*Also:* Funding read `plan_settings.opening_cash` while the forecast read the historic balance sheet, so a plan with 21,315 in the bank ran its entire funding check from nil. `openingCashFor` is now the one rule and both screens use it. And `r2` normalises negative zero — a balance sheet reporting its own check as `-0` reads as a fault to anyone who looks twice.

## 6.38 GST — the money in the bank that is not yours (14 Sep 2026)

A registered business collects tax on every invoice, pays it on every bill, and remits the difference each BAS period. Between collecting and remitting **it sits in the bank looking exactly like cash**, and then leaves in one lump four times a year. A forecast that does not know this is not slightly optimistic — it is wrong about the balance in every single month, and **most wrong in the month the return falls due**, which on a June year end is the month straight after the year the plan is being judged on.

Three rules hold it together, and all three are what an accountant checks first. Each one is a test:

1. **It never touches the profit.** Revenue, cost of sales and overheads are tax-exclusive and stay that way. Registering does not change a business's profit by a cent — if turning the flag on moved the profit line, *that* would be the bug.
2. **Debtors and creditors are tax-INCLUSIVE**, because a customer owes the whole invoice. Stock is the exception, carried exclusive. This is the detail most spreadsheets get wrong.
3. **What is collected and not yet paid over is a liability.** With quarterly returns and a June year end, the entire June quarter is still owed at 30 June, and it is not cash.

**Not everything is taxable, and getting that wrong is worse than ignoring tax altogether.** Wages are the largest line in most plans and carry none, so claiming credits on a payroll would invent tens of thousands a year. Every line that can be exempt carries its own flag — a product, a fixed cost, an overhead, an asset — defaulting to the ordinary case. The synced People line is excluded whatever it says, because a wage is never taxed and that line has no row of its own to carry a flag on.

**A refund is money coming IN.** A business that buys a 120,000 excavator in a quarter has claimed more than it collected, and the tax office pays the difference.

**On the screens.** Plan settings gains a GST section under *Tax and distributions*: registered or not, the rate, and how often returns are filed. It **names the tax the way the business does** — GST in Brisbane, VAT in Bristol, Sales tax in Boston — off the country already in the plan, and offers that country's ordinary rate as a starting point rather than imposing one. Every other field stays hidden until registration is on, because a business that is not registered should not be asked about filing frequency.

The forecast grows three conditional lines that appear only when registered: the remittance on the cash flow in both spans, and both sides of the position on the balance sheet — owing, or a refund due. A note under the cash flow says which months the BAS settles in, which of them are refunds coming back, what is still sitting in the bank at year end that is not the business's, and **that none of it has moved the profit**.

The monthly cash flow carries GST on the four lines it belongs to and the remittance as a fifth. That matters more than it sounds: the twelve-months check (§6.21.1) now has five more ways to disagree with the year, and it is asserted **at every filing frequency**, because frequency is the thing that moves which months the money leaves in.

## 6.38.1 Mark the lines that carry no GST, on the lines themselves (15 Sep 2026)

The flags existed in the database and the engine honoured them, but **nothing could set them**: every line defaulted to taxable and a client had no way to say that an export is GST-free or that a bank fee has no credit to claim. Half a feature.

One control — `GstToggle` — in the product, fixed cost, overhead and asset dialogs, because the question is the same in all four places and **nobody should have to learn it four times**. It renders **nothing** when the business is not registered: a sole trader under the threshold should never be asked whether their rent is taxable, and a dialog that asks anyway has been made harder to use for no one's benefit. On a wage line the question disappears too. A list row shows a *no GST* chip so an exempt line can be seen without opening it.

Registration reaches those four modules through `GstProvider` on the plan layout rather than four more props on four signatures — the same reasoning that put currency (§6.30) and the plan's own nouns (§6.31.1) there.

**Two faults found by building the UI, which is the point of building it.**

**A GST-free sale is zero-rated, not exempt.** Filtering the COST side by the SALES flag stripped an exporter's input credits — it charges nothing on the sale and still claims every cent on what the job cost. **What a business charges and what it claims are different acts and now read different flags.** Input-taxed supplies, where the sale is untaxed *and* the credits denied, are deliberately not modelled and said so in the code.

**The yearly figures were a second computation of the schedule's own.** Tax-per-month-then-add versus add-then-tax differ by a cent or two, and that residue left the balance sheet three cents out in Year 2, because the liability came from one and the cash lines from the other. Both now round per month and add.

## 6.38.2 A rate is a fact with a date on it (15 Sep 2026)

**Finland's standard rate was 24 here and has been 25.5 since September 2024.** The whole table was verified against published rates and the missing countries added. Every rate is a **default the client overwrites**, never an input the plan depends on — which is the only safe way to ship a table that goes stale.

**Malaysia was listed as a GST country.** It replaced GST with SST in 2018, which is a single-stage sales tax, not a value-added one, and that distinction is not cosmetic. A VAT is charged at every stage and every business claims back what it paid, so only the final consumer bears it. **A sales tax is charged once, at retail**: a business buying for resale pays nothing, and there is no credit to claim because there was never any tax to claim back. Modelling one as the other invents input credits that do not exist.

`salesTaxCountry` names the regimes this engine gets wrong on the claim side — the United States and Malaysia — **so the screens can say so rather than quietly producing a confident wrong number.** The charge side is still right for them; a sales-tax mode is a separate decision.

## 6.39 One engine, four markets — tax components (15 Sep 2026)

Australia, the UK, Canada and the US are three genuinely different taxes, and Canada is two of them at once. Rather than a mode switch, **a plan carries a LIST of tax components**, each saying whether the business claims back what it pays on purchases.

**That one flag does all the work.** A non-reclaimable component produces no purchase-side credits, and `collected − credits` then reduces to `collected` — which is exactly right for a sales tax, where the business remits the lot. One formula, four countries, and British Columbia's two taxes at two different treatments fall out of it for free.

| Market | What it needed |
|---|---|
| **Australia** | GST 10 %, reclaimable, BAS a month after the quarter. Unchanged. |
| **UK** | VAT 20 % — due one month **and seven days** after the quarter, so a quarter to 30 June is paid in August. The payment lands two months on, not one. Being a month out on a quarterly payment is a real hole in a cash flow, and this was wrong. |
| **Canada** | Entirely provincial. Ontario 13 % HST, all reclaimable. Alberta and the territories, federal GST alone. BC, Saskatchewan and Manitoba charge GST plus a PST that is **never** reclaimable — the business wears it. Quebec charges GST plus QST and reclaims both. All thirteen provinces and territories. |
| **US** | Not a value-added tax. Charged once at retail, nothing to claim, and the rate is state plus whatever counties and cities add. All fifty states and DC at the **combined state-plus-average-local** rate, because a Louisiana business charges a shade over 10 %, not the 5 % the state levies. The five states that levy nothing come out at nil. |

## 6.39.1 Pick the state or province, get the right taxes (15 Sep 2026)

**Migration 0023** adds `tax_region` and `tax_components`, and the Settings tab becomes one screen that covers all four markets.

The country is already on the Business profile, so **the only new question is the state or province — and only where that decides the answer.** It decides a great deal: an Ontario plan charges one reclaimable 13 % HST, a British Columbia plan charges 5 % GST it claims back plus 7 % PST it never does. Choose the region and the taxes fill in, shown as a small table with the rate and filing frequency editable, when the money actually leaves, and — in plain words — whether each one is claimed back or is simply a cost. **A default that cannot be overridden is a guess wearing a uniform.**

The resolver has a strict order, and each step earns its place:

1. **Not registered means nothing at all**, whatever else is stored. The switch is the switch.
2. **A stored component list is exactly what the client chose.** Their answer always wins over any default.
3. Otherwise the ordinary regime for the country and region — **but honouring a single rate the client has already typed**, so a plan written before any of this existed keeps its own 12.5 % rather than being silently repriced to the country's 10 %. That fallback deliberately does **not** apply where the region levies two taxes: one stored rate spread across a GST and a QST would be meaningless.

**Nothing is migrated and nothing is dropped.** `gst_registered` stays the on/off switch and the old single-rate columns stay readable, so every existing plan keeps working and none of them change until someone chooses.

**Six faults the walkthrough found, none of which a test would have caught**, because every one is about what the client reads:

- **The tax section was on the wrong tab** — it rendered at the bottom of *Business profile* instead of *Financial year & tax*, because the edit that placed it matched the first closing block in the file, which belonged to the other area. Nothing about it was reachable from where it belongs.
- **Moving country took the old country's taxes with it.** A plan switched from British Columbia to Australia kept charging a 7 % PST that Australia has never heard of. Enforced in `saveProfile` rather than on the screen, so it holds whichever screen changes the country.
- **"Sales tax / sales tax"** — what a fixed suffix on a section title gives you in the United States.
- **"GST and PST settles"** — a plural subject with a singular verb, on the one screen where two taxes are the whole point.
- **A monthly filer listed eleven months by name.** Past a handful it now says the shape: *every month but the first*.
- **The state and province picker had no visible placeholder**, so it read as an empty box with an arrow rather than a question.

## 6.40 Two thousand plans nobody would have typed (15 Sep 2026)

**Every hand-written test asserts something someone already suspected.** This one generates plans at random — seasonal and flat, recurring and one-off, linked lines, lines starting in Year 4, financed assets, balloon and interest-only loans, revenue-linked finance, disposals, exempt lines, nine tax regimes, opening losses and opening reserves — and holds every one to the same rules the app claims are always true: the balance sheet balances, profit explains the cash, each year opens where the last closed, Year 1 equals its own twelve months in six modules, the forecast reads the same figures the screens show, tax is never charged on a loss, and the tax parts add to the whole. **The seed is the case number**, so a failure names a plan that can be rebuilt exactly.

It found a real one on the first run, and it is a big one.

**A financed asset was free.** `capexByYear` returned nil for it, reasoning that the lender paid so no cash moved — but the loan's proceeds were already counted as money IN by both Funding and the forecast. So the money arrived and never left, and the plan gained an asset for nothing: **86,949 of asset against 86,949 of debt AND 86,949 of cash still sitting in the bank.** On the Funding cash check it showed a business flush with money it had already spent on an excavator.

**Both flows are real and both are now shown** — borrowed in, paid to the supplier straight back out, net nil. It is also what a lender expects to read: a plan that hides the borrowing and the spending because they cancel is a plan that never mentions its own capital investment.

**A test was asserting the fault outright** — *"a financed asset costs no cash the year it is bought"* — which is how it survived this long.

And on the way: the balance sheet was adding assets at their **cash** cost, so before the above was fixed a financed asset was depreciated without ever being capitalised, and fixed assets marched downwards into negative numbers.

## 6.40.1 A totals row in the wrong half of the table (15 Sep 2026)

My own regression, from the §6.36 fix a day earlier.

`FootRow` emitted a `<tfoot>`. Inside a `<tbody>` — which is what the forecast's mapped statements produce — that is not part of the table at all, and the totals sat 84 px out of the columns they totalled. So I made it a plain `<tr>`.

**Which fixed the forecast and broke the other eight modules.** All sixteen of their totals rows are written correctly, as a direct child of `<table>` after the `</tbody>` — and a bare `<tr>` there is the **mirror fault**: the parser inserts a `<tbody>` around it, the server's HTML and the browser's DOM disagree, and React refuses to hydrate. Two red issues in the corner of the app, on Sales and on Funding, and a page quietly not interactive.

**The thing I had missed is that the forecast's "total" rows are not table footers at all.** Net profit has Dividends and Retained profit underneath it; a `<tfoot>` would have rendered it at the bottom of the statement, which is simply the wrong place for it. It was never a footer — it is an ordinary row that happens to be bold. So `FootRow` goes back to being a real `<tfoot>`, where all sixteen callers already put it, and the forecast styles its mid-statement subtotals with `TOTAL_ROW` instead.

**This bit in both directions a day apart, and neither direction showed up in any other test, because both are about HTML the browser rewrites underneath you.** `grid-structure.test.ts` scans the source for a `<FootRow>` written inside a `<tbody>` — the fault is in **where the tag is written** and nothing at runtime will tell you — plus a guard that the scan is still finding real call sites rather than passing by finding nothing.

## 6.41 The What-If planner — seven levers over the real forecast (15 Sep 2026)

The mockup's headline number was a fudge: `low = B.low + dWC + dE * 0.75 / 6`, the profit change spread over six months to approximate "lowest cash in Year 1". **APeX's scenario engine cannot do better — it is annual only, so it has no February to be lowest in.**

This one approximates nothing. It applies the levers to the plan's own rows and **re-runs the same pipeline the Forecast screen runs**, so *"lowest cash 18,422, in June"* is the arithmetic the cash flow already shows rather than a curve fitted through it.

**It computes no business figure of its own.** The levers rewrite plan rows; everything after that is the engine that was already there, invariants included — **a scenario that stops reconciling says so.** Volume scales the clients won, annual figure and twelve monthly counts together, or the months would stop adding to their year (§6.21.1); a later year typed outright moves with its lever too, or a plan that typed *"Year 2: 140 units"* would answer in Year 1 and ignore it for the other four.

**Two things the live plan taught, which no hand-written test would have:**

- **A minimum cannot be split between the levers that produced it.** Move one and the tightest month itself moves, so each part was answering about a different month — and on Nic's plan the parts missed their own total by **four hundred thousand**. `tightest` fixes the month first, every lever read in the one month the scenario is tightest in, and the leftover interaction fell to six dollars.
- **Ten months named one by one is a sentence nobody finishes.** A run of consecutive months is one fact.

The fuzz generator moved out of `fuzz.test.ts` into `plans.fixture.ts`, because two suites now hold generated plans to their invariants and **two generators would drift**.

## 6.41.2 Not all revenue is worth the same money (15 Sep 2026)

Price and Volume sit next to each other and look interchangeable — both raise revenue. On Nic's plan **the same +218,224 of revenue is worth 218,224 of operating profit from price and 90,597 from volume**, and 132,254 of cash against 57,076. Which of the two a business reaches for is one of the larger decisions it makes, and until now the screen let it look like a coin toss.

So the profit levers carry a standing line, measured from the plan when it loads and true whether or not anything has moved: **prices cost nothing extra to deliver, so all of a price rise reaches operating profit; winning more work keeps 42 %, because the extra has to be bought and made.**

**It is measured, not read off the statement, and the obvious shortcut is wrong twice.** Fixed cost of sales does not scale with volume, so the incremental margin is not the gross margin the P&L reports — 42 % against 39.43 % on this plan, and the test asserts the two genuinely differ. And on a plan with an ongoing book, a volume lever wins new clients without touching the clients already on the books, so the same percentage does not even produce the same revenue. **Both are run for real and each measured against what it actually earned.** A plan whose extra work loses money is told that instead of being given a multiple.

Held across 200 generated plans: price always keeps exactly 100 %, volume never keeps more, the multiple is never below 1.

**A check about ONE lever renders under that lever's slider, where the hand already is**; only checks about the whole scenario stay in the panel. Without that split the same warning was heading for two places at once.

## 6.41.3 Show what the accounts imply, and name the gap out loud (15 Sep 2026)

Review forecast already says it, in these words: *"Your own accounts imply 46 debtor days, 2 stock days and 6 creditor days. A forecast that assumes better terms than the business has ever achieved is the first thing a lender questions."* **Then the one screen where those days are actually dragged about did not mention it.**

On Nic's plan that looked harmless, because his assumptions are unset and the schedule falls back to the implied figures — the slider starts at 46 because history is 46, and **they coincide by accident**. The moment anyone sets Year 1 debtor days the coincidence breaks and history leaves the screen entirely.

Worse, **the warnings were anchored to the plan's own assumption rather than the business.** A plan assuming 25 debtor days against a history of 46 sat there silently; dragging to 24 then said *"being paid in 24 days is quick for most trades"*. **The screen measured realism against the plan's own optimism, which is backwards.**

The three days levers carry the implied figure under the label and a mark on the track, and their checks are re-anchored: they fire on **where the slider is**, not on whether anybody moved it, so a plan that *arrives* optimistic says so on open. A tenth is the line — it scales with the business, it is one number rather than a table of them, and trimming a day or two off a long collection cycle passes without comment. *"Your accounts imply 46 debtor days. This plan collects in 35 — 11 days faster than the business has managed"* is the client's own record rather than a rule of thumb, and the rules of thumb stay for a business that has no record yet.

**Two things deliberately not done.** History is a reference mark, **never the slider's starting point**: the baseline stays the plan's Year 1 assumption, or the screen would open disagreeing with the forecast, and agreeing to the cent is the whole value of it. And the figure is named as **implied**, not achieved — `daysFromHistory` divides a closing balance-sheet figure by the year's revenue, so it is a reading taken on one date, and the footer says a quiet month flatters it. Six creditor days for a concreter may be true, or may be a balance date that fell after everyone had been paid.

**The rule this section is cited for: show what the accounts imply, let the client refine it, and name the unrefined gap out loud.**

## 6.42 A goal is owned by a person in the plan, not by a login (15 Sep 2026)

`plan_goals.owner_user_id` has pointed at `auth.users` since migration 0002, and it is the wrong shape for the question the screen asks. **The people who own quarterly goals are the Leadership Team** — the office manager, the slab supervisor, the owner's brother who does the quoting — and most of them will never have a login. Asking *"who owns this?"* and offering only the one person in the room with an account is not a choice.

**Migration 0024** adds `owner_person_id`, pointing at `plan_people`. `owner_user_id` is untouched: when the advisor workspace exists (§7.1) there is a real second question — which **login** is accountable — and it can be answered without moving this one.

The foreign key is **composite**, matching the rule `parent_id` already follows, so a goal's owner must be a person in the **same** plan. A plain reference to `plan_people(id)` would let one plan's goal name another plan's employee, **which under multi-tenancy is a leak rather than a mistake.**

Landed ahead of the Goals module that uses it: one nullable column and an index, so applying it early changes nothing.

## 6.43 The left menu was hiding three screens (15 Sep 2026)

**The menu was lying.** Review forecast holds the profit and loss, the cash flow, the balance sheet and the assumptions on one module bar — three statements that must agree belong on one screen. But the left menu listed **Balance Sheet** and **Cash Flow** as items of their own, pointing at routes that do not exist, so a client clicking either was told the module was *"next in the build queue"* while the real thing sat behind an item labelled *Profit & Loss*. **Assumptions was not listed at all** — the only place debtor, stock and creditor days can be set for all five years, findable only by opening Profit & Loss and noticing a fourth tab.

The `href` deep-link field has been in `NavItem` since the beginning and nothing had ever used it. Now Cash Flow, Balance Sheet and Assumptions each point at the tab they name, and the sidebar lights the one item the client is actually on rather than two at once.

**And the sliders write back.** What-If explains those three numbers better than any grid can — it shows what each is worth in cash, holds it against what the business actually achieved (§6.41.3), and re-runs the real forecast as they move. So it is where they should be edited. *"Save these days to the plan"* is **the first thing that screen is allowed to change**, and it is allowed because it is the one lever whose effect the screen has already shown honestly and completely, and because nothing lands in another module's records.

It writes through `saveAssumptions`, the same server action the Assumptions tab uses, so **that grid has one writer rather than two that drift**. It takes the current schedule from `loadPlan` rather than reading `plan_settings` itself — an unset grid falls back to the days the business's own history implies, and rebuilding that fallback here would have written 30/0/30 over a plan quietly forecasting on 46/2/6.

## 6.43.1 An input filed with the inputs (15 Sep 2026)

The Forecasts group had six items and **one of them was the wrong kind of thing.** Profit & Loss, Cash Flow, Balance Sheet, Break-Even and Unit Economics are all things the plan **produces**; Assumptions is a thing the client **types**. It was the only input in a group of outputs, which is exactly why it read as not belonging.

It moves to **Financials**, after One-off income & costs and before What-If Planner — which also reads as a sequence: enter the figures, set the assumptions behind the cash flow, then test them. A **tool** rather than a step, because the guided path already walks through these at step 13 and this is the door for somebody wanting to change them afterwards. Cash Flow and Balance Sheet stay where they are: they are outputs, and a CFO looks for them by name under Forecasts. The module bar stays too — it switches with no round trip, which is what somebody comparing two statements does all afternoon, and the left menu cannot do that.

**Which surfaced a real fault in the deep links: they only worked on a cold load.** Clicking *Cash Flow* in the menu is a navigation within the **same** route, so React kept the module mounted and `useState` kept whatever tab was already showing — the menu item appeared to do nothing.

The URL now follows the bar and the bar follows the URL, and **the first direction has to go through the router** rather than `history.replaceState`: a shallow URL change leaves Next still believing it is on the old address, so the next menu click there is treated as a no-op and the server component never re-renders. Local state still moves first, so the switch is as instant as it was; the router catches up behind it.

## 6.43.2 A way back to the days the accounts imply (15 Sep 2026)

`working_capital_schedule` starts empty, and while it is empty the forecast reads the days implied by the last historic period — **so the plan tracks the business.** The moment anything on that grid is saved the column is populated and **the link is cut**: the figures stay right, but they stop following the accounts, and there was no way back. A client who corrected their Historic balance sheet after touching the screen would have gone on forecasting from the old reading with nothing to tell them.

*"Use the days my history implies"* sits beside the sentence that already names them, appears only when there is something to revert, and **empties the column rather than writing today's implied figures into it.** That is the difference between reverting and copying: a later correction to Historic moves the forecast again. Only the working-capital column — tax timing, prepayments and accruals are the client's own judgement.

**Which exposed a fault of the same family as the tabs.** The assumption grids are edited locally and saved on blur, so they are state — but **the plan can move underneath them**, from this revert or from the days saved in What-If, and `useState` held the old figures on screen while the statements above showed the new ones.

**The rule: adjust state during render off the prop, rather than reaching for an effect.** The corrected grid then paints first time, with no remount and no flash of the old figures. This is the pattern every screen that can be written to from elsewhere now follows.

## 6.44 Quarters belong to the plan's year, and a lever can become a goal (15 Sep 2026)

**Q1 is the first three months of the FINANCIAL year, not the calendar.** A June year-end means Q1 is July to September. Goals carry a quarter, and a client who sets one for Q1 and finds it on the dashboard against January to March **has been told something false about their own business** — the same fault the months had before §6.21, one level up. `planQuarters` and `quarterOf` sit beside the month helpers so there is one definition, and the suite holds five different year ends to it.

**A lever is a decision; a decision with a number, an owner and a quarter is a goal** — and that is the whole reason the exit exists. The scenario a client liked on Tuesday is forgotten by Friday unless somebody owns it. This is the **gentler** of the two What-If exits and went in first: it changes no figure anywhere, so a goal can be wrong without the forecast being wrong.

**Every figure traces to the lever's own measured contribution, never to a formula written here.** *"Raise prices 5 %"* carries the profit the tile showed, which is what a full re-run of the plan produced; **a goal quoting a different figure from the screen it came from would be this project's oldest fault arriving in the client's goal list**, so a test asserts the two agree to the cent. Titles are in the owner's units — *"Win 24 more services this year — about 2 a month"*, not *"+10 % volume"* — and a cash-only lever claims no profit.

The area mapping is a judgement, so it is made once and in the open: **selling is Sales, buying and making are Operational, terms and overheads are Financial.**

On Nic's plan, price +4 % and cogs −6 % became Sales and Operational goals quoting 87,290 and 76,576 of operating profit, and the two days levers became Financial goals claiming cash only and no profit, **which is the truth about them.**

**Two things the live run caught.** Completeness counted annual goal **rows**, so the empty ones this exit creates made a client with one written sentence look three-sixths done; it now counts goals that have actually been written. And the *What-If* badge sat inside the truncating title cell, so **where a goal came from was the first thing truncation ate** — it is outside it now.

## 6.45 Make this the plan — the levers finally write something (15 Sep 2026)

Nic moved price and cost of goods, created goals from the scenario, came back to the levers and found everything as it was. **"It feels like I did nothing."** He was right, and the fault was a recommendation of mine two turns earlier to apply the days only, which left the four levers that matter most as a read-only demo. **The only way to make a price rise real was to open Sales and retype ten prices by hand.**

It writes the **base** figures, not five years of them. A product's price and units are what the yearly growth compounds from, so **one number per product carries the change through all five years** exactly as the preview showed it — which is also the answer to *"how can it flow through five years if we did not change each product?"* The preview always did change each product; on a copy in memory, thrown away when you left.

**Three things the confirmation does before anything is overwritten:**

- **It lists every record.** On Nic's plan: Retaining Walls 19,000 → 19,760, Mining Works 25,000 → 26,000, Driveways 2,328 → 2,421, and so on for twenty-two figures. *"10 products changed"* is a number to be trusted; **a list is a thing to be checked.**
- **It sizes what it cannot reach.** His overheads lever moves 82 % of his overheads — the lines he typed. The other 171,661 a year is Leadership Team salaries and Marketing spend, which live in their own modules, **because cutting overheads by a tenth cannot mean cutting every salary by a tenth. A salary is a decision, not a slider.**
- **It quotes the forecast recomputed from the records that will really be written**, rounding and unreachable lines included — not the preview's own figure.

## 6.45.1 An overheads cut is a plan, not a claim about this year's rent (15 Sep 2026)

Nic's assumption: every cost and overhead already carries a per-year % change field, and a slider ought to write **there**, combining with whatever is typed, rather than restating the figure. Checked against the four modules, he is right about one of them — and it was the one just got wrong.

**Overheads** have six columns — *This year*, then Year 1 to 5 — and `current_value` is the first of those: what the business spends **now**. Year 1 has its own % change box. So the previous day's apply, which scaled `current_value`, **was restating what the client spends today in order to record a plan about next year.** It writes Year 1's change box instead, **compounded** with what is there: on Nic's plan Fuel already carried +5 %, so a 5 % cut records **−0.25 %**, not −5 %, because 1.05 × 0.95 is what actually happens to the money.

**Products are the other shape, and deliberately**: a line's price and units **are** its Year 1 figures. The growth dialog gives Year 1 no box and says why — *"there is nothing before them to grow from; the first change you can make is Year 2."*

> **Superseded the next day by §6.47**, which made an overhead's amount its own first plan year and put the two modules on one shape. The distinction drawn here is the reason §6.47 exists; the conclusion it reached is no longer the app's.

## 6.46 A change can start next year (15 Sep 2026)

Nic's assumption pointed at something neither of us had said out loud: **every lever meant "from Year 1, day one"**, and a business planning to raise prices *next* financial year means something different. The plan could already hold both — the modules keep a % change box for each year — it just had no way to say which.

*"These changes start in — Year 1 / Year 2 / Year 3"* sits **above the levers, not in the save dialog**, because it is part of the scenario rather than part of committing it: the tiles have to preview the year the client picked, or the screen would show one thing and write another.

**One rule covers every line whatever year it starts selling in:** a change takes effect in `max(from, the line's own first year)`, and where that **is** the line's first year it moves the base — a first year has nothing before it to grow from — otherwise it compounds into that year's own change box. `landsIn` is exported so **the preview and the write make the same decision about the same row** rather than two copies disagreeing.

**Compounded, never added.** On Nic's plan a 10 % rise from Year 2 reads *"Shed and Tank Concrete Slabs · Year 2 price change +2 % → +12.2 %"*, because 1.02 × 1.10 is what happens to the money. A year the client typed a figure into outright moves the figure instead, because a rate there would be ignored (§6.26).

The two tiles follow the scenario to its own year. A Year 2 scenario does nothing to Year 1 by construction, and **a tile reading "no change" would tell the client they had wasted their time** — so the profit tile becomes Year 2 operating profit and the cash tile shows where Year 2 closes.

## 6.47 Year 1 is the first projected year, in Overheads too (15 Sep 2026)

Nic pulled back to the thing everything else rests on: **Year 1 is the first PROJECTED year** — the year the business is in, and a forecast rather than a record.

Sales already said so: its Year 1 column is headed *Sales this year* and the growth dialog tells the client *"the price and units above are its Year 1 figures"*, giving Year 1 no change box because there is nothing before it to grow from. **Overheads did not.** It carried a sixth column, *This year*, with `current_value` in it, and derived Year 1 by applying `yearly_change->>'1'` on top — almost certainly the phantom year 0 that §6.33 removed everywhere else.

**The same field meant two different things in two modules**, which is why a What-If slider moving "Year 1 overheads" had to write somewhere different from one moving "Year 1 price", and neither screen could tell you which. So **§6.45.1 is largely undone, and rightly**: an overhead's amount **is** its first plan year, and a Year 1 cut moves the amount, exactly as it does for a product.

**Migration 0025 folds rather than drops** — `current_value × (1 + c1)`, then the key goes — so every year of every plan keeps the figure it had. Verified on scratch Postgres across the cases that matter: a line with +5 % (10,000 → 10,500), one with an awkward 7.5 % (997 → 1,071.78, the same figure the old rule computed), one with a zero key, one with no key, and one starting in Year 3 whose dead `"1"` key the engine never read and which is left untouched. Idempotent across three runs.

## 6.48 Year 1 is the figure, in fixed COGS and salaries too (15 Sep 2026)

§6.47 made an overhead's amount its Year 1 figure. **Two tables were left behind**, and they were the last places in the app where *"the figure you typed"* and *"the figure in Year 1"* were different numbers:

```
plan_fixed_cogs   annual_cost   × (1 + yearly_growth_rates->>'1')
plan_people       annual_salary × (1 + salary_adjustments->>start)
```

A yard entered at 60,000 with 5 % in the Year 1 box appeared in the plan as **63,000**; a salary of 120,000 with 3 % appeared as **123,600**. Neither screen said so, so a business owner had to hold two models at once.

**Migration 0026** folds the first-year rate into the base and removes the key, the way 0025 did. A person's first plan year is **derived** from their Started date (§6.11), so the migration derives it the same way rather than assuming Year 1: someone joining in Year 3 carries their Year 3 salary and it is the Year 3 key that folds.

Both engines keep reading the first year's key while the migration is pending — the §6.29 deploy bridge.

*A note on how this was nearly got wrong:* the effect was described **backwards** in conversation — as lowering the stored figures rather than raising them — and Nic stopped the migration because the live data contradicted the claim. The fold **preserves the forecast and raises the stored base** (15,000 → 15,150; 140,000 → 141,400). **A migration is checked against the data, not against the sentence describing it.**

## 6.48.1 The bridges come down (15 Sep 2026)

0025 and 0026 have run on every plan, so the three readers that carried both the old shape and the new one have nothing left to carry:

```
enteredByYear      else if (start === 1) v *= 1 + yearly_change["1"] / 100
fixedCostByYear    else v *= 1 + yearly_growth_rates["1"] / 100
salaryForYear      the loop opening ON the start year rather than after it
```

Each was multiplying by 1 and would go on doing so forever. **§6.29 says the reader bridges the deploy; it does not say it stays afterwards, and a branch that can no longer fire is a second answer waiting for someone to ask the question (§6.35).**

With them gone the rule is stated once, in one line per module: **the figure belongs to the line's first year, and the percentages compound from the year after it.**

`scheduleChangeFromBase` became `scheduleChangeFromFirstYear`. Its old name came from APeX's *"Total Increase From Base"*, where the base was a salary sitting in front of the plan — the year §6.48 removed. The People screen already says *"Y5 vs first year"*; the function now says it too.

## 6.49 Break-Even, and the first charts in the app (16 Sep 2026)

**Break-even is a lens on the forecast, not a model of its own.** Every annual figure comes off `PnlYear` and every monthly one off the cash flow the same pipeline already built, from the same loader Review forecast and What-If use. **It cannot disagree with the profit and loss one menu item away.**

**Two break-evens, because clients ask two questions with the same words.** The year is **accrual** — fixed costs are overheads, fixed cost of sales, depreciation and interest, so breaking even means covering everything, the bank included. The months are **cash** — cumulative operating cash after interest, where depreciation drops out because it never moved money, and an owner's injection is excluded because **a cheque from the owner is not the business breaking even.** They differ; the screen names the gap as working capital rather than hiding it.

**Margin of safety** is the one number that turns break-even into advice: comfortable at 25 % or better, tight at 10, exposed below that.

## 6.49.1 No blended unit — each line in what it is actually sold in (16 Sep 2026)

APeX divided total revenue by total units across every line to get **one average selling price**, then divided the fixed base by the contribution on that average. Across a book holding a house slab at 16,800 and a foot path at 15,000, **that average describes nothing anyone can go and sell** — and with an ongoing line it adds jobs to client-months, which is not a unit at all.

So there is **no blended unit anywhere in this module.** Break-even **revenue** leads, because it needs no unit; each line is then measured in what it is really sold in — **jobs** for a one-off line, **client-years** for an ongoing one. *"On this alone"* says how many of one line would carry the whole fixed base by itself: **a deliberate counterfactual, because fixed costs cannot be split between lines without inventing a share nobody agreed to.**

**A real defect the property tests caught:** `serviceBreakEven` rounded the planned volume **before** dividing by it, which priced a ten-client line at 24,004 instead of 24,000. **Divide by the unrounded figure; round only what is displayed.**

## 6.49.2 Charts, and colours that are not statuses (16 Sep 2026)

**No charting library.** `chart/core.tsx` and `chart/plots.tsx` carry a measured width, a nice scale, a frame, a tooltip, a meter, stat tiles, columns, a trend line and bar rows — everything this app needs and nothing it does not.

Three rules that came out of building them:

- **Column width is capped at 56 px.** A two-column chart in a wide frame otherwise draws two enormous slabs, which reads as a fault rather than as data.
- **A meter, not a dial.** A dial spends a great deal of space saying one number.
- **One series means no legend** — the title already said it.

**Five series slots, assigned in a fixed order and never cycled**; a sixth series folds into *Other* rather than inventing a hue nobody can tell from the five.

**The first set declared failed on two counts and was never used by anything.** `--chart-3` was a teal of chroma 0.088, **under the floor at which a colour stops reading as a colour and starts reading as grey**. And `--chart-5` **was** `--warn`: the moment a chart used it for a cost category, **amber stopped meaning "warning" anywhere on the screen.**

**Status colours are reserved, and a series is not a status.** The replacement set is validated against the chart surface by a runnable script — every slot inside the lightness band, every chroma above the floor, worst adjacent pair ΔE 9.2 under deuteranopia against a target of 8.

## 6.50 A grant is income, not share capital (16 Sep 2026)

`plan_funding_grants` has collected `recognition_type` and `recognition_period_months` since **migration 0003. Nothing has ever read either.** A grant was filed into the equity bucket by `raisedByYear`, so it arrived as financing cash, became contributed equity on the balance sheet, and **never touched the profit and loss at all.**

Wrong three ways, and quietly:

- A grant is not money an owner subscribed for shares with.
- **An immediate grant is income.** A grant-funded business was showing a loss it did not have, and being taxed on the wrong figure.
- **A deferred grant is a liability until it is earned.** There was none.

**Nothing failed.** Cash went up, equity went up by the same amount, and the balance sheet balanced perfectly around the mistake — which is why it survived this long. A field nobody reads is the §6.35 fault; **a field nobody reads that also moves the tax bill is a worse one**, because the client typed a recognition period and watched it change nothing.

Immediate grants are earned the month they arrive; deferred grants are earned evenly across the period entered, and what is not yet earned sits as deferred income, split by whether the next twelve months will earn it. The engine runs a **seventy-two month horizon** so that at the end of Year 5 *"earned within a year?"* still has an answer instead of the whole balance defaulting to non-current.

Grant income sits **below** operating profit; grant cash is **operating**, not financing, because it is income the business earned rather than money it raised.

## 6.51 A save that cannot be started twice (16 Sep 2026)

Nic entered one equipment loan and Fixed Assets showed two excavators. **Fixed Assets was right. There were two loans.**

A dialog's Save button calls a server action and closes the dialog when it returns. **Between those two moments the button is still there, still enabled**, and the draft it holds still carries its temporary id — so the second click does not update the row the first one created, **it inserts another.** Two Citibanks, 60,000 of debt, 6,699 of interest, and two assets faithfully depreciating against them.

**Nothing downstream was at fault:** the unique index on `funding_debt_id` held, `syncFinancedAsset` made exactly one asset per loan, and the plan added up perfectly. It was just a plan the client had not typed.

**The guard is a ref, not the transition's `pending`**, because `pending` only becomes true after a render and **two clicks fit inside one frame**. A ref is set in the same tick as the first click, so the second has something to hit.

It lives in one hook rather than four copies, because **this is a shape, not an incident**: Funding · Fixed assets · One-off income & costs · Goals all opened a dialog holding a draft with a `tmp-` id and saved it on a bare `onClick`. Each now runs its save through `useSaveOnce`, and each Save button reads *"Saving…"* while the first is in flight — **the guard makes the duplicate impossible, the disabled button makes it visible why nothing happened.**

## 6.52 An asset says how it was paid for (16 Sep 2026)

Nic: *"Why are we allowed to add a fixed asset that has clear funding implications — 'Bought in' a projected year, 'What it cost' — with no connection to a loan or cash?"*

**The arithmetic was never the problem.** A 90,000 van bought in Year 2 already gave capex of 0 · 90,000 · 0 · 0 · 0, the asset on the balance sheet, and 18,000 a year off profit. The money left the bank, in the right year, in full.

**The problem is that the same purchase could be entered twice.** The only way to say *"this van is financed"* was to **not** type it on Fixed Assets at all and add a loan on Funding instead, which makes its own asset. Nobody would guess that. Type the van here and add the loan there and the plan holds two vans: 180,000 of assets, 180,000 of capex, 90,000 borrowed, two lots of depreciation, **and no warning anywhere.** The link was made by which screen the client happened to use, and that is invisible.

So **the asset asks**: *"Paid with: money the business has / equipment or vehicle finance."* Choosing finance collects the lender, rate and term and writes a **loan** — through the same action the Funding step uses, never a second writer — and the loan makes the asset, as it always did. **One way in, whichever screen you start from, so describing one purchase twice stops being possible rather than being warned about.**

**And finance can have money down.** DesignOne's own accounts show a 2,500 deposit on a 425,000 machine and the plan had nowhere to put it. **Migration 0027** adds `deposit`. The forecast needed no change at all: capex is the **asset's** price, debt proceeds are the **loan's** advance, and the gap between them is the deposit, already leaving as cash.

## 6.52.1 The Funding page had its own copy of the loader (16 Sep 2026)

Verifying §6.52 live found two faults, and one of them is **the fault this app keeps having to learn.**

**The deposit reached the forecast and not the screen.** `funding/page.tsx` carried its own hand-written mapping of the five funding tables — a second copy of `loadFundingRows`, **whose own docstring says it exists "rather than a second copy that drifts".** It drifted the moment a column was added: the engine read `deposit` through `planLoad` and the list read it through the copy, which had never heard of it. 10,000 of money down was in the plan, changing the asset and the cash, and invisible beside the loan that took it.

**The fix is not to add the column to the copy. The copy is gone**, and the page calls the loader, like every other reader of this plan.

**The list did not move.** Saying *paid with finance* writes a loan and the **loan** writes the asset, on the server — so the client saved a van and the list sat there unchanged until they navigated away and back. This screen had never needed the §6.43.2 resync before, because nothing but its own dialog had ever changed its rows. Now something does.

And the third §6.40 sentence, the one in the engine: `capexMonths` still said *"nil if it is financed"* while returning the full price for every asset.

## 6.52.2 The lender has a name and so does the thing (16 Sep 2026)

Nic bought *"TEST 1"* on a Westpac loan and Funding called it **Westpac**.

A loan is named after its **lender**, which is right — and it is useless on its own the moment a business finances two vehicles from the same bank. Three Westpac rows, no way to tell which is the tipper. Worse, **the two screens had ended up with two naming schemes for one purchase**: start on Fixed assets and the thing keeps the name you typed; start on Funding and it becomes *"Equipment — Citibank"*, because that was the only name the loan had to give it.

**No new field is needed.** The name already exists — it is the asset's — and the fault was that the loan never showed it and the loan's own dialog never asked for it. So both screens ask, and both show: Funding gives the lender in the link and, under it quietly, **what the money bought**; Fixed assets gives the thing, with its loan one click away.

`What it buys` writes straight through to the asset whichever screen it is typed on, and **an empty box never erases a name** — it means this caller had nothing to say about it. *Equipment — Westpac* survives only as the fallback for a loan whose thing was never named.

## 6.53 Can the business afford it? (16 Sep 2026)

An asset bought in a projected year takes its price out of the bank in that year. **The forecast has always said so; this screen never did.** A client could put a 425,000 excavator here against 21,315 of cash and see nothing at all, because the only place it showed was Review forecast — **three steps further on, after they had stopped thinking about assets.**

Fixed assets now carries the year's own cash, **read from the forecast and never recomputed**: what the assets took out, what the bank closes on, and a sentence that says plainly whether it holds. Funding already owns *"is the money enough"* for Year 1 by month and this defers to it; **a second answer to that question is a fault this app has paid for more than once.**

On a real plan it immediately said something worth hearing — **and caught a false sentence being written.** BNE Concreting buys 47,000 of assets in Year 1, closes Year 1 on 12,994 and Year 2 at (20,431). The first draft read *"Not these purchases — nothing is bought that year"*, which is true and useless: **the Year 1 spend is most of the reason Year 2 is short.** It now says what can be **proved** — 47,000 went out in Year 1, and that is money not in the bank now — rather than passing a verdict on cause, because the year has other things in it too.

## 6.53.1 A row of fields is a row of boxes, not a row of cells (16 Sep 2026)

*"Valuation before the money"* wraps to two lines and the two labels either side of it do not, so the box under it sat a line lower than theirs and the investor dialog read as crooked. **Aligning the cells' tops aligns the labels; the eye reads the boxes as the row.** `items-end` on **every** field row in that dialog, not just the one that showed it, because the next long label will land somewhere else.

## 6.54 Two screens, two answers to who owns the business (16 Sep 2026)

Nic asked whether an investor buying 5 % should be put into the Leadership Team. **The answer is no — and the question found something worse.**

**No**, because that list is *"owners, directors and the key people a lender asks about"*. A passive shareholder is none of those. Putting them there would file them in the salary schedule and present them to a lender as management, and **it would be the Fixed Assets trap again: one fact typed on two screens, counted twice.** If an investor does take a seat, the client adds them as a person, and their share is typed once, where they belong.

**But the two screens had already stopped agreeing about the thing itself.** The Leadership Team totals `pct_shareholding` against 100 % and shows amber until it gets there; Funding totals `equity_percent` and reported *"Investors hold 5 % of the business; you keep 95 %"*. On Nic's plan — two directors on 35 and 25, one investor on 5 — **People said 60 % and Funding said 95 %.** Neither was wrong on its own terms. **Both were counting their own half and calling it the whole.**

**Neither number is the cap table.** The cap table is both halves plus what nobody has been given, and it is computed once, in the engine, loaded once, and shown the same way in both places. On Nic's plan it says out loud that **35 % of the business is allocated to nobody.**

## 6.54.1 A column total is a sum, not a verdict (16 Sep 2026)

§6.54 gave the header the whole cap table and **left the footer judging its own column**, so the same screen contradicted itself out loud: John 75 and Mary 25 showed **100 % in green** at the foot of the Share % column, directly under a header showing **105 % in red** because an investor holds 5 % as well. Drop John to 70 and it inverts — the footer goes amber at 95 % while the header goes green at 100 %.

**Both figures were right.** The column really does add to 95 %, and the business really is fully allocated. **What was wrong is that both were passing judgement, on different questions, six inches apart.**

**The whole business is judged once, in the header, where the whole business is in view. The footer adds up the column above it and says nothing about whether that is good news — because on its own it cannot know.**

## 6.55 The business already owned things (16 Sep 2026)

Nic tried to sell an old lathe on One-off income & costs. The screen asked *"is this from selling something the business owns?"*, which was true, and **he had to answer no** — because the list only held things bought inside the plan, and the lathe had been there for years.

**Answering no is not a harmless fallback.** It books the whole proceeds as one-off **income**: operating cash, taxed in full. A disposal puts the proceeds in **investing** and only the gain over book value touches profit. On a lathe standing at 8,000, selling it for 50,000 the wrong way **overstates profit by 42,000.**

**But the dropdown was the small half.** Everything a trading business already owned was a single figure lifted from Historic with no items behind it — **and a lump is not something that can wear out.** Run BNE Concreting's opening position through the engine:

```
fixed assets by year:  129,294 · 129,294 · 129,294 · 129,294 · 129,294
depreciation by year:        0 ·       0 ·       0 ·       0 ·       0
```

**Five years of concreting plant that never depreciates.** Profit and tax overstated every year, and a balance sheet no lender would believe.

So an asset can say it was **already owned** (migration 0028). It carries what it is **worth now** rather than what it once cost, and what is **left** of its life rather than the whole of it. It depreciates from the plan's first month, it can be named in a disposal like anything else, and **no cash moves and nothing is added to the balance sheet** — the opening figure from Historic is already carrying it.

**Itemise what you need, name the rest.** Nobody is asked to list every extension lead. The reconciliation Note says what the last balance sheet put the plant at, how much of it has been itemised, and — out loud — that *"the remaining 109,294 is not broken down, so it carries no depreciation and cannot be sold."* The §6.41.3 bargain: show what the accounts imply, let the client refine it, name the unrefined gap.

## 6.56 A sold asset stops wearing out (16 Sep 2026)

**The assets engine knew nothing about disposals, so it went on depreciating a machine the plan had already sold.** A lathe sold in Year 1 cost the profit 5,000 a year through Years 2, 3 and 4 — depreciation on something that was not in the shed — and the balance sheet wrote it down to match.

**The three statements still reconciled**, because the same false charge came off both sides: internally consistent and factually wrong, **which is the hardest kind of fault to see.** On Nic's own plan it left the plant line 20,000 light by Year 5, under a green tick reading *"The statements agree."*

The disposal fact is owned by the one-off that names the asset, so `soldMonthByAsset` publishes it and `withDisposals` attaches it. From there **one series answers everything**: depreciation stops at the **start of the month of the sale**, `bookValueByYear` is nil from the year the asset leaves, and `bookValueAtDisposal` — the same series, summed to the sale month — is what the gain is measured against.

That book value **used to be read at the close of the prior year**, which was only right *because* the asset went on depreciating. Now that it stops, **the two have to be the same series or the balance sheet carries the difference forever.**

Every reader attaches it: the forecast, the Assets screen, the Funding cash check. The Assets list says *"Sold Oct · Yr 2"* under the purchase, **so the depreciation stopping has a reason on the screen it stops on.**

**And the screens stopped calling the whole cheque profit.** Selling a machine for 50,000 that is on the books at 13,750 puts **36,250** into profit, not 50,000 — so that is what the dialog says, what the *Effect on the year* column shows, what the header totals, and what the year grid nets after a new *"Less what the sold assets were worth"* line. The already-owned remove-confirm no longer claims a machine bought before the plan *"stops leaving the bank"*.

## 6.57 A step nobody can finish (16 Sep 2026)

**Step 11 had no entry in the completeness map at all.** The sidebar looks up each step's section to decide green or grey, found nothing for Fixed Assets, and fell through to grey — permanently. A client could enter fifty assets and the step would still look unfinished, **with every step around it green.** Nic asked what he was still missing on a screen holding three assets and 47,000 of plant; the answer was nothing.

Same reason Fixed Assets had never appeared on the dashboard's Plan completeness panel, which was showing twelve of thirteen sections **and nobody had noticed the one that was missing.**

**The rule: a guided step that cannot be completed is worse than a step that does not exist**, because the client goes looking for the work they have not done.

Steps 13 and 15 were uncounted too, so the guided path counted itself out of fifteen while only twelve could ever be reached.

## 6.57.1 "None" is an answer (16 Sep 2026)

**Three guided steps can be legitimately empty**, and all three of their empty states say so in plain words: a business that runs on its own cash raises no funding, a service business with a laptop owns no fixed assets, plenty of plans have no one-offs at all.

**Completeness counted rows, so the only way to answer was to enter something untrue.** The screen told the client empty was right and the menu marked them unfinished for believing it.

Now they can say it. One line under the empty table, one writer (`sayNone`) with the column chosen from a fixed map, one click to take it back. **It only appears while the list is empty, because a row answers the question by itself** — so the flag is never cleared and adding a row later just works. Migration 0031 adds `no_funding`, `no_fixed_assets`, `no_one_offs`; false means *nothing has been said*, which is what an empty table meant before there was anything to say it with.

**Step 13 is counted too.** Review forecast shows three statements the plan **produces**; the only thing on it a client can finish is the one thing they **type** — debtor days, creditor days and tax timing. A forecast left at zero days assumes every client pays on the day of the job, so **setting them is the act the step is asking for.**

**Step 15 stays at zero, and that is honest**: the Business plan module is still a placeholder, so the guided path reaches 14 of 15 and **15 of 15 will mean the client actually has a business plan.**

## 6.58 A plan can be put away, and it can be destroyed (16 Sep 2026)

**Neither was possible anywhere in the app.** A coach who mistyped a client's name was stuck with that plan on the Welcome screen forever — a throwaway had to be cleared out of Supabase by hand — and a client finished last year sat beside this year's work with nothing to tell them apart.

**Archiving is its own fact, not a status.** `plan_status` already had an `'archived'` value and using it would have meant a **complete** plan stopping being complete the moment it was put away: **one field asked to answer two questions, which is the shape of every expensive fault in this project.** So migration 0030 adds a timestamp. Status is untouched, restoring is setting it back to null, and the header inside an archived plan reads *"Working draft · Archived"* rather than replacing one fact with the other.

**Archive lives on the Welcome card.** That card was one large link, which is why there had never been anywhere to put a control — **a button inside an anchor is a button that sometimes navigates instead** — so the anchor now wraps the name and the action sits beside it. Archived plans collapse behind their own heading, which says plainly that nothing has been deleted.

**Deleting lives only inside the plan**, in a Plan settings area, far enough from the list that nobody reaches it while tidying. **It names the work before it asks anything** — *"10 products · 13 overheads · 2 people · 2 fixed assets · 1 one-off · 4 years of history · 13 goals"* — because *"are you sure?"* is not a question anybody reads and a count of the work is. Then it asks for the business name typed out, **the one confirmation that cannot be given by recognition: the gap being closed is a name somebody got wrong.**

**The typed name is checked on the server against the plan's own row as well. A guard that lives only in the browser is not a guard.**

**And a delete refused by RLS returns success with no rows, not an error** — so the action re-reads the plan afterwards and says the client lacks permission, rather than sending them to a Welcome screen with the plan still sitting on it.

## 6.59 A SWOT that does something about it (16 Sep 2026)

**§6.14 closed this the other way** — *"no priority columns, no implication fields, no quadrant commentary; a SWOT is a list"* — **and that was right about commentary. A response is not commentary.** Four honest lists with nothing attached is a page in a report; the same four lists with *"the owner prices every tender personally"* answered by *"hire and train a second estimator"* is a plan. **The decision is reversed deliberately, not drifted past.** APeX had nothing here to copy: four quadrants and an *Add* button.

Every written line gets a second, fainter one beneath it, prompted by **its own quadrant's verb** — build on it, fix it, take it, guard against it. Generating those from the labels gives *"How you'll respond to Opportunities"*, which is a sentence nobody would write on purpose. **It is always visible and always empty until filled, because the whole point is that a blank one shows.**

The toolbar counts both sides and **names the gap** the way the Fixed Assets note names un-itemised plant (§6.41.3): *"3 lines · 1 with a plan · 1 now a goal"*, and beside it in amber, *"1 weakness and 1 threat with nothing planned."* **It never blocks. It does the count a lender does.**

## 6.59.1 A response is intent; a goal is a commitment (16 Sep 2026)

Without a link between them **the same sentence would be typed in two places and drift**, so `plan_goals.swot_item_id` joins them and Goals gains a third tab listing every response nobody is accountable for. Turning one into a goal opens the ordinary quarterly dialog with the response as its title and a banner naming the line it answers; the SWOT screen then tags that line **GOAL**.

**The direction is deliberate.** The response is written at step 5; the commitment is made at step 14, where Goals already sits so that *"targets are set with the numbers in hand"*. **Asking for a quarter and an owner eight steps before the forecast exists would have been the easier build and the wrong one.**

**The dialog does not guess the area.** Nothing about a weakness says whether answering it is a marketing job or an operational one, so it asks, and *Add goal* stays disabled until an area is picked — **a wrong default files the goal under the wrong heading in the report, which is worse than one more click.**

*Found on the way:* `CellSelect` rendered an empty box instead of its placeholder whenever its value was `""` rather than `null`, because `??` does not treat `""` as absent. **Any select with nothing picked looked broken rather than waiting.** Fixed generally; a matching option still wins.

## 6.60 Marketing actions are goals (16 Sep 2026)

**§6.13 sent APeX's Action Plan to Goals and said the rows would stay "until Goals absorbs them". Goals was built and the absorption never happened.** `plan_marketing_actions` had been read by nothing in `src/` since — a table collecting titles, owners and deadlines that no screen in the product could show back. **A promise in a decisions document is not a migration.**

Marketing gains an **Actions** tab over the **same `plan_goals` rows** the Goals step shows: one list, two windows. Not a copy, not a sync — the same rows, filtered to the marketing area. **The quarterly dialog moved to `components/goals/` so there is literally one dialog rather than two that drift**, which is the same reasoning as §6.52.1, where the Funding page had grown its own copy of the loader.

Migration 0032 carries any typed rows across as marketing goals **before** dropping the table. **Nobody's work is thrown away to tidy a schema.**

## 6.61 The half of Marketing that was never asked for (16 Sep 2026)

Nic: *"there seems to be a lot of marketing missing? Is it missing because you believe we do not need it?"* **No.** Counted against APeX and against a standard marketing-plan structure: **APeX collects 39 fields, we collected 20.** Three of the gaps had never been put to him at all, and one had been put badly — I had called APeX's distribution fields *"prose nobody reads back"*, **an opinion written as a fact, aimed straight at the lean answer.** That is how a review ends up agreeing with the reviewer.

**Research got its four questions back**, including the one migration 0008 dropped entirely: *what the business will DO about the finding.* On Nic's own plan that line now reads *"Position our retaining wall …"* — **the only part of a research record that changes anything, and it had nowhere to go.** Brand returns **without** brand purpose, which really is Vision & Purpose's Purpose and Brand promise; **the same fact stored twice is the fault this project keeps paying for.** Sales process — how a prospect becomes a customer — **had never existed in this app at all.**

**Six categories, prompted not forced.** §6.13 called APeX's fixed promotion blocks rigid and replaced them with an empty grid, **which threw out what the rigidity was FOR**: a concreter who has never thought about retention does not add a retention row, and the plan then looks finished. **Rigid was wrong; silent is worse.** The categories with no row are offered as faint suggestions, the way SWOT offers lines drawn from the plan.

**What a customer costs to win** is the one marketing KPI that is arithmetic rather than a wish — *"website traffic: 5,000"* typed into a box is a hope with a number attached. Marketing spend over the plan's own count of new jobs and clients, so **it moves when the What-If sliders move.** Two traps, both tested: a **linked** line wins nobody new — its clients are another line's jobs arriving again under a maintenance plan, and counting both would **halve the cost on exactly the plans that thought hardest about retention** — and a job is not a client-month. §6.49.1's refusal of a blended unit applies to revenue per unit, **not to counting one customer deciding once.** On Nic's plan: 105 a customer in Year 1, falling to 87 by Year 5 on flat spend.

*A correction owed.* I told Nic `positioning` was a dead unwired column and therefore free to reuse. **It is not dead — migration 0009 renamed it to `our_advantage` a week after it was added, and §6.35's audit still described it under the old name.** I read the document instead of the schema, 0033 failed on a comment for a column that was not there, and Nic found it. 0034 adds the column that never existed, and §6.35 now carries the correction: **an audit of what is stored is only as good as the schema it was run against.**

## 6.62 Marketing reviewed for the person filling it in (16 Sep 2026)

Nic asked whether the area reads plainly for an SME owner — sole trader to $50M — and whether anything a lender or a growing business needs is still missing. **Four things were hard to understand, two were missing, and one expected gap turned out to be signposting.**

**Three boxes asking one question.** §6.61 added *"what they have in common"* and *"what they care about"* beside `target_market`, whose own hint still read *"who buys, where, and what they have in common"* — **the same words as the new field's label, one section below it.** An owner would stall on which box to type in, **and that collision was made the same morning it was found.**

**Who you sell to is a grid now.** One box cannot hold a business with a commercial arm and a residential one, and Nic's own answer to it opens *"We serve two primary customer segments"* — **a structure being worked around in prose is a structure that is wrong.** One row reads exactly like the old box; five rows describe five arms. Share of sales is optional and the footer only speaks when shares are given and miss 100. Migration 0035 carries what was typed into the first segment, joining `psychographics` and `customer_needs` **because they were the same question asked twice.** The four source columns are **left in place, unread**: dropping them in the migration that creates their replacement leaves no way back if the copy is wrong on a plan nobody has opened yet. **§6.29 is about a reader bridging a deploy, not about destroying the old shape the moment the new one compiles.**

**"How a job is won" now uses the plan's own noun** (§6.31.1). A clinic gets *"How a treatment is won"* and a software business does not win jobs. **Nic built that vocabulary so nobody reads someone else's words, and "job" was hardcoded the day before.**

**Why this price, on Sales.** The SBA asks for it in words — how much you charge and why that price fits the market while still making a profit — and **the plan has collected the number since day one and never the reasoning.** It sits under the price rather than on Marketing, because **a rationale kept on another screen drifts from the figure it is about.**

Smaller: *"Question or source"* was two things in one column header and is now *"What you wanted to know"*; Brand says it is optional; and the spend note finally mentions that lumpy spend — a March campaign, an August trade show — takes its month-by-month shape on the Marketing line in Overheads. **That last one had been assumed to be a missing feature until it was checked: it has always worked and nothing ever said so.**

*Caught in verification, before it shipped:* **there was no way to add a second segment.** The grid went out with no *+ Segment*, which is the whole point of a grid.

**Deliberately not built:** buyer personas — an SME plan gets *"Builder Barry, 42"* and learns nothing the segment rows do not already say — and a free-text KPI list, because **a number with no arithmetic behind it is a wish.** Which channel actually works needs actuals and belongs with them.

## 6.62.1 A dropdown is as wide as its longest option (16 Sep 2026)

Nic: *"Customer retention & loyalty"* loses its end on the Channels & spend Type column, and the picker is not wide enough to read the values either. **Two causes, and only one of them was about this column.**

**The popup was pinned to its trigger.** `SelectContent` carried `w-(--anchor-width)`, so **every dropdown in the app was exactly as wide as the box that opened it** — a narrow cell gave a narrow list, and the longest option was clipped **in the one place a client goes to read the options.** It is `min-w-(--anchor-width) w-max` now, capped at 28rem and at the space available: never narrower than its trigger, wide enough for its content, never off the screen. **That is a fix for every select in the product, not just this one.**

**And the column was 220.** The longest label decides a column of labels, **not the header above it** — 248 fits the longest with the chevron clear of it.

## 6.62.2 The written columns leave the facts grid (16 Sep 2026)

Nic, on the Competitors tab: the comments *"span the competitor name and the type dropdown"*, and would a second pass find something better.

**Three prose fields were three `colSpan={2}` cells laid across six fact columns.** They landed on column boundaries by arithmetic and on the wrong headings by meaning: *Where they're weak* sat on REACH's exact left edge, *How we win* on THREAT's. **Two unrelated things sharing a vertical line reads as a mistake even when every cell is where it belongs.**

**Even thirds did not fix it, and the first attempt claimed they had.** Measured at 1512px, the blocks moved 34px and 61px — **a near-miss, which looks sloppier than a clean collision and is indistinguishable from the old layout at a glance.** Nic said so immediately: *"visually everything seems the same to me."* **He was right, and the mistake was calling it fixed from arithmetic without asking whether a human eye would register it.**

So the band stops pretending to belong to the grid at all: **one tinted panel, indented to the competitor's name rather than the table edge, with a left accent and hairline rules between the thirds.** It spans the fact columns *deliberately* instead of accidentally, and stacks below 1180px rather than becoming three unreadable ribbons.

## 6.62.3 A dropdown hugs its value (17 Sep 2026)

Nic, still on the same screen: *"the selection of each visually has them looking a bit strange."*

**`CellSelect` was `w-full`, so every trigger stretched across its whole column and parked the chevron up to 125px from the word it belongs to.** *Direct* is 36px of text followed by 101px of nothing and then a chevron that reads as if it belongs to the next column. **And because only the hovered or focused trigger draws its border, one control looked like a box while its neighbours looked like loose text — the same control, two appearances, side by side.**

`SelectTrigger` is already `w-fit` on its own, so the fix was **to stop overriding it**; `max-w-full` keeps a long label inside its cell. A call site that genuinely wants a fixed or full width still says so in `className` and still wins, so the dialog selects and the scope chips are untouched. **Blast radius was four modules and one dialog — smaller than the warning given before the change.**

## 6.63 Roles & Capability says what is missing (17 Sep 2026)

Nic: *"it would be easy to miss adding details for skills, strengths, expertise etc. Do you want to place a warning on the screen or stats on what has been done. I dont want to force a client to fill in all areas."*

**The app already speaks this way and this one list did not.** Marketing says *"A strategy nobody is accountable for is a strategy that does not happen."* Goals says *"Nobody is accountable for them yet."* Assets says *"Nothing here yet — and for plenty of businesses that is the right answer."* **Roles & Capability's only note explained hatched rows.**

**The evidence was on Nic's own plan.** Both directors: one Skill and two Responsibilities each, and **no Expertise, Licence or Education between them.** The bios said what they do and **nothing about why they can be trusted to do it**, which is the half a lender reads.

So each person's group row names **its own gap**, beside the *+ Add* that fixes it, and only while there is one — *nothing yet* → *no responsibility yet* → *no expertise, licence or education yet*. **Not "fill in all seven types":** Strength is colour and Development area never leaves the building, so demanding them is busywork on a page a lender reads. **The pair that carries a bio is what the person owns and the evidence behind it.**

**The gap is computed from all of a person's rows, never the filtered ones** — and that was tested rather than assumed. Filtered to *Skill*, both lines still read *"no expertise, licence or education yet"*. **Computing it from the visible rows would have made the type filter invent gaps.**

**And the Leadership Team tick stopped counting names.** It was `Math.min(people, 1)`, so one named person turned the menu green with an empty Roles & Capability list behind it — **the §6.57 fault again, a section reporting done while the substance is missing.** Every named person now needs at least one written row; which kind it is stays the client's call. **A percentage bar was refused: scoring a judgement list makes optional things feel mandatory and invites padding to lift the number, on a page a lender reads.**

## 6.64 The licence the business holds (17 Sep 2026)

Nic, asked whether a trade licence belongs to a person or the business: **"QBCC licence belongs to the business."**

**The plan already argued from a licence it had no field for.** SWOT's help text offers *"the only QBCC open licence in the postcode"* as its example of a proper strength, and Marketing's barriers-to-entry placeholder reads *"e.g. QBCC open licence"*. **The app asked an owner to reason from a licence twice, in two prose boxes, with nowhere to record its number, its issuer or the date it runs out.**

The only licence the plan could hold was a **person's**: `plan_people_capabilities` has a `licence` kind, which is the right home for an individual's ticket and the wrong one for a contractor licence. **That is held by the entity, it is what the entity is allowed to do, and when it lapses the business stops trading whoever is on the payroll.** Filed against a director it would be lost the day that director left.

`plan_licences`, and a list under the identity fields in **Plan settings** — the module that opens every report's business overview, so a lender reads legal structure, years trading and what the business may do **in that order**. **No blank first row:** a grid that always shows an empty line reads as an obligation, and a bookkeeper with no trade licence would be looking at a form asking for something she does not have.

**The expiry earns its keep, and the obvious rule was wrong.** *Warn if it expires within a year* is useless here: a QBCC licence, a public liability policy and a vehicle registration all renew **annually**, so every licence a business holds is permanently inside twelve months of running out. **Flag them all, always, and the owner has been taught to skip the flag by the second read.** A 60-day renewal window says so on the screen where it is typed and nowhere else; **only a licence that has already lapsed reaches SWOT**, as a threat. A licence held is offered as a strength — **the example SWOT's own help text has used since it was built.**

*Found while writing it:* **today is read through `useSyncExternalStore`, never during render.** This is a client component Next still renders on the server, so a date taken during render is the **server's** date, and **a plan opened either side of midnight would hydrate with two different answers to "has this lapsed".**

## 6.64.1 A lapsed licence is not a strength (17 Sep 2026)

**Found by running the thing rather than reading it.** With the QBCC licence back-dated to test the threat path, SWOT offered *"Holds QBCC contractor licence"* as a **strength** and *"QBCC contractor licence expired on 30 Jun 2025 and has not been renewed"* as a **threat**, at the same time. **A client clicking Use on each would hand a lender a plan that contradicts itself on one page.** The strength loop never asked what state the licence was in.

The lapsed chip also read *"lapsed 30 Jun 2025"* in a 104px column and overflowed. **It says "lapsed"; the date is already red in the cell beside it.**

## 6.65 Assumption hints stop running under Year 1 (17 Sep 2026)

**The assumption's name and its hint were one `whitespace-nowrap` line in a 28% column, so every hint ran straight on under the Year 1 input**: *"How long clients take to pay. Each day holds this much in debtor"* with a number box sitting on top of the rest of the sentence. **Three rows wrote that markup by hand, so the same fault was in the grid three times over.**

One `AssumptionLabel` instead, hint on its own line and allowed to wrap. **Nothing is truncated: that sentence explains what the number does to the cash flow, which is the one thing somebody typing into this screen needs to read.** Measured rather than eyeballed — every hint now ends 34px short of where the Year 1 column begins, against an overlap before. **Same fault class as §6.62.2: content laid out as though the column were wider than it is.**

## 6.66 The balance you already carry (17 Sep 2026)

Nic, reading the Assumptions tab: *"If I have payments of an overhead e.g. insurance in the overheads area … BUT I have 50% of the value being paid in assumptions — how is that addressed?"* **Answering that honestly meant reading the engine, and the engine was wrong.**

Prepayments and accruals are entered as **closing** balances and the cash flow moves on the change in them — `dPrepaid = prepaid - priorPrepaid`. **`priorPrepaid` was hard-coded to 0 for Year 1**, because `OpeningBalance` had no prepaid or accrued field and the historic balance sheet had no column to fill one from. **Accounts receivable, inventory, accounts payable, bank loans and tax payable all carry over from the last historic period. These two were the only working-capital balances that did not.**

**So a business that has always paid its insurance a year ahead was shown paying that half-premium again in Year 1**, out of cash that left the bank before the plan started; the accrual side did the reverse and handed it money it did not have. **Year 1 cash is the year a lender reads hardest.**

**And "the statements agree" stayed green throughout**, because the cash-flow bridge reconciles against the same wrong movement — **the plan agreed with itself about the wrong number.** Only a test that knows what the cash *should* be catches that, so there is now one that asserts the old behaviour explicitly: **−12,000 of phantom Year 1 outflow, `reconciled: true`.** This is the same fault as §6.32.4, where the opening bank loan was missing: **a balance sheet is short by exactly what you forget to put on it.**

Two lines on the historic balance sheet, carried into `assembleOpening` and into `priorPrepaid`/`priorAccrued`. **Both default to 0, so no existing period changes until somebody fills one in.** On the **totals** path they cost nothing to adopt — *other current assets* is the residual, so naming a prepayment **moves** it out of other rather than adding it twice, and total current assets never moves. On the **components** path the line's help text says to take it out of *Other current assets*.

*Found on the way:* the first draft of the engine test reported five broken invariants **that were the fixture's own fault** — opening equity had been typed as the cash figure, so the opening balance sheet did not balance once it carried a prepaid asset. **The fixture now derives equity from the rest, which is what a balance sheet does.**

## 6.67 One pipeline, run once (17 Sep 2026)

Five places assembled a forecast — Review forecast, Break-Even, Fixed Assets, the What-If planner and the monthly test — and **each of them wrote the same twenty-five lines by hand**: assemble GST, assemble the years, push GST onto each year, build the forecast, rebuild Year 1 month by month off the balances the forecast had just computed.

Character for character identical, **with two silent exceptions that prove the point.** Only What-If threaded `openingGstPayable` through. And until §6.66.1, three of them opened the monthly view at `prepaid: 0, accrued: 0` while handing the same call real opening receivables, inventory and payables **in the same object literal**.

That is §6.52.1 at a larger scale: **a copy of the loader is a copy of every future mistake.** The overdraft sweep has to go in exactly here, and going in five times is how it drifts.

`runForecast` returns `forecast`, `monthly`, `gst`, and `checked` — the forecast with the monthly invariants folded into the strip and `reconciled` recomputed. **Both are returned deliberately:** Review forecast has always appended those checks and Break-Even and Fixed Assets have not, so the extraction changes no screen and **that choice can be made on purpose later rather than smuggled inside a refactor.**

**A refactor is only worth trusting if nothing moved.** 476 tests pass unchanged, and on the live plan Review forecast still reads operating profit (87,248) / (19,791) / 72,198 / 178,430 / 289,764 with the statements agreeing in all five years.

## 6.68 Break-Even was invisible in the mode every client starts in (17 Sep 2026)

Nic: *"I can see a left hand menu called 'Review forecasts' but for the life of me I cant find break even … if I cant find graphs or the Break Even then the client is fucked — they will never find — maybe by accident."*

`Sidebar.tsx` renders an item in Guided mode **only if it carries a step number or is flagged a tool**. Break-Even had neither, and **Guided is the default** — so the one screen in the product with charts on it was reachable only by finding the Advanced toggle in the header first. **It is also the only hidden screen with no other door**: Cash Flow and Balance Sheet survive as tabs on Review forecast, which is exactly why nobody noticed this one.

It is a **tool, not a step** — the same shape as What-If Planner and Assumptions, which sit in that menu already: things you go to rather than steps you walk.

**Unit Economics is removed rather than flagged.** There is no module behind it; the directory does not exist. A menu item pointing at a route that is not there is the §6.43.1 fault, and **it survived in this corner precisely because the default mode never drew it.**

## 6.68.1 A door from Review forecast to Break-Even (17 Sep 2026)

Nic: *"I cant see any graphs or button or sneaky links. Again bloody hard to find."*

Cash Flow and Balance Sheet were never missing — **they are the second and third tabs on Review forecast's own module bar**, and he had already been using the fourth. What was genuinely missing is **any route from that screen to Break-Even**. The two answer halves of one question — this one says what happens, Break-Even says what has to happen for it to pay for itself — **and there was no link between them from anywhere in the product.**

It sits on the Cash flow toolbar, beside the figure it is about, and **says what is on the other side rather than naming a menu item**: *"Where it starts paying for itself →"*.

## 6.69 The dashboard was a mockup nobody had wired (17 Sep 2026)

Going to look for the charts turned up something larger than where they were. **The first page a client opens never loaded the forecast at all.** Five KPI tiles hard-coded to an em dash with *"Forecast pending"* beneath them, a *"Cash runway"* panel reading *"Not yet"*, and **no call to the engine anywhere in the file** — on a plan thirteen steps of fifteen complete, with five years of statements that agree.

It reads the same run as every other screen now, **which is a one-line call because §6.67 made it one.** The dashboard cannot disagree with Review forecast about a figure it is showing larger.

Two charts, both from the kit built in §6.49.2 and **used by exactly one module until today**. Closing cash month by month through Year 1, badged *"Never below zero"* or the count of months that are — because **it is the month, not the year, that runs a business out of money**. And revenue against break-even across five years: amber where the bar is under the rule, green where it clears it. On Nic's plan Years 1 and 2 are amber and 3 to 5 are green, **which is the plan's whole argument in one picture** — and it was previously only visible on a screen the default mode would not draw.

*Caught on screen before committing:* `→` and `—` written into **JSX text**, where they are six characters rather than an escape, so *"Open Break-Even →"* rendered exactly like that. **The same sequences inside string literals in the same file were fine, which is precisely why reading the diff would not have caught it and looking at the page did.**

## 6.70 The unbuilt screens stop talking to the developer (17 Sep 2026)

Auditing the rest of the *"can't find a fucking thing"* complaint turned up one genuine thing, and **it was not a navigation fault.**

The placeholder every unbuilt module falls through to read: *"This module is next in the build queue. The design is in `docs/mockup` and the fields in `docs/planning/Data_Model.md`."* **A developer's note, naming two internal repository paths, shown to a business owner paying for the product.**

**And the likeliest person to see it was the worst possible one. Business plan is step 15** — the last step of the guided path and the entire reason a client filled in the other fourteen. They walk the whole way, click the deliverable, and **are told to go and read a markdown file.**

Six menu items land here: Business plan, Recommendations, and the four unbuilt Assets modules. Each now says what the screen is for **in the words a client would use**, and what to do meanwhile. **None names a file, promises a date, or pretends the thing exists.** On a guided step it also says how far along the plan is and links the step actually waiting on them — *"Your plan is 94% complete. The next thing waiting on you is step 14, Goals."*

**Reports themselves stay deferred, deliberately** (Nic: *"I dont want to do reports yet"*). Nothing here starts building one; this is only what the client reads until there is one.

**The rest of the audit came back clean, which is worth recording**: after §6.68 there are no menu items pointing at routes that do not exist beyond those six, **no route folder without a menu entry**, and **no built module hidden in Guided**.

## 6.71 Every year, month by month (17 Sep 2026)

`assembleMonths` was sliced to Year 1, so a five-year plan carried **twelve months of detail and forty-eight months of nothing**. The overdraft sweep needs monthly cash in every year; this is the floor it stands on.

**It turned out to be mostly windowing rather than rewriting.** Revenue, depreciation, loan schedules, revenue-based finance and grants **already computed sixty months** and the Year 1 wrappers threw four fifths away. The GST assembly already looped over all five years computing exactly the monthly split needed, and **stored Year 1 — because Year 1 was the only year with a monthly cash flow to feed it.**

Genuinely new: a sixty-month variable-cost series (`productCostMonths60`), settled per year to that year's own annual cost the way revenue already was; a sixty-month active-clients series; and a year index through overheads, fixed COGS, capex and depreciation. **`year` is the LAST parameter and defaults to 1**, so every existing caller keeps working untouched — which is why 476 tests passed before a single new one was written.

**One judgement recorded in the code rather than buried:** monthly new clients are typed by hand for Year 1 only. There is no screen asking for month-by-month intake in Year 4, so later years fall evenly rather than inheriting Year 1's shape — **inventing one would put a number in front of a lender that nobody entered.**

Proving it, because "the totals agree" would not have:

- The swap from `planYear1Months` to `planRevenueMonths.slice(0,12)` is only safe if the two agree **month by month** — matching totals would hide a reshuffle, and every existing reconciliation check compares totals. Three shapes tested; all identical.
- **Each year's twelve months add to that year's own annual cash flow, across 40 generated plans, 16 lines each.** The app's own oracle, run five times instead of once.
- **An all-zero year would satisfy every invariant vacuously**, so there is a test that the later years carry real movement and are not copies of each other.
- Years 2–5 open within half a dollar of where the year before closed — **the same tolerance `monthlyInvariants` uses, not a stricter one invented here.** The seam is December absorbing the rounding of a monthly series placed against an annual total.

## 6.72 An overdraft behaves like an overdraft (17 Sep 2026)

`line_of_credit` existed in **exactly two places in the whole codebase** — the `LoanType` union and its dropdown label — and **nowhere in the engine**. So choosing *"Overdraft / line of credit"* gave you a **term loan wearing another name**: the full amount drawn on day one whether the business needed it or not, repaid on a schedule the client invented, interest charged on a figure fixed at the start. A facility is the opposite of all three. It is a **limit**, drawn only when the month would otherwise close short, repaid the moment there is cash to repay it with, and charged on what is actually owed.

**Interest is charged on the balance owed at the START of the month.** Average-balance interest is closer to how a bank really works — but this month's interest would then depend on this month's closing balance, which depends on this month's draw, which depends on this month's interest. **A circular reference needing an iterative solve, for a difference that is small across five years and a test nobody can check by hand.** Opening-balance interest runs strictly forwards, and every figure in the tests was worked out on paper.

**Zero buffer** — the facility covers the shortfall and not a dollar more, and every spare dollar pays it down. It gives the model a property worth relying on, and there is a test for it: **a drawn balance and spare cash never exist in the same month.** If anything is owed, the account is at nil.

**Three of the eleven tests failed first time and all three were the arithmetic, not the engine.** Two were worth keeping once corrected: a deficit the facility could not cover **does not go away** — nothing repays it and the balance keeps costing interest, so every month afterwards is short too, sixty of them rather than the one expected; and a facility that only exists from month 13 **covers the whole accumulated hole when it arrives**, not just that month's. A third records that a balance left outstanding is not idle: 5,201 draws nine more times to pay its own interest and compounds to 5,688.26.

## 6.72.1 The facility reaches the three statements (17 Sep 2026)

**`loanMonths` is the single gate.** `loanByYear`, `debtByYear`, `debtSplitByYear`, `assembleBase` and `assembleMonths` all funnel through it, so **one early return keeps a facility out of every schedule** rather than ten call sites each remembering to ask. A limit is also not money arriving, so the day-one draw skips it in both places that do one.

**The loop.** The sweep is fed the movement **before** the facility acts, so whatever the last pass injected is taken straight back out, month by month. What actually changes between passes is **tax**: the interest lowers taxable profit, which lowers tax paid, which leaves more cash, which means a smaller draw and less interest. It settles in two or three passes.

**If it has not settled in six, the plan is not reported as fine.** It carries a failed invariant and the reconciliation strip says so, the same way every other engine disagreement surfaces. **Silence would have been the easy option and the wrong one.**

**Three of the six new tests failed first time, and every one failed on a GUARD rather than an assertion** — *"this plan never needed the facility, so it proves nothing"*. The seed chosen never runs short of cash, so the facility had nothing to do and all three would have **passed vacuously**. The guards had been written expecting to be decoration; they were the most useful lines in the file.

And the test the whole stage existed for: **at 120 debtor days against 30, the plan pays more interest and earns less profit — and with no facility in the same plan, the same change leaves the bottom line identical to the cent.** That second half is the behaviour §6.66's conversation described: until a facility exists, the working-capital assumptions decide *when* money arrives and never *whether it was earned*. It is now a test that fails if anyone breaks it.

## 6.72.2 The facility says what it did (17 Sep 2026)

**The last place the old lie survived was the dialog.** Choosing *"Overdraft / line of credit"* still asked for a term, a repayment type, how often, and a balloon at the end — **a form describing a term loan, for a thing that is none of those.** And the engine had known everything about the facility since it was wired in **while no screen said a word.**

For a facility the top field is the **facility limit** and writes to `total_facility_amount`, leaving what is drawn at nil — **because on day one it is**. *"Arrives in"* becomes *"Available from"*, since nothing arrives when you open one. Term, repayments, frequency and balloon are gone; interest rate and annual fee stay, **because those are what it actually costs.**

**The strip sits on the cash flow** — the statement it changes, and the screen that already runs the five-year forecast; Funding builds its own Year 1 cash check and has never run it. Name, limit, the deepest point and when, what it costs across five years, and what is owing at each year end. Then one line that answers the only question worth asking: **"The facility is not big enough" — by how much at its worst, in how many months, from which month.** Not *"check your facility"*. Where it is drawn but within the limit, how much room was left at the deepest point; where it was never drawn, that the plan pays its own way — **and the fee is still named if there is one, because an unused facility is not free.**

*Caught on screen:* **"Deepest never drawn" is not a sentence.** A facility that was never used has no deepest point, so that figure is not rendered at all.

## 6.73 Three small ones, each worse than it looked (17 Sep 2026)

**The step number is a guided-path fact.** `ModuleFrame` printed *"STEP 7 OF 15"* whenever a module passed a step, in **both modes**. Advanced is *"every module and assumption"* in the sidebar's own words: **it has no steps**, so that line counted a journey the client is not on. It shows the group alone there now. Mode comes from the server session, so the toggle needs the reload it already does — which is why the first check appeared to fail.

## 6.73.1 A salary is a whole number of dollars (17 Sep 2026)

One per cent on 70,700 reaches **73,570.70** by Year 5, and nobody is paid seventy cents. Carrying the fraction put two directors on identical salaries, each row reading **73,571**, above a total of **147,141**. **Both roundings correct, neither adding up**, and a lender reading that sees a typo.

Rounding **in the engine rather than on the screen** keeps the rows, the footer, the Overheads line and the forecast all quoting one figure — the rule this project keeps relearning (§6.19). Every year on Nic's plan now equals twice its row: 141,400 / 142,814 / 144,242 / 145,684 / 147,142.

**This deliberately breaks an APeX-parity expectation.** APeX carried the cents and that test asserted them; it now asserts whole dollars, with the reason written beside it. The deviation is at most fifty cents a person a year, and **it is the kind that should be made on purpose rather than discovered later.**

## 6.73.2 A cell keeps its contents inside itself (17 Sep 2026)

At 575px the Sales list printed *"Shed and Tank Concrete Slabs"* on top of *"One-off job"* — **two columns drawn over each other.**

**The first fix was wrong and the page said so.** Every grid is `table-fixed` with a `w-full` table, so it is always exactly as wide as its container and the `overflow-x-auto` above it never fires. A 680px floor went in and **the overlap survived untouched.** Measuring explained why: Sales fixes six of its seven columns at 720px between them, so a 680 floor left the flexible Service column **zero pixels wide**. **A floor has to clear the columns that have widths AND leave room for the one that does not** — 900.

**And a floor alone is a bet.** `whitespace-nowrap` will paint any overflow across the neighbouring column, so a cell now clips to an ellipsis: **a squeezed cell looks squeezed rather than broken**, and the `title` means nothing is lost.

## 6.74 A grant the tax office does not want (17 Sep 2026)

**Every grant in the plan was taxed, and plenty are not.** Australian R&D and export grants, disaster and drought relief, a good many state programmes are non-assessable: they land in the bank, they belong in the profit and loss as income, and **the tax office does not want a cent.** The plan had no way to say so, so a client with a 60,000 exempt grant was shown 15,000 of tax on money that carries none — overstating the charge and understating the cash **in exactly the year a lender is reading.**

**The subtlety, and the reason the exemption comes out BEFORE relief rather than after:** a business losing 100,000 including 50,000 of exempt grant income has a **tax loss of 150,000**, not 100,000. Netting the exemption against the loss would carry the smaller figure forward and **quietly tax that 50,000 again in a later year — the exemption would be borrowed rather than given.** There is a test that fails if anyone nets it.

A deferred exempt grant is exempt **on the same schedule it is earned on**, not when the cash lands; otherwise the income and its exemption fall in different years and the charge is wrong in both.

**`true` is the default everywhere** — column, converter and save action. A grant assumed taxable and actually exempt understates the client's cash, **which is the error that disappoints nobody**; the reverse writes a plan promising money the tax office is about to take. The dialog says so, and tells the client to check the grant's own terms.

*Shape worth copying:* `grantIncomeUntaxed` is **optional** on `YearBase`, like `gst` — an addition that is nil on every plan that has not said otherwise, so no existing caller or fixture had to be rewritten and 503 tests passed before the six new ones were written.

## 6.75 Four boxes that became a grid (17 Sep 2026)

0035 turned one target-market box into `plan_market_segments` and **left the four source columns in place, unread, deliberately**: dropping them in the same migration that creates their replacement leaves no way back if the copy is wrong on a plan nobody has opened yet. The grid has been used since. They go now.

**Looking properly before dropping them found something bigger than the drop.**

`getCompleteness` scored the Marketing step out of four by counting `target_market`, market size, market trends and `customer_needs` — and **two of those four stopped being fillable** the day §6.62 replaced them with the grid. Nothing renders them; nothing writes them. So **a plan created after §6.62 could reach 2/4 on Marketing and never move again**, however much its owner wrote. **That is the §6.57 fault in a second place: a step nobody can finish.** Nic's own plan hides it, because his boxes were filled before the grid existed and still hold words.

It now counts **a named segment, market size, market trends and positioning** — four things a client can actually type, all on the same tab.

**The migration re-runs the copy before it drops anything**, for any plan with words in those boxes and no segment to hold them: one created between 0035 and today, or one where the boxes were filled after the first copy ran. **A plan that already has a segment is skipped entirely**, so anyone who has since edited their segments keeps exactly what they wrote. Both halves are guarded, so the whole thing runs twice safely.

**It is the first destructive migration in the project**, and it went out with the rule written down: *apply it with the code, not before* — the old completeness query names two of the columns it drops and fails the moment they are gone.

## 6.76 Profit & Loss becomes its own module (17 Sep 2026)

Nic, comparing two screens: Break-Even has tiles, a chart and three tabs; the profit and loss is **hidden under a menu item called "Review forecast"** with a one-line toolbar and a five-year table. "It should have its own menu item like Break-Even."

He was describing the least developed screen in the app, and it is **the statement a lender opens first.**

Three areas, the same shape Break-Even proved: **The year** (revenue, gross margin, operating profit, net profit, three lines across five years, the statement). **Month by month.** **By service.**

**Two of them stop short on purpose, and the reasons are different.** Month by month stops at **operating profit**: tax is charged on a year, loss relief is given against a year, a dividend is declared once — spreading them across twelve months means **inventing twelve figures from one.** By service stops at **gross profit**: overheads cannot be split across lines without a basis nobody agreed to (§6.49). A table that stopped where the data stops explains more than one that runs to the bottom on invented numbers.

**The §6.32.3 question, answered honestly.** That rule said three statements that must agree belong on one screen, and this breaks the adjacency. But **the guarantee was never the adjacency — it was the CHECK.** The reconciliation strip is what tells a client the figures agree before they read one, and it travels to every module that leaves. §6.32.3 keeps what it was actually protecting.

*Shape worth copying:* `Statement`, `TaxNotes` and `StatementRow` were lifted out of ForecastModule into `components/module/`. **The first time two screens need the same rows is the moment to extract them, not the moment to paste them.**

## 6.76.1 A legend takes its height out of the box, not on top of it (17 Sep 2026)

The new multi-line chart added a legend **above** the plot and the SVG kept its full height, so the whole thing ran **20px past its container** and the year labels landed on the table header underneath. Nic sent a screenshot.

`LEGEND_H` is now subtracted from the caller's height before the plot is drawn. **A component given a height honours it** — anything else makes every caller responsible for guessing what the component will add.

## 6.76.2 The monthly chart borrows Break-Even's idiom (17 Sep 2026)

Nic: "you had three lines before and now you only have two. If you only have two lines then why not make it similar to the break even chart."

**Nothing had been dropped** — the browser was left on a different tab after a check, and the tab it was left on has two lines rather than three. **Mine to own: a check that changes what the user sees should put it back.** The instinct behind the question was still right, and the chart became columns with a cost rule, the way Break-Even draws it.

## 6.76.3 One line, not a bar and a line (17 Sep 2026)

Nic, one screen later: "i think the month by month should be a line, its too confusing as a bar and a line."

**He was right and the borrowed idiom did not travel.** Break-Even's form works because it has five bars whose thresholds **genuinely differ.** BNE's revenue is flat at 181,853 in every month of Year 1, so the cost rule sat a hair above every bar and **twelve near-identical pairs read as noise rather than as a comparison.**

One `Trend` of operating profit. The fill runs between the line and nil, so **the shaded area below zero IS the loss.** Every tile on that tab is about one number; the chart says the same one thing. Revenue stays the first row of the table beneath, where reading it against the cost rows is **exact rather than pixel-judged.**

*The rule this leaves:* **a chart form is not portable just because it is good.** It carries an assumption about the data — Break-Even's is that its thresholds differ — and a form used where its assumption fails produces a picture that looks considered and says nothing.

## 6.77 The balance sheet gets its own module (17 Sep 2026)

Same move, same reasons. Three areas: **The years**, **Working capital**, **Strength**.

**The years** draws total assets, total liabilities and equity as three lines, so **the gap between the first two IS the third.** On BNE, equity crosses above the borrowings between Year 2 and Year 3 — the whole story of the plan, and no column of figures says it at a glance.

**Working capital** is the only part of a balance sheet that moves week to week, and it found something: **275,022 of BNE's 539,406 in assets is money other people owe.** One line, month by month, of debtors plus stock less creditors — **one line and not three**, because three series two orders of magnitude apart leaves the small ones lying flat on the floor pretending to be zero (§6.76.3, learned once and applied without being told twice). **The closing column is the year-END balance, not twelve months summed:** a total of balances means nothing and would be the §6.19 footer mistake in a different costume.

**Strength** is current ratio, quick ratio, gearing, net debt, net assets. Every figure is **division on two lines already printed above it**, and the test says so across thirty generated plans — so a ratio can never become a second opinion on the statement it sits under.

**What is deliberately NOT here is a month-by-month balance sheet.** The monthly engine carries cash, debtors, stock and creditors; fixed assets, tax, equity and GST are annual. Twelve columns of a statement that must balance would need most of its rows invented to make them balance, and **a statement that balances because figures were invented to make it balance is worse than no statement** (§6.49). The monthly reading is the part that is genuinely monthly, and it is **labelled working capital rather than a balance sheet** — the label is part of the honesty.

## 6.78 The cash flow gets its own module, and the bridge finally has a screen (17 Sep 2026)

Last of the three to leave. **The years**, **Month by month**, and **Where the cash went**.

The third one had never existed anywhere. **The engine has computed a full profit-to-cash bridge for every year since the forecast was written, an invariant has checked it the whole time, and no screen ever showed a line of it.** A client handed a loss of 136,681 and a bank balance that went **up** has been given both figures and never the sentence joining them. It is the question every client asks about their own cash flow.

**And displaying it found a real gap in a day.** `BridgeYear` did not carry every component of its own total: `operatingCashFlow` was adding the tax credit on capital purchases and **no field held it.** Nothing caught it, because the invariant compares that total against the cash flow's total and **both were computed** — the PARTS were never added up by anything, because nothing ever displayed them. Two of thirty generated plans were out by 251,422 and 67,924.

*The rule this leaves, and it is the second time in two days:* **unshown output does not get checked.** A value the engine computes and no screen renders has only the tests somebody remembered to write for it; the moment a screen adds them up, the gaps appear. §6.79 found the same thing again in a hard-coded tax name.

The chart draws **the adjustments and never the profit it starts from** — on BNE the profit is six times the largest adjustment, so on one scale the start bar takes the whole chart and every line that explains anything becomes a sliver. §6.76.3, a third time.

Review forecast keeps step 13. `?area=cash` redirects, as `?area=pnl` and `?area=balance` already did: **an old link lands where the thing it asked for actually went**, which is not the same as falling back to something plausible.

## 6.79 Assumptions moves to the menu item that was already pointing at it (17 Sep 2026)

Nic: "we have a menu item called Assumptions under item 12, and another one in 13 Review forecast. I prefer the position under item 12."

**§6.43.1 made this argument and then half-acted on it.** The days are an input — a thing the client types — so the NAME moved up to Financials with the rest of the inputs. **The grid stayed behind** as a tab on Review forecast and the menu item became a deep link into it, so **one screen answered to two menu items in two different groups.** Once the three statements left, what remained was a module called "Checks & assumptions": **two unrelated jobs sharing a tab because of where the code happened to live.**

The grid moves to the name. Assumptions still runs the forecast — not to show a statement, but so each day can say **what it is worth**: 46 debtor days against this revenue is 275,022 sitting in debtors, and **that figure is the reason anybody ever changes the number above it.**

**And Review forecast goes back to being one thing.** The check had never been shown. **A hundred and one checks run on BNE** — the balance sheet balancing, profit explaining the cash, cash agreeing with the balance sheet, each year opening where the last closed, sixteen monthly lines adding to their own year, in all five years — and a client saw **one green strip.**

That is the right thing to say **first**. It is not the only thing worth saying: **a check nobody can inspect is a check nobody can trust**, and a lender asking "what did you verify" deserves an answer longer than a tick. Twenty rows, five years across each, a tick where the figures agreed and the distance where they did not.

`Invariant` carries `group` and `row` rather than the screen recovering them by **splitting a sentence on an em dash** — which works right up until somebody edits the sentence. A year with no invariant for a row renders as **nothing, never as a tick**: "not tested" and "tested and fine" are different answers, and a table that draws them the same is telling the reader something it does not know.

**And a fault that existed only because nothing displayed it.** The monthly check row was hard-coded `"GST paid over"`. **An engine has no business knowing it is Australian.** It emits "Sales tax paid over" and the screen substitutes the plan's own name, so a British plan is not shown a check about a tax it does not have. §6.78's rule, confirmed the same day it was written.

## 6.80 The numbers run down the page (17 Sep 2026)

Nic, in front of a client: "13 is six menu items away from 12 ... the What-If planner seems to be an activity and not a report but it has no number ... 15 is Business plan and I can't see a 14."

**Three observations, one fault.** The sidebar was doing two jobs that had quietly stopped agreeing — a **topic map** (Market, Financials, Forecasts) and a **numbered journey.** They used to roughly coincide. §6.76 to §6.78 put three new modules into the Forecasts group and finished off what was left: 13 ended up six items below 12, and **14 sat ABOVE 6**, because Goals is filed next to SWOT for topical reasons while being the last thing the plan drafts.

**A number is only a guide if the next one is the next thing down.** They were not, so they had stopped being navigation and become decoration.

The journey wins the ordering; the topics keep the grouping within it. **Nothing is renumbered** — every step keeps its number and only its position moves, so the Save-and-continue chain is untouched. Below the path, in their own groups: the four statements, the What-If planner, the unbuilt, the settings.

SWOT gets its own heading, **"Strengths & Risks"**. It shared "Goals" with Goals, and those two are steps 5 and 14 — **one heading holding the fifth step and the fourteenth was the single place where the two orders tore.**

What-If moves to **Tools**. Nic had it exactly: it is an **activity**, not a step and not an output, and it sat in the group where a client TYPES things while being the one screen that needs a forecast to already exist.

Assumptions stays directly under item 12 (§6.79) and is now the **last item in its group** rather than a gap in the middle of a run. **An unnumbered item at the end of a group reads as "and also this"; the same item between 12 and 13 reads as a step you have somehow missed.**

*The cost, accepted openly:* the four statements are the screens a client opens most and they now sit below the path. Cheaper than four unnumbered items back in the middle of the journey.

`nav.test.ts` **locks the rule rather than trusting the next person to remember it**: numbers in order top to bottom, none skipped or repeated, no unnumbered item between two numbered ones.

## 6.81 The guided path is defined once, and it was already broken (17 Sep 2026)

The order lived in two places: step numbers in `nav.ts`, and a hard-coded module name inside each of thirteen "Save and continue" redirects. Nothing compared them. **§6.80 flagged the risk as a thing that COULD drift.**

**It already had, in two places, and both were live.**

**Marketing sent a client past Competitors.** Step 3's redirect said `swot`, which is step 5. Anybody following the guided path — **the mode every client starts in** — skipped step 4 entirely and was never shown it again. *Back* worked, because Competitors' own `prevId` was right, so **the two halves of one journey disagreed about whether step 4 existed.** There is no telling how long it had been there.

**And step 13 was a dead end.** Review forecast rendered a form with no action on it, so "Save and continue" submitted nothing and went nowhere: **a client could not reach Goals from the screen before it.** That screen writes nothing now (§6.79), so it gets `ModuleReadOnlyFooter` — same three positions, "Nothing to save on this screen", and forward is a link.

The fix is the one this project keeps making (§6.41): **the number is the fact, and everything else asks it.** `stepAfter`, `stepBefore`, `nextHref`, `backHref`. Thirteen redirects and thirteen `prevId` props are gone — a footer takes its **own** id and works out both directions. The test **walks the whole path forwards, then backwards**, and fails on the Marketing skip if anyone reintroduces it.

Also, five `\uXXXX` escapes rendering as **literal text** in Marketing — two in JSX text, three in JSX attribute strings. **JSX is not JavaScript and neither position processes the escape.** Same fault as §6.76's "Open Break-Even →", sitting in copy a client reads at step 3.

## 6.82 Plan settings goes first, and starts counting (17 Sep 2026)

Nic: "Plan settings is critical, and being right at the bottom of the left-hand menu its sure to be never seen. Most people start at the top. They can do all the numbers and then print the plan and never see it."

**Right, and worse than buried: it is UPSTREAM of every step rather than beside them.** The country decides the sales tax and what it is called; the financial year end decides **every month column in the product**; the customer and product words change the labels on Sales, COGS, Break-Even and the profit and loss. Unset, they default to 30 June and 25% with no GST — **defaults that are PLAUSIBLE, which is exactly what makes them dangerous.** A client in Britain gets an Australian financial year and a tax rate nobody chose, and nothing on screen says so.

So it sits directly under Dashboard, above step 1, under **"Set up"**. It carries no number and should not: **it is not a step in the story a plan tells, it is what you set before the story starts.** The §6.80 rule holds — unnumbered, in a group of its own with no numbers in it.

**And it counts now, which is the half that actually protects a client.** Business name, industry, country and legal structure are the app's own definition of what a report cannot open without (`PROFILE_REQUIRED`), and **none of them were counted** — a plan could read 94% complete while the thing the whole exercise produces could not be printed. **§6.57 in a new place.**

*The near-miss, written down because it is the more useful half.* The first version added all four fields to the existing `plan_settings` select — and `business_name` is on `plans`. **Selecting a column a table does not have errors the WHOLE query, and that query swallows its error into `null`**, so four unrelated sections silently zeroed and the plan fell to 81%. Plan settings 0/4, and Review forecast 0/1 because `assumptionsSet` reads the same row.

**`tsc`, eslint and 541 tests all passed. The dashboard showed it in three seconds.** That is the same lesson as §6.78 and §6.81 — **unshown output does not get checked, and reasoning about whether something is wrong is not the same as looking at it.** Three times in two days, which is enough for it to be a rule rather than an anecdote.
