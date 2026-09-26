# Financial Capabilities — where every figure comes from

Written before the three tabs are rebuilt as display-only (§6.129). The three tabs are
DASHBOARDS. They read the plan. Nothing is typed on them. Where a dial needs a figure the
plan does not yet hold, that figure gets a home on the step that owns it, and the dial
carries a pencil to that home.

## 1. What the plan already holds — no new fields

| Figure | Where it already lives |
|---|---|
| Revenue, margins, operating profit, EBITDA | Forecast (P&L), years 1–5 |
| Operating cash, capex, debt repaid, interest paid | Forecast (Cash Flow) |
| Current assets/liabilities, stock, debtors, creditors, net debt | Forecast (Balance Sheet) |
| Debtor / stock / creditor days | Assumptions, step 14 |
| Twelve monthly cash balances and profits (Year 1) | Forecast monthly run |
| Existing scheduled principal + interest | Cash Flow — never re-read from the funding rows (§6.41) |
| **Committed but undrawn facility** | **Funding, step 11** — `total_facility_amount` − `amount` drawn. Already there. |
| Recurring revenue share | Sales, step 8 — products flagged recurring |
| Largest product share | Sales, step 8 |
| Leadership pay | Leadership Team → Salaries, step 2 |

## 2. Dropped — the question was wrong, not the data

**The "proposed new loan" (amount, rate, term).** Three inputs deleted. The borrowing tab
should answer *"can this plan carry the debt it has, and how much more would it stand?"* —
both of which the plan already answers. Debt service cover comes off the cash flow. Borrowing
capacity comes off earnings. A client who wants to test a *specific* new loan adds it on
Funding, or bends it in What-If, and every screen in the app moves — which is a better answer
than a number typed into a dashboard and lost on refresh.

## 3. New homes for genuinely missing figures

### Assumptions (step 14) — new area: **Cash & capital**
| Field | Why here | Default |
|---|---|---|
| Cash floor | The lowest balance the client will tolerate. An assumption about how the business is run, and the dashboard's lowest-month chart should honour it too. | 0 |
| Cost of capital % | Sets the bar the growth return must clear. | highest loan rate on Funding, else 11% |

### Assumptions (step 14) — new area: **Downside**
| Field | Default |
|---|---|
| Sales fall by % | 10 |
| Gross margin falls by points | 1.5 |
| Customers pay this many days later | 10 |

A stress case is a standing second view of the plan, not a transient experiment, so it lives
with the assumptions and can print in the funding report. What-If applies changes *to* the
plan; this never does.

### Fixed Assets (step 12) — new column: **Security value**
What a lender would actually lend against, per asset. Nullable. Loan-to-value reads
unanswerable until at least one asset has a figure — blank is not nought (§6.89).

### Plan settings — new tab: **Exit & sale**
| Field | Plain English |
|---|---|
| Asking price | What you would want for the business. Enterprise value. |
| Owner add-backs | Costs in the accounts that exist only because *this* owner runs it. |
| Comparable deals, low × | The bottom of the range businesses like this have sold for. |
| Comparable deals, high × | The top of it. |
| Intended exit year (optional) | Which forecast year the sale is aimed at. |

### Vision & Purpose (step 1) — new field 7: **Exit intention**
Prose, one paragraph: whether a sale is the plan, roughly when, and to whom — a competitor, a
manager, family. The numbers go in settings; the intention belongs with the vision.

### Leadership Team (step 2) → **Risk & Succession** — built, not Phase 2
Six ratings, 1 (weak) to 5 (strong), each with an optional note:

1. Runs without the owner
2. Customer relationships held by the team
3. Written-down processes
4. Key staff likely to stay
5. Contracts a buyer can inherit
6. Systems and records

This is key-person risk. The People help text already promises it feeds "key-person risk in
funding, SBA and sale reports". Scoring it once there and reading it on the sale tab keeps one
fact in one place.

## 4. The pencil

A dial missing its figure draws greyed with no needle and a pencil. The pencil opens a dialog
that writes to the real table on the real step — not a scratch value — and carries a link to
that step for anyone who wants the full screen. One fact, one home, two doors.

## 5. Decided (Nic, this session)

- Proposed loan: **deleted**. The borrowing tab reads the plan's own debt.
- Six ratings: **Leadership Team → Risk & Succession**, built now.
- Security: **per asset on Fixed Assets**, nullable.
- Cash floor and cost of capital: **Assumptions, new area**.

## 6. Storage

`plan_settings` already holds the working-capital schedule, so it takes the cash floor, the
cost of capital, the three downside figures and the four sale numbers — one row per plan, no
new table. `plan_framework` takes the exit-intention prose as Vision's seventh field.
`plan_fixed_assets` takes a nullable `security_value`. The six ratings need rows, not columns,
because each carries a note: `plan_transfer_ratings` (plan_id, factor, score 1–5, note), one
row per factor, with the same RLS pair as every other plan table.

## 7. Built (§6.129) — what actually shipped

All five collection points, the stripped tabs, and one thing the map did not anticipate.

| Where | What | Notes |
|---|---|---|
| Assumptions → Cash & capital | cash floor, cost of capital | hint quotes the plan's worst month and its dearest loan rate |
| Assumptions → Downside | sales −%, margin −pts, debtor days | all three or none; a partial downside is not a milder one |
| Fixed Assets, per asset | security value | nullable; editable on financed assets too |
| Plan settings → Exit & sale | price, add-backs, low ×, high ×, exit year | with the plain-English explanation of add-backs and multiples |
| Vision & Purpose, field 7 | Selling the business | prose, and the only field on that step AI will not draft |
| Leadership Team → Risk & Succession | the six judgements, with a note each | "Phase 2" tag removed; the empty per-person grid deleted |

The proposed loan was deleted. The borrowing tab reads the plan's own debt service off the cash flow, and
the undrawn facility out of the Funding rows that already record it.

## 8. What the real data caught (§6.129.1)

Putting the rebuilt screen in front of SEQ Concreting — which forecasts a loss — found five ratios that
printed a CHEERFUL answer on a business losing money. Every one is the §6.128.1 argument in a new costume:
a ratio whose denominator has gone negative does not become a small ratio, it stops being a ratio.

- **Net debt ÷ EBITDA read −1.85× · Healthy**, sailing under the "under 2.5× is good" band.
- **Operating leverage read 13.18× · "profit is growing faster than sales"** on a plan whose loss merely
  got smaller.
- **Debt service cover read −10.38×**, a negative multiple in a column of multiples.
- **Interest cover read −19.68× · "barely covers the interest"** — it does not cover it at all.
- **The selling tab scored 58 and read "Saleable, with work to do first"** on a business losing $76,000,
  because the one decisive measure was unanswerable for want of an asking price and eight tidy measures
  carried the rest. Normalised margin is now decisive too.

All five are covered by tests in `capability.test.ts`.

## 9. The panels (§6.129.2) and the four that needed new fields (§6.129.3)

| Panel | Tab | Reads |
|---|---|---|
| Cash month by month, against the floor | Grow | forecast + Assumptions |
| Cash cycle by year | Grow | Assumptions |
| Keeping it standing vs growing it | Grow | forecast |
| Where Year 2's growth comes from / margin by product | Grow | Sales + COGS per product |
| **Can the business execute it?** | Grow | Operations → Capacity (table), People (hires, worked out), Marketing → Sales process (pipeline), Marketing → Market (retention) |
| Debt cover over five years | Borrow | forecast + Assumptions → Downside |
| Cash available against repayments | Borrow | forecast |
| **How overdue are the invoices?** | Borrow | Historic → Balance sheet (ageing, latest year) |
| **What the lender checks beyond the numbers** | Borrow | Plan settings (years trading), People (tenure), Historic (last year), Fixed Assets (security), Marketing (customers), Funding → Lender history |
| The borrowing the plan carries | Borrow | Funding + opening bank debt from Historic |
| Revenue / margins over five years | Sell | forecast |
| Would it survive a change of owner? | Sell | People → Risk & Succession |
| Revenue by product | Sell | Sales |
| **Who the customers are** | Sell | Marketing → Market (largest customers) |
| **From reported to normalised earnings** | Sell | Plan settings → Exit & sale (add-backs, itemised) |
| Questions a buyer will ask | Sell | rules over the weak measures, customers and ratings |

Every panel is display only. An unanswered line draws greyed with a pencil to its box; it never carries a
status. Migration 0049 moved each plan's single add-backs total into the list as its first line before
dropping the old column.
