-- Staff notification center (top-bar bell): mark inbound messages and
-- business-card leads as "read" WITHOUT changing their business status (their
-- status enums have no read state). contact_submissions uses status='read' and
-- dashboard_notes uses read_by[], so only these two need a tracking column.
-- Applied to the live project via MCP on 2026-07-08.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS notification_read_at TIMESTAMPTZ;
ALTER TABLE business_card_leads ADD COLUMN IF NOT EXISTS notification_read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_notif_unread
  ON messages (created_at)
  WHERE direction = 'inbound' AND status = 'received' AND notification_read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bcleads_notif_unread
  ON business_card_leads (created_at)
  WHERE status = 'new' AND notification_read_at IS NULL;
