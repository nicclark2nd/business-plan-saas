-- 0059: the consultant's own area (§6.182)
--
-- Nic: "There should be a separated area for me as the consultant … This is where my brand, my team, my
-- details and my clients list live." Three things that had nowhere to be kept:
--
--   1. THE FIRM'S DETAILS — address, phone, website, business number, the "Prepared by" line and the paper
--      new plans start on. On `organisations`, beside the name, colour and logo (0058), because they are the
--      firm's, set once, and printed for every client. Never on a plan.
--   2. THE CONSULTANT AS A PERSON — title, direct phone, photo. On `profiles`, which already holds the name.
--      The sign-in email stays where auth keeps it; it is shown, never copied here.
--   3. THE CLIENT'S CONTACT PERSON — who at the business the consultant deals with. On `plans`, because it is
--      one per client business and it is what "Invite" (part 2) will email. The business's own address, phone
--      and email are NOT added: the plan already holds them (its premises and its cover details), and My
--      Clients reads them from there rather than asking again (product rule: never ask twice).

alter table public.organisations add column if not exists address_line   text;
alter table public.organisations add column if not exists city           text;
alter table public.organisations add column if not exists region         text;
alter table public.organisations add column if not exists postcode       text;
alter table public.organisations add column if not exists phone          text;
alter table public.organisations add column if not exists website        text;
alter table public.organisations add column if not exists business_number text;   -- ABN, EIN, company number
-- Null means "build it from the details": "Prepared by Nic Clark Coaching · 0400 000 000 · nic@…".
alter table public.organisations add column if not exists prepared_by    text;
alter table public.organisations add column if not exists default_page_size text;

do $$ begin
  alter table public.organisations add constraint organisations_default_page_size_check
    check (default_page_size is null or default_page_size in ('a4', 'letter'));
exception when duplicate_object then null; end $$;

alter table public.profiles add column if not exists title      text;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists photo_path text;

alter table public.plans add column if not exists contact_first_name  text;
alter table public.plans add column if not exists contact_family_name text;
alter table public.plans add column if not exists contact_email       text;
alter table public.plans add column if not exists contact_phone       text;

-- THE CONSULTANT'S PHOTO. Private, PNG or JPEG, 2 MB, one object per person at `<user id>/photo.<ext>`.
--
-- READ: the person, and anyone who shares a firm with them — their team today, and (part 2) the clients of
-- a plan they look after, for the "Your Planner" card. WRITE: the person only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.shares_a_firm_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from organisation_members a
    join organisation_members b on b.organisation_id = a.organisation_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

drop policy if exists "profile photos read"   on storage.objects;
drop policy if exists "profile photos insert" on storage.objects;
drop policy if exists "profile photos update" on storage.objects;
drop policy if exists "profile photos delete" on storage.objects;

-- `plan_of_storage_object` (0042) reads the first folder as a uuid — here, the person's id.
create policy "profile photos read" on storage.objects for select
  using (bucket_id = 'profile-photos' and public.shares_a_firm_with(public.plan_of_storage_object(name)));
create policy "profile photos insert" on storage.objects for insert
  with check (bucket_id = 'profile-photos' and public.plan_of_storage_object(name) = auth.uid());
create policy "profile photos update" on storage.objects for update
  using (bucket_id = 'profile-photos' and public.plan_of_storage_object(name) = auth.uid())
  with check (bucket_id = 'profile-photos' and public.plan_of_storage_object(name) = auth.uid());
create policy "profile photos delete" on storage.objects for delete
  using (bucket_id = 'profile-photos' and public.plan_of_storage_object(name) = auth.uid());
