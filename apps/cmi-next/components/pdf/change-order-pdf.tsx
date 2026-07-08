import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, BrandHeader, LabeledBlock, Footer, money, pdfDate } from "./cmi-theme";
import type { ChangeOrder } from "@/lib/change-orders/types";
import type { Job } from "@/lib/jobs/types";

type Client = { name?: string; email?: string | null; phone?: string | null } | null;

export function ChangeOrderPdf({ co, job, client, logo }: { co: ChangeOrder; job: Job; client: Client; logo: string | null }) {
  return (
    <Document title={`Change Order ${co.co_number ?? ""}`}>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={logo} title="CHANGE ORDER" meta={[
          `${co.co_number ?? "—"}`,
          `Date ${pdfDate(co.co_date)}`,
          `Status: ${co.status.replace(/_/g, " ")}`,
        ]} />

        <View style={[styles.section, styles.twoCol]}>
          <LabeledBlock heading="Client" lines={[client?.name, client?.email, client?.phone]} />
          <LabeledBlock heading="Job" lines={[job.job_name, job.job_number, job.full_address]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{co.title}</Text>
          <Text style={{ fontSize: 10, color: "#374151", lineHeight: 1.5 }}>{co.description || "—"}</Text>
        </View>

        <View style={styles.totalsBox}>
          {co.requested_by ? <View style={styles.totalRow}><Text>Requested By</Text><Text>{co.requested_by}</Text></View> : null}
          {co.approved_date ? <View style={styles.totalRow}><Text>Approved</Text><Text>{pdfDate(co.approved_date)}</Text></View> : null}
          <View style={styles.grandRow}><Text style={styles.grandText}>Change Order Total</Text><Text style={styles.grandText}>{money(co.amount)}</Text></View>
        </View>

        <View style={{ marginTop: 40, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: 220 }}>
            <View style={{ borderTopWidth: 1, borderTopColor: "#1A1A1A", marginTop: 24, paddingTop: 4 }}>
              <Text style={styles.label}>Client Signature / Date</Text>
            </View>
          </View>
          <View style={{ width: 220 }}>
            <View style={{ borderTopWidth: 1, borderTopColor: "#1A1A1A", marginTop: 24, paddingTop: 4 }}>
              <Text style={styles.label}>CMI Representative / Date</Text>
            </View>
          </View>
        </View>

        <Footer note="Constructed Matter, Inc. — Change Order" />
      </Page>
    </Document>
  );
}
