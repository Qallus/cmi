import { strict as assert } from "node:assert";
import { test } from "node:test";
import { approvalParagraphs, draftParagraphs, followUpMeetingDraft, missingDocumentsDraft } from "./drafts.ts";

const who = { firstName: "Ana", company: "Acme Framing LLC", reviewerName: "Yovana Hernandez", reviewerTitle: "Executive Operations" };

test("follow-up meeting draft thanks them, offers our office and leaves a time to fill in", () => {
  const d = followUpMeetingDraft(who);
  assert.match(d.body, /^Hi Ana,/);
  assert.match(d.body, /Thank you for submitting your trade partner application for Acme Framing LLC/);
  assert.match(d.body, /\[DAY, DATE at TIME\]/);
  assert.match(d.body, /7314 E Osborn Dr/);
  assert.match(d.body, /Yovana Hernandez\nExecutive Operations/);
});

test("missing documents draft lists each document and the upload link, with optional notes", () => {
  const d = missingDocumentsDraft({ ...who, missing: ["W-9", "Certificate of Insurance"], uploadUrl: "https://x.test/up?t=abc", notes: "Please name us as additional insured." });
  assert.match(d.body, /• W-9\n• Certificate of Insurance/);
  assert.match(d.body, /https:\/\/x\.test\/up\?t=abc/);
  assert.match(d.body, /additional insured/);
  assert.match(d.subject, /Acme Framing LLC/);
});

test("missing drafts work without a first name or notes", () => {
  const d = missingDocumentsDraft({ ...who, firstName: null, missing: [], uploadUrl: "u", notes: "" });
  assert.match(d.body, /^Hi there,/);
  assert.doesNotMatch(d.body, /\n\n\n/);
});

test("approval email mentions the guide only when attached, and outstanding documents", () => {
  const withGuide = approvalParagraphs({ firstName: "Ana", company: "Acme", outstanding: ["W-9"], hasGuide: true, uploadUrl: "u" });
  assert.ok(withGuide.some((p) => /Onboarding Guide is attached/.test(p)));
  assert.ok(withGuide.some((p) => /still need: W-9/.test(p)));
  const noGuide = approvalParagraphs({ firstName: "Ana", company: "Acme", outstanding: [], hasGuide: false, uploadUrl: "u" });
  assert.ok(!noGuide.some((p) => /attached/.test(p)));
  assert.ok(!noGuide.some((p) => /still need/.test(p)));
});

test("plain-text drafts split into paragraphs on blank lines", () => {
  assert.deepEqual(draftParagraphs("Hi,\n\nLine one\nline two\n\n\nBye"), ["Hi,", "Line one\nline two", "Bye"]);
});
