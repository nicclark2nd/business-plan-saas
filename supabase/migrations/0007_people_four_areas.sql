-- 0007: Key People reduced to four areas (People, Salaries, Roles & Capability, Risk & Succession).
-- See docs/planning/SaaS_Requirements.md §6.11. Supersedes the 0006 per-person lists.

-- People: legal role + start date. Salary start year is now DERIVED from started_on vs the plan's FY start.
create type person_role as enum ('owner','director','employee','contractor');

alter table plan_people
  add column role       person_role not null default 'employee',
  add column started_on date;

-- carry the old explicit start year across as a month-precision date so nothing is lost
update plan_people p
   set started_on = make_date(pl.plan_year + p.salary_start_year - 1, 1, 1)
  from plans pl
 where pl.id = p.plan_id and p.started_on is null and p.salary_start_year > 1;

alter table plan_people
  drop column salary_start_year,
  drop column productivity_level,
  drop column productivity_comments;

-- Roles & Capability: one typed list per person, replaces duties / qualities / education.
create type capability_kind as enum ('responsibility','skill','strength','expertise','licence','education','development');

create table plan_people_capabilities (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  person_id   uuid not null,
  kind        capability_kind not null default 'responsibility',
  description text not null,
  internal    boolean not null default false,   -- development areas default true (set by app); never printed externally
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (person_id, plan_id) references plan_people(id, plan_id) on delete cascade
);

-- migrate existing rows
insert into plan_people_capabilities (plan_id, person_id, kind, description, sort_order, created_at)
  select plan_id, person_id, 'responsibility', duty, sort_order, created_at from plan_people_duties;
insert into plan_people_capabilities (plan_id, person_id, kind, description, internal, sort_order, created_at)
  select plan_id, person_id,
         case kind when 'skill' then 'skill' when 'strength' then 'strength' when 'expertise' then 'expertise'
                   when 'certification' then 'licence' else 'development' end::capability_kind,
         description, kind = 'development', sort_order, created_at
    from plan_people_qualities;
insert into plan_people_capabilities (plan_id, person_id, kind, description, sort_order, created_at)
  select plan_id, person_id,
         case when kind in ('degree','course') then 'education' else 'licence' end::capability_kind,
         concat_ws(', ', nullif(description,''), nullif(institution,''), nullif(year_completed,'')),
         sort_order, created_at
    from plan_people_education;

drop table plan_people_duties;
drop table plan_people_qualities;
drop table plan_people_education;
drop table plan_people_focus;          -- 12-month focus becomes goal ownership (Goals step)
drop type quality_kind;
drop type education_kind;
drop type focus_priority;

-- Risk & Succession (phase 2 — table exists, UI later)
create type dependency_level as enum ('low','medium','high');
create type keyperson_cover  as enum ('none','quoted','insured');

create table plan_people_succession (
  plan_id              uuid not null references plans(id) on delete cascade,
  person_id            uuid not null,
  dependency           dependency_level not null default 'medium',
  successor_person_id  uuid,
  successor_external   boolean not null default false,
  cover                keyperson_cover not null default 'none',
  cover_amount         numeric(14,2),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (person_id),
  foreign key (person_id, plan_id) references plan_people(id, plan_id) on delete cascade,
  foreign key (successor_person_id, plan_id) references plan_people(id, plan_id) on delete set null (successor_person_id)
);

do $$
declare t text;
begin
  foreach t in array array['plan_people_capabilities','plan_people_succession'] loop
    execute format('create index %I on %I (plan_id)', t || '_plan_idx', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_updated', t);
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
create index plan_people_capabilities_person_idx on plan_people_capabilities (person_id);
