-- Separate the public Project Canvas surface from the staff/client feature.
--
-- `project_canvas`         → gates the dashboard + client-portal Canvas feature
--                            (stays ON).
-- `project_canvas_public`  → gates the PUBLIC frontend surfaces: site nav,
--                            footer link, and the /project-canvas landing page.
--                            Starts OFF; flip to true when ready to launch the
--                            feature publicly. Absent/false = hidden.
insert into public.feature_flags (key, enabled, description)
values (
  'project_canvas_public',
  false,
  'Show Project Canvas on the public frontend (site nav, footer, and /project-canvas landing). Keep off until ready to go live; the dashboard/client feature is controlled separately by project_canvas.'
)
on conflict (key) do nothing;
