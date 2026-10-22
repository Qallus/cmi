# CMI MCP Server + Paperclip Briefings: Project Plan

> **Decisions as of 2026-10-21.** The implementation plan approved with Jeremy changes
> some details below.
> - The MCP server lives **inside the existing app** at
>   `https://my.constructedmatter.com/api/mcp`, not in a separate `/mcp-server`
>   service. It reuses Bolt's tool registry and permissions. The code is isolated in
>   `apps/cmi-next/lib/mcp/` so it can be split out later, and
>   `mcp.constructedmatter.com` can be a domain alias.
> - **"Owner" means a named allowlist, not a role.** Jeremy manages it in
>   **Dashboard → Settings → Claude**. The same tab controls who may receive
>   AI-generated email, SMS, DMs and notifications, for both staff and contacts.
> - MCP access follows the Bolt roles (super_admin, admin, project_manager, designer,
>   estimator, superintendent). Financial data is limited to super_admin, admin and
>   project_manager.
> - Version 1 allows reads plus safe creates (daily logs, job notes, tasks). It has no
>   sends, deletes or updates.
> - **Every team member has already approved the staff email-monitoring disclosure.**
> - Slack uses Claude's native connector only.
> - **Plaud.ai** is in scope; see the Plaud.ai section below.

## Primary Objective
Build one CMI MCP server that combines CMI's Google Workspace data (Gmail, Drive, Sheets) with the CMI web app data (Pipeline/CRM, Projects, Projections, Files). It feeds two consumers:
1. Every CMI employee's own Claude, through the Claude Team account as a custom connector.
2. Paperclip agents running on the Coolify VPS, mainly a scheduled Briefing agent that emails each staff member a detailed daily briefing and sends ownership an executive summary.

Ownership goals: CMI owns its data and automations, costs stay controlled, and agents only do CMI work.

## Current State
- CMI web app (https://my.constructedmatter.com): Next.js 16, Supabase, Tailwind/Radix, hosted on a Coolify VPS. Repo: https://github.com/Qallus/cmi
- Dashboard modules include Pipeline/CRM, Projects, Projections and Files. File bytes live on the CMI office server (Garage S3), reached over Tailscale with the web app as the gatekeeper.
- Claude Team account is active and every employee has their own seat.
- Paperclip runs on the Coolify VPS. Gauge (the forecasting agent) already exists and must answer only from the dashboard Projections numbers.
- Google Workspace hosts company email and docs on the constructedmatter.com domain.
- Plaud.ai records meetings and phone calls. Staff use Plaud's native connector in Claude and ChatGPT.

## Architecture
- One MCP server (TypeScript, official MCP SDK, Streamable HTTP transport), served by the existing CMI app at https://my.constructedmatter.com/api/mcp. mcp.constructedmatter.com is an optional alias.
- Google access: a Workspace service account with domain-wide delegation, READ-ONLY scopes only: gmail.readonly, drive.readonly, spreadsheets.readonly. It impersonates the user it is acting for.
- CMI data access: the Supabase server client inside the MCP server, or calls to internal web app API routes. Never expose service keys to clients.
- Auth: every request maps to a CMI identity: the staff email, their dashboard role, and whether they are on the Settings → Claude company-wide allowlist. Use OAuth for Claude Team connector users and a scoped bearer token per Paperclip agent.

## Hard Rules (enforce in code, not only in prompts)
1. Data scoping: a staff caller can only read their OWN mailbox, files and assigned projects. Only the owner role, plus the Briefing agent acting on its behalf, can read company-wide.
2. Google is read-only in v1. The only write action is sending a briefing.
3. Every tool call is audit logged in a Supabase table mcp_audit_log (caller, tool, target user, timestamp, success).
4. Gauge's numbers come only from Projections. Never estimate or invent figures.
5. Keep it clean and functional. Don't over-engineer.

## MCP Tools

### CMI web app
- cmi_list_staff: staff directory (name, email, role, briefing opt-in)
- cmi_list_projects(filter: status, assignee): projects with status, PM and key dates
- cmi_get_project(project_id): full project record, including recent activity and open items
- cmi_list_pipeline(stage, owner): leads and opportunities through Pre-Con, Contracted and Construction
- cmi_get_projections(period): Projections module figures (Gauge's source of truth)
- cmi_list_files(project_id or since): Files module metadata only, not bytes
- cmi_list_tasks_due(user_email, window): upcoming deadlines, inspections and follow-ups

### Google Workspace (impersonating target user, read-only)
- gmail_search(user_email, query, since, max): thread summaries (subject, from, date, snippet)
- gmail_get_thread(user_email, thread_id): full thread text
- drive_list_recent(user_email, since): recently modified or shared files
- drive_read_file(user_email, file_id): text export of Docs/PDFs
- sheets_get_values(user_email, spreadsheet_id, range): sheet data

### Briefing
- briefing_get_context(user_email, since): ONE aggregate call that returns that person's new and important email, recent Drive/Sheets activity, assigned projects, pipeline items and due tasks. It's the main tool the Briefing agent uses.
- briefing_get_exec_context(since): company-wide rollup for ownership (Projections and Gauge figures, pipeline movement, at-risk projects, key client emails). Owner role only.
- briefing_send(to, subject, html, kind: staff or exec): sends from a briefings@constructedmatter.com address (Gmail send-as or Resend) and logs to briefing_log.
- briefing_log_list(since): sent history, for checking and avoiding duplicates

### Plaud.ai (meetings and calls)
- cmi_list_meetings(since, job/deal, kind: meeting or call): recordings synced from Plaud and Recording Studio, with title, date, attendees, linked job/deal, and summary.
- cmi_get_meeting(meeting_id): the full transcript, summary and action items.
- briefing_get_context also includes "meetings and calls since yesterday".

## Plaud.ai

CMI uses **Plaud.ai** to record in-person meetings and phone calls. Plaud transcribes and summarizes each recording.

There are two ways recordings reach the AI. They serve different purposes, and both are in scope:

1. **Plaud's native connector (now, no build).** Each employee connects their own Plaud account in Claude, and in ChatGPT if they use it. Their personal Claude can then search their own recordings. This is part of the Phase 0 / week-1 setup, alongside the Google Workspace and Slack connectors. Admins enable it in the Claude Team connector settings, and each person signs in to it.
2. **Plaud sync into the CMI app (later build).** This makes recordings part of the company record, so they show up on the job or deal, feed action items, and reach the executive briefing. Recordings someone keeps in a personal connector are invisible to everyone else.
   - **Proof test first:** confirm the server can hold a CMI Plaud account's auth through Plaud's API, MCP or CLI. The fallback is running the Plaud CLI on the CMI office server. **No Zapier.**
   - **"Connect Plaud"** in each person's My Profile stores their Plaud token server-side, never in the browser.
   - A **`plaud-sync` Coolify Scheduled Task** runs every 15 minutes.
     - It pulls new recordings, transcripts and summaries into Recording Studio (`meetings` table, `apps/cmi-next/lib/meetings/`).
     - It tags each one as a meeting or a phone call and matches it to a job or deal.
     - It extracts action items as suggested tasks for a person to approve.
   - The MCP tools above (`cmi_list_meetings`, `cmi_get_meeting`) then expose them to Claude and to Paperclip agents, with the same permissions as the dashboard.

**Open items:**
- A CMI Plaud account to use for the proof test.
- Confirmation of what Plaud's API and MCP allow server-side.
- Which recordings are company records and which are personal. The default: only recordings from connected work accounts sync.

## Paperclip Setup (Constructed Matter company, separate from Qallus)
- CEO (Operations Director): delegates and reports to Jeremy/ownership
- Gauge (Finance/Forecasting): uses cmi_get_projections only
- Briefing Agent: runs on a schedule (weekday mornings), loops over cmi_list_staff, calls briefing_get_context, writes and sends each staff briefing, then builds the ownership executive summary with Gauge's figures
- Pre-Con/Estimating agent and Project Coordinator: later phases
- Employee personal agents are NOT Paperclip agents. Each employee uses their own Claude (Team seat) with the CMI MCP connector.
- Every Paperclip agent gets its own scoped token and a monthly budget. Check whether automated agents need an API key rather than a Team seat.

## Briefing Format
Staff briefing: top priorities today; emails needing a reply; project updates; pipeline items they own; due dates this week; recently changed files.
Executive summary: cash/projections snapshot (Gauge); pipeline movement; projects at risk; notable client communications; decisions needed from ownership. Keep it to one screen.

## Phases (stop for Jeremy's approval after each)
0. Week 1, no build: enable the native Google Workspace, Slack and Plaud connectors in Claude Team. Each person connects their own accounts. See `docs/ai-os/phase-0-claude-team-setup.md`.
1. Scaffold the MCP server inside the app (`/api/mcp`, `lib/mcp/`), add OAuth sign-in with identity and role mapping, add the audit log table, add the Settings → Claude access tab, and implement the CMI read-only tools. Test with MCP Inspector.
2. Set up the Google service account with domain-wide delegation (Jeremy does the Workspace admin steps; Claude Code provides exact instructions), then implement the Gmail, Drive and Sheets tools with scoping enforced.
3. Implement briefing_get_context, briefing_get_exec_context, briefing_send and briefing_log. Test by sending briefings to Jeremy only. (The morning briefing is paused, so Brandon must re-approve before anything goes wider.) Then run the Plaud proof test and build `plaud-sync` and the meeting tools.
4. Add https://my.constructedmatter.com/api/mcp as a custom connector on the Claude Team account. It ships with the normal master → Coolify deploy.
5. Create the Paperclip agents (CEO, Gauge connection, Briefing agent) with tokens, budgets and the schedule.
6. Pilot with 2 staff (Joe, Brandon) plus the ownership summary, then roll out to all staff.
7. Later: Pre-Con and Coordinator agents, and write actions behind approval.

## Instructions for Claude Code
- Work one phase at a time and stop for approval before moving on.
- Give step-by-step instructions for anything Jeremy must do by hand (Google Admin, Coolify, DNS at Squarespace).
- Favor simple, working code over abstraction.
- Never commit secrets. Use environment variables in Coolify.