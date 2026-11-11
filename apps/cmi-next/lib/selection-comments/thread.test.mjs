import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseLegacyComments, summarize, relTime } from "./thread.ts";

const FALLBACK = "2026-10-20T19:00:00.000Z";

test("unstamped text (before Nov 9) is one client comment on the decision date", () => {
  const e = parseLegacyComments("Champagne Bronze in lieu of Brushed Nickel", FALLBACK);
  assert.deepEqual(e, [{ created_at: FALLBACK, author_name: "Client", body: "Champagne Bronze in lieu of Brushed Nickel", stamped: false }]);
});

test("stamped notes, newest first in the text, come back oldest first; multi-line notes stay whole", () => {
  const text = "Nov 10, 2026 · Jane Lindquist: Second note\nwith a link\nNov 9, 2026 · Jane Lindquist: First note";
  const e = parseLegacyComments(text, FALLBACK);
  assert.deepEqual(e.map((x) => [x.body, x.author_name, x.created_at.slice(0, 10)]), [
    ["First note", "Jane Lindquist", "2026-11-09"],
    ["Second note\nwith a link", "Jane Lindquist", "2026-11-10"],
  ]);
});

test("empty text gives nothing", () => {
  assert.deepEqual(parseLegacyComments("  \n ", FALLBACK), []);
  assert.deepEqual(parseLegacyComments(null, FALLBACK), []);
});

test("summary counts open client comments and finds the latest", () => {
  const c = (id, kind, at, handled = null) => ({ id, selection_id: "s", job_id: "j", author_kind: kind, author_contact_id: null, author_staff_id: null, author_name: kind, action: "comment", body: id, created_at: at, handled_at: handled, handled_by: null });
  const s = summarize([c("a", "client", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"), c("b", "client", "2026-11-03T00:00:00Z"), c("r", "staff", "2026-11-02T00:00:00Z")]);
  assert.equal(s.count, 3);
  assert.equal(s.open, 1);
  assert.equal(s.latest.body, "b");
  assert.deepEqual(summarize([]), { count: 0, open: 0, latest: null });
});

test("relative time", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  assert.equal(relTime("2026-11-11T11:30:00Z", now), "30m ago");
  assert.equal(relTime("2026-11-09T12:00:00Z", now), "2d ago");
});
