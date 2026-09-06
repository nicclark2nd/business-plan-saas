-- Sales §6.17: an ongoing line can inherit its clients from another line instead of winning them itself —
-- a franchisor's royalty follows the licences sold, a service plan follows the equipment, annual support
-- follows the software licence, a membership follows the joining fee. One level only: a line that is itself
-- fed by another cannot feed a third, which keeps the chain from looping.
alter table plan_products
  add column if not exists clients_from_product_id uuid references plan_products(id) on delete set null;

create index if not exists plan_products_clients_from_idx on plan_products (clients_from_product_id);

comment on column plan_products.clients_from_product_id is
  'Ongoing lines only: every unit the named product sells becomes a client here, from the month it sells.';
