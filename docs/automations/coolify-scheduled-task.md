# Coolify Scheduled Task — the automation run

Everything time-based in the dashboard (insurance expiring, licence expiring,
qualification renewals, stalled applications, queued booking notifications)
runs off **one** endpoint that something outside the app has to call on a
schedule. Coolify's Scheduled Tasks is that something.

- Endpoint: `POST /api/automations/run`
- Auth: a shared secret in a header — there is no user behind a cron
- Safe to call twice: every event carries a unique dedupe key, so a repeat run
  finds nothing new to create and nothing pending

---

## Step 1 — Add three environment variables

In Coolify → your CMI application → **Environment Variables**. Add all three,
then **Redeploy** (env changes don't take effect until the app restarts).

```
AUTOMATION_SECRET=886287bc3f3ad48367f3055fa87a8245e3952c9fec7b7500ea364537e5314fd8
```

```
AUTOMATION_ENABLED=false
```

```
AUTOMATION_STAFF_EMAIL=info@constructedmatter.com
```

**Leave `AUTOMATION_ENABLED` as `false` to start with.** While it is false the
run still scans everything and writes down exactly what it *would* send, but
sends nothing. That's the point — you get a few days of evidence before the app
is allowed to email or text anyone. Flip it to `true` when the logs look right.

`AUTOMATION_SECRET` is a fresh 64-character random value generated for this.
It is already in `apps/cmi-next/.env.local` for local runs. Treat it like a
password: anyone with it can trigger a run.

`AUTOMATION_STAFF_EMAIL` is where the *internal* nudges go — "this application
has been sitting unreviewed for 3 days". Partner-facing mail goes to the
partner, not here.

---

## Step 2 — Create the Scheduled Task

Coolify → your CMI application → **Scheduled Tasks** → **+ Add**.

| Field | Value |
| --- | --- |
| Name | `automations` |
| Command | see below |
| Frequency | `0 8 * * *` |
| Container | leave as the app's own container |

**Command** (one line, paste as-is):

```sh
wget -qO- --header="Authorization: Bearer $AUTOMATION_SECRET" http://localhost:3000/api/automations/run
```

Two constraints shaped that line, both learned the hard way:

- **Not `curl`.** The image is `node:20-alpine` and has no curl — the command
  fails with `sh: curl: not found`. Alpine's busybox provides `wget`, which
  does the same job. `-q` drops the progress noise, `-O-` puts the JSON
  summary in the task log, and a non-2xx makes wget exit non-zero so Coolify
  marks the run Failed instead of passing silently.
- **No single quotes anywhere in the command.** Coolify builds a raw SQL
  statement to save the task, and a `'` terminates it — the save fails with a
  half-written `UPDATE ... where "id" = 1` in the error. Double quotes are
  fine. This rules out the obvious `node -e '…'` alternative.

It's a GET; the endpoint accepts either verb, and GET keeps the command short.

`localhost:3000` because the task runs *inside* the app container — it doesn't
need to go back out through the internet. The secret is read from the
environment at run time, so it never appears in the task definition.

### Frequency

`0 8 * * *` is **08:00 every day, in the server's timezone (UTC unless Coolify
says otherwise)**. 08:00 UTC is 01:00 Phoenix. If you'd rather the run happen
during the Arizona workday, use `0 15 * * *` — 15:00 UTC is 08:00 Phoenix.

Once a day is right for this. Everything it watches is measured in days
(30 days to expiry, 7 days, expired today), so there is nothing to gain from
running it hourly.

---

## Step 3 — Check it worked

Trigger it once by hand from the Coolify task's **Run now** button, then look
at the two log tables in Supabase:

```sql
select trigger, started_at, finished_at, scanned, error
from automation_runs
order by started_at desc
limit 10;
```

A healthy row has `error = null`, a `finished_at`, and a `scanned` object like
`{"document_expiries": 2, "qualification_renewals": 0, "awaiting_review": 1, "queued_bookings": 0}`.

```sql
select kind, recipient, channel, status, skip_reason, error, created_at
from automation_events
order by created_at desc
limit 50;
```

While `AUTOMATION_ENABLED=false` these sit at `pending` — that's the list of
what will go out the moment you switch it on. **Read that list before you flip
the switch.** Anything in it you don't want sent, mark off first:

```sql
update automation_events set status = 'skipped', skip_reason = 'reviewed, not wanted'
where id = '...';
```

---

## Step 4 — Go live

When the pending list reads the way it should, change
`AUTOMATION_ENABLED` to `true` in Coolify and redeploy. Nothing else changes —
same endpoint, same schedule, same secret.

---

## What the run actually does

| Scan | Trigger | Goes to |
| --- | --- | --- |
| Document expiries | A `company_documents` row with an `expires_at` 30 days out, 7 days out, or today | The partner's contact email/SMS |
| | Anything already past its expiry also gets flipped to status `expired` | — |
| Qualification renewals | `companies.qualification_expires_at` at the same 30/7/0 thresholds | The partner |
| Stalled applications | A submitted `prequal_applications` row nobody has moved in 3 days | `AUTOMATION_STAFF_EMAIL` |
| Queued bookings | `booking_notifications` still `queued` | The booking's contact |

Consent is checked before every single send — `isSuppressed` in
`lib/messaging/consent.ts`, the same gate the rest of the app uses. Someone who
replied STOP will not be texted by the cron.

Booking notifications older than **24 hours** are marked `skipped`, never sent.
A confirmation for an appointment that already happened is worse than silence.

## Responses you might see

| Code | Meaning |
| --- | --- |
| `200` | Ran. Body is the summary — `dry_run`, `run_id`, `scanned`, `sent`, `skipped`, `failed`. |
| `401` | Wrong or missing secret. |
| `503` | `AUTOMATION_SECRET` isn't set on the app. Step 1 wasn't applied, or the app wasn't redeployed after — env vars only reach the container on a deploy. |
| `500` | The run itself broke. The reason is in `automation_runs.error`. |

Add `?dry=1` to force a dry run even when `AUTOMATION_ENABLED=true` — useful
for a one-off "what would this send right now?" without sending it.

## Code

- `apps/cmi-next/app/api/automations/run/route.ts` — auth and the entry point
- `apps/cmi-next/lib/automations/runner.ts` — the scans and the dispatcher
- `automation_events`, `automation_runs` — the log tables
