# CLAUDE.md — Constructed Matter, Inc. (CMI)

**Read `AGENTS.md` first.** It is the source of truth for every agent: the stack, the
repo map, commands, security and messaging rules, schema conventions, Bolt, Paperclip
and Hermes, and git and deploy. This file only adds notes specific to Claude Code.

In short: CMI is one Next.js 16 app (`apps/cmi-next`) on Supabase, Resend and Twilio,
with Bolt on Hermes, agents managed by Paperclip, and deploys through GitHub and
Coolify. **There is no WordPress, FluentCRM, FluentBoards, FluentBooking or WS Form.**
If any doc, plan or old note says otherwise, trust the code.

---

## Claude Code specifics

- **Inspect before you edit.** Grep for an integration before you describe it, and
  read the domain's `lib/<domain>/data.ts` and its API route before you change
  either one.
- **Work in `apps/cmi-next`.** Run `npm run typecheck`, `npm run lint` and
  `npm run test` there. Report failures with their output.
- **Supabase MCP:** read-only queries are fine. Write schema changes as a migration
  file in `apps/cmi-next/supabase/migrations/` first, and apply one to the live
  project only after the user approves it.
- **External messages:** never send real email, SMS, push or broadcasts while
  testing. Outbound sending is held outside production, so do not set
  `NOTIFY_FORCE_SEND` unless asked.
- **Bolt's guide:** a change to any dashboard nav item, page or feature also
  updates `lib/agent/dashboard-guide.ts`.
- **Commits:** commit only when asked. Stage only the files you changed, by
  explicit path, and push to `master`, which deploys to production. The working tree
  routinely contains unrelated untracked files, so leave them alone.
- **Plans:** for multi-phase features, write the plan or spec under `docs/features/`
  and build behind a `feature_flags` row that stays off until approved.
- **Secrets:** never echo, log or commit secret values. If you find one committed in
  a doc, flag it so it can be rotated.

---

## Wrap-up

End each task with the same summary `AGENTS.md` asks for: the files you changed, any
migrations (run or still pending), any new env vars and where to set them, the check
results, and any blockers.
