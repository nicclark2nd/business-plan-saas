# Data Model — Supabase / Postgres

Designed 4 Sep 2026 from `ABoS_APeX_Menu_Inventory.md`, `SaaS_Requirements.md` and the APeX engine types
(`SalesTypes`, `CogsTypes`, `FundingTypes`, `FinancialTypes`). Every plan-level table is keyed by `plan_id`,
never `user_id` — the single biggest change from APeX, and what makes the product multi-tenant.

## Principles
1. **Tenancy first.** `organisations → cohorts (optional) → plans → plan_members`. A solo owner is an organisation of one.
2. **Row-level security on every table.** Access is derived from `plan_members` (per plan) and `organisation_members` (per org). Two helper functions, `can_read_plan(plan_id)` and `can_write_plan(plan_id)`, are the only policy logic.
3. **Engine-shaped columns.** Financial tables mirror the engine's TypeScript interfaces so the port is a column-to-field mapping.
4. **JSONB where the engine already uses maps.** Year-by-year growth (`{1: {price, units}, …}`) and month distributions (`{jan: 8.3, …}`) are stored as JSONB, validated in the app, exactly as the engine consumes them.
5. **Actuals-ready, not actuals-built.** One table, `plan_actuals`, keyed `(plan_id, line, year, month)`, exists from day one so Plan Check-in (phase 2) is a feature flag, not a migration.
6. **Versioning by snapshot.** `plan_versions` stores a full JSONB snapshot of a plan on demand (before "Make this the plan", at annual re-plan, on report generation). Cheap, simple, sufficient for v1.
7. **AI usage metered.** `ai_calls` logs every model call against a plan with token cost, so credits (later) are a pricing decision.

## Tenancy & identity

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One row per `auth.users` — display name, avatar, default org, interface mode (guided/advanced) | `id (= auth.users.id)`, `full_name`, `mode` |
| `organisations` | The paying entity: an owner's business, a coach, a consultancy, an accounting firm | `id`, `name`, `kind` (owner/coach/consultant/accounting_firm), `branding` jsonb, `country`, `currency` |
| `organisation_members` | Who belongs to an org | `organisation_id`, `user_id`, `role` (admin/advisor/member) |
| `cohorts` | A workshop or programme group inside an org | `id`, `organisation_id`, `name`, `starts_on`, `ends_on` |
| `plans` | A business plan. The root of everything below | `id`, `organisation_id`, `cohort_id?`, `business_name`, `status` (draft/active/complete/archived), `plan_year`, `created_by` |
| `plan_members` | Who can see/edit a plan | `plan_id`, `user_id`, `role` (owner/advisor/viewer), `can_generate_reports` (the legacy "client can print" toggle) |
| `plan_invitations` | Advisor invites an owner (replaces legacy client ID + access code) | `plan_id`, `email`, `role`, `token`, `accepted_at` |

## Plan configuration (Plan Settings)

`plan_settings` — one row per plan. Business info (`date_established`, `industry`, `country`, `legal_structure`, `products_services_statement`), financial config (`financial_year_end_month`, `first_projected_year`, `months_projecting`, `tax_rate`, `dividend_rate`, `currency`, `opening_tax_payable`), classification (`customer_type`, `product_type`), customer economics (`customer_acquisition_cost`, `monthly_churn_rate`), and the per-year assumption grids as JSONB in the engine's shape: `working_capital_schedule` (debtor/inventory/creditor days by year), `cash_flow_assumptions` (tax paid %, prepaid and accrued balances, maintenance CapEx, CapEx life, disposal proceeds, disposed book value — by year).

## Strategy & Direction, Assets, People, Market, Goals

| Table | Notes |
|---|---|
| `plan_framework` | One row: `vision`, `mission`, `purpose`, `brand_promise`, `ai_direction`, `field_of_play` |
| `plan_outlets`, `plan_social_media`, `plan_memberships`, `plan_ip`, `plan_capital_equipment` | Simple registers; descriptive only (no financial effect) |
| `plan_people` | `name`, `position`, `pct_time_in_sales`, `pct_shareholding`, `annual_salary`, `salary_by_year` jsonb, `productivity_level`, `productivity_comments`, `duties`, `qualities`, `education`, `focus_areas` — one row per person, the seven APeX tabs become columns |
| `plan_marketing` | One row: market research (`target_market`, `market_size`, `market_trends`, `customer_needs`, `competitive_analysis`), research (`research_topic`, `methodology`, `key_findings`, `recommendations`), branding (`brand_purpose`, `brand_values`, `brand_personality`, `visual_identity`) |
| `plan_promotion_items` | Six fixed kinds (advertising, content, sales_promotions, pr, partnerships, retention): `kind`, `approach`, `estimated_budget` |
| `plan_distribution_channels` | `channel`, `cost` |
| `plan_marketing_actions` | `title`, `detail`, `sort_order` |
| `plan_competitors` | `name`, `profile` |
| `plan_swot_items` | `quadrant` (strength/weakness/opportunity/threat), `text` |
| `plan_goals` | Two-level: `parent_id` null = **annual goal** (one per `area`: financial/management/marketing/sales/operational/ai); child rows = **quarterly goals** with `quarter`, `owner_user_id`, `status`, `milestone_date`, `source` (manual/ai/whatif) |

## Financials (engine inputs)

| Table | Mirrors | Key columns |
|---|---|---|
| `plan_products` | `Product` | `name`, `average_price`, `units_sold`, `cost_per_unit`, `start_selling_year`, `yearly_growth` jsonb `{year: {price, units}}`, `yearly_cost_increase` jsonb, `monthly_distribution` jsonb |
| `plan_fixed_cogs` | `FixedCogs` | `item_name`, `annual_cost`, `yearly_growth_rates` jsonb, `monthly_distribution` jsonb |
| `plan_overheads` | expenses | `name`, `current_value`, `yearly_change` jsonb, `monthly_distribution` jsonb |
| `plan_funding_owner` | `FundingOwner` | `funding_type`, `amount`, `date_injected`, `interest_rate`, `repayment_term_months` |
| `plan_funding_debt` | `FundingDebt` | all engine fields incl. `draw_schedule` jsonb, asset fields (`asset_purchase_price`, `useful_life_months`, …) for equipment/vehicle finance |
| `plan_funding_equity` | `FundingEquity` | `investor_name`, `amount_invested`, `date`, `equity_percent`, `pre_money_valuation`, `dividend_policy` |
| `plan_funding_grants` | `FundingGrant` | `grant_name`, `amount_approved`, `date_received`, `has_conditions`, `recognition_type`, `recognition_period_months` |
| `plan_funding_revenue_linked` | `FundingRevenueLinked` | `provider`, `amount_received`, `repayment_percent`, `cap_multiple`, `min_monthly_payment`, `start_date` |
| `plan_extraordinary_items` | | `description`, `category` (income/expense), `month`, `year`, `amount` |
| `plan_historic_periods` | `FinancialPeriod` | `period_number` 1–4, `period_end`, `period_length`, and every P&L + balance-sheet line as numeric columns |

## Engine outputs, scenarios, actuals, versions, AI

| Table | Purpose |
|---|---|
| `plan_forecast_cache` | Latest engine output per plan as JSONB (`model_version`, `computed_at`, `input_hash`, `result`). Dashboard and Forecast pages read this; recalculated on write. |
| `plan_scenarios` | Saved What-If scenarios: `name`, `levers` jsonb, `result_summary` jsonb |
| `plan_actuals` | `(plan_id, line, year, month, amount)` — phase 2 check-ins. Lines: revenue, cogs, overheads, net_profit, cash, debtors, creditors, inventory |
| `plan_versions` | `label`, `snapshot` jsonb, `created_by`, `reason` (manual/whatif_apply/report/annual) |
| `plan_reports` | Generated documents: `template` (bank/government_loan/sea/investor/internal), `country_format`, `sections` jsonb, `storage_path`, `generated_by` |
| `report_templates` | Template definitions (sections, order, per-country format rules) — global + per-organisation overrides |
| `ai_calls` | `plan_id`, `user_id`, `purpose` (goals_draft/insight/suggest/field_hint…), `model`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `created_at` |
| `audit_log` | `plan_id`, `user_id`, `table_name`, `row_id`, `action`, `diff` jsonb — who changed what (workshop requirement) |

## Row-level security (all tables)

```
can_read_plan(p)  := exists plan_members (p, auth.uid())
                  or exists organisation_members (org of p, auth.uid()) with role in (admin, advisor)
can_write_plan(p) := exists plan_members (p, auth.uid()) with role in (owner, advisor)
                  or exists organisation_members (org of p, auth.uid()) with role in (admin, advisor)
```
Plan-level tables: `select` using `can_read_plan(plan_id)`; `insert/update/delete` using `can_write_plan(plan_id)`.
Organisation tables: members read their own org; admins write. `profiles`: users read/write their own row.
Service-role (server routes only) bypasses RLS for report generation, AI calls and invitations.

## Migration order
1. `0001_core.sql` — extensions, profiles, organisations, members, cohorts, plans, plan_members, invitations, helper functions, RLS.
2. `0002_plan_settings_and_foundations.sql` — settings, framework, registers, people, marketing, competitors, SWOT, goals.
3. `0003_financials.sql` — products, COGS, overheads, funding ×5, extraordinary, historic periods.
4. `0004_engine_and_ops.sql` — forecast cache, scenarios, actuals, versions, reports, templates, ai_calls, audit_log.
