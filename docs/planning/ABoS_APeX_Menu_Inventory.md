# ABoS / APeX — Left Menu & Sub-Tab Inventory

Source: https://abos-26-may-2026.vercel.app (logged-in dashboard, crawled 4 Sep 2026)
Companion: `SaaS_Requirements.md` records decisions and requirements for the new build.
Purpose: reference map of every left-menu item, its sub-tabs, and the fields/tables each one holds — the starting point for the public SaaS build.

Left menu = Plan Dashboard + 4 groups (Foundations 7, Financials 6, Forecasts 5, Strategies 6) = 25 items. Sub-tabs are Radix tab strips inside each page; most map to their own URL.

---

## Plan Dashboard — `/annual-plan`

| Sub-tab | URL | What it holds |
|---|---|---|
| Historic | `/annual-plan/historic` | Financial Dashboard built from historical data. 16 KPI cards in 4 groups: **Big Picture** (Net Profit, Revenue Growth, Net Profit Margin, Gross Profit Margin); **Liquidity & Cash Flow** (Cash Balance, Working Capital, Current Ratio, Cash Ratio); **Leverage & Solvency** (Debt-to-Equity, Interest Coverage, Operating Cash Flow Ratio, Return on Assets); **Operational Efficiency** (Debtor Days, A/R Turnover, Inventory Days, Creditor Days). Plus Revenue & Profit Trends chart (4 periods), Financial Summary table (Revenue → Equity, Periods 1–4), Strategic Initiatives list. Button: *Financial Situation Report*. |
| Projected | `/annual-plan/projected` | Same dashboard shell driven off the forecast; Strategic Initiatives. |
| 7 Key Drivers | `/annual-plan/optimize` | Scenario tool: "Turn 1% changes into a visible cash flow strategy". Sliders for Price Change, Volume Change, COGS Change, Overheads Change, Debtor Days, Stock Days, Creditor Days (Annual / Quarterly Average toggle, per-product / per-item scoping, Reset). Outputs: Current vs Adjusted Net Cash Flow & EBIT, Cash Flow / EBIT Opportunity, Key Insights (greatest cash lever, fastest EBIT lever, working-capital priority), Year 1 Baseline/Adjusted/Variance table (P&L + Working Capital & Cash Flow), Cash Flow Opportunity Map. Buttons: *Client Report, Load Scenario, Save Scenario*. |

---

## FOUNDATIONS

### Plan Settings — `/plan-settings` (single page, 62 inputs)
- **Business Information**: Date Established, Industry Name, Main Country of Operation, Legal Structure, Products & Services Statement
- **Financial Configuration**: Financial Year End (month), First Projected Year, Months Projecting, Tax Rate %, Dividend %, Currency
- **Working Capital Assumptions** (Historical + Year 1–5 grid, "Use historical for all years", "Copy Year 1"): Debtor Days, Inventory Days, Creditor Days
- **Cash Flow & Investing Assumptions**: Opening Tax Payable; *Operating cash timing* (Current-Year Tax Paid %, Prepaid Expenses closing balance, Accrued Liabilities closing balance × 5 yrs); *Investing cash assumptions* (Maintenance/Replacement CapEx, CapEx Useful Life, Asset Disposal Proceeds, Disposed Asset Book Value × 5 yrs); "Reset forecast assumptions"
- **Business Classification**: Type of Customer, Type of Product
- **Customer Economics**: Customer Acquisition Cost, Monthly Churn Rate %
- **Branding**: logo upload / replace
- Button: *Save Settings*

### Business Details — `/business`
| Sub-tab | URL | Fields |
|---|---|---|
| Framework | `/business/framework` | Vision Statement, Mission Statement, Purpose Statement, Brand Promise, AI Direction Statement, Field of Play – Strategic Focus. *Save Framework* |
| Outcomes | `/business/outcomes` | 1st-Year outcomes for Financial, Management, Marketing, Sales, Operational, AI. *Save Outcomes* |
| Outlets | `/business/outlets` | Card list — name, address, description/function. *Add Outlet* |
| Social Media | `/business/social` | Card list — platform, description, URL. *Add Social Media* |
| Membership | `/business/membership` | Card list — organisation name, description. *Add Membership* |
| Intellectual Property | `/business/ip` | Card list — name, type (e.g. Patent), description. *Add Intellectual Property* |
| Capital Equipment | `/business/equipment` | Card list — item, value. *Add Capital Equipment* |

### Key People — `/owners`
| Sub-tab | URL | Columns |
|---|---|---|
| Key People List | `/owners/list` | Name, Position, % Time in Sales, % Shareholding, Annual Salary. *Add Key Person* |
| Salaries | `/owners/salaries` | Key Person Name, Year 1–5 |
| Productivity | `/owners/productivity` | Name, Position, Productivity Level, Comments |
| Duties | `/owners/duties` | Name, Position, Duties |
| Qualities | `/owners/qualities` | Name, Position, Qualities |
| Education | `/owners/education` | Name, Position, Education |
| Focus | `/owners/focus` | Name, Position, Focus Areas |

### Marketing — `/marketing`
| Sub-tab | URL | Fields |
|---|---|---|
| Market Research | `/marketing/analysis` | Target Market, Market Size, Market Trends, Customer Needs, Competitive Analysis (+ *Add Competitor*). *Save Market Research / Save All* |
| Distribution | `/marketing/distribution` | Table: Distribution Channel, Cost. *Add Channel* |
| Promotion | `/marketing/promotion` | Six blocks each with Approach + Estimated Budget: Advertising, Content Marketing, Sales Promotions, Public Relations, Partnerships & Referrals, Customer Retention & Loyalty. *Save Promotion Strategy* |
| Branding | `/marketing/branding` | Brand Purpose & Vision, Brand Values, Brand Personality, Visual Identity. *Save Brand Strategy* |
| Research | `/marketing/research` | Research Goals (Topic, Methodology), Research Findings (Key Findings, Recommendations). *Save Research Information* |
| Action Plan | `/marketing/action-plan` | Card list of action items (title + detail). *Add Action Item* |
| Budget | `/marketing/budget` | Roll-up table: Item Title, Type, Estimated Cost (read-only, aggregated from Distribution + Promotion). |

### Goals — `/goals` (single page)
Table: Goal, Category, Year, Quarter, Historic Milestone. *Add Goal*

### SWOT — `/swot` (single page)
Four quadrants: Strengths, Weaknesses, Opportunities, Threats — each with *Add*.

### Competitors — `/competing` (single page)
Card list of competitors (name + profile). *Add Competitor*

---

## FINANCIALS

### Sales — `/sales`
| Sub-tab | URL | Columns |
|---|---|---|
| Products | `/sales/products` | Product, Average Price, Units Sold, Annual Sales. *Edit* |
| Annual Projections | `/sales/annual` | Product, Starting Sales (Current), Year 1–5. *Edit Growth Rates, Monthly Distribution* |
| Monthly Projections | `/sales/monthly` | Product × Jan–Dec + Total; per-product "Edit monthly distribution" |
| Charts | `/sales/charts` | Sales Growth Chart |

### COGS — `/cogs`
| Sub-tab | URL | Columns |
|---|---|---|
| COGS Variable | `/cogs/variable` | Product, Current COGS, Projected Gross Profit, Margin, Year 1–5. *View Cost Details, Edit* |
| COGS Fixed | `/cogs/fixed` | Name, Current, Year 1–5. *Edit* |
| COGS Combined | `/cogs/combined` | Type, Current, Year 1–5 |
| COGS Monthly | `/cogs/monthly` | Name × Jan–Dec + Total (Year 1) |
| Charts | `/cogs/charts` | COGS and Profitability Charts |

### Overheads — `/expenses`
| Sub-tab | URL | Columns |
|---|---|---|
| Annual Projections | `/expenses/annual` | Overhead Expense, Current, Year 1–5 Projected. *+ Add Expense* |
| Monthly Projections | `/expenses/monthly` | Expense × Jan–Dec |
| Charts | `/expenses/charts` | Expenses Chart |

### Funding — `/funding`
| Sub-tab | URL | Columns |
|---|---|---|
| Owner Funding | `/funding/owner` | Type, Amount, Date Injected, Interest Rate %, Term (months) |
| Debt | `/funding/debt` | Lender, Loan Type, Amount/Drawn, Rate %, Term, Repayment, Frequency, Residual, Start Date |
| Equity Investment | `/funding/equity` | Investor, Amount, Date, Equity %, Pre-Money Val., Dividends + **Cap Table Summary** |
| Grants | `/funding/grants` | Grant Name, Amount, Date Received, Conditions, Recognition, Period (mo) |
| Revenue-Linked | `/funding/revenue` | Provider, Principal, Cap Multiple, Total Repayment, Revenue Share %, Min. Payment, Start Date + **RBF Summary** |
All tabs: *Add Funding*

### Extraordinary — `/extraordinary` (single page)
Table: Description, Category, Month, Year, Amount. Totals for Extraordinary Income / Expense. *Add Item*

### Historic — `/historical`
| Sub-tab | What it holds |
|---|---|
| Input Form | 4-period grid (133 inputs). **General**: Period End, Period Length. **P&L**: Revenue, Cost of Goods, Gross Margin, Overheads, Depreciation/Amortisation, Operating Profit, Extraordinary Income/Expenses, Interest Paid, Net Profit Before Tax, Tax Paid, Net Profit, Dividends Paid, Retained Profit. **Balance Sheet**: Cash, Accounts Receivable, Inventory, Other Current Assets, Current Assets, Fixed Assets, Other Non Current Assets, Non Current Assets, Total Assets, Accounts Payable, Bank Loans – Current, Other Current Liabilities, Current Liabilities, Bank Loans – Non Current, Other Non Current Liabilities, Non Current Liabilities, Total Liabilities, Equity. Buttons: *Calculate Results, Upload Excel* |
| Charts | Operating Profit bar chart + movement table (Revenue, Gross Margin %, Operating Profit %, Net Profit %) |

---

## FORECASTS (all read-only outputs of the shared 5-year forecast engine; PDF/Excel download + inline Help)

| Item | URL | Contents |
|---|---|---|
| Break-Even | `/forecasts/break-even` | Tabs: **Annual (5 Year)**, **Year 1 — Monthly**. KPI cards (Break-Even Revenue, Break-Even Units, Margin of Safety, Contribution Margin %). Charts: Revenue vs Total Costs, Cost Structure Breakdown, Cumulative Revenue vs Costs. Table: Revenue, Units Sold, ASP, Variable Costs, Variable Cost/Unit, Fixed COGS, Overheads, Depreciation, Interest, Total Fixed Costs, Total Costs, CM/Unit, CM %, Total CM, Break-Even Units, Break-Even Revenue, Margin of Safety %. |
| Profit & Loss | `/forecasts/profit-loss` | Revenue, Variable COGS, Fixed COGS, Total COGS, Gross Margin, Overheads, Depreciation/Amortisation, Operating Profit, Extraordinary Income/Expense, Asset Disposal Gain/(Loss), Grant Income Recognised, Interest Expense, NPBT, Tax, Net Profit, Dividends, Retained Profit. Revenue & Profit Trend chart. |
| Balance Sheet | `/forecasts/balance-sheet` | Cash, AR, Inventory, Prepaid/Other CA, Fixed Assets, Other NCA, AP, Tax Payable, Bank Loans (Current/Non-Current), Deferred Income (Current/Non-Current), Accrued/Other CL, Revenue-Linked Funding, Other NCL, Equity, Balance Check ("Balanced" badge). Charts: How the Business Is Funded, Can It Pay Short-Term Bills, Cash Cushion & Debt Pressure. |
| Cash Flow | `/forecasts/cash-flow` | Direct-method: Operating (receipts, grants, extraordinary, suppliers & employees, taxes), Investing (CapEx, disposal proceeds), Financing (owner capital/loans, debt, equity, RBF, automatic LOC draws, principal, interest, dividends), Cash Reconciliation. **Profit-to-Cash Reconciliation** table. Ending Cash & Operating Cash trend chart. "Reconciled" badge. |
| Unit Economics | `/forecasts/unit-economics` | Units/Customers, ASP/ARPU, Variable Cost/Unit, CM/Unit, CM %, Total CM, CAC, LTV, LTV:CAC, Payback Period. Charts: CM Trend, LTV vs CAC. |

---

## STRATEGIES — NOT CARRIED FORWARD

> **Decision (Nic, 4 Sep 2026):** the Strategies group will not be ported. It will be rebuilt from scratch, AI-driven (strategy recommendations generated from the plan's own financials and foundations rather than picked from a static library). The table below is kept for reference only — it documents what the old version did, not what the SaaS will do.
>
> **Open question:** *Reports* (the merge-field business plan editor) lives in this menu group but is functionally the output layer for the whole plan, not a strategy feature. Assumed to be retained and re-homed — confirm.

| Item | URL | Categories (selected/total at crawl time) |
|---|---|---|
| Dashboard Strategies | `/dashboard-strategies` | Big Picture (5), Liquidity & Cash Flow (5), Leverage & Solvency (5), Operational Efficiency (5) — mirrors the 4 KPI groups on Plan Dashboard |
| 6 Ways Profit | `/planning/six-ways-profit` | Leads (86), Conversion (99), Retention (70), Transactions (95), Average Value (74), Margins (87) ≈ 511 strategies. *View PDF* |
| 6 Ways Cash | `/planning/six-ways-cash` | Increase Prices (42), Reduce COGS (43), Reduce Debtors (35), Reduce Inventory (33), Increase Creditors (8), Reduce Overheads (55) ≈ 216 |
| 4 Ways Systems | `/planning/four-ways-systems` | People & Education (26), Delivery & Distribution (23), Testing & Measuring (31), Systems & Technology (30) ≈ 110 |
| Exponential Growth | `/planning/exponential-growth` | Two tabs: **5 Constituents** — Company (4), Customers (4), Team (6), Stakeholder (5), Community (5); **5 Disciplines** — Strategy (20), Business Development (20), People (23), Execution (22), Mission (21) ≈ 130 |
| Reports | `/reports` | **Business Plan Editor** — rich-text template editor with named templates (Rename / New Template), formatting toolbar, *Insert*, and *Merge Fields* (e.g. `{Business Name}`, `{Projected Year 1}`, `{Revenue & Profit Chart}`) that pull live plan data into the document. |

Legacy behaviour (for reference): search across categories, per-category tabs with counts, *View Selected Strategies (n)*, *Save Selected Strategies*; selections fed the To-Do / KPI tracking on the ABoS Dashboard.

---

## Outside the APeX menu (top-level `/dashboard`, "ABoS" home)
Tabs: Get Started (help hub, video library, ABoS Flow), ABoS Scorecard (Mastery, Marketing, Systems, Team, Scale, Freedom), To Dos KPIs, Weekly KPIs (Strategy Selection Progress + Implementation Progress per framework). Not part of the planning module but shares the strategy data.

---

## Observations for the SaaS version
1. **Data model is clean** — Settings → Foundations (qualitative) → Financial inputs (Sales, COGS, Overheads, Funding, Extraordinary, Historic) → one forecast engine → 5 read-only statements → Strategy libraries → Report generator. That's the spine to keep.
2. **ABoS/ActionCOACH-specific naming** (L.I.O.N.S, Frogs, Scorecard on the outer dashboard) will need renaming or licensing for public sale — the 6 Ways / 4 Ways naming goes away with the Strategies group.
3. **Multi-tenancy**: current build is single-client ("DesignOne Concreting"); SaaS needs orgs → plans → users, plus plan versioning.
4. Strategies group dropped from scope — replaced by an AI-generated strategy layer (to be specified). This also removes the strategy-library IP question.
