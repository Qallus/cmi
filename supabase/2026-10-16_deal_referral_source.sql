-- Deals: who referred the lead, when Source = referral.
-- Carried onto the Pre-Con record (pipeline_opportunities.referral_source) at Closed Won.
ALTER TABLE deals ADD COLUMN IF NOT EXISTS referral_source TEXT;
