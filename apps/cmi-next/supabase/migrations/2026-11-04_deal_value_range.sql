-- Deals: an estimated value can be a range (Brandon quotes "$850k – $950k").
-- estimated_value stays the low end (or the single number); estimated_max_value
-- is the high end, null when the estimate is one number. Totals and sorting
-- use the midpoint. Ends in _value, so the MCP money redaction covers it.
alter table public.deals
  add column if not exists estimated_max_value numeric;

do $$ begin
  alter table public.deals add constraint deals_value_range_check
    check (estimated_max_value is null or estimated_value is null or estimated_max_value >= estimated_value);
exception when duplicate_object then null; end $$;
