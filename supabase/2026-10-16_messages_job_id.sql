-- Messages sent from inside a Job (the job top-bar Calls / SMS / Email tools)
-- are tagged with that job, so the job's Communications feed shows them even
-- when the recipient isn't a linked client contact. (messages.project_id points
-- at the legacy `projects` table, not jobs.)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_job ON messages(job_id);
