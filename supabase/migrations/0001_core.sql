-- 0001_core: tenancy, identity, plans, membership, RLS helpers
-- Every plan-level table in later migrations is keyed by plan_id and protected by can_read_plan / can_write_plan.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type organisation_kind as enum ('owner', 'coach', 'consultant', 'accounting_firm');
create type org_role          as enum ('admin', 'advisor', 'member');
create type plan_role         as enum ('owner', 'advisor', 'viewer');
create type plan_status       as enum ('draft', 'active', 'complete', 'archived');
create type interface_mode    as enum ('guided', 'advanced');

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  mode        interface_mode not null default 'guided',
  default_organisation_id uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- create a profile row automatically on signup
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- organisations ----------
create table organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        organisation_kind not null default 'owner',
  country     text,
  currency    text not null default 'AUD',
  branding    jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger organisations_updated before update on organisations for each row execute function set_updated_at();

create table organisation_members (
  organisation_id uuid not null references organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            org_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (organisation_id, user_id)
);
create index on organisation_members (user_id);

alter table profiles add constraint profiles_default_org_fk
  foreign key (default_organisation_id) references organisations(id) on delete set null;

-- ---------- cohorts (workshops / programmes) ----------
create table cohorts (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  name            text not null,
  starts_on       date,
  ends_on         date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organisation_id)                      -- lets plans reference (cohort_id, organisation_id)
);
create index on cohorts (organisation_id);
create trigger cohorts_updated before update on cohorts for each row execute function set_updated_at();

-- ---------- plans ----------
create table plans (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  cohort_id       uuid,
  business_name   text not null,
  status          plan_status not null default 'draft',
  plan_year       int not null default extract(year from now())::int,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- a plan's cohort must belong to the plan's own organisation (tenant boundary enforced by the database)
  foreign key (cohort_id, organisation_id) references cohorts(id, organisation_id) on delete set null (cohort_id)
);
create index on plans (organisation_id);
create index on plans (cohort_id);
create trigger plans_updated before update on plans for each row execute function set_updated_at();

create table plan_members (
  plan_id              uuid not null references plans(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  role                 plan_role not null default 'owner',
  can_generate_reports boolean not null default true,
  created_at           timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index on plan_members (user_id);

create table plan_invitations (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  email       text not null,
  role        plan_role not null default 'owner',
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by  uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now()
);
create index on plan_invitations (plan_id);

-- ---------- access helpers (the only policy logic) ----------
create or replace function is_org_advisor(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.organisation_id = org and m.user_id = auth.uid() and m.role in ('admin','advisor')
  );
$$;

create or replace function is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.organisation_id = org and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

create or replace function is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.organisation_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function can_read_plan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = auth.uid())
      or exists (select 1 from plans pl where pl.id = p and is_org_advisor(pl.organisation_id));
$$;

create or replace function can_write_plan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = auth.uid() and pm.role in ('owner','advisor'))
      or exists (select 1 from plans pl where pl.id = p and is_org_advisor(pl.organisation_id));
$$;

-- ---------- RLS ----------
alter table profiles             enable row level security;
alter table organisations        enable row level security;
alter table organisation_members enable row level security;
alter table cohorts              enable row level security;
alter table plans                enable row level security;
alter table plan_members         enable row level security;
alter table plan_invitations     enable row level security;

create policy "own profile"        on profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "org read"           on organisations for select using (is_org_member(id));
create policy "org insert"         on organisations for insert with check (auth.uid() is not null);
create policy "org update"         on organisations for update using (is_org_admin(id));

create policy "org members read"   on organisation_members for select using (is_org_member(organisation_id));
create policy "org members write"  on organisation_members for all using (is_org_admin(organisation_id)) with check (is_org_admin(organisation_id));

create policy "cohorts read"       on cohorts for select using (is_org_member(organisation_id));
create policy "cohorts write"      on cohorts for all using (is_org_advisor(organisation_id)) with check (is_org_advisor(organisation_id));

create policy "plans read"         on plans for select using (can_read_plan(id));
create policy "plans insert"       on plans for insert with check (is_org_member(organisation_id));
create policy "plans update"       on plans for update using (can_write_plan(id));
create policy "plans delete"       on plans for delete using (is_org_advisor(organisation_id));

create policy "plan members read"  on plan_members for select using (can_read_plan(plan_id));
create policy "plan members write" on plan_members for all using (can_write_plan(plan_id)) with check (can_write_plan(plan_id));

-- invitations are created, accepted and revoked by server routes (secret key). Plan writers may only see them.
create policy "invitations read"   on plan_invitations for select using (can_write_plan(plan_id));

-- When a user creates an organisation, make them its admin; when they create a plan, make them its owner.
create or replace function on_org_created() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into organisation_members (organisation_id, user_id, role) values (new.id, coalesce(new.created_by, auth.uid()), 'admin');
  return new;
end $$;
create trigger org_created after insert on organisations for each row execute function on_org_created();

-- The creator joins the plan as 'advisor' when they are an admin/advisor of the organisation (a coach setting up
-- a client), otherwise as 'owner' (a business owner creating their own plan).
create or replace function on_plan_created() returns trigger language plpgsql security definer set search_path = public as $$
declare creator uuid := coalesce(new.created_by, auth.uid());
declare r plan_role := 'owner';
begin
  if exists (select 1 from organisation_members m where m.organisation_id = new.organisation_id and m.user_id = creator and m.role in ('admin','advisor')
             and (select kind from organisations where id = new.organisation_id) <> 'owner') then
    r := 'advisor';
  end if;
  insert into plan_members (plan_id, user_id, role) values (new.id, creator, r) on conflict do nothing;
  return new;
end $$;
create trigger plan_created after insert on plans for each row execute function on_plan_created();
