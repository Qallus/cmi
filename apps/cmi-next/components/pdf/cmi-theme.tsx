// Shared CMI-branded PDF primitives built on @react-pdf/renderer. Rendered
// server-side (Node) — this is NOT a DOM/React-client module; the JSX elements
// are react-pdf components, not HTML. Uses default Helvetica (no font registration).
/* eslint-disable jsx-a11y/alt-text -- <Image> here is react-pdf, not an HTML img */
import { StyleSheet, View, Text, Image } from "@react-pdf/renderer";

export const CMI = {
  ink: "#1A1A1A",
  muted: "#6B7280",
  border: "#E5E7EB",
  accent: "#B7541F", // CMI warm rust/orange
  accentSoft: "#FBEEE6",
  white: "#FFFFFF",
};

export const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: CMI.ink, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: CMI.border, paddingBottom: 12, marginBottom: 16 },
  logo: { width: 165, height: 32, objectFit: "contain" },
  brandName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  brandMeta: { fontSize: 8, color: CMI.muted, marginTop: 2 },
  docTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 9, color: CMI.muted, textAlign: "right", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 8, letterSpacing: 1, color: CMI.muted, textTransform: "uppercase", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  twoCol: { flexDirection: "row", justifyContent: "space-between", gap: 24 },
  col: { flexGrow: 1, flexBasis: 0 },
  label: { fontSize: 8, color: CMI.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 10, marginBottom: 4 },
  // table
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: CMI.border, paddingVertical: 5 },
  tHead: { flexDirection: "row", backgroundColor: CMI.accentSoft, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 2 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: CMI.ink, textTransform: "uppercase", letterSpacing: 0.5 },
  td: { fontSize: 9, paddingHorizontal: 4 },
  right: { textAlign: "right" },
  // totals
  totalsBox: { marginTop: 12, marginLeft: "auto", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 2, borderTopColor: CMI.ink },
  grandText: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, borderTopWidth: 1, borderTopColor: CMI.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: CMI.muted },
  badge: { alignSelf: "flex-start", fontSize: 8, color: CMI.accent, backgroundColor: CMI.accentSoft, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, fontFamily: "Helvetica-Bold" },
});

export function money(v: number | null | undefined): string {
  const n = typeof v === "number" ? v : 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pdfDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

// Branded header: logo (or wordmark fallback) on the left, document title/meta right.
export function BrandHeader({ logo, title, meta }: { logo: string | null; title: string; meta?: string[] }) {
  return (
    <View style={styles.headerRow}>
      <View>
        {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.brandName}>CONSTRUCTED MATTER, INC.</Text>}
        <Text style={styles.brandMeta}>AZ ROC KB-1 #343120</Text>
        <Text style={styles.brandMeta}>constructedmatter.com</Text>
      </View>
      <View>
        <Text style={styles.docTitle}>{title}</Text>
        {(meta ?? []).map((m, i) => <Text key={i} style={styles.docMeta}>{m}</Text>)}
      </View>
    </View>
  );
}

export function LabeledBlock({ heading, lines }: { heading: string; lines: (string | null | undefined)[] }) {
  return (
    <View style={styles.col}>
      <Text style={styles.sectionTitle}>{heading}</Text>
      {lines.filter(Boolean).map((l, i) => <Text key={i} style={styles.value}>{l}</Text>)}
    </View>
  );
}

export function Footer({ note }: { note?: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{note ?? "Constructed Matter, Inc."}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
