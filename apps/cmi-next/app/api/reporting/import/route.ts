// Import a past Weekly Workload Meeting document.
//
// Accepts either pasted text (JSON) or an uploaded .pdf / .txt / .md
// (multipart). `preview: true` parses without saving so the UI can show what
// it found first.
import { NextResponse } from "next/server";
import { requireReportingWrite, reportingErrorResponse } from "@/lib/reporting/guard";
import { importDocument } from "@/lib/reporting/data";
import { parseMeetingDocument } from "@/lib/reporting/parse";

// unpdf pulls in pdf.js, which needs the Node runtime.
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

/** Pull the document out of whichever way it was sent. */
async function readInput(request: Request): Promise<{ text: string; title?: string; meetingDate?: string; preview: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("No file was uploaded.");
    if (file.size > MAX_BYTES) throw new Error("That file is larger than 10 MB.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    return {
      text: isPdf ? await pdfToText(bytes) : new TextDecoder().decode(bytes),
      title: (form.get("title") as string) || undefined,
      meetingDate: (form.get("meeting_date") as string) || undefined,
      preview: form.get("preview") === "true",
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    text: typeof body.text === "string" ? body.text : "",
    title: body.title || undefined,
    meetingDate: body.meeting_date || undefined,
    preview: body.preview === true,
  };
}

export async function POST(request: Request) {
  try {
    const { actor } = await requireReportingWrite(request);
    const { text, title, meetingDate, preview } = await readInput(request);
    if (!text.trim()) return NextResponse.json({ error: "The document was empty." }, { status: 400 });

    if (preview) {
      const parsed = parseMeetingDocument(text);
      return NextResponse.json({
        meeting_date: meetingDate || parsed.meetingDate,
        sections: parsed.sections.map((s) => ({
          key: s.key,
          title: s.title,
          items: s.items.length,
          actions: s.items.reduce((sum, i) => sum + i.actions.length, 0),
          sample: s.items.slice(0, 3).map((i) => [i.jobNumber, i.title].filter(Boolean).join(" ")),
        })),
      });
    }

    const result = await importDocument(text, { title, meeting_date: meetingDate }, actor);
    return NextResponse.json(
      { report_id: result.report.id, items: result.items, actions: result.actions },
      { status: 201 },
    );
  } catch (err) {
    return reportingErrorResponse(err);
  }
}
