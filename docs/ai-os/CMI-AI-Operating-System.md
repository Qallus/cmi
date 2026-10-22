# CMI AI Operating System — Implementation Brief

**Company:** Constructed Matter, Inc. (CMI)
**Prepared for:** Implementation Working Sessions — Wednesday, October 21, 2026
**Web app:** my.constructedmatter.com (Next.js 15 · Supabase · shadcn/ui · Coolify VPS)

---

## 1. Decision Summary

- CMI will set up a **company-managed Business / Enterprise AI plan** (ChatGPT Business or Claude Team/Enterprise) with **individual employee accounts**.
- The single shared-account approach is retired due to limits on permissions, individual integrations, personalized context, security, and scalability.
- The **CMI web app is the integration layer** — the source-of-truth hub that connects company systems, holds the shared knowledge base and commitment register, and exposes them to whichever AI platform CMI uses.
- AI is the **intelligence layer**, not a replacement for existing systems. It connects them, manages information, flags what needs attention, and makes the team more efficient.

---

## 2. Goal

Build a **CMI AI Operating System** that:

- Works for the team today and scales as CMI grows.
- Pulls from underlying sources of truth instead of creating disconnected duplicates.
- Is **model-agnostic** — company knowledge, workflows, project records, and integrations live independently of any one AI provider.
- Enforces role-based permissions: employees see what's relevant to their role; leadership has company-wide oversight.
- Gets usable tools into the team's hands **now**, and keeps improving while in use.

---

## 3. Core Components

### 3.1 Individual Employee Assistants & Daily Briefings

Each team member gets an AI interface that understands their role, responsibilities, assigned projects, and relevant communications.

**Morning briefing includes:**
- Today's meetings, appointments, and scheduled commitments
- Outstanding action items and follow-ups
- Emails and Slack messages needing attention
- Updates on assigned projects
- Items waiting on clients, subcontractors, or teammates
- Upcoming deadlines, schedule conflicts, and potential issues

Tailored per person; underlying systems and processes consistent company-wide.

### 3.2 Company-Wide Executive Briefing & Oversight

A master briefing across all projects, communications, and employee responsibilities.

**Example questions:**
- What client emails or requests haven't been addressed?
- What commitments to clients or subcontractors are unresolved?
- What are Joe, Ben, Yovana, Fernando, or others working on that needs leadership attention?
- Which projects have outstanding decisions, scheduling issues, or potential delays?
- Which proposals, budgets, or follow-ups have gone stale?
- What has fallen through the cracks between people or platforms?

**Sources:** authorized company Gmail accounts, Slack, calendars, project management records, meeting notes, and other relevant systems.

**Requirements:**
- Not just summarizing — recognize actionable items, track responsibility, detect whether items were addressed, and keep them visible until resolved.
- **Daily executive briefing** + **weekly company review**.
- Drill-down by project or employee.

### 3.3 Centralized Company Knowledge Base

One approved, permissioned knowledge source for everyone — not six AI accounts taught separately, and not dependent on any one person's chat history or memory.

**Contents:**
- SOPs, policies, standardized procedures
- Active and historical project information
- Job numbers, addresses, client info, project assignments
- Estimating templates, budgeting practices, historical cost data
- Standard correspondence and document formats
- Meeting notes, daily logs, project history
- Employee roles and responsibilities

### 3.4 Shared Agents, Forms & Workflows

Function-based company agents, defined once and updated centrally.

**Example — Daily Log agent:**
1. Select the project
2. Dictate what happened on-site
3. Upload photos
4. AI formats the log to CMI's standard
5. Log saves to the project record; photos file to the correct project folder
6. Follow-up items are identified and tracked

**Other workflows:**
- Meeting summaries & action-item extraction
- Weekly project status reports
- Client communication drafts
- Subcontractor follow-up tracking
- Preliminary budgets & estimating assistance
- Scope development & proposal preparation
- Project closeout checklists
- Internal administrative workflows

### 3.5 Integration With Existing Systems

| System | Role |
|---|---|
| Google Workspace / Gmail / Calendar | Communications, scheduling, follow-up tracking |
| Slack | Internal comms, project channels, action items, possible agent interface |
| Adaptive | Project management, job info, schedules, budgets, project records |
| QuickBooks | Accounting, financial reporting, project financials |
| Plaud.ai | Meeting and phone-call recordings, transcripts, summaries, commitments. Uses the native Claude/ChatGPT connector per user, plus a planned `plaud-sync` into Recording Studio |
| Google Drive / Project Files | Project documentation, templates, company knowledge |

Some have native AI-platform connectors; others need custom APIs or middleware.

> **Update 2026-10-21:**
> - **Claude Team** is the platform.
> - The CMI MCP server will live inside the web app at `/api/mcp`.
> - Who gets company-wide access, and who receives AI-generated email, SMS, DMs and notifications, is managed in **Dashboard → Settings → Claude**.
> - The staff email-monitoring disclosure is approved.
> - Plaud is covered in `docs/mcp/CMI-MCP-PLAN.md` (section "Plaud.ai"), which is now the working build plan.

### 3.6 Centralized Action Item & Commitment Tracking

A company-wide register of commitments and action items.

**Example:** Joe emails a client promising an updated budget next week → the system captures the commitment, links it to the project, and tracks it. When Ben completes it, the system recognizes it or verifies status through project records.

Prevents items discussed in email, calls, meetings, or Slack from never reaching a task list. Requires an **underlying database and automation layer** — not just a chat connector.

---

## 4. CMI Web App Integration Layer

The web app becomes the shared backbone. The AI plan (ChatGPT or Claude) is the front-end interface; the web app owns the data.

### 4.1 Architecture

```
 Employees ──> AI Workspace (ChatGPT Business / Claude Team)
                     │  (native connectors + CMI MCP server)
                     ▼
            CMI Web App — Integration Layer (Supabase)
   ┌──────────┬────────────┬──────────────┬─────────────┐
   │Knowledge │ Commitment │  Briefing    │  Workflow   │
   │  Base    │  Register  │  Engine      │  Records    │
   └──────────┴────────────┴──────────────┴─────────────┘
                     ▲  sync / webhooks / APIs
   Gmail · Calendar · Drive · Slack · Adaptive · QuickBooks · Plaud
```

### 4.2 Modules to Build

1. **CMI MCP Server** — exposes web app data and actions to whichever AI platform is used. This is the key to staying model-agnostic.
2. **Knowledge Base** — versioned SOPs, templates, standards, roles; tagged by permission level.
3. **Commitment & Action Register** — Supabase tables for commitments (source, owner, project, due date, status, evidence of completion).
4. **Ingestion / Sync Jobs** — pull Gmail, Calendar, Slack, Plaud, Adaptive, QuickBooks into the register and project records.
5. **Briefing Engine** — scheduled jobs generating per-employee daily briefings, a daily executive briefing, and a weekly company review.
6. **Workflow Records** — Daily Logs, meeting summaries, status reports saved to project records; photos routed to the Files module.
7. **Permissions** — role-based access (employee vs. leadership) enforced in Supabase RLS, mirrored in what the MCP server returns.

### 4.3 Suggested Data Entities

- `employees` (role, assigned projects, connected accounts)
- `projects` (job number, address, client, assignments, Adaptive ID)
- `commitments` (description, owner, project, source, source_link, due, status, resolved_by, resolved_evidence)
- `knowledge_docs` (title, category, version, access_level)
- `daily_logs`, `meeting_notes`, `status_reports`
- `briefings` (type, recipient, period, content, generated_at)
- `integration_connections` (system, user/company, scopes, last_sync)

---

## 5. What Can Be Done Now vs. Later

### Immediate (existing platform features)
- Business/Enterprise workspace with individual accounts
- Each user connects their own Gmail, Calendar, Drive, and Slack via native connectors
- Shared project/knowledge files loaded into the workspace
- Shared function-based agents/projects (Daily Log, Meeting Summary, Status Report, Client Draft)
- Personal daily briefings from each user's own connected accounts

### Requires custom development (CMI web app)
- Company-wide executive briefing across all employees' data
- Commitment & action register with resolution tracking
- Adaptive, QuickBooks, and Plaud integrations
- Saving workflow output into project records automatically
- CMI MCP server and model-agnostic knowledge base

---

## 6. Recommended Rollout

1. **Set up workspace** — Business/Enterprise plan, individual employee accounts.
2. **Seed knowledge** — SOPs, templates, roles, active project list.
3. **Publish first shared agents** — Daily Log, Meeting Summary, Weekly Status.
4. **Connect Google Workspace + Slack** per user; start personal daily briefings.
5. **Build web app integration layer** — MCP server, commitment register, sync jobs.
6. **Launch executive briefing** — daily, then weekly review with drill-down.
7. **Expand integrations** — Adaptive, Plaud, QuickBooks.
8. **Automate commitment tracking** across all systems.

**Target:** first usable components in the team's hands within **1–2 weeks** of October 21, 2026, with deeper integrations built in parallel while the team uses the tools.

---

## 7. Questions to Resolve

1. What can we implement immediately with ChatGPT, Claude, Slack, and Google Workspace?
2. What is the minimum setup to get each team member using AI effectively?
3. Can individual and executive briefings start before full integrations are complete?
4. Which already-developed workflows are ready for use?
5. What requires custom development vs. existing platforms?
6. What is a realistic rollout schedule, and what's needed to start?
7. How do we keep shipping usable tools along the way instead of building toward one large end product?

---

## 8. Working Sessions — Wednesday, October 21, 2026 (CMI Office)

**10:00–11:00 AM — AI Platform, Structure & Initial Rollout**
- Review account structure, shared knowledge base, agents, and completed work
- Identify what can be implemented immediately
- Decide on initial platform and team setup

**1:30–2:30 PM — Briefings, Workflows & Implementation Plan**
- Individual and executive briefings
- Cross-system integrations and centralized action tracking
- Workflows ready for rollout
- Set priorities, responsibilities, and target dates

**Session outcome:** a clear, actionable plan, with first usable components in the team's hands within the next week or two.
