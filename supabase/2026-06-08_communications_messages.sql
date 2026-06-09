-- ============================================================
-- CMI — Communications / Messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  direction     TEXT        NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel       TEXT        NOT NULL CHECK (channel IN ('email', 'sms', 'call')),

  -- Who it is to/from
  contact_id    UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  to_address    TEXT,   -- email address or phone number
  from_address  TEXT,   -- email address or phone number

  -- Content
  subject       TEXT,   -- email subject
  body          TEXT,
  status        TEXT    NOT NULL DEFAULT 'sent'
                CHECK (status IN ('draft','queued','sent','delivered','failed','received')),

  -- Optional project/quote link
  project_id    UUID    REFERENCES projects(id) ON DELETE SET NULL,
  quote_id      UUID    REFERENCES quotes(id)   ON DELETE SET NULL,

  -- Provider metadata
  provider      TEXT,   -- 'resend', 'smtp', 'twilio', etc.
  provider_id   TEXT,   -- message ID from provider
  error_message TEXT,

  -- Call-specific
  duration_seconds INTEGER,
  recording_url    TEXT,

  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_contact_id_idx ON messages(contact_id);
CREATE INDEX IF NOT EXISTS messages_channel_idx    ON messages(channel);
CREATE INDEX IF NOT EXISTS messages_sent_at_idx    ON messages(sent_at DESC);

-- RLS: staff only
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage messages" ON messages;
CREATE POLICY "Staff can manage messages" ON messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
