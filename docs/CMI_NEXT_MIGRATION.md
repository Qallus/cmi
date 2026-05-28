# CMI Next Dashboard Migration

## Goal

Move the Constructed Matter staff dashboard from the current hybrid HTML/JS app into a modern Next.js, React, TypeScript, Tailwind, and ShadCN-style UI app without breaking the existing production dashboard.

## Current Strategy

The legacy app remains the production fallback:

- `staff-dashboard.html`
- `server.js`
- existing Supabase schema and Express API routes

The new app lives side-by-side at:

```text
apps/cmi-next
```

## First Migration Module

Start with:

```text
/dashboard/project-manager
```

This module targets the existing Project Manager / Gantt tables:

- `project_schedule_items`
- `project_schedule_dependencies`
- `project_templates`
- `project_template_tasks`
- `project_template_phases`

Initial Next routes:

- `GET/POST /api/project-manager/schedule`
- `PATCH/DELETE /api/project-manager/schedule/:id`
- `GET/POST /api/project-manager/dependencies`
- `PATCH/DELETE /api/project-manager/dependencies/:id`
- `GET /api/project-manager/templates`
- `POST /api/project-manager/apply-template`

## Guardrails

- Do not rewrite the old dashboard in place.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client components.
- Add auth/session enforcement before this app is exposed beyond a private test environment.
- Preserve the current CMI branding and design-system direction.
- Convert one dashboard section at a time after Project Manager reaches feature parity.

## Suggested Conversion Order

1. Project Manager / Gantt
2. Contacts
3. Quotes & Leads
4. Projects
5. Bookings
6. Portfolio
7. Team
8. Blog
9. Documents
10. Settings

## Known Next Step

Add the real staff auth/session layer before deploying the Next dashboard publicly. The initial scaffold uses server-side Supabase access so we can prove the module shape, but it is not ready to expose without authentication middleware.
