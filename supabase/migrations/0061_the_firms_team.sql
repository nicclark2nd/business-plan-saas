-- 0061: the firm's team (§6.184)
--
-- Part 3 of the consultant's area: a firm's admin invites consultants, sets each as admin or advisor, and
-- decides who looks after which client. The rule agreed with Nic: AN ADVISOR SEES THEIR OWN CLIENTS; AN ADMIN
-- SEES ALL OF THEM.
--
-- WHAT CHANGES IN THE ACCESS RULES, AND WHY IT IS SAFE TO CHANGE.
--
-- Since 0001 every admin and advisor of a firm could read and write every plan the firm holds
-- (`is_org_advisor` in `can_read_plan` / `can_write_plan`). From here the firm-wide reach is the ADMIN's; an
-- advisor reaches a client through being assigned to it — a `plan_members` row with role 'advisor', which is
-- exactly what 0001 already writes for whoever creates a client plan. So:
--
--   * nobody loses a plan they made (they are already its advisor member);
--   * every advisor is BACKFILLED onto every plan of their firm below, so nobody loses one they could open
--     yesterday either — the admin then takes them off what is not theirs;
--   * plans of a business planning for itself (`kind = 'owner'`) are untouched: their owner is their admin.
--
-- NO EMAIL IS SENT (Nic: email comes from the consultant, and is built last). A team invitation is a link, the
-- same shape as a client's (0060), and every step is a SECURITY DEFINER function that checks one thing.

-- ---------------------------------------------------------------- who reaches a plan

create or replace function can_read_plan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = auth.uid())
      or exists (select 1 from plans pl where pl.id = p and is_org_admin(pl.organisation_id));
$$;

create or replace function can_write_plan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = auth.uid() and pm.role in ('owner','advisor'))
      or exists (select 1 from plans pl where pl.id = p and is_org_admin(pl.organisation_id));
$$;

-- The firm's Planners for a plan (0060): its admins, and the advisors assigned to it.
create or replace function public.is_plan_planner(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans pl join organisations o on o.id = pl.organisation_id
    where pl.id = p and o.kind <> 'owner' and (
      is_org_admin(pl.organisation_id)
      or (is_org_advisor(pl.organisation_id)
          and exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = auth.uid() and pm.role = 'advisor'))
    )
  );
$$;

-- THE CREATOR'S READ, CLOSED TO THE CREATING MOMENT.
--
-- 0005 let whoever created a plan or a firm read its row for ever, because INSERT … RETURNING checks the
-- SELECT policy before the trigger that adds the creator as a member has run. For ever was wider than that
-- needed, and with a team it is a leak: an advisor taken off a client, or a consultant who leaves the firm,
-- could still see the row they once created. `created_at = now()` is true only inside the transaction that
-- inserted it (`now()` is the transaction's start time, and it is the column's default), which is exactly
-- the RETURNING the rule was written for — and nothing after.
drop policy if exists "plans read" on plans;
create policy "plans read" on plans for select
  using (can_read_plan(id) or (created_by = auth.uid() and created_at = now()));
drop policy if exists "org read" on organisations;
create policy "org read" on organisations for select
  using (is_org_member(id) or (created_by = auth.uid() and created_at = now()));

-- Deleting a client plan: the firm's admin, or the advisor who looks after it.
drop policy if exists "plans delete" on plans;
create policy "plans delete" on plans for delete using (is_plan_planner(id) or is_org_admin(organisation_id));

-- Backfill: every advisor keeps every plan of their firm they could reach yesterday.
insert into plan_members (plan_id, user_id, role)
select pl.id, m.user_id, 'advisor'
  from organisation_members m
  join organisations o on o.id = m.organisation_id and o.kind <> 'owner'
  join plans pl on pl.organisation_id = m.organisation_id
 where m.role = 'advisor'
on conflict (plan_id, user_id) do nothing;

-- My Clients' access list (0060), for the plans this Planner reaches — all of them for an admin.
create or replace function public.firm_client_access(p_org uuid)
returns table (plan_id uuid, state text, email text, token text, expires_at timestamptz, since timestamptz)
language sql stable security definer set search_path = public as $$
  with last as (
    select distinct on (i.plan_id) i.* from plan_invitations i
      join plans pl on pl.id = i.plan_id where pl.organisation_id = p_org
     order by i.plan_id, i.created_at desc
  )
  select pl.id,
         case when exists (select 1 from plan_members pm where pm.plan_id = pl.id and is_plan_client(pl.id, pm.user_id)) then 'active'
              when l.id is null then 'none'
              when l.accepted_at is not null or l.revoked_at is not null then 'off'
              when l.expires_at < now() then 'expired'
              else 'invited' end,
         l.email,
         case when l.accepted_at is null and l.revoked_at is null and l.expires_at >= now() then l.token end,
         l.expires_at,
         coalesce(l.accepted_at, l.created_at)
    from plans pl left join last l on l.plan_id = pl.id
   where pl.organisation_id = p_org and is_plan_planner(pl.id);
$$;

-- ---------------------------------------------------------------- the team

-- Everyone in the firm, with their email (auth.users is not readable from the app) and how many clients each
-- looks after. Any member of the firm may see the team; only an admin changes it.
create or replace function public.firm_team(p_org uuid)
returns table (user_id uuid, full_name text, title text, email text, role text, clients int, joined timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, pr.full_name, pr.title, u.email::text, m.role::text,
         (select count(*)::int from plan_members pm join plans pl on pl.id = pm.plan_id
           where pm.user_id = m.user_id and pm.role = 'advisor' and pl.organisation_id = p_org and pl.archived_at is null),
         m.created_at
    from organisation_members m
    join auth.users u on u.id = m.user_id
    left join profiles pr on pr.id = m.user_id
   where m.organisation_id = p_org and m.role in ('admin', 'advisor') and is_org_member(p_org)
   order by m.role, pr.full_name;
$$;

-- Who looks after each client, for My Clients: the firm's people who are advisor members of each plan.
create or replace function public.firm_assignments(p_org uuid)
returns table (plan_id uuid, user_id uuid)
language sql stable security definer set search_path = public as $$
  select pm.plan_id, pm.user_id
    from plan_members pm join plans pl on pl.id = pm.plan_id
    join organisation_members m on m.organisation_id = pl.organisation_id and m.user_id = pm.user_id and m.role in ('admin','advisor')
   where pl.organisation_id = p_org and pm.role = 'advisor' and is_plan_planner(pl.id);
$$;

-- Put someone on a client, or take them off. The firm's admin only, and only someone in the firm.
create or replace function public.assign_planner(p_plan uuid, p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  select organisation_id into org from plans where id = p_plan;
  if org is null or not is_org_admin(org) then raise exception 'not the admin' using errcode = '42501'; end if;
  if not exists (select 1 from organisation_members where organisation_id = org and user_id = p_user and role in ('admin','advisor')) then
    raise exception 'not in the firm' using errcode = '22023';
  end if;
  if p_on then
    insert into plan_members (plan_id, user_id, role) values (p_plan, p_user, 'advisor')
    on conflict (plan_id, user_id) do update set role = 'advisor';
  else
    delete from plan_members where plan_id = p_plan and user_id = p_user and role = 'advisor';
  end if;
end $$;

-- Change a teammate's role. The firm keeps at least one admin.
create or replace function public.set_team_role(p_org uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_org_admin(p_org) then raise exception 'not the admin' using errcode = '42501'; end if;
  if p_role not in ('admin', 'advisor') then raise exception 'bad role' using errcode = '22023'; end if;
  if p_role = 'advisor' and (select count(*) from organisation_members where organisation_id = p_org and role = 'admin' and user_id <> p_user) = 0 then
    raise exception 'last admin' using errcode = '22023';
  end if;
  update organisation_members set role = p_role::org_role where organisation_id = p_org and user_id = p_user;
end $$;

-- Take someone out of the firm — and off every one of its clients, so a plan membership cannot outlive the
-- job that gave it. The firm keeps at least one admin.
create or replace function public.remove_from_team(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_org_admin(p_org) then raise exception 'not the admin' using errcode = '42501'; end if;
  if (select count(*) from organisation_members where organisation_id = p_org and role = 'admin' and user_id <> p_user) = 0 then
    raise exception 'last admin' using errcode = '22023';
  end if;
  delete from plan_members pm using plans pl
   where pl.id = pm.plan_id and pl.organisation_id = p_org and pm.user_id = p_user and pm.role = 'advisor';
  delete from organisation_members where organisation_id = p_org and user_id = p_user;
end $$;

-- ---------------------------------------------------------------- team invitations

create table if not exists public.organisation_invitations (
  id          uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email       text not null,
  role        org_role not null default 'advisor',
  token       text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by  uuid references auth.users(id),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at  timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now(),
  check (role in ('admin', 'advisor'))
);
create index if not exists organisation_invitations_org_idx on public.organisation_invitations (organisation_id);
alter table public.organisation_invitations enable row level security;
-- Read by the firm's admins; written only through the functions below.
drop policy if exists "team invitations read" on public.organisation_invitations;
create policy "team invitations read" on public.organisation_invitations for select using (is_org_admin(organisation_id));

create or replace function public.create_team_invitation(p_org uuid, p_email text, p_role text)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not is_org_admin(p_org) then raise exception 'not the admin' using errcode = '42501'; end if;
  if (select kind from organisations where id = p_org) = 'owner' then raise exception 'not a firm' using errcode = '22023'; end if;
  if p_role not in ('admin', 'advisor') then raise exception 'bad role' using errcode = '22023'; end if;
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'bad email' using errcode = '22023'; end if;
  if exists (select 1 from organisation_members m join auth.users u on u.id = m.user_id
              where m.organisation_id = p_org and lower(u.email) = e) then
    raise exception 'already in the team' using errcode = '23505';
  end if;
  -- One open link per address: a new one closes the old.
  update organisation_invitations set revoked_at = now()
   where organisation_id = p_org and lower(email) = e and accepted_at is null and revoked_at is null;
  return query
    insert into organisation_invitations (organisation_id, email, role, invited_by)
    values (p_org, e, p_role::org_role, auth.uid())
    returning organisation_invitations.token, organisation_invitations.expires_at;
end $$;

create or replace function public.team_invitation_preview(p_token text)
returns table (firm_name text, email text, role text, state text)
language sql stable security definer set search_path = public as $$
  select o.name, i.email, i.role::text,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'open' end
    from organisation_invitations i join organisations o on o.id = i.organisation_id
   where i.token = p_token;
$$;
grant execute on function public.team_invitation_preview(text) to anon, authenticated;

create or replace function public.accept_team_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i organisation_invitations%rowtype;
declare me text;
begin
  if auth.uid() is null then raise exception 'sign in' using errcode = '42501'; end if;
  select * into i from organisation_invitations where token = p_token for update;
  if not found then raise exception 'no such invitation' using errcode = 'P0002'; end if;
  if i.revoked_at is not null or i.accepted_at is not null or i.expires_at < now() then
    raise exception 'invitation closed' using errcode = '22023';
  end if;
  select lower(email) into me from auth.users where id = auth.uid();
  if me is distinct from lower(i.email) then raise exception 'wrong email' using errcode = '42501'; end if;
  insert into organisation_members (organisation_id, user_id, role) values (i.organisation_id, auth.uid(), i.role)
  on conflict (organisation_id, user_id) do update set role = excluded.role;
  update profiles set default_organisation_id = i.organisation_id where id = auth.uid();
  update organisation_invitations set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.organisation_id;
end $$;

create or replace function public.revoke_team_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from organisation_invitations where id = p_id and is_org_admin(organisation_id)) then
    raise exception 'not the admin' using errcode = '42501';
  end if;
  update organisation_invitations set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null;
end $$;

-- The "Your Planner" card (0060) now prefers the Planner assigned to the client, then whoever invited them.
create or replace function public.plan_planner(p_plan uuid)
returns table (user_id uuid, full_name text, title text, phone text, email text, photo_path text)
language sql stable security definer set search_path = public as $$
  with who as (
    select coalesce(
      (select i.invited_by from plan_invitations i
         where i.plan_id = p_plan and i.accepted_by = auth.uid()
           and exists (select 1 from plan_members pm where pm.plan_id = p_plan and pm.user_id = i.invited_by and pm.role = 'advisor')
         order by i.accepted_at desc limit 1),
      (select pm.user_id from plan_members pm join plans pl on pl.id = pm.plan_id
         join organisation_members m on m.organisation_id = pl.organisation_id and m.user_id = pm.user_id
        where pm.plan_id = p_plan and pm.role = 'advisor' order by pm.created_at limit 1),
      (select pl.created_by from plans pl where pl.id = p_plan)
    ) as uid
  )
  select pr.id, pr.full_name, pr.title, pr.phone, u.email::text, pr.photo_path
    from who join profiles pr on pr.id = who.uid join auth.users u on u.id = who.uid
   where can_read_plan(p_plan)
     and exists (select 1 from plans pl join organisations o on o.id = pl.organisation_id where pl.id = p_plan and o.kind <> 'owner');
$$;

create or replace function public.is_my_planner(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plan_members me join plans pl on pl.id = me.plan_id
    where me.user_id = auth.uid()
      and (pl.created_by = other
           or exists (select 1 from plan_members pm where pm.plan_id = pl.id and pm.user_id = other and pm.role = 'advisor')
           or exists (select 1 from plan_invitations i where i.plan_id = pl.id and i.invited_by = other and i.accepted_by = auth.uid()))
  );
$$;
