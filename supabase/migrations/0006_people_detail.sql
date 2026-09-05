-- 0006: Key People to APeX depth — split name, salary schedule, six-level productivity,
-- and four per-person lists (duties, qualities, education, focus) as real tables.

alter table plan_people
  add column first_name text,
  add column last_name  text,
  add column salary_start_year int not null default 1 check (salary_start_year between 1 and 5),
  -- {"1": -50, "2": 2, "3": 2, "4": 2, "5": 2} — % change applied to annual_salary year on year
  add column salary_adjustments jsonb not null default '{}'::jsonb,
  drop column pct_time_in_sales,
  drop column salary_by_year,
  drop column duties,
  drop column qualities,
  drop column education,
  drop column focus_areas;

-- carry existing single-field names across, then make name a derived convenience
update plan_people set first_name = split_part(name, ' ', 1),
                       last_name  = nullif(trim(substr(name, length(split_part(name, ' ', 1)) + 1)), '')
  where first_name is null;
alter table plan_people drop column name;
alter table plan_people add column name text generated always as (trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) stored;
alter table plan_people alter column first_name set not null;
alter table plan_people alter column first_name set default '';

-- productivity: APeX six-level scale stored as text label ("1 - Avoiding" … "6 - Inspired Work"); comments column exists

-- tenant-boundary anchor for child tables
alter table plan_people add constraint plan_people_id_plan unique (id, plan_id);

create table plan_people_duties (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  person_id  uuid not null,
  duty       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (person_id, plan_id) references plan_people(id, plan_id) on delete cascade
);

create type quality_kind as enum ('skill','strength','development','expertise','certification');
create table plan_people_qualities (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  person_id   uuid not null,
  kind        quality_kind not null default 'skill',
  description text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (person_id, plan_id) references plan_people(id, plan_id) on delete cascade
);

create type education_kind as enum ('degree','certification','training','course','workshop','seminar','conference');
create table plan_people_education (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references plans(id) on delete cascade,
  person_id      uuid not null,
  kind           education_kind not null default 'course',
  institution    text not null,
  year_completed text,
  description    text,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (person_id, plan_id) references plan_people(id, plan_id) on delete cascade
);

create type focus_priority as enum ('high','medium','low');
create table plan_people_focus (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  person_id   uuid not null,
  focus_area  text not null,
  description text,
  priority    focus_priority not null default 'medium',
  target_date date,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (person_id, plan_id) references plan_people(id, plan_id) on delete cascade
);

do $$
declare t text;
begin
  foreach t in array array['plan_people_duties','plan_people_qualities','plan_people_education','plan_people_focus'] loop
    execute format('create index %I on %I (person_id)', t || '_person_idx', t);
    execute format('create index %I on %I (plan_id)', t || '_plan_idx', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_updated', t);
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
