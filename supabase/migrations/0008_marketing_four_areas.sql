-- 0008: Marketing reduced to four areas (Market, Competitors, Channels & spend, Evidence). SaaS §6.13.
-- Branding text dropped (duplicates Vision & Purpose); Action Plan rows kept in place until Goals absorbs them.

-- Market: four narrative fields + optional positioning line. Research prose becomes an Evidence grid.
alter table plan_marketing
  add column positioning text,
  drop column competitive_analysis,
  drop column brand_purpose, drop column brand_values, drop column brand_personality, drop column visual_identity;

create table plan_marketing_evidence (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  source      text not null,          -- "Customer survey, 42 responses" / "IBISWorld report" / "Council development approvals"
  finding     text,                   -- what it showed
  occurred_on date,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
insert into plan_marketing_evidence (plan_id, source, finding, sort_order)
  select plan_id,
         concat_ws(' — ', nullif(research_topic,''), nullif(research_methodology,'')),
         concat_ws(E'\n', nullif(key_findings,''), nullif(recommendations,'')),
         0
    from plan_marketing
   where coalesce(research_topic,'') <> '' or coalesce(research_methodology,'') <> '' or coalesce(key_findings,'') <> '' or coalesce(recommendations,'') <> '';
alter table plan_marketing drop column research_topic, drop column research_methodology, drop column key_findings, drop column recommendations;

-- Competitors: a factual grid, not a profile essay.
alter table plan_competitors
  rename column profile to strengths;
alter table plan_competitors
  add column weaknesses text,
  add column how_we_win text;

-- Channels & spend: one row per channel actually used (replaces the six fixed Promotion blocks + Distribution table).
create type spend_kind as enum ('distribution','advertising','content','sales_promotion','public_relations','partnerships','retention');
create table plan_marketing_spend (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  kind          spend_kind not null default 'advertising',
  approach      text not null,
  annual_budget numeric(14,2) not null default 0,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
insert into plan_marketing_spend (plan_id, kind, approach, annual_budget, sort_order, created_at)
  select plan_id, 'distribution', channel, coalesce(cost,0), sort_order, created_at from plan_distribution_channels;
insert into plan_marketing_spend (plan_id, kind, approach, annual_budget, sort_order)
  select plan_id,
         case kind when 'advertising' then 'advertising' when 'content' then 'content' when 'sales_promotions' then 'sales_promotion'
                   when 'public_relations' then 'public_relations' when 'partnerships' then 'partnerships' else 'retention' end::spend_kind,
         coalesce(nullif(approach,''), initcap(replace(kind::text,'_',' '))), coalesce(estimated_budget,0), 0
    from plan_promotion_items
   where coalesce(approach,'') <> '' or coalesce(estimated_budget,0) <> 0;
drop table plan_promotion_items;
drop table plan_distribution_channels;
drop type promotion_kind;

do $$
declare t text;
begin
  foreach t in array array['plan_marketing_evidence','plan_marketing_spend'] loop
    execute format('create index %I on %I (plan_id)', t || '_plan_idx', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_updated', t);
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
