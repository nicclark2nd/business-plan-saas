-- 0063: Site Admin (§6.186)
--
-- Part 5 of the consultant's area: Nic's own view, as the owner of BizPlanHQ, across every firm and every
-- business planning for itself — who they are, what they pay, how much they use — and the three things only
-- he may do to an account: put it on hold, give it plans, and look at it.
--
-- WHO IS A SITE ADMIN IS DECIDED IN SQL, AND ONLY IN SQL. There is no screen, no sign-up path and no API that
-- makes anyone one. Nic adds himself once, in the SQL editor:
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where lower(email) = 'nic@nicclark.com';
--
-- EVERY LOOK IS WRITTEN DOWN. Each function below that reads across accounts or changes one records who, what
-- and when in `platform_audit`, in the same transaction — a view that is not logged cannot happen.
--
-- NO "LOG IN AS". Looking at an account is a read-only summary built here, not a session as that person: a
-- Site Admin never holds a consultant's or a client's access, so there is nothing to misuse and nothing to
-- forget to hand back.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- No policies: nobody reads or writes this table through the API. Only the functions below consult it.

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.platform_audit (
  id              bigint generated always as identity primary key,
  admin_id        uuid not null,
  action          text not null,
  organisation_id uuid,
  detail          jsonb not null default '{}'::jsonb,
  at              timestamptz not null default now()
);
alter table public.platform_audit enable row level security;
-- No policies, and no update or delete path anywhere: the log is written by the functions and read by one.

create or replace function public.platform_log(p_action text, p_org uuid, p_detail jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'not a site admin' using errcode = '42501'; end if;
  insert into platform_audit (admin_id, action, organisation_id, detail) values (auth.uid(), p_action, p_org, coalesce(p_detail, '{}'::jsonb));
end $$;
revoke all on function public.platform_log(text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- on hold

alter table public.organisations add column if not exists on_hold_at     timestamptz;
alter table public.organisations add column if not exists on_hold_reason text;

-- ON HOLD MEANS READ-ONLY. The firm's people and its clients can still sign in and read every plan — nothing is
-- hidden or lost — but nothing can be changed or added until the hold is lifted. It is the switch for an
-- account that has stopped paying or is being looked into, and it is reversible in one click.
create or replace function can_write_plan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from plans pl join organisations o on o.id = pl.organisation_id where pl.id = p and o.on_hold_at is not null)
     and (exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = auth.uid() and pm.role in ('owner','advisor'))
          or exists (select 1 from plans pl where pl.id = p and is_org_admin(pl.organisation_id)));
$$;

create or replace function public.refuse_plans_on_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from organisations where id = new.organisation_id and on_hold_at is not null) then
    raise exception 'account on hold' using errcode = 'P0001', hint = 'on_hold';
  end if;
  return new;
end $$;
drop trigger if exists plans_on_hold on plans;
create trigger plans_on_hold before insert on plans for each row execute function public.refuse_plans_on_hold();

-- An organisation's own people read whether they are on hold (to show why the screens will not save).
create or replace function public.org_on_hold(p_org uuid) returns table (on_hold_at timestamptz, reason text)
language sql stable security definer set search_path = public as $$
  select o.on_hold_at, o.on_hold_reason from organisations o
   where o.id = p_org and (is_org_member(o.id) or exists (select 1 from plans pl where pl.organisation_id = o.id and can_read_plan(pl.id)));
$$;

-- ---------------------------------------------------------------- the view across every account

create or replace function public.platform_accounts()
returns table (
  organisation_id uuid, name text, kind text, created_at timestamptz, on_hold_at timestamptz, on_hold_reason text,
  admin_email text, people int, active_plans int, archived_plans int, clients_with_login int,
  billing_status text, level_name text, plans_included int, extra_plans int, granted_plans int, current_period_end timestamptz,
  ai_calls_30d int, last_activity timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform platform_log('list accounts', null);
  return query
  select o.id, o.name, o.kind::text, o.created_at, o.on_hold_at, o.on_hold_reason,
         (select u.email::text from organisation_members m join auth.users u on u.id = m.user_id
           where m.organisation_id = o.id and m.role = 'admin' order by m.created_at limit 1),
         (select count(*)::int from organisation_members m where m.organisation_id = o.id and m.role in ('admin','advisor')),
         (select count(*)::int from plans pl where pl.organisation_id = o.id and pl.archived_at is null),
         (select count(*)::int from plans pl where pl.organisation_id = o.id and pl.archived_at is not null),
         (select count(distinct pm.plan_id)::int from plans pl join plan_members pm on pm.plan_id = pl.id
           where pl.organisation_id = o.id and is_plan_client(pl.id, pm.user_id)),
         coalesce(b.status, 'none'), b.level_name, coalesce(b.plans_included, 0), coalesce(b.extra_plans, 0),
         coalesce(b.granted_plans, 0), b.current_period_end,
         (select count(*)::int from ai_calls a join plans pl on pl.id = a.plan_id
           where pl.organisation_id = o.id and a.created_at > now() - interval '30 days'),
         greatest(o.updated_at, (select max(pl.updated_at) from plans pl where pl.organisation_id = o.id))
    from organisations o left join billing_accounts b on b.organisation_id = o.id
   order by o.created_at desc;
end $$;

-- One account, read-only: its people, its plans and its billing. "View as this consultant", without becoming them.
create or replace function public.platform_account_people(p_org uuid)
returns table (user_id uuid, full_name text, email text, role text, joined timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform platform_log('view account', p_org);
  return query
  select m.user_id, pr.full_name, u.email::text, m.role::text, m.created_at
    from organisation_members m join auth.users u on u.id = m.user_id left join profiles pr on pr.id = m.user_id
   where m.organisation_id = p_org order by m.role, m.created_at;
end $$;

create or replace function public.platform_account_plans(p_org uuid)
returns table (plan_id uuid, business_name text, created_at timestamptz, updated_at timestamptz, archived_at timestamptz,
               looked_after_by text, client_email text, ai_calls_30d int)
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'not a site admin' using errcode = '42501'; end if;
  return query
  select pl.id, pl.business_name, pl.created_at, pl.updated_at, pl.archived_at,
         (select string_agg(coalesce(nullif(pr.full_name, ''), u.email::text), ', ')
            from plan_members pm join organisation_members m on m.organisation_id = pl.organisation_id and m.user_id = pm.user_id
            join auth.users u on u.id = pm.user_id left join profiles pr on pr.id = pm.user_id
           where pm.plan_id = pl.id and pm.role = 'advisor'),
         (select string_agg(u.email::text, ', ') from plan_members pm join auth.users u on u.id = pm.user_id
           where pm.plan_id = pl.id and is_plan_client(pl.id, pm.user_id)),
         (select count(*)::int from ai_calls a where a.plan_id = pl.id and a.created_at > now() - interval '30 days')
    from plans pl where pl.organisation_id = p_org order by pl.archived_at nulls first, pl.business_name;
end $$;

-- ---------------------------------------------------------------- the three actions

create or replace function public.platform_set_hold(p_org uuid, p_on boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform platform_log(case when p_on then 'put on hold' else 'lift hold' end, p_org, jsonb_build_object('reason', p_reason));
  update organisations set on_hold_at = case when p_on then now() end,
                           on_hold_reason = case when p_on then nullif(btrim(coalesce(p_reason, '')), '') end
   where id = p_org;
  if not found then raise exception 'no such account' using errcode = 'P0002'; end if;
end $$;

-- Plans given by BizPlanHQ, on top of anything paid for. Sets the number rather than adding to it, so the screen
-- shows exactly what was given.
create or replace function public.platform_grant_plans(p_org uuid, p_plans int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_plans is null or p_plans < 0 or p_plans > 10000 then raise exception 'bad number' using errcode = '22023'; end if;
  perform platform_log('grant plans', p_org, jsonb_build_object('granted_plans', p_plans));
  if not exists (select 1 from organisations where id = p_org) then raise exception 'no such account' using errcode = 'P0002'; end if;
  insert into billing_accounts (organisation_id, granted_plans, updated_at) values (p_org, p_plans, now())
  on conflict (organisation_id) do update set granted_plans = excluded.granted_plans, updated_at = now();
end $$;

create or replace function public.platform_audit_recent(p_limit int default 50)
returns table (at timestamptz, admin_email text, action text, organisation_id uuid, organisation_name text, detail jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'not a site admin' using errcode = '42501'; end if;
  return query
  select a.at, u.email::text, a.action, a.organisation_id, o.name, a.detail
    from platform_audit a left join auth.users u on u.id = a.admin_id left join organisations o on o.id = a.organisation_id
   order by a.at desc limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;
