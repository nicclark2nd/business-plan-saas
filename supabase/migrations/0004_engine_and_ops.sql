-- 0004: engine output cache, scenarios, actuals (phase 2 ready), versions, reports, AI metering, audit

create table plan_forecast_cache (
  plan_id        uuid primary key references plans(id) on delete cascade,
  model_version  int not null,
  input_hash     text not null,
  result         jsonb not null,
  computed_at    timestamptz not null default now()
);

create table plan_scenarios (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references plans(id) on delete cascade,
  name           text not null,
  levers         jsonb not null,               -- {price, volume, cogs, overheads, debtorDays, stockDays, creditorDays, scope}
  result_summary jsonb,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Plan Check-in (phase 2). Present from day one so it is a feature flag, not a migration.
create type actual_line as enum ('revenue','cogs','overheads','net_profit','cash','debtors','creditors','inventory');
create table plan_actuals (
  plan_id     uuid not null references plans(id) on delete cascade,
  line        actual_line not null,
  year        int not null,
  month       int not null check (month between 1 and 12),
  amount      numeric(14,2) not null,
  entered_by  uuid references auth.users(id),
  entered_at  timestamptz not null default now(),
  primary key (plan_id, line, year, month)
);

create type version_reason as enum ('manual','whatif_apply','report','annual');
create table plan_versions (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  label       text,
  reason      version_reason not null default 'manual',
  snapshot    jsonb not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create type report_template_kind as enum ('bank','government_loan','self_employment','investor','internal');
create table report_templates (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,   -- null = global template
  kind            report_template_kind not null,
  country         text,                                                  -- null = generic format
  name            text not null,
  sections        jsonb not null,                                        -- ordered [{key, title, included}]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create table plan_reports (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references plans(id) on delete cascade,
  template_kind  report_template_kind not null,
  country_format text,
  sections       jsonb not null,
  storage_path   text,                                                   -- Supabase Storage object
  generated_by   uuid references auth.users(id),
  generated_at   timestamptz not null default now()
);

create table ai_calls (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid references plans(id) on delete set null,
  organisation_id   uuid references organisations(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  purpose           text not null,       -- goals_draft | insight | suggest | field_hint | report_section ...
  model             text not null,
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  cost_usd          numeric(10,6) not null default 0,
  created_at        timestamptz not null default now()
);
create index on ai_calls (plan_id, created_at);
create index on ai_calls (organisation_id, created_at);

create table audit_log (
  id          bigserial primary key,
  plan_id     uuid references plans(id) on delete cascade,
  user_id     uuid,
  table_name  text not null,
  row_id      text,
  action      text not null,             -- insert | update | delete
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log (plan_id, created_at);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['plan_forecast_cache','plan_scenarios','plan_actuals','plan_versions','plan_reports'] loop
    if t not in ('plan_forecast_cache') then
      execute format('create index if not exists %I on %I (plan_id)', t || '_plan_idx', t);
    end if;
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
create trigger plan_scenarios_updated before update on plan_scenarios for each row execute function set_updated_at();

alter table report_templates enable row level security;
create policy "templates read"  on report_templates for select using (organisation_id is null or is_org_member(organisation_id));
create policy "templates write" on report_templates for all using (organisation_id is not null and is_org_advisor(organisation_id))
  with check (organisation_id is not null and is_org_advisor(organisation_id));

alter table ai_calls enable row level security;
create policy "ai calls read" on ai_calls for select using (plan_id is not null and can_read_plan(plan_id));
-- inserts happen server-side with the service role only

alter table audit_log enable row level security;
create policy "audit read" on audit_log for select using (plan_id is not null and can_read_plan(plan_id));

-- Global report templates (sections mirror the validated mockup)
insert into report_templates (kind, country, name, sections) values
('bank', null, 'Bank or lender', '[
 {"key":"executive_summary","title":"Executive summary","included":true},
 {"key":"business_overview","title":"Business overview","included":true},
 {"key":"people","title":"Ownership & key people","included":true},
 {"key":"products","title":"Products & services","included":true},
 {"key":"market","title":"Market & competitors","included":true},
 {"key":"marketing","title":"Marketing plan","included":true},
 {"key":"operations","title":"Operations & assets","included":true},
 {"key":"swot","title":"SWOT","included":true},
 {"key":"goals","title":"Goals & milestones","included":true},
 {"key":"historic","title":"Historic financials","included":true},
 {"key":"funding","title":"Funding request & security","included":true},
 {"key":"pnl","title":"5-year P&L","included":true},
 {"key":"cashflow","title":"Cash flow & serviceability","included":true},
 {"key":"balance_sheet","title":"Balance sheet","included":true},
 {"key":"unit_economics","title":"Unit economics","included":false},
 {"key":"cap_table","title":"Cap table","included":false},
 {"key":"mentor_signoff","title":"Mentor sign-off","included":false}]'),
('government_loan', null, 'Government loan application', '[
 {"key":"executive_summary","title":"Executive summary","included":true},
 {"key":"business_overview","title":"Company description","included":true},
 {"key":"market","title":"Market analysis","included":true},
 {"key":"people","title":"Organisation & management","included":true},
 {"key":"products","title":"Service or product line","included":true},
 {"key":"marketing","title":"Marketing & sales","included":true},
 {"key":"funding","title":"Funding request","included":true},
 {"key":"pnl","title":"Financial projections (3-year)","included":true},
 {"key":"cashflow_monthly","title":"Monthly Year 1 cash flow","included":true},
 {"key":"historic","title":"Historic financials","included":true},
 {"key":"balance_sheet","title":"Balance sheet","included":true},
 {"key":"appendix","title":"Appendix","included":true},
 {"key":"swot","title":"SWOT","included":false},
 {"key":"goals","title":"Goals & milestones","included":false},
 {"key":"unit_economics","title":"Unit economics","included":false},
 {"key":"cap_table","title":"Cap table","included":false},
 {"key":"mentor_signoff","title":"Mentor sign-off","included":false}]'),
('self_employment', null, 'Self-Employment Assistance', '[
 {"key":"executive_summary","title":"Business idea & summary","included":true},
 {"key":"people","title":"About the owner","included":true},
 {"key":"products","title":"Products & services","included":true},
 {"key":"market","title":"Target market","included":true},
 {"key":"competitors","title":"Competitors","included":true},
 {"key":"marketing","title":"Marketing plan","included":true},
 {"key":"operations","title":"Operations & location","included":true},
 {"key":"swot","title":"SWOT","included":true},
 {"key":"goals","title":"Goals — first 12 months","included":true},
 {"key":"funding","title":"Start-up costs & funding","included":true},
 {"key":"cashflow_monthly","title":"12-month cash flow","included":true},
 {"key":"mentor_signoff","title":"Mentor sign-off","included":true},
 {"key":"pnl","title":"5-year P&L","included":false},
 {"key":"balance_sheet","title":"Balance sheet","included":false},
 {"key":"unit_economics","title":"Unit economics","included":false},
 {"key":"cap_table","title":"Cap table","included":false},
 {"key":"historic","title":"Historic financials","included":false}]'),
('investor', null, 'Investor pack', '[
 {"key":"executive_summary","title":"Executive summary","included":true},
 {"key":"opportunity","title":"The opportunity","included":true},
 {"key":"unit_economics","title":"Products & unit economics","included":true},
 {"key":"market","title":"Market & competitors","included":true},
 {"key":"growth","title":"Growth strategy","included":true},
 {"key":"people","title":"Team","included":true},
 {"key":"historic","title":"Traction & historic financials","included":true},
 {"key":"pnl","title":"5-year P&L","included":true},
 {"key":"cashflow","title":"Cash flow","included":true},
 {"key":"balance_sheet","title":"Balance sheet","included":true},
 {"key":"use_of_funds","title":"Use of funds","included":true},
 {"key":"cap_table","title":"Cap table & terms","included":true},
 {"key":"swot","title":"Risks & SWOT","included":true},
 {"key":"mentor_signoff","title":"Mentor sign-off","included":false},
 {"key":"marketing","title":"Marketing plan","included":false},
 {"key":"goals","title":"Goals & milestones","included":false},
 {"key":"operations","title":"Operations & assets","included":false}]');
