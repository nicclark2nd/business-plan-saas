-- 0058: the firm's letterhead (§6.180)
--
-- The Planner's report goes out under the PLANNER'S name, not the client's: the firm's logo on the cover
-- and in the header, the firm's colour on the headings, "Prepared by" the firm. Set once per firm and used
-- on every client's report, which is why it lives on `organisations` and not on `plan_settings` — the
-- plan's own logo (0042) is the client's, and stays on the client's business plan.
--
-- WHY COLUMNS AND NOT THE `branding` JSON FROM 0001.
--
-- `branding jsonb` has been on organisations since the first migration and nothing has ever written to it.
-- A colour is a constrained value and a logo is a path; a check constraint says what a colour may be in a
-- place the database enforces, where a JSON key would take anything. `branding` is left as it is, unused.

alter table public.organisations add column if not exists logo_path text;
alter table public.organisations add column if not exists brand_colour text;

do $$ begin
  alter table public.organisations add constraint organisations_brand_colour_check
    check (brand_colour is null or brand_colour ~ '^#[0-9A-F]{6}$');
exception when duplicate_object then null; end $$;

-- The firm's logo: private, PNG or JPEG, 2 MB — the same rules as the plan's (0042), for the same reason
-- (Word cannot place WebP or SVG without breaking the page).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firm-logos', 'firm-logos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- One object per firm, at `<organisation id>/logo.<ext>`. `plan_of_storage_object` (0042) only reads the
-- first folder as a uuid; it is reused here for the organisation's id rather than written twice.
--
-- READ: anyone in the firm — every Planner prints the firm's report. WRITE: the firm's admins only, the same
-- people the "org update" policy (0001) lets change the firm's name and colour.
drop policy if exists "firm logos read"   on storage.objects;
drop policy if exists "firm logos insert" on storage.objects;
drop policy if exists "firm logos update" on storage.objects;
drop policy if exists "firm logos delete" on storage.objects;

create policy "firm logos read" on storage.objects for select
  using (bucket_id = 'firm-logos' and is_org_member(public.plan_of_storage_object(name)));
create policy "firm logos insert" on storage.objects for insert
  with check (bucket_id = 'firm-logos' and is_org_admin(public.plan_of_storage_object(name)));
create policy "firm logos update" on storage.objects for update
  using (bucket_id = 'firm-logos' and is_org_admin(public.plan_of_storage_object(name)))
  with check (bucket_id = 'firm-logos' and is_org_admin(public.plan_of_storage_object(name)));
create policy "firm logos delete" on storage.objects for delete
  using (bucket_id = 'firm-logos' and is_org_admin(public.plan_of_storage_object(name)));
