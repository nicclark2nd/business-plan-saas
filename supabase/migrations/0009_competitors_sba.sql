-- 0009: Competitors to SBA depth (SaaS §6.13.1). Four short classifications per competitor; the moat and the horizon at plan level.
create type competitor_kind    as enum ('direct','indirect');
create type competitor_reach   as enum ('local','regional','national','online');
create type competitor_pricing as enum ('much_lower','lower','same','higher','much_higher');
create type competitor_threat  as enum ('low','medium','high','critical');

alter table plan_competitors
  add column kind    competitor_kind    not null default 'direct',
  add column reach   competitor_reach,
  add column pricing competitor_pricing,
  add column threat  competitor_threat  not null default 'medium';

-- "Positioning" on Market becomes "Our advantage" here; barriers and future threats are new.
alter table plan_marketing
  rename column positioning to our_advantage;
alter table plan_marketing
  add column barriers_to_entry text,
  add column future_threats    text;
