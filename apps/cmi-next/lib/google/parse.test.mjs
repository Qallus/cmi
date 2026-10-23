import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { buildAssertion, extractGmailText, parseServiceAccount, parseSince, stripQuoted } from "./parse.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const json = JSON.stringify({ client_email: "reader@cmi.iam.gserviceaccount.com", private_key: pem.replace(/\n/g, "\\n") });

test("service account JSON parses as pasted or base64, and rejects junk", () => {
  assert.equal(parseServiceAccount(json)?.client_email, "reader@cmi.iam.gserviceaccount.com");
  assert.equal(parseServiceAccount(Buffer.from(json).toString("base64"))?.client_email, "reader@cmi.iam.gserviceaccount.com");
  assert.ok(parseServiceAccount(json)?.private_key.includes("\n-----END"), "escaped newlines are restored");
  assert.equal(parseServiceAccount("nope"), null);
  assert.equal(parseServiceAccount(""), null);
});

test("delegation JWT impersonates the subject and verifies with the key", () => {
  const sa = parseServiceAccount(json);
  const jwt = buildAssertion(sa, "joe@constructedmatter.com", "scope-a", 1_000);
  const [h, p, s] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(claims.sub, "joe@constructedmatter.com");
  assert.equal(claims.iss, sa.client_email);
  assert.equal(claims.exp, 4_600);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url")));
});

test("since accepts relative and absolute times", () => {
  const now = Date.UTC(2026, 9, 23);
  assert.equal(parseSince("3d", 7, now).getTime(), now - 3 * 86_400_000);
  assert.equal(parseSince("12h", 7, now).getTime(), now - 12 * 3_600_000);
  assert.equal(parseSince("2026-10-20", 7, now).toISOString().slice(0, 10), "2026-10-20");
  assert.equal(parseSince(undefined, 7, now).getTime(), now - 7 * 86_400_000);
});

test("gmail body prefers text/plain and falls back to stripped HTML", () => {
  const b64 = (s) => Buffer.from(s).toString("base64url");
  const multipart = { mimeType: "multipart/alternative", parts: [
    { mimeType: "text/plain", body: { data: b64("Hi Joe,\nBudget by Friday.") } },
    { mimeType: "text/html", body: { data: b64("<p>ignored</p>") } },
  ] };
  assert.equal(extractGmailText(multipart), "Hi Joe,\nBudget by Friday.");
  const htmlOnly = { mimeType: "text/html", body: { data: b64("<p>Hello&nbsp;there</p><style>x{}</style><div>Line 2</div>") } };
  assert.equal(extractGmailText(htmlOnly), "Hello there\nLine 2");
});

test("quoted reply history is removed", () => {
  const t = "Sounds good.\n\nOn Tue, Oct 20, 2026 at 9:00 AM Joe <joe@x.com> wrote:\n> earlier text";
  assert.equal(stripQuoted(t), "Sounds good.");
});
