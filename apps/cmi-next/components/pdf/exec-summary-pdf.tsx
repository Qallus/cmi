// Server-rendered CMI-branded Executive Summary (react-pdf). Saved to the job's
// Files when a summary is sent (Field Reports, Step 4).
/* eslint-disable jsx-a11y/alt-text -- <Image> here is react-pdf, not an HTML img */
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { styles, CMI, BrandHeader, Footer } from "./cmi-theme";

export type ExecSummaryPdfProps = {
  audience: "team" | "client";
  projectName: string; projectNumber: string | null;
  headline: string; opening: string; firstName: string | null;
  facts: { label: string; value: string }[];
  completed: string[];
  comingSoon: { item: string; when: string | null }[];
  /** Plain-text sections from the edited body ("Title" lines followed by paragraphs/bullets). */
  sections: { title: string; lines: string[] }[];
  photos: { url: string; caption: string | null }[];
  dateLabel: string; periodLabel: string | null; preparedBy: string | null;
  logo: string | null;
};

export function ExecSummaryPdf(p: ExecSummaryPdfProps) {
  const opening = p.opening.replace(/\{\{\s*first_name\s*\}\}/gi, (p.firstName ?? "").trim() || (p.audience === "team" ? "team" : "there"));
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={p.logo} title={p.audience === "team" ? "EXECUTIVE SUMMARY · INTERNAL" : "EXECUTIVE SUMMARY"}
          meta={[p.projectNumber && p.projectNumber !== p.projectName ? `${p.projectName} · ${p.projectNumber}` : p.projectName, p.periodLabel ? `${p.periodLabel} · ${p.dateLabel}` : p.dateLabel]} />

        <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", lineHeight: 1.25, marginBottom: 8 }}>{p.headline}</Text>
        {opening.split(/\n+/).map((para, i) => <Text key={i} style={{ fontSize: 10, lineHeight: 1.45, marginBottom: 4 }}>{para}</Text>)}

        {p.facts.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 10 }}>
            {p.facts.map((f) => (
              <View key={f.label} style={{ flexGrow: 1, flexBasis: 110, borderWidth: 1, borderColor: CMI.border, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: CMI.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.label}</Text>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 3 }}>{f.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
          {p.completed.length ? (
            <View style={{ flexGrow: 1, flexBasis: 0 }}>
              <Text style={[styles.sectionTitle, { color: CMI.accent }]}>Completed</Text>
              {p.completed.map((c, i) => <Text key={i} style={{ fontSize: 9.5, marginTop: 3 }}>• {c}</Text>)}
            </View>
          ) : null}
          {p.comingSoon.length ? (
            <View style={{ flexGrow: 1, flexBasis: 0 }}>
              <Text style={[styles.sectionTitle, { color: CMI.accent }]}>Coming soon</Text>
              {p.comingSoon.map((c, i) => <Text key={i} style={{ fontSize: 9.5, marginTop: 3 }}>• {c.item}{c.when ? ` — ${c.when}` : ""}</Text>)}
            </View>
          ) : null}
        </View>

        {p.sections.map((s, i) => (
          <View key={i} style={{ marginTop: 6 }} wrap={false}>
            {s.title ? <Text style={[styles.sectionTitle, { color: CMI.accent }]}>{s.title}</Text> : null}
            {s.lines.map((l, j) => <Text key={j} style={{ fontSize: 9.5, lineHeight: 1.4, marginTop: 2 }}>{l}</Text>)}
          </View>
        ))}

        {p.photos.length ? (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {p.photos.slice(0, 6).map((ph) => (
                <View key={ph.url} style={{ width: 166 }}>
                  <Image src={ph.url} style={{ width: 166, height: 124, objectFit: "cover", borderRadius: 3 }} />
                  {ph.caption ? <Text style={{ fontSize: 7.5, color: CMI.muted, marginTop: 2 }}>{ph.caption}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Footer note={`Constructed Matter, Inc. — ${p.projectName}${p.preparedBy ? ` — prepared by ${p.preparedBy}` : ""}`} />
      </Page>
    </Document>
  );
}

/** The edited body (simple HTML: h2/h3, p, li) as titled sections of plain lines. */
export function bodySections(html: string): { title: string; lines: string[] }[] {
  const out: { title: string; lines: string[] }[] = [];
  const text = html
    .replace(/<\s*(h[1-4])[^>]*>/gi, "\n§§").replace(/<\/\s*h[1-4]\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ").replace(/<\/\s*(p|li|div)\s*>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("§§")) { out.push({ title: line.slice(2).trim(), lines: [] }); continue; }
    if (!out.length) out.push({ title: "", lines: [] });
    out[out.length - 1].lines.push(line);
  }
  return out.filter((s) => s.title || s.lines.length);
}
