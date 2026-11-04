// Server-rendered CMI-branded daily report (Field Reports), react-pdf.
/* eslint-disable jsx-a11y/alt-text -- <Image> here is react-pdf, not an HTML img */
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { styles, CMI, BrandHeader, Footer, pdfDate } from "./cmi-theme";
import { SECTION_KEYS, SECTION_LABELS, type LogItem, type LogSections } from "@/lib/daily-logs/sections";

type JobLite = { job_number: string | null; job_name: string; full_address?: string | null };

function itemLine(i: LogItem): string {
  if (i.section === "onsite") {
    const who = [i.company, i.trade].filter(Boolean).join(" – ") || i.text;
    const extra = [i.crew != null ? `${i.crew} crew` : null, i.hours != null ? `${i.hours} hrs` : null].filter(Boolean).join(", ");
    return extra ? `${who} (${extra})` : who;
  }
  const bits = [i.text];
  if (i.section === "inspections" && i.result) bits.push(`Result: ${i.result}`);
  if (i.section === "delays" && i.impact) bits.push(`Impact: ${i.impact}`);
  if (i.section === "actions") bits.push([i.owner ? `Owner: ${i.owner}` : null, i.due ? `Due ${pdfDate(i.due)}` : null].filter(Boolean).join(" · "));
  return bits.filter(Boolean).join(" — ");
}

export function DailyReportPdf({ job, log, sections, photos, logo, submittedBy }: {
  job: JobLite;
  log: { log_number: number | null; log_date: string; status: string; weather: string | null; temperature: string | null; submitted_at: string | null };
  sections: LogSections; photos: string[]; logo: string | null; submittedBy?: string | null;
}) {
  const title = `Daily Log${log.log_number ? ` #${log.log_number}` : ""}`;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={logo} title="DAILY REPORT" meta={[`${title} · ${pdfDate(log.log_date)}`, log.status === "submitted" ? `Submitted${submittedBy ? ` by ${submittedBy}` : ""}${log.submitted_at ? ` · ${pdfDate(log.submitted_at)}` : ""}` : "Draft"]} />

        <View style={{ flexDirection: "row", gap: 16, marginBottom: 14 }}>
          <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <Text style={styles.sectionTitle}>Project</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>{job.job_name}</Text>
            {job.job_number && job.job_number !== job.job_name ? <Text style={{ fontSize: 8.5, color: CMI.muted, marginTop: 2 }}>{job.job_number}</Text> : null}
            {job.full_address ? <Text style={{ fontSize: 9, marginTop: 4 }}>{job.full_address}</Text> : null}
          </View>
          <View style={{ width: "38%", borderWidth: 1, borderColor: CMI.border, borderRadius: 4, padding: 8 }}>
            <Text style={styles.sectionTitle}>Weather</Text>
            <Text style={{ fontSize: 10 }}>{[log.weather, log.temperature].filter(Boolean).join(" · ") || "Not recorded"}</Text>
          </View>
        </View>

        {SECTION_KEYS.filter((k) => k !== "internal").map((k) => {
          const items = sections.items.filter((i) => i.section === k);
          if (!items.length) return null;
          return (
            <View key={k} style={{ marginBottom: 10 }} wrap={false}>
              <Text style={[styles.sectionTitle, { color: CMI.accent }]}>{SECTION_LABELS[k]}</Text>
              {items.map((i) => (
                <View key={i.id} style={{ flexDirection: "row", marginTop: 3 }}>
                  <Text style={{ width: 10, fontSize: 9, color: CMI.muted }}>•</Text>
                  <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 9.5, lineHeight: 1.35 }}>{itemLine(i)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {photos.length ? (
          <View style={{ marginTop: 6 }} wrap={false}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {photos.slice(0, 6).map((u) => <Image key={u} src={u} style={{ width: 166, height: 124, objectFit: "cover", borderRadius: 3 }} />)}
            </View>
          </View>
        ) : null}

        <Footer note={`Constructed Matter, Inc. — ${job.job_name} — ${title}`} />
      </Page>
    </Document>
  );
}
