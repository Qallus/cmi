import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildFeed, unansweredInbound } from "./client-feed-core.ts";

const item = (id, kind, at, open) => ({ id, kind, at, who: "Jane", title: id, body: null, href: "/", open });

test("newest first, with open counts per kind", () => {
  const f = buildFeed([
    item("a", "selection", "2026-11-01T00:00:00Z", true),
    item("b", "message", "2026-11-03T00:00:00Z", true),
    item("c", "selection", "2026-11-02T00:00:00Z", false),
  ]);
  assert.deepEqual(f.items.map((i) => i.id), ["b", "c", "a"]);
  assert.equal(f.open, 2);
  assert.deepEqual(f.openBy, { selection: 1, message: 1 });
});

test("an inbound text is open until the team texts that contact back", () => {
  const rows = [
    { id: "in1", direction: "inbound", channel: "sms", contact_id: "k", created_at: "2026-11-01T10:00:00Z" },
    { id: "out", direction: "outbound", channel: "sms", contact_id: "k", created_at: "2026-11-01T11:00:00Z" },
    { id: "in2", direction: "inbound", channel: "sms", contact_id: "k", created_at: "2026-11-01T12:00:00Z" },
    { id: "mail", direction: "inbound", channel: "email", contact_id: "k", created_at: "2026-11-01T09:00:00Z" },
  ];
  assert.deepEqual([...unansweredInbound(rows)].sort(), ["in2", "mail"]);
});
