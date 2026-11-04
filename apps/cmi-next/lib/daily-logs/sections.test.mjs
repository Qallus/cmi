import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanItem, normalizeSections, mergeCapture, needsALook, clientSafeItems, emptySections, sectionsText } from "./sections.ts";

const it = (section, text, extra = {}) => cleanItem({ section, text, ...extra });

test("field reports: two captures append to one log, repeats skipped", () => {
  let s = emptySections();
  s = mergeCapture(s, { items: [it("work", "Framed the north wall"), it("onsite", "", { company: "Ideal Temp", trade: "HVAC" })], raw: { at: "2026-11-04T15:00:00Z", text: "framed the north wall uh ideal temp was here" } });
  s = mergeCapture(s, { items: [it("work", "framed the  north wall"), it("safety", "No incidents")], raw: { at: "2026-11-04T19:00:00Z", text: "no incidents" } });
  assert.equal(s.items.length, 3, "the repeat isn't added twice");
  assert.equal(s.raw.length, 2, "both raw transcripts are kept");
  assert.equal(s.items.find((i) => i.section === "onsite").company, "Ideal Temp");
  assert.match(sectionsText(s), /Work completed: Framed the north wall/);
});

test("field reports: needs a look", () => {
  const s = normalizeSections({ items: [
    { section: "work", text: "Poured footings" },
    { section: "inspections", text: "Footing inspection" },
    { section: "delays", text: "Concrete truck late" },
    { section: "onsite", company: "ABC Concrete" },
    { section: "actions", text: "Call the inspector" },
  ], raw: [{ text: "x", unsorted: true }] });
  const keys = needsALook(s).map((f) => f.key.split("-")[0]);
  assert.deepEqual(keys.sort(), ["delay", "insp", "no", "owner", "trade", "unsorted"].sort());
  // Filled in, the flags clear.
  const ok = normalizeSections({ items: [
    { section: "work", text: "Poured footings" }, { section: "safety", text: "No incidents" },
    { section: "inspections", text: "Footing inspection", result: "Passed" },
    { section: "delays", text: "Truck late", impact: "Two hours" },
    { section: "onsite", company: "ABC Concrete", trade: "Concrete", crew: 4 },
    { section: "actions", text: "Call the inspector", owner: "Ben", due: "2026-11-06" },
  ] });
  assert.equal(needsALook(ok).length, 0);
});

test("field reports: client guardrail keeps internal sections out unless added back", () => {
  const s = normalizeSections({ items: [
    { id: "a", section: "work", text: "Cabinets set" },
    { id: "b", section: "delays", text: "Countertop fab slipped", impact: "3 days" },
    { id: "c", section: "internal", text: "Sub is behind on invoices" },
    { id: "d", section: "work", text: "Tile started", star: true },
  ] });
  const { client, internal } = clientSafeItems(s);
  assert.deepEqual(client.map((i) => i.id), ["d", "a"], "starred first");
  assert.deepEqual(internal.map((i) => i.id).sort(), ["b", "c"]);
  const back = clientSafeItems(s, ["b"]);
  assert.ok(back.client.some((i) => i.id === "b"), "added back");
  assert.ok(!back.client.some((i) => i.id === "c"));
});

test("field reports: bad input is dropped or cleaned", () => {
  assert.equal(cleanItem({ section: "work", text: "   " }), null);
  assert.equal(cleanItem({ section: "nope", text: "Odd" }).section, "work");
  const a = cleanItem({ section: "actions", text: "Order tile", due: "Friday", owner: "Ben" });
  assert.equal(a.due, null, "only real dates");
  assert.equal(a.owner, "Ben");
  const o = cleanItem({ section: "onsite", company: "Ideal Temp", crew: "3", hours: -2 });
  assert.equal(o.crew, 3);
  assert.equal(o.hours, null);
});
