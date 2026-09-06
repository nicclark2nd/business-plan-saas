-- 0011: a plan can say it has no trading history yet (startups), and each historic period remembers its source.
alter table plan_settings add column has_history boolean;   -- null = not answered, true = has accounts, false = new business
