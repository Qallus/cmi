// Builds the executed MSA: the exact PDF the trade partner was shown, plus an
// electronic-signature certificate page recording consent, identity evidence,
// the document fingerprint and the countersignature. Pure — no I/O, no path
// aliases — so lib/prequal/msa-pdf.test.mjs can run it directly.
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Shown to the signer and printed on the certificate. Attorney to approve wording. */
export const ESIGN_CONSENT_TEXT =
  "I agree to sign this agreement electronically and to receive it electronically. My electronic signature has the same legal effect as my handwritten signature. I can download a copy now and may request a paper copy at any time from info@constructedmatter.com.";

export type SignatureCertificate = {
  agreementLabel: string;
  docSha256: string;
  company: string | null;
  signerName: string;
  signerTitle: string | null;
  signerEmail: string;
  emailVerifiedAt: string;
  consentText: string;
  signedAt: string;
  ip: string | null;
  userAgent: string | null;
  signaturePng: Uint8Array | null;
  countersignerName?: string | null;
  countersignedAt?: string | null;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const fmt = (iso: string) =>
  `${new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", dateStyle: "long", timeStyle: "medium" })} (Arizona) · ${new Date(iso).toISOString()}`;

// The standard PDF fonts only cover Latin-1 (WinAnsi); anything else would
// throw mid-render and lose a signature, so it's swapped for "?".
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•§·\n]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) lines.push(line);
      // Break words longer than a line (hashes, user agents).
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** The original MSA pages followed by the certificate page. */
export async function buildSignedMsaPdf(msaBytes: Uint8Array, cert: SignatureCertificate): Promise<Uint8Array> {
  const doc = await PDFDocument.load(msaBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page: PDFPage = doc.addPage([612, 792]);
  const margin = 54;
  const width = 612 - margin * 2;
  let y = 792 - margin;
  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.4, 0.4, 0.4);

  const text = (s: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    for (const line of wrap(s, opts.f ?? font, size, width)) {
      page.drawText(line, { x: margin, y, size, font: opts.f ?? font, color: opts.color ?? ink });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };
  const row = (label: string, value: string) => {
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: muted });
    const lines = wrap(value || "—", font, 10, width - 130);
    for (const line of lines) {
      page.drawText(line, { x: margin + 130, y, size: 10, font, color: ink });
      y -= 14;
    }
    y -= 2;
  };

  text("Electronic Signature Certificate", { size: 18, f: bold, gap: 2 });
  text("Constructed Matter, Inc. · 7314 E Osborn Dr Suite A, Scottsdale, AZ 85251 · ROC License KB1 - 343120", { size: 9, color: muted, gap: 14 });

  text("Agreement", { size: 12, f: bold, gap: 2 });
  row("Document", cert.agreementLabel);
  row("SHA-256", cert.docSha256);
  row("Pages signed", `${doc.getPageCount() - 1} (this certificate is page ${doc.getPageCount()})`);
  y -= 8;

  text("Trade partner signature", { size: 12, f: bold, gap: 2 });
  row("Company", cert.company ?? "");
  row("Signer", [cert.signerName, cert.signerTitle].filter(Boolean).join(", "));
  row("Email", cert.signerEmail);
  row("Email verified", fmt(cert.emailVerifiedAt));
  row("Signed", fmt(cert.signedAt));
  row("IP address", cert.ip ?? "");
  row("Device", (cert.userAgent ?? "").slice(0, 300));
  row("Consent", cert.consentText);

  if (cert.signaturePng) {
    const png = await doc.embedPng(cert.signaturePng);
    const scale = Math.min(220 / png.width, 70 / png.height, 1);
    const w = png.width * scale, h = png.height * scale;
    y -= h + 4;
    page.drawImage(png, { x: margin + 130, y, width: w, height: h });
    page.drawLine({ start: { x: margin + 130, y: y - 3 }, end: { x: margin + 130 + 240, y: y - 3 }, thickness: 0.5, color: muted });
    y -= 18;
  }
  y -= 8;

  text("Constructed Matter countersignature", { size: 12, f: bold, gap: 2 });
  if (cert.countersignerName && cert.countersignedAt) {
    row("Countersigned by", cert.countersignerName);
    row("Countersigned", fmt(cert.countersignedAt));
  } else {
    row("Status", "Pending countersignature");
  }
  y -= 10;

  text(
    "Signed electronically under the Arizona Uniform Electronic Transactions Act (A.R.S. § 44-7001 et seq.) and the federal Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.). The SHA-256 fingerprint above identifies the exact agreement text that was presented and signed.",
    { size: 8, color: muted },
  );

  return await doc.save();
}
