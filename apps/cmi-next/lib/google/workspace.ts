// Read-only Gmail, Drive, Sheets and Calendar calls, as one staff member.
// Callers must have already run scopeUserEmail + assertWorkspaceStaff.
import { GOOGLE_SCOPES, extractGmailText, stripQuoted, truncate } from "./parse";
import { GoogleError, googleGet } from "./client";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const DRIVE = "https://www.googleapis.com/drive/v3";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 40_000;

type Header = { name: string; value: string };
const header = (hs: Header[] | undefined, name: string) => hs?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

// ── Gmail ──────────────────────────────────────────────────────────────────

export async function gmailSearch(user: string, opts: { query?: string; since: Date; max: number }) {
  const q = [opts.query?.trim(), `after:${Math.floor(opts.since.getTime() / 1000)}`].filter(Boolean).join(" ");
  const list = await googleGet<{ threads?: { id: string }[]; resultSizeEstimate?: number }>(
    user, GOOGLE_SCOPES.gmail, `${GMAIL}/threads?${new URLSearchParams({ q, maxResults: String(opts.max) })}`, "json");

  const threads = await Promise.all((list.threads ?? []).map(async (t) => {
    const params = new URLSearchParams({ format: "metadata" });
    for (const h of ["Subject", "From", "To", "Date"]) params.append("metadataHeaders", h);
    const th = await googleGet<{ id: string; messages?: { id: string; snippet?: string; labelIds?: string[]; payload?: { headers?: Header[] } }[] }>(
      user, GOOGLE_SCOPES.gmail, `${GMAIL}/threads/${t.id}?${params}`, "json");
    const msgs = th.messages ?? [];
    const first = msgs[0]?.payload?.headers;
    const last = msgs[msgs.length - 1];
    return {
      thread_id: th.id,
      subject: header(first, "Subject"),
      from: header(first, "From"),
      last_from: header(last?.payload?.headers, "From"),
      last_date: header(last?.payload?.headers, "Date"),
      messages: msgs.length,
      unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
      snippet: last?.snippet ?? null,
    };
  }));
  return { query: q, estimated_total: list.resultSizeEstimate ?? threads.length, threads };
}

export async function gmailThread(user: string, threadId: string) {
  const th = await googleGet<{ id: string; messages?: { id: string; labelIds?: string[]; payload?: { headers?: Header[] } & Parameters<typeof extractGmailText>[0] }[] }>(
    user, GOOGLE_SCOPES.gmail, `${GMAIL}/threads/${encodeURIComponent(threadId)}?format=full`, "json");
  let budget = MAX_TEXT;
  const messages = (th.messages ?? []).map((m) => {
    const body = truncate(stripQuoted(extractGmailText(m.payload)), Math.max(500, Math.min(8_000, budget)));
    budget -= body.length;
    return {
      from: header(m.payload?.headers, "From"), to: header(m.payload?.headers, "To"), cc: header(m.payload?.headers, "Cc"),
      date: header(m.payload?.headers, "Date"), subject: header(m.payload?.headers, "Subject"), body,
    };
  });
  return { thread_id: th.id, messages };
}

/** Message ids in `user`'s mailbox sent by any of `senders` since `since`. */
export async function gmailMessageIdsFrom(user: string, senders: string[], since: Date, max = 50): Promise<string[]> {
  if (!senders.length) return [];
  const q = `from:(${senders.join(" OR ")}) after:${Math.floor(since.getTime() / 1000)} -in:chats`;
  const res = await googleGet<{ messages?: { id: string }[] }>(
    user, GOOGLE_SCOPES.gmail, `${GMAIL}/messages?${new URLSearchParams({ q, maxResults: String(max) })}`, "json");
  return (res.messages ?? []).map((m) => m.id);
}

export async function gmailMessage(user: string, id: string) {
  const m = await googleGet<{ id: string; threadId: string; internalDate?: string; payload?: { headers?: Header[] } & Parameters<typeof extractGmailText>[0] }>(
    user, GOOGLE_SCOPES.gmail, `${GMAIL}/messages/${encodeURIComponent(id)}?format=full`, "json");
  const from = header(m.payload?.headers, "From") ?? "";
  return {
    id: m.id,
    threadId: m.threadId,
    from,
    fromAddress: (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase(),
    to: header(m.payload?.headers, "To"),
    subject: header(m.payload?.headers, "Subject"),
    date: m.internalDate ? new Date(Number(m.internalDate)) : new Date(),
    text: truncate(stripQuoted(extractGmailText(m.payload)), 20_000),
  };
}

// ── Drive ──────────────────────────────────────────────────────────────────

const FILE_FIELDS = "id,name,mimeType,modifiedTime,size,webViewLink,shared,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress)";

export async function driveRecent(user: string, opts: { since: Date; max: number; query?: string }) {
  const q = [`modifiedTime > '${opts.since.toISOString()}'`, "trashed = false"];
  if (opts.query?.trim()) q.push(`name contains '${opts.query.trim().replace(/['\\]/g, "\\$&")}'`);
  const params = new URLSearchParams({
    q: q.join(" and "), orderBy: "modifiedTime desc", pageSize: String(opts.max),
    fields: `files(${FILE_FIELDS})`, includeItemsFromAllDrives: "true", supportsAllDrives: "true", corpora: "allDrives",
  });
  const res = await googleGet<{ files?: Record<string, unknown>[] }>(user, GOOGLE_SCOPES.drive, `${DRIVE}/files?${params}`, "json");
  return { files: res.files ?? [] };
}

const EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export async function driveReadFile(user: string, fileId: string) {
  const id = encodeURIComponent(fileId);
  const meta = await googleGet<{ id: string; name: string; mimeType: string; size?: string; webViewLink?: string; modifiedTime?: string }>(
    user, GOOGLE_SCOPES.drive, `${DRIVE}/files/${id}?fields=id,name,mimeType,size,webViewLink,modifiedTime&supportsAllDrives=true`, "json");

  let text: string;
  if (EXPORTS[meta.mimeType]) {
    text = await googleGet(user, GOOGLE_SCOPES.drive, `${DRIVE}/files/${id}/export?mimeType=${encodeURIComponent(EXPORTS[meta.mimeType])}`, "text");
  } else if (Number(meta.size ?? 0) > MAX_FILE_BYTES) {
    throw new GoogleError(`${meta.name} is too large to read (over 10 MB).`);
  } else if (meta.mimeType === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bytes = await googleGet(user, GOOGLE_SCOPES.drive, `${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, "bytes");
    const { text: pages } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    text = (Array.isArray(pages) ? pages.join("\n\n") : pages ?? "").trim() || "(No selectable text; the PDF may be scanned images.)";
  } else if (meta.mimeType.startsWith("text/") || meta.mimeType === "application/json") {
    text = await googleGet(user, GOOGLE_SCOPES.drive, `${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, "text");
  } else {
    throw new GoogleError(`Can't read ${meta.name} (${meta.mimeType}) as text. Google Docs, Sheets, Slides, PDFs and text files are supported.`);
  }
  return { file: meta, text: truncate(text, MAX_TEXT) };
}

// ── Sheets ─────────────────────────────────────────────────────────────────

export async function sheetValues(user: string, spreadsheetId: string, range?: string) {
  const id = encodeURIComponent(spreadsheetId);
  if (!range) {
    const meta = await googleGet<{ properties?: { title?: string }; sheets?: { properties?: { title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[] }>(
      user, GOOGLE_SCOPES.sheets, `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties(title,gridProperties)`, "json");
    return { title: meta.properties?.title, tabs: (meta.sheets ?? []).map((s) => s.properties), note: "Pass a range like 'Sheet1!A1:H50' to read values." };
  }
  const res = await googleGet<{ range: string; values?: unknown[][] }>(
    user, GOOGLE_SCOPES.sheets, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`, "json");
  const values = res.values ?? [];
  return { range: res.range, rows: values.length, values: values.slice(0, 500), truncated: values.length > 500 };
}

// ── Calendar ───────────────────────────────────────────────────────────────

export async function calendarEvents(user: string, from: Date, to: Date) {
  const params = new URLSearchParams({
    timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50",
    fields: "items(id,summary,start,end,location,hangoutLink,status,organizer(email,displayName),attendees(email,displayName,responseStatus))",
  });
  const res = await googleGet<{ items?: unknown[] }>(user, GOOGLE_SCOPES.calendar,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, "json");
  return { events: res.items ?? [] };
}
