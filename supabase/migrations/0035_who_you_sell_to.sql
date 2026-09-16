-- 0035: customer segments, and why the price is the price (§6.62).
--
-- ONE TARGET MARKET BOX DOES NOT FIT A BUSINESS WITH TWO ARMS. A sole trader sells to one kind of buyer and
-- a $50M business sells to several, each with its own needs, channels and often its own price. The plan had
-- one box, and Nic's own answer to it opens "We serve two primary customer segments" — the structure was
-- being worked around in prose, which is the reliable sign that the structure is wrong.
--
-- It also collapsed three questions into one. `target_market` asked who buys; §6.61 then added
-- `demographics` and `psychographics` beside it, and `target_market`'s own hint still read "who buys, where,
-- and what they have in common" — the same words as the new field's LABEL, one section below it. Three
-- boxes, one question, and an owner with nowhere obvious to type.
--
-- A grid answers both ends. One row reads exactly like the old single box; five rows describe a business
-- with five arms, and the report gets a segment table instead of a paragraph.
create table if not exists public.plan_market_segments (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  name          text not null,                    -- "Residential builders", "Commercial head contractors"
  profile       text,                             -- what they have in common: size, trade, location, spend
  cares_about   text,                             -- what they value and how they decide
  revenue_share numeric(5,2),                     -- roughly what share of revenue, 0-100; null = not said
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Everything already typed becomes the first segment. `customer_needs` joins `psychographics` because they
-- are the same question asked twice — "what they are actually buying" and "what they care about".
insert into public.plan_market_segments (plan_id, name, profile, cares_about, sort_order)
  select plan_id,
         coalesce(nullif(btrim(target_market), ''), 'Our customers'),
         nullif(btrim(demographics), ''),
         nullif(concat_ws(E'\n\n', nullif(btrim(psychographics), ''), nullif(btrim(customer_needs), '')), ''),
         0
    from public.plan_marketing
   where coalesce(btrim(target_market), '') <> ''
      or coalesce(btrim(demographics), '') <> ''
      or coalesce(btrim(psychographics), '') <> ''
      or coalesce(btrim(customer_needs), '') <> ''
   on conflict do nothing;

-- Index, updated-at trigger and the same RLS every plan_* table carries. Each part is guarded on its own so
-- the whole migration can be run twice without failing halfway, which is what strands a half-finished push.
create index if not exists plan_market_segments_plan_idx on public.plan_market_segments (plan_id);

do $$ begin
  create trigger plan_market_segments_updated before update on public.plan_market_segments
    for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  perform apply_plan_rls('public.plan_market_segments'::regclass);
exception when duplicate_object then null;
end $$;

-- The four source columns are LEFT IN PLACE, unread. Dropping them in the same migration that creates their
-- replacement leaves no way back if the copy is wrong on a plan nobody has looked at yet; they go in a
-- follow-up once the grid has been used in anger (§6.29 is about a reader bridging a deploy, not about
-- destroying the old shape the moment the new one compiles).

-- WHY THIS PRICE. The SBA asks for it in words — how much you charge and why that price fits the target
-- market while still making a profit. The plan has collected the number since day one and never once asked
-- for the reasoning, so a lender reads a figure with nothing behind it. It goes on the line, beside the
-- price, because a rationale kept on another screen drifts from the figure it is about.
alter table public.plan_products
  add column if not exists pricing_rationale text;

comment on column public.plan_products.pricing_rationale is
  'Why this price: what it costs to deliver, what the market pays, and why this sits where it does (§6.62).';
