# Phase 0: Claude Team Setup Checklist

Week 1 of the CMI AI-OS. It needs no code. It gets every employee using Claude with
their own email, calendar, files, Slack and Plaud recordings while the CMI MCP server
is being built.

**Owner:** Jeremy, as Claude Team admin.
**Time:** about 30 minutes for admin setup, then about 10 minutes per employee.

Claude's admin screens change from time to time. If a label below doesn't match
exactly, look for the closest equivalent under the organization's admin settings.

---

## 1. Admin: enable connectors for the organization

In Claude, go to **Admin settings → Connectors** (organization owner or admin).

Enable these native connectors:

| Connector | What staff get |
| --- | --- |
| Gmail | Search and read their own email |
| Google Calendar | Their meetings and availability |
| Google Drive | Their Docs, Sheets and PDFs |
| Slack | Their channels and DMs |
| Plaud | Their own meeting and phone-call recordings, transcripts and summaries |

Each connector only ever sees the data of the person who connected it. The
company-wide view (other people's inboxes, the executive briefing) comes later from
the CMI app. Who gets it is controlled in **Dashboard → Settings → Claude**.

## 2. Each employee: connect their accounts

Do this once per person, ideally together in a short huddle:

1. Sign in to Claude with the **@constructedmatter.com** account.
2. Open **Settings → Connectors**.
3. Connect **Google** (Gmail, Calendar, Drive) with the work Google account.
4. Connect **Slack** with the work Slack account.
5. Connect **Plaud** with the account they record meetings and calls with.
6. Test it by asking Claude: *"What's on my calendar today, and which emails from
   yesterday still need a reply?"*

## 3. Admin: shared Projects

Create these as shared **Projects** in the Team workspace, and add CMI SOPs and
templates as project knowledge:

| Project | Purpose | Starting knowledge |
| --- | --- | --- |
| Daily Log | Dictate site notes and get a CMI-standard daily log | Daily log template, an example log |
| Meeting Summary | Paste in a Plaud transcript and get a summary, decisions and action items | Meeting summary format |
| Weekly Status | Weekly project status report | Status report format |
| Client Communications | Draft client emails in CMI's voice | Standard correspondence examples |

## 4. Personal daily briefing (works today)

Each person can start the morning with:

> "Give me my morning briefing: today's meetings, emails from the last 24 hours that
> need a reply, Slack threads waiting on me, Plaud action items from yesterday's
> meetings and calls, and anything due this week."

Save it as a project instruction or a saved prompt so it's one click.

## 5. When the CMI MCP server is ready (Phase 1)

Jeremy adds a **custom connector** in **Admin settings → Connectors**:

- Name: `CMI`
- URL: `https://my.constructedmatter.com/api/mcp`

Each person then connects it and signs in with their CMI dashboard account. Claude
can then look up jobs, pipeline, files, daily logs and the company knowledge base,
with the same permissions each person has in the dashboard.

---

**Already done:** every team member has approved the staff email-monitoring
disclosure.
