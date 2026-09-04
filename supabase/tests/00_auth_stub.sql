-- Minimal stand-in for Supabase's auth schema so migrations and tests run on a plain Postgres.
-- NOT applied to Supabase (the real auth schema exists there). Used only by scripts/test-db.sh.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- role that obeys RLS, like Supabase's `authenticated`
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
