# Dashboard Review FAB — Portable Spec & Implementation Prompt

A self-contained, framework-agnostic guide to the **leadership "capture anywhere"
tool** built for the CMI dashboard: a floating action button (FAB) on every
dashboard page that lets a privileged user **take a note, screenshot + crop +
annotate the page, share it (email + in-app), triage it, reply in a thread, and
ask an AI agent** — all without leaving the page they're on.

Written so you can hand it (or the prompt in §12) to another project / AI coding
agent and rebuild it independently. It has **no hard dependency on CMI's stack**
(Supabase, Next.js, Resend, roles) — those are just the host we built it in.
Substitute your own DB, mailer, auth, and agent.

Companion doc: `docs/features/frontend-page-editor-portable.md` (the *iframe*
page editor). This one is the *dashboard/backend* review tool.

---

## 1. What it does

A fixed **bottom-right FAB**, visible only to privileged users, on every
dashboard page. It opens a small panel with:

- **Note** — a composer that **auto-captures the current route + page title**, a
  **type** (Edit / Bug / Idea / Question / Remove), a **priority**, a
  **share-with** multi-select, and a **screenshot** button.
- **Screenshot flow** — capture the page → open an **editor** to **crop to a
  chosen area (live W×H)** and **draw** (pen / arrow / box / highlighter) → attach
  the flattened image to the note.
- **Share** — selected recipients get an **email** *and* an **in-app bell** badge.
- **Requests** — an inbox of notes you created or that were shared with you, with
  a **status** control (Open → In Progress → Done → Archived).
- **Detail modal** — click a request to see the **full screenshot**, note,
  metadata, status control, and a **reply thread** ("note back").
- **Ask Bolt** — a compact **AI agent chat modal**, pre-grounded with the current
  page, with **voice input** (browser speech-to-text).

It is a capture/triage tool. It never mutates the app; AI suggestions are drafts.

---

## 2. Architecture / data flow

```
[FAB on every dashboard page]  (role-gated; mounted once in the dashboard layout)
  ├─ Note composer
  │    auto-context: pathname + document.title
  │    screenshot → capture(dom) → [Annotation editor: crop + draw] → dataURL
  │    submit → upload image → POST create note → (if recipients) email + bell
  ├─ Requests tab  → GET notes (created-by-me ∪ shared-with-me)
  │    click → [Detail modal: screenshot + note + status + reply thread]
  └─ Ask Bolt  → [Agent chat modal] → POST /agent/chat (voice via Web Speech)

Bell badge (global header): unread shared notes counted server-side.
```

Two DB tables, a handful of API actions, and four UI pieces (FAB, annotation
editor, detail modal, agent modal). Each is independently portable.

---

## 3. Data model (generic)

Adapt to any relational store. Postgres/Supabase shown; the shape matters more
than the dialect.

```sql
create table dashboard_notes (
  id            uuid primary key default gen_random_uuid(),
  route         text,                 -- pathname captured automatically
  page_title    text,
  note          text not null,
  type          text not null default 'edit',   -- edit|bug|idea|question|remove|other
  priority      text not null default 'medium',  -- low|medium|high|urgent
  status        text not null default 'open',    -- open|in_progress|done|archived
  created_by    text,                 -- author email (store lowercased)
  created_by_name text,
  recipient_emails text[] not null default '{}', -- who it's shared with
  read_by       text[] not null default '{}',    -- who has opened it (bell logic)
  screenshot_url text,
  shared        boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table dashboard_note_comments (   -- the reply thread
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references dashboard_notes(id) on delete cascade,
  author_email text,
  author_name  text,
  body       text not null,
  created_at timestamptz default now()
);
```

Notes on the model:
- **`recipient_emails[]` + `read_by[]`** drive both "shared with me" and the
  unread bell count (a note is unread for me if I'm a recipient and not in
  `read_by`). Author is added to `read_by` on create so their own notes never
  show as unread to themselves.
- **Inbox = created-by-me ∪ shared-with-me** — the key fix that makes captures
  visible to their author even when not shared with anyone.
- Store all emails **lowercased** for reliable array matching.
- Keep everything server-side/private; the host enforces the privileged role.

---

## 4. API surface (action-based, one endpoint)

`GET  /api/dashboard-notes?scope=inbox|shared|all` → `{ notes, unread, me }`
`POST /api/dashboard-notes` with `{ action, … }`:

| action          | payload                       | effect |
|-----------------|-------------------------------|--------|
| `create`        | `{ payload: NoteInput }`      | insert note; if recipients → send emails; returns note |
| `update_status` | `{ id, status }`              | change status |
| `mark_read`     | `{ id }`                      | add caller to `read_by` (clears bell) |
| `get_note`      | `{ id }`                      | returns `{ note, comments }`; also marks read |
| `add_comment`   | `{ id, comment }`             | append a reply |

`NoteInput = { route, page_title, note, type, priority, recipient_emails[], screenshot_url }`

Every action requires the privileged role. The unread bell count is a separate
lightweight query (`recipient_emails contains me AND read_by !contains me`).

---

## 5. Screenshot capture — the critical gotcha

**Do not use `html2canvas` if your app uses modern CSS colors.** It cannot parse
`oklch()`, `lab()`, `color()`, or `color-mix()` and throws
("unsupported color function") — which surfaces as a generic "couldn't capture"
error. Tailwind v4 / shadcn themes commonly use `oklch`, so this bites hard.

Use a library that renders through the browser's own engine instead —
**`html-to-image`** (SVG `foreignObject`) or `modern-screenshot`. These resolve
`oklch`/`color-mix` because the browser does the painting.

```ts
async function capturePage(): Promise<string> {
  const { toJpeg } = await import("html-to-image"); // dynamic → client only
  const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
  return toJpeg(document.body, {
    quality: 0.85,
    backgroundColor: bg,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    filter: (n) => !(n instanceof HTMLElement && n.hasAttribute?.("data-fab-ignore")), // exclude the FAB
    cacheBust: true,
  });
}
```

Caveats to document for users:
- Cross-origin `<img>` without CORS may render blank.
- Clamp very large captures (e.g. max 1600px on the long edge) for editor
  performance and upload size.
- Tag the FAB/editor with `data-fab-ignore` so they're excluded from the shot.

---

## 6. Annotation editor (crop + draw) — portable canvas core

A `<canvas>` editor: load the captured image, let the user **crop to a selected
region** and **draw** shapes, then flatten to a JPEG dataURL. Dependency-free.
The reusable core (framework-agnostic):

```ts
type Pt = { x: number; y: number };
type FreeShape = { tool: "pen" | "highlight"; color: string; size: number; points: Pt[] };
type LineShape = { tool: "arrow" | "rect"; color: string; size: number; a: Pt; b: Pt };
type Shape = FreeShape | LineShape;
const isFree = (s: Shape): s is FreeShape => s.tool === "pen" || s.tool === "highlight";

const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.lineJoin = ctx.lineCap = "round";
  switch (s.tool) {
    case "pen": case "highlight": {
      ctx.strokeStyle = s.tool === "highlight" ? hexA(s.color, 0.35) : s.color;
      ctx.lineWidth = s.tool === "highlight" ? s.size * 4 : s.size;
      ctx.beginPath(); s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      break;
    }
    case "rect": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
      ctx.strokeRect(s.a.x, s.a.y, s.b.x - s.a.x, s.b.y - s.a.y); break;
    }
    case "arrow": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x), head = 10 + s.size * 2.5;
      ctx.beginPath();
      ctx.moveTo(s.b.x, s.b.y); ctx.lineTo(s.b.x - head * Math.cos(ang - Math.PI / 7), s.b.y - head * Math.sin(ang - Math.PI / 7));
      ctx.moveTo(s.b.x, s.b.y); ctx.lineTo(s.b.x - head * Math.cos(ang + Math.PI / 7), s.b.y - head * Math.sin(ang + Math.PI / 7));
      ctx.stroke(); break;
    }
  }
}

// Composite base image + shapes at natural resolution → offscreen canvas.
function composite(img: HTMLImageElement, shapes: Shape[]): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0); shapes.forEach(s => drawShape(ctx, s)); return c;
}
```

Editor behavior to implement around that core:
- **Canvas internal size = image natural size**; scale down via CSS to fit. Map
  pointer coords: `canvasPx = (clientPx - rectOffset) * (canvas.width / rect.width)`.
- **Tools:** crop, pen, arrow, box, highlighter + a color palette + undo + reset.
- **Crop:** drag a rect (show live `W×H`), dim outside, "Apply" → `composite()`
  then `drawImage(comp, x, y, w, h, 0, 0, w, h)` into a new `w×h` canvas → replace
  the base image, clear shapes.
- **Save:** `composite(img, shapes).toDataURL("image/jpeg", 0.9)` → hand back to
  the note composer.
- Clamp the loaded image to a max dimension (§5) before editing.

Full reference: `apps/cmi-next/components/dashboard/screenshot-editor.tsx`.

---

## 7. Voice input for the AI chat (Web Speech API)

Zero-infra live dictation (Chrome/Edge; degrade gracefully elsewhere). No `any`:

```ts
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
// start(): const r = new (speechCtor()!)(); r.lang="en-US"; r.onresult = e => appendToInput(e.results[0][0].transcript); r.start();
```

Only render the mic button when `speechCtor() !== null`. Upgrade path for
cross-browser / higher accuracy: record audio and transcribe server-side
(e.g. Whisper).

---

## 8. AI agent modal

Reuse whatever agent/chat endpoint the host already has — **don't fork it.** Pop
the existing chat into a modal and **prepend the current page as context** on the
first turn so questions are grounded:

```ts
const outbound = firstTurn && context ? `[Context: I'm on the ${context} page.] ${text}` : text;
```

Rules to enforce (state them in the system prompt / UI): the agent may look up and
**draft**, but must **not auto-publish or make destructive edits**; anything it
proposes is saved as a draft for review. Render any staged/confirmable actions as
explicit confirm buttons, or link out to the full agent page for those.

---

## 9. Sharing & notifications (email + in-app bell)

- **Email:** on `create` with recipients, send each an email via your mailer
  (Resend/SES/SMTP). Include the note, page, priority, and a link back to the
  route. Fire-and-forget (`Promise.allSettled`), log failures.
- **In-app bell:** add "unread shared notes" to the host's global notification
  count — a note is unread for a user if they're in `recipient_emails` and not in
  `read_by`. Opening the detail modal (`get_note`) marks it read.
- Replies (`add_comment`) can optionally notify the note author + other
  participants the same way (nice-to-have).

---

## 10. FAB mechanics

- **Mount once** in the dashboard layout/shell so it appears on every page;
  render it only for the privileged role.
- **Fixed** `bottom-right`, high z-index, `print:hidden`, and marked
  `data-fab-ignore` so it's excluded from screenshots.
- **Auto-context:** read the router pathname + a derived page title on open — the
  user never types "where."
- Small tabbed panel: **Note** | **Requests** (with unread badge). A secondary
  button opens **Ask Bolt**. Keep the default path one-click: open → type → send.

---

## 11. Integration checklist

1. Create the two tables (§3) + storage bucket for screenshots.
2. Build the action endpoint (§4) behind your privileged-role guard.
3. Add the unread-shared count to your global notification bell.
4. Add the screenshot capture util (§5) — **not html2canvas**.
5. Build the annotation editor (§6) around the canvas core.
6. Build the FAB (§10): note composer (auto-context, type/priority, share-with,
   screenshot→editor), Requests inbox (status control), and a launcher for the
   agent modal.
7. Build the request **detail modal**: large screenshot, note + metadata, status
   control, reply thread.
8. Wire the agent modal (§8) with voice input (§7).
9. Wire share emails (§9).

---

## 12. Implementation prompt (paste into your coding agent)

```text
Build a "Dashboard Review" tool in <APP>: a floating action button (FAB) on every
dashboard page (privileged role only) for capturing and triaging web-edit
requests.

Data: create `dashboard_notes` (route, page_title, note, type[edit|bug|idea|
question|remove], priority[low|medium|high|urgent], status[open|in_progress|done|
archived], created_by, created_by_name, recipient_emails[], read_by[],
screenshot_url, shared, timestamps) and `dashboard_note_comments`
(note_id, author, body, created_at). Store emails lowercased. Keep private;
enforce the privileged role on every request.

API (one endpoint, action-based): GET ?scope=inbox|shared|all returns
{notes, unread, me}; POST actions create | update_status | mark_read | get_note |
add_comment. "inbox" = notes created by me OR shared with me. A note is unread if
I'm a recipient and not in read_by; opening it (get_note) marks it read.

FAB: fixed bottom-right, mounted once in the dashboard shell, rendered only for
the privileged role, tagged data-fab-ignore, z-index high. Panel tabs:
- Note: textarea; auto-capture the current route + page title (no manual entry);
  type + priority selects; a "share with" multi-select of other privileged users;
  a Screenshot button.
- Requests: list notes from scope=inbox with an inline status control and an
  unread badge; clicking a note opens a detail modal.
- A secondary button opens an AI agent chat modal.

Screenshot: capture document.body with `html-to-image` (NOT html2canvas — it
can't parse oklch/color-mix used by modern themes). Exclude data-fab-ignore
elements; clamp to 1600px long edge. Then open an annotation editor: a canvas
where the user can CROP to a selected area (show live W×H) and DRAW with pen,
arrow, box, and highlighter tools in several colors, with undo/reset. Flatten
crop + drawings to a JPEG dataURL, upload it, and store the URL on the note.

Detail modal: large screenshot (click to open full), the note + type/priority/
author/date, a status control, and a reply thread (add_comment). Opening marks
the note read.

Agent modal: reuse <APP>'s existing chat endpoint; prepend the current page as
context on the first message; add voice input via the browser Web Speech API
(show the mic only when supported). The agent may draft but must never
auto-publish or make destructive edits.

Notifications: on create with recipients, email each recipient (link back to the
route) AND include unread shared notes in <APP>'s global notification bell count.

Deliver: migrations, the API endpoint, the FAB, the annotation editor, the detail
modal, the agent modal, the screenshot util, and the notification wiring.
```

---

## 13. Reference implementation (in this repo)

- FAB: `apps/cmi-next/components/dashboard/review-fab.tsx`
- Annotation editor: `apps/cmi-next/components/dashboard/screenshot-editor.tsx`
- Detail modal: `apps/cmi-next/components/dashboard/note-detail-modal.tsx`
- Agent modal (voice): `apps/cmi-next/components/dashboard/bolt-modal.tsx`
- Data/API: `apps/cmi-next/lib/dashboard-notes/*`,
  `apps/cmi-next/app/api/dashboard-notes/route.ts`
- Bell count: `apps/cmi-next/app/api/notifications/unread-count/route.ts`
- Mount point: `apps/cmi-next/app/dashboard/layout.tsx`
- Full spec: `docs/features/dashboard-review-fab.md`
