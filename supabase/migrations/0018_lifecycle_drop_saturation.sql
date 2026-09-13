-- 0018: drop 'saturation' from the product lifecycle.
--
-- Development -> Introduction -> Growth -> Maturity -> Decline is the standard product life cycle used in
-- business planning. Saturation is not a stage in it - where it appears at all it is the late plateau of
-- maturity, so offering both asks the client to split a hair that no lender, grant assessor or accountant
-- recognises. Existing rows move to maturity rather than to null: a line marked saturation was marked
-- deliberately, and blanking it would throw the client's judgement away to tidy a list.
--
-- Postgres cannot drop a value from an enum in place, so the type is rebuilt. The data moves FIRST, while
-- the column still has the old type, so the cast can never meet a value the new type lacks. The whole thing
-- is guarded on the value still being there: a migration that cannot be run twice is a migration that
-- strands a half-finished push.

do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'product_lifecycle' and e.enumlabel = 'saturation'
  ) then
    update public.plan_products set lifecycle = 'maturity' where lifecycle::text = 'saturation';

    alter type public.product_lifecycle rename to product_lifecycle_old;

    create type public.product_lifecycle as enum ('development', 'introduction', 'growth', 'maturity', 'decline');

    alter table public.plan_products
      alter column lifecycle type public.product_lifecycle
      using lifecycle::text::public.product_lifecycle;

    drop type public.product_lifecycle_old;
  end if;
end $$;
