// Weekly Workload Meeting report, laid out the way the Word document reads:
// sections, then projects, then the detail lines under each.
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { CMI, styles, BrandHeader, Footer, pdfDate } from "./cmi-theme";
import type { ReportDetail, ReportItem } from "@/lib/reporting/types";

const local = StyleSheet.create({
  sectionHead: { fontSize: 11, fontFamily: "Helvetica-Bold", color: CMI.ink, backgroundColor: CMI.accentSoft, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 2, marginTop: 12, marginBottom: 6 },
  item: { marginBottom: 9, paddingLeft: 2 },
  itemTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  meta: { fontSize: 8, color: CMI.muted },
  body: { fontSize: 9, marginTop: 2 },
  bullet: { fontSize: 9, marginLeft: 10, marginTop: 1.5 },
  owner: { fontSize: 8, color: CMI.accent },
  empty: { fontSize: 9, color: CMI.muted, fontStyle: "italic" },
});

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <Text style={local.meta}>{label}: {value}</Text>;
}

function Lines({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <View>
      <Text style={local.meta}>{label}</Text>
      {text.split("\n").filter(Boolean).map((line, i) => <Text key={i} style={local.bullet}>• {line}</Text>)}
    </View>
  );
}

function Item({ item, ownerName }: { item: ReportItem; ownerName: (id: string | null, label: string | null) => string | null }) {
  const heading = [item.job_number, item.title].filter(Boolean).join("_");
  return (
    <View style={local.item} wrap={false}>
      <Text style={local.itemTitle}>
        {heading}{item.value_note ? ` — ${item.value_note}` : ""}
      </Text>
      <View style={local.metaRow}>
        <Meta label="Status" value={item.status_text} />
        <Meta label="Original completion" value={item.original_completion ? pdfDate(item.original_completion) : null} />
        <Meta label="Current completion" value={item.current_completion ? pdfDate(item.current_completion) : null} />
        <Meta label="Warranty" value={item.warranty_date ? pdfDate(item.warranty_date) : null} />
        <Meta label="Financial" value={item.financial_note} />
        <Meta label="Scope" value={item.scope} />
        <Meta label="Design partner" value={item.design_partner} />
      </View>
      {item.latest_update ? <Text style={local.body}>{item.latest_update}</Text> : null}

      {item.action_items.length > 0 && (
        <View>
          <Text style={local.meta}>Action items</Text>
          {item.action_items.map((action) => {
            const owner = ownerName(action.owner_staff_id, action.owner_label);
            const due = action.due_date ? ` · due ${pdfDate(action.due_date)}` : "";
            return (
              <Text key={action.id} style={local.bullet}>
                {action.completed_at ? "✓" : "•"} {action.body}
                {owner || due ? <Text style={local.owner}>{owner ? ` — ${owner}` : ""}{due}</Text> : null}
              </Text>
            );
          })}
        </View>
      )}

      <Lines label="Procurement" text={item.procurement_note} />
      <Lines label="Notes" text={item.notes} />
    </View>
  );
}

export function MeetingReportPdf({
  report, logo, owners,
}: {
  report: ReportDetail;
  logo: string | null;
  owners: { id: string; name: string }[];
}) {
  const nameById = new Map(owners.map((o) => [o.id, o.name]));
  const ownerName = (id: string | null, label: string | null) => (id ? nameById.get(id) ?? label : label);

  return (
    <Document title={report.title}>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          logo={logo}
          title="Weekly Workload Meeting"
          meta={[pdfDate(report.meeting_date), report.status === "final" ? "Final" : "Draft"]}
        />

        {report.sections.map((section) => (
          <View key={section.id}>
            <Text style={local.sectionHead}>{section.title}</Text>
            {section.items.length === 0
              ? <Text style={local.empty}>Nothing this week.</Text>
              : section.items.map((item) => <Item key={item.id} item={item} ownerName={ownerName} />)}
          </View>
        ))}

        <Footer note={`Constructed Matter, Inc. — ${report.title}`} />
      </Page>
    </Document>
  );
}
