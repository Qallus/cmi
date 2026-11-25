import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DESIGN_DEFAULTS, isRsvpToken, normalizeDesign, parseRsvpInput, publicGuestList, rsvpCounts, safeUrl } from "./design.ts";
import { EVENT_THEMES, themeById, DEFAULT_THEME_ID } from "./themes.ts";
import { formatWhen, formatDay, splitLocation, splitTitle, mapUrl } from "./format.ts";
import { allowRequest } from "./rate-limit.ts";

test("themes: unknown ids fall back to the default", () => {
  assert.equal(themeById("nope").id, DEFAULT_THEME_ID);
  assert.equal(themeById("blueprint").id, "blueprint");
  assert.equal(new Set(EVENT_THEMES.map((t) => t.id)).size, EVENT_THEMES.length);
});

test("design: drops unknown keys, caps text, rejects bad theme and links", () => {
  const d = normalizeDesign({ theme: "evil", eyebrow: "x".repeat(500), hacker: true, image_url: "javascript:alert(1)", guest_list: "everyone" });
  assert.equal(d.theme, DEFAULT_THEME_ID);
  assert.equal(d.eyebrow.length, 160);
  assert.equal(d.image_url, "");
  assert.equal(d.guest_list, "full");
  assert.equal("hacker" in d, false);
});

test("design: a patch keeps what it doesn't mention", () => {
  const base = normalizeDesign({ theme: "confetti", message_body: "Hello" });
  const next = normalizeDesign({ signoff: "Cheers" }, base);
  assert.equal(next.theme, "confetti");
  assert.equal(next.message_body, "Hello");
  assert.equal(next.signoff, "Cheers");
});

test("design: good-to-know rows are cleaned and empty rows dropped", () => {
  const d = normalizeDesign({ good_to_know: [{ label: "Sitter", value: "Busy Bees", url: "https://example.com" }, { label: "", value: "" }, { label: "Bad", value: "x", url: "javascript:x" }] });
  assert.equal(d.good_to_know.length, 2);
  assert.equal(d.good_to_know[0].url, "https://example.com");
  assert.equal("url" in d.good_to_know[1], false);
  assert.deepEqual(normalizeDesign({}), DESIGN_DEFAULTS);
});

test("safeUrl allows http(s), mailto and tel only", () => {
  assert.equal(safeUrl("https://a.com"), "https://a.com");
  assert.equal(safeUrl("mailto:a@b.co"), "mailto:a@b.co");
  assert.equal(safeUrl("data:text/html,x"), "");
});

test("rsvp tokens are 32 lowercase hex characters", () => {
  assert.equal(isRsvpToken("a".repeat(32)), true);
  assert.equal(isRsvpToken("A".repeat(32)), false);
  assert.equal(isRsvpToken("abc"), false);
  assert.equal(isRsvpToken(null), false);
});

test("rsvp input: open link needs a name and email", () => {
  assert.equal(parseRsvpInput({ status: "attending" }, { needIdentity: true, allowPlusOne: true }).ok, false);
  assert.equal(parseRsvpInput({ status: "attending", name: "Jo", email: "nope" }, { needIdentity: true, allowPlusOne: true }).ok, false);
  const ok = parseRsvpInput({ status: "attending", name: "Jo", email: "JO@X.COM", plus_one: true, plus_one_name: "Sam" }, { needIdentity: true, allowPlusOne: true });
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.value.email, "jo@x.com");
  assert.equal(ok.ok && ok.value.plus_one_name, "Sam");
});

test("rsvp input: personal link, status required, +1 respects the event and the answer", () => {
  assert.equal(parseRsvpInput({}, { needIdentity: false, allowPlusOne: true }).ok, false);
  const noPlus = parseRsvpInput({ status: "attending", plus_one: true }, { needIdentity: false, allowPlusOne: false });
  assert.equal(noPlus.ok && noPlus.value.plus_one, false);
  const declined = parseRsvpInput({ status: "declined", plus_one: true, plus_one_name: "Sam" }, { needIdentity: false, allowPlusOne: true });
  assert.equal(declined.ok && declined.value.plus_one, false);
  assert.equal(declined.ok && declined.value.plus_one_name, "");
});

test("guest list: counts +1s, sorts, and honours the display setting", () => {
  const rows = [
    { name: "Yovana", status: "attending", plus_one: true },
    { name: "Brandon Fadden", status: "attending", plus_one: true },
    { name: "Someone", status: "declined", plus_one: false },
    { name: "Waiting", status: "invited", plus_one: false },
  ];
  const full = publicGuestList(rows, "full");
  assert.equal(full.count, 4);
  assert.deepEqual(full.names.map((n) => n.name), ["Brandon Fadden", "Yovana"]);
  assert.deepEqual(publicGuestList(rows, "first").names.map((n) => n.name), ["Brandon", "Yovana"]);
  assert.deepEqual(publicGuestList(rows, "count").names, []);
  assert.equal(publicGuestList(rows, "off").count, 4);
  assert.deepEqual(rsvpCounts(rows), { attending: 2, declined: 1, waiting: 1, plusOnes: 2, headcount: 4, invited: 4 });
});

test("format: Arizona time, same-day ranges share the AM/PM", () => {
  // 6–9 PM Arizona on Dec 18, 2026 = 01:00–04:00 UTC Dec 19.
  assert.equal(formatWhen("2026-12-19T01:00:00Z", "2026-12-19T04:00:00Z"), "Friday, December 18, 2026 · 6:00 – 9:00 PM");
  assert.equal(formatDay("2026-12-04T19:00:00Z"), "Friday, December 4, 2026");
  assert.deepEqual(splitLocation("Rokerij Private Dining Room\n6335 N 16th St, Phoenix, AZ 85016"), { venue: "Rokerij Private Dining Room", address: "6335 N 16th St, Phoenix, AZ 85016" });
  assert.deepEqual(splitTitle("Christmas Dinner & Drinks 2026", "2026"), { before: "Christmas Dinner & Drinks ", accent: "2026", after: "" });
  assert.deepEqual(splitTitle("Holiday Party", "nope"), { before: "Holiday Party", accent: "", after: "" });
  assert.match(mapUrl("A\nB St"), /query=A%2C%20B%20St$/);
});

test("rate limit: blocks after the max within the window", () => {
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(allowRequest(key, 3, 1000, 1000 + i), true);
  assert.equal(allowRequest(key, 3, 1000, 1500), false);
  assert.equal(allowRequest(key, 3, 1000, 2600), true);
});

test("azLocalToIso: Arizona local, date-only noon, and real offsets", async () => {
  const { azLocalToIso } = await import("./format.ts");
  assert.equal(azLocalToIso("2026-12-18T18:00"), "2026-12-19T01:00:00.000Z");
  assert.equal(azLocalToIso("2026-12-18"), "2026-12-18T19:00:00.000Z");
  assert.equal(azLocalToIso("2026-12-19T01:00:00Z"), "2026-12-19T01:00:00.000Z");
  assert.equal(azLocalToIso("2026-12-18T18:00:00-07:00"), "2026-12-19T01:00:00.000Z");
  assert.equal(azLocalToIso("next friday"), null);
});

test("draftFromModel: converts times, defaults safely, cleans the design", async () => {
  const { draftFromModel } = await import("./draft-parse.ts");
  const d = draftFromModel({
    title: "Christmas Dinner & Drinks 2026", start: "2026-12-18T18:00", end: "2026-12-18T21:00",
    location: "Rokerij\n6335 N 16th St", rsvp_by: "2026-12-04", open_link: "yes",
    design: { theme: "snowfall", title_accent: "2026", good_to_know: [{ label: "What", value: "Dinner" }], evil: 1 },
  });
  assert.equal(d.start_time, "2026-12-19T01:00:00.000Z");
  assert.equal(d.end_time, "2026-12-19T04:00:00.000Z");
  assert.equal(d.access, "invite_only");
  assert.equal(d.allow_plus_one, true);
  assert.equal(d.design.title_accent, "2026");
  assert.equal("evil" in d.design, false);
  assert.equal(draftFromModel({ start: null }).start_time, null);
});

test("email hero: escapes text, keeps only http(s) images, falls back to a solid colour", async () => {
  const { heroRowsHtml } = await import("../../components/email-builder/hero.ts");
  const html = heroRowsHtml({
    hero_image: "https://x.com/a.gif", bg_color: "#1b1b1b", text: "Party <script>alert(1)</script> 2026", title_accent: "2026",
    accent_color: "#e0392b", hero_facts: [{ label: "When", value: "Fri\nLate" }], stripe: ["#e0392b", "red;x:y", "#2f5a45"],
  }, "https://app.example");
  assert.match(html, /bgcolor="#1b1b1b"/);
  assert.match(html, /background-image:url\('https:\/\/x\.com\/a\.gif'\)/);
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<span style="color:#e0392b;">2026<\/span>/);
  assert.match(html, /Fri<br\/>Late/);
  assert.equal(html.includes("red;x:y"), false);
  const bad = heroRowsHtml({ hero_image: "javascript:alert(1)", bg_color: "url(x)" }, "https://app.example");
  assert.equal(bad.includes("javascript:"), false);
  assert.match(bad, /bgcolor="#1b1b1b"/);
});

test("ics: UTC times, escaped text, folded lines", async () => {
  const { buildIcs } = await import("./ics.ts");
  const ics = buildIcs({ id: "abc", title: "Dinner, drinks; fun", start_time: "2026-12-19T01:00:00Z", end_time: "2026-12-19T04:00:00Z", location: "Rokerij\n6335 N 16th St", url: "https://a.b/events/x" }, new Date("2026-11-25T00:00:00Z"));
  assert.match(ics, /DTSTART:20261219T010000Z/);
  assert.match(ics, /DTEND:20261219T040000Z/);
  assert.ok(ics.includes("SUMMARY:Dinner\\, drinks\\; fun"));
  assert.ok(ics.includes("LOCATION:Rokerij\\, 6335 N 16th St"));
  assert.ok(ics.split("\r\n").every((l) => l.length <= 75));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
