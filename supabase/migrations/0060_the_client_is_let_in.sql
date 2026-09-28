-- 0060: the client is let in (§6.183)
--
-- Part 2 of the consultant's area: a consultant invites a client to their own plan, turns that access off,
-- and decides whether the client may download their own business plan. The client, once in, sees a small
-- "Your Planner" card and nothing else about the firm.
--
-- NO EMAIL IS SENT BY THE APP (Nic: "the email coming from them and not this app … all email functionality
-- will be done last"). The consultant copies the link or opens it in their own email program.
--
-- NO SERVICE KEY. 0001 said invitations would be "created, accepted and revoked by server routes (secret
-- key)"; this app has no secret-key client and is not getting one for this. Each step is a SECURITY DEFINER
-- function that checks, in SQL, the one thing that makes the step allowed — the caller is one of the firm's
-- Planners, or the caller is the person the invitation was for — and does nothing else.

alter table public.plan_invitations add column if not exists accepted_by uuid;
alter table public.plan_invitations add column if not exists revoked_at  timestamptz;
-- Whether the client may download their own business plan (the old system's "Your client can print their own
-- reports"). On the PLAN, so an invitation accepted later picks it up; copied onto the client's membership.
alter table public.plans add column if not exists client_can_download boolean not null default true;

-- The firm's Planners for a plan: admins and advisors of the plan's organisation, when it is a firm.
create or replace function public.is_plan_planner(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans pl join organisations o on o.id = pl.organisation_id
    where pl.id = p and o.kind <> 'owner' and is_org_advisor(pl.organisation_id)
  );
$$;

-- A client of a plan: a member who is not in the plan's firm.
create or replace function public.is_plan_client(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plan_members pm where pm.plan_id = p and pm.user_id = u)
     and not exists (select 1 from plans pl join organisation_members m on m.organisation_id = pl.organisation_id
                     where pl.id = p and m.user_id = u);
$$;

-- CREATE (or re-create) an invitation. Any open invitation for the plan is closed first, so there is only ever
-- one live link per client business, and "Resend" really does switch the old one off.
create or replace function public.create_plan_invitation(p_plan uuid, p_email text)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not is_plan_planner(p_plan) then raise exception 'not the planner' using errcode = '42501'; end if;
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'bad email' using errcode = '22023'; end if;
  update plan_invitations set revoked_at = now()
   where plan_id = p_plan and accepted_at is null and revoked_at is null;
  return query
    insert into plan_invitations (plan_id, email, role, invited_by)
    values (p_plan, e, 'owner', auth.uid())
    returning plan_invitations.token, plan_invitations.expires_at;
end $$;

-- WHAT AN INVITATION LINK SAYS, before anyone signs in: whose plan, from which firm, for which email, and whether
-- it still works. The token is the secret; this reveals nothing a holder of the link was not already sent.
create or replace function public.invitation_preview(p_token text)
returns table (business_name text, firm_name text, email text, state text)
language sql stable security definer set search_path = public as $$
  select pl.business_name, o.name, i.email,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'open' end
    from plan_invitations i join plans pl on pl.id = i.plan_id join organisations o on o.id = pl.organisation_id
   where i.token = p_token;
$$;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- ACCEPT: only the person the invitation was for (their sign-in email must match), only while it is open.
create or replace function public.accept_plan_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i plan_invitations%rowtype;
declare me text;
begin
  if auth.uid() is null then raise exception 'sign in' using errcode = '42501'; end if;
  select * into i from plan_invitations where token = p_token for update;
  if not found then raise exception 'no such invitation' using errcode = 'P0002'; end if;
  if i.revoked_at is not null or i.accepted_at is not null or i.expires_at < now() then
    raise exception 'invitation closed' using errcode = '22023';
  end if;
  select lower(email) into me from auth.users where id = auth.uid();
  if me is distinct from lower(i.email) then raise exception 'wrong email' using errcode = '42501'; end if;
  insert into plan_members (plan_id, user_id, role, can_generate_reports)
  values (i.plan_id, auth.uid(), 'owner', (select client_can_download from plans where id = i.plan_id))
  on conflict (plan_id, user_id) do nothing;
  update plan_invitations set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.plan_id;
end $$;

-- TURN ACCESS OFF: every client of the plan removed, and any open link closed. The firm's own people are
-- untouched — they reach the plan through the firm, not through membership.
create or replace function public.revoke_client_access(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_plan_planner(p_plan) then raise exception 'not the planner' using errcode = '42501'; end if;
  delete from plan_members pm where pm.plan_id = p_plan and is_plan_client(p_plan, pm.user_id);
  update plan_invitations set revoked_at = now() where plan_id = p_plan and accepted_at is null and revoked_at is null;
end $$;

-- MAY THE CLIENT DOWNLOAD THEIR OWN PLAN — on the plan, and on every client already in it.
create or replace function public.set_client_download(p_plan uuid, p_allow boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_plan_planner(p_plan) then raise exception 'not the planner' using errcode = '42501'; end if;
  update plans set client_can_download = p_allow where id = p_plan;
  update plan_members pm set can_generate_reports = p_allow where pm.plan_id = p_plan and is_plan_client(p_plan, pm.user_id);
end $$;

-- EVERY CLIENT'S ACCESS, for My Clients: the firm's Planners only.
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
   where pl.organisation_id = p_org and is_org_advisor(p_org);
$$;

-- THE "YOUR PLANNER" CARD: the Planner who invited this client (or who set the plan up), for a member of the
-- plan. Name, title, phone, email and photo — what Nic asked the card to carry, and nothing else about the firm.
create or replace function public.plan_planner(p_plan uuid)
returns table (user_id uuid, full_name text, title text, phone text, email text, photo_path text)
language sql stable security definer set search_path = public as $$
  with who as (
    select coalesce(
      (select i.invited_by from plan_invitations i where i.plan_id = p_plan and i.accepted_by = auth.uid() order by i.accepted_at desc limit 1),
      (select pl.created_by from plans pl where pl.id = p_plan)
    ) as uid
  )
  select pr.id, pr.full_name, pr.title, pr.phone, u.email::text, pr.photo_path
    from who join profiles pr on pr.id = who.uid join auth.users u on u.id = who.uid
   where can_read_plan(p_plan)
     and exists (select 1 from plans pl join organisations o on o.id = pl.organisation_id where pl.id = p_plan and o.kind <> 'owner');
$$;

-- The Planner's photo, readable by their clients too (0059 let only the firm read it).
create or replace function public.is_my_planner(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plan_members pm join plans pl on pl.id = pm.plan_id
    where pm.user_id = auth.uid()
      and (pl.created_by = other or exists (select 1 from plan_invitations i where i.plan_id = pl.id and i.invited_by = other and i.accepted_by = auth.uid()))
  );
$$;

drop policy if exists "profile photos read" on storage.objects;
create policy "profile photos read" on storage.objects for select
  using (bucket_id = 'profile-photos' and (
    public.shares_a_firm_with(public.plan_of_storage_object(name)) or public.is_my_planner(public.plan_of_storage_object(name))
  ));
