-- 0012: product lifecycle stage and notes (APeX Product dialog: lifecycle; features/strengths/weaknesses folded into one notes field).
create type product_lifecycle as enum ('development','introduction','growth','maturity','saturation','decline');
alter table plan_products
  add column lifecycle product_lifecycle,
  add column notes text;   -- why customers buy it, margin comments, weaknesses — free text for the report's products section
