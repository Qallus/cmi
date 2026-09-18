-- Portfolio project team credits: Architect, Interior Designer, and an
-- optional repeater of additional participants ({ role, name }), e.g.
-- { "role": "Painter", "name": "Jeremy Waters" }.
-- show_participants gates the repeater on the public project page so staff can
-- keep the entries while hiding them.

ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS architect TEXT,
  ADD COLUMN IF NOT EXISTS interior_designer TEXT,
  ADD COLUMN IF NOT EXISTS show_participants BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS participants JSONB NOT NULL DEFAULT '[]'::jsonb;
