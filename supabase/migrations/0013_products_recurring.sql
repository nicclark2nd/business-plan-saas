-- Sales §6.16: a product is sold either as a one-off job (invoiced when delivered) or as an ongoing client who
-- keeps paying (coaching, bookkeeping, legal and consulting retainers, memberships, maintenance contracts).
-- Ongoing lines earn from ACTIVE clients, so a year's sales are not price x units; they need an opening book,
-- month-by-month acquisition and how long a client stays. One-off lines are unchanged.

do $$ begin
  create type product_sold_as as enum ('one_off', 'recurring');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_life_mode as enum ('average', 'fixed');
exception when duplicate_object then null; end $$;

alter table plan_products
  add column if not exists sold_as             product_sold_as  not null default 'one_off',
  add column if not exists opening_clients     numeric(12,2)    not null default 0,
  add column if not exists client_life_months  int              not null default 12,
  add column if not exists life_mode           client_life_mode not null default 'average',
  add column if not exists monthly_new_clients jsonb;

comment on column plan_products.average_price       is 'One-off: price of the job. Ongoing: what one client is worth in a year (the monthly fee x 12).';
comment on column plan_products.units_sold          is 'One-off: jobs sold in the base year. Ongoing: new clients won in the base year.';
comment on column plan_products.opening_clients     is 'Ongoing only: clients already paying when the plan starts. 0 for a new business.';
comment on column plan_products.client_life_months  is 'Ongoing only: how long a client stays.';
comment on column plan_products.life_mode           is 'Ongoing only: average = clients drift away at a steady rate; fixed = a set programme served out.';
comment on column plan_products.monthly_new_clients is 'Ongoing only: {"1".."12"} new clients won in each month of the first selling year.';
