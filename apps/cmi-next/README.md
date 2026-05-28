# CMI Next Dashboard

Side-by-side Next.js migration workspace for the Constructed Matter staff dashboard.

The current HTML/Express dashboard remains the production fallback. This app starts with the Project Manager / Gantt module and should absorb the rest of the dashboard one page at a time.

## First Module

- `/dashboard/project-manager`
- Reads/writes the existing Supabase project-management tables:
  - `project_schedule_items`
  - `project_schedule_dependencies`
  - `project_templates`
  - `project_template_tasks`
  - `project_template_phases`

## Local Setup

Create `apps/cmi-next/.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The service role key is server-only. Never expose it through client components or `NEXT_PUBLIC_*` variables.

## Run

```bash
npm install
npm run dev
```

## Migration Rule

Keep the legacy dashboard working. Add new Next routes section by section, then cut traffic over only when the matching module has feature parity.
