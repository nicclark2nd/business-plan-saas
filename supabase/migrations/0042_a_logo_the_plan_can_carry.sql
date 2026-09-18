-- 0042: a logo the plan can carry (§6.94).
--
-- `plan_settings.logo_path` has existed since 0002 and nothing has ever written it. The Branding tab said
-- "Logo upload arrives with the Reports step" — a promise made on a screen and kept nowhere (§6.87), while
-- the help text beside it already told clients "your logo goes on the report cover and page headers".
--
-- The column holds the OBJECT PATH inside the bucket below, never a URL. A stored URL would be a second
-- reading of where the file is (§6.41) and would expire: these are signed on demand, per request.

-- A PRIVATE bucket. A business plan's letterhead belongs to the client, and a public bucket would mean
-- every logo on the platform was fetchable by anyone who could guess a plan id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plan-logos', 'plan-logos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- PNG and JPEG only, enforced here as well as in the upload action.
--
-- Not because of what a browser can render — it is what WORD can place. An ImageRun takes png, jpg, gif,
-- bmp or svg, and a WebP dropped into a .docx is a grey box in the document a client sends to a bank.
-- Refusing the file with a sentence saying why is the only honest option; accepting it and producing a
-- broken cover is the §6.57 fault with a file picker in front of it.
--
-- SVG is excluded deliberately. It is a document, not an image: it can carry script, and it would be
-- rendered by whatever opens it. A logo is not worth that.

-- ---------- who may touch which object ----------
--
-- Objects are stored as '<plan_id>/logo.<ext>', so the plan id is the first path segment and the existing
-- can_read_plan / can_write_plan answer the question. The regex guard matters: `::uuid` on a folder that is
-- not a uuid raises rather than returning false, which would turn a stray object into a 500 for everybody.
create or replace function public.plan_of_storage_object(object_name text) returns uuid
language sql immutable as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
  end
$$;

drop policy if exists "plan logos read"   on storage.objects;
drop policy if exists "plan logos insert" on storage.objects;
drop policy if exists "plan logos update" on storage.objects;
drop policy if exists "plan logos delete" on storage.objects;

create policy "plan logos read" on storage.objects for select
  using (bucket_id = 'plan-logos' and can_read_plan(public.plan_of_storage_object(name)));

create policy "plan logos insert" on storage.objects for insert
  with check (bucket_id = 'plan-logos' and can_write_plan(public.plan_of_storage_object(name)));

create policy "plan logos update" on storage.objects for update
  using (bucket_id = 'plan-logos' and can_write_plan(public.plan_of_storage_object(name)))
  with check (bucket_id = 'plan-logos' and can_write_plan(public.plan_of_storage_object(name)));

create policy "plan logos delete" on storage.objects for delete
  using (bucket_id = 'plan-logos' and can_write_plan(public.plan_of_storage_object(name)));
