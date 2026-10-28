import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { ESIGN_CONSENT_TEXT, buildSignedMsaPdf, sha256Hex } from "./msa-pdf.ts";

async function samplePdf(pages = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]).drawText(`MSA page ${i + 1}`, { x: 50, y: 700 });
  return doc.save();
}

// 1×1 transparent PNG.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const cert = (over = {}) => ({
  agreementLabel: "Master Subcontractor Agreement Rev 2026",
  docSha256: "a".repeat(64), company: "Acme Framing LLC",
  signerName: "Jane Doe", signerTitle: "Owner", signerEmail: "jane@acme.test",
  emailVerifiedAt: "2026-10-28T17:00:00Z", consentText: ESIGN_CONSENT_TEXT,
  signedAt: "2026-10-28T17:01:00Z", ip: "203.0.113.9", userAgent: "Mozilla/5.0 ".repeat(30),
  signaturePng: PNG, ...over,
});

test("signed PDF keeps every MSA page and appends one certificate page", async () => {
  const msa = await samplePdf(3);
  const out = await buildSignedMsaPdf(msa, cert());
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 4);
});

test("countersigned rebuild is still original pages + one certificate", async () => {
  const msa = await samplePdf(2);
  const out = await buildSignedMsaPdf(msa, cert({ countersignerName: "Brandon Fadden", countersignedAt: "2026-10-29T15:00:00Z" }));
  assert.equal((await PDFDocument.load(out)).getPageCount(), 3);
});

test("works without a drawn signature image and with long unbroken values", async () => {
  const out = await buildSignedMsaPdf(await samplePdf(1), cert({ signaturePng: null, docSha256: "f".repeat(64) }));
  assert.equal((await PDFDocument.load(out)).getPageCount(), 2);
});

test("names outside Latin-1 don't break the certificate", async () => {
  const out = await buildSignedMsaPdf(await samplePdf(1), cert({ signerName: "Camila Leão 李", company: "Ωmega Builders" }));
  assert.equal((await PDFDocument.load(out)).getPageCount(), 2);
});

test("sha256Hex is the fingerprint of the exact bytes", () => {
  assert.equal(sha256Hex(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
