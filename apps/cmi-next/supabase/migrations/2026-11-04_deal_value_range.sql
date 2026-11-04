-- Deals: besides the estimated amount, an estimated range (Brandon quotes
-- "$850k – $950k"). estimated_value stays the estimated amount; the low and
-- high ends are separate and optional. Totals use the amount, or the range's
-- midpoint when there's no amount. Both end in _value, so the MCP money
-- redaction covers them.
alter table public.deals
  add column if not exists estimated_low_value numeric,
  add column if not exists estimated_high_value numeric;

do $$ begin
  alter table public.deals add constraint deals_estimate_range_check
    check (estimated_low_value is null or estimated_high_value is null or estimated_high_value >= estimated_low_value);
exception when duplicate_object then null; end $$;
