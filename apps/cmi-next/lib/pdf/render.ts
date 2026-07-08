import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

// Render a react-pdf <Document> element to a PDF Buffer (Node runtime). Accepts
// any ReactElement (our Document components) and hands it to renderToBuffer.
export async function renderPdf(doc: ReactElement): Promise<Buffer> {
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}
