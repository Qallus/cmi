-- Fixes the real exposure behind the Supabase "publicly accessible" warning:
-- 31 tables carried a permissive `FOR ALL TO anon USING (true) WITH CHECK (true)`
-- policy, so anyone holding the public anon key could read/insert/update/delete
-- client contacts, invoices, quotes, documents, jobs, etc.
--
-- These policies existed only to support the legacy staff-dashboard.html, which
-- talked to Supabase directly with the anon key. That app has been removed; the
-- live Next.js app (apps/cmi-next) uses the service-role key server-side ONLY
-- (no anon client, no NEXT_PUBLIC_SUPABASE key), and service-role bypasses RLS.
-- There are no edge functions and n8n is not in play. So nothing depends on anon
-- access to these tables. RLS is already enabled on all of them; dropping the
-- policy leaves RLS on with no permitting policy => anon/authenticated get zero
-- rows, service-role is unaffected.
--
-- NOT touched here (intentional):
--   * portfolio.portfolio_public_published_read  -> safe anon SELECT of published
--     rows; kept as a public-read safety net.
--   * portfolio.portfolio_authenticated_all       -> permissive but only reachable
--     with a real Supabase-Auth JWT, which this app never issues (Phase 2 review).
--   * legitimate public-insert endpoints (contact_submissions, business_card_leads,
--     booking registrations, messaging consent) -> Phase 2.
--
-- ROLLBACK (per table, if ever needed):
--   CREATE POLICY <policyname> ON public.<table>
--     FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_all_blog                        ON public.blog_posts;
DROP POLICY IF EXISTS anon_all_bookings                    ON public.bookings;
DROP POLICY IF EXISTS anon_all_change_orders               ON public.change_orders;
DROP POLICY IF EXISTS anon_all_client_notification_prefs   ON public.client_notification_prefs;
DROP POLICY IF EXISTS anon_all_client_notifications        ON public.client_notifications;
DROP POLICY IF EXISTS anon_all_contacts                    ON public.contacts;
DROP POLICY IF EXISTS anon_all_daily_logs                  ON public.daily_logs;
DROP POLICY IF EXISTS anon_all_documents                   ON public.documents;
DROP POLICY IF EXISTS anon_all_invoice_line_items          ON public.invoice_line_items;
DROP POLICY IF EXISTS anon_all_invoices                    ON public.invoices;
DROP POLICY IF EXISTS anon_all_job_action_items            ON public.job_action_items;
DROP POLICY IF EXISTS anon_all_job_activity_logs           ON public.job_activity_logs;
DROP POLICY IF EXISTS anon_all_job_contacts                ON public.job_contacts;
DROP POLICY IF EXISTS anon_all_job_files                   ON public.job_files;
DROP POLICY IF EXISTS anon_all_job_groups                  ON public.job_groups;
DROP POLICY IF EXISTS anon_all_job_insurance               ON public.job_insurance;
DROP POLICY IF EXISTS anon_all_job_internal_users          ON public.job_internal_users;
DROP POLICY IF EXISTS anon_all_job_messages                ON public.job_messages;
DROP POLICY IF EXISTS anon_all_job_settings                ON public.job_settings;
DROP POLICY IF EXISTS anon_all_job_types                   ON public.job_types;
DROP POLICY IF EXISTS anon_all_job_updates                 ON public.job_updates;
DROP POLICY IF EXISTS anon_all_job_vendors                 ON public.job_vendors;
DROP POLICY IF EXISTS anon_all_jobs                        ON public.jobs;
DROP POLICY IF EXISTS anon_all_pipeline_opportunities      ON public.pipeline_opportunities;
DROP POLICY IF EXISTS anon_all_pipeline_stage_history      ON public.pipeline_stage_history;
DROP POLICY IF EXISTS anon_all_portfolio                   ON public.portfolio;
DROP POLICY IF EXISTS anon_all_projects                    ON public.projects;
DROP POLICY IF EXISTS anon_all_quotes                      ON public.quotes;
DROP POLICY IF EXISTS anon_all                             ON public.task_comments;
DROP POLICY IF EXISTS anon_all_team                        ON public.team_members;
DROP POLICY IF EXISTS anon_all_warranty_requests           ON public.warranty_requests;
