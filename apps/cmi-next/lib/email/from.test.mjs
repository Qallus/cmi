import { strict as assert } from "node:assert";
import { test, afterEach } from "node:test";
import { fromAddress, FROM_NAME } from "./from.ts";

afterEach(() => { delete process.env.RESEND_FROM_EMAIL; });

test("the comma in the company name is quoted", () => {
  // Unquoted, a mail parser reads the comma as an address separator and the
  // header becomes two broken addresses.
  process.env.RESEND_FROM_EMAIL = "info@constructedmatter.com";
  assert.equal(fromAddress(), '"Constructed Matter, Inc." <info@constructedmatter.com>');
  assert.ok(FROM_NAME.includes(","), "this test is pointless if the name loses its comma");
});

test("falls back to the caller's address when nothing is configured", () => {
  assert.equal(fromAddress(), '"Constructed Matter, Inc." <info@constructedmatter.com>');
  assert.equal(fromAddress("noreply@constructedmatter.com"), '"Constructed Matter, Inc." <noreply@constructedmatter.com>');
});

test("an env value that already has a display name is left alone", () => {
  process.env.RESEND_FROM_EMAIL = "CMI Billing <billing@constructedmatter.com>";
  assert.equal(fromAddress(), "CMI Billing <billing@constructedmatter.com>");
});

test("an empty or whitespace env value does not produce an empty From", () => {
  process.env.RESEND_FROM_EMAIL = "   ";
  assert.equal(fromAddress(), '"Constructed Matter, Inc." <info@constructedmatter.com>');
});
