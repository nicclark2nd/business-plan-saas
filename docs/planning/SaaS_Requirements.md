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
