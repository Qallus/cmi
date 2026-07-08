import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, BrandHeader, LabeledBlock, Footer, money, pdfDate } from "./cmi-theme";
import type { PriceSummary } from "@/lib/jobs/types";

type Client = { name?: string; email?: string | null; phone?: string | null } | null;

export function PriceSummaryPdf({ summary, client, logo }: { summary: PriceSummary; client: Client; logo: string | null }) {
  const job = summary.job;
  return (
    <Document title={`Price Summary ${job.job_number ?? ""}`}>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={logo} title="PRICE SUMMARY" meta={[`Generated ${pdfDate(new Date().toISOString())}`]} />

        <View style={[styles.section, styles.twoCol]}>
          <LabeledBlock heading="Client" lines={[client?.name, client?.email, client?.phone]} />
          <LabeledBlock heading="Job" lines={[job.job_name, job.job_number, job.full_address]} />
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}><Text>Contract Price</Text><Text>{money(summary.contract_price)}</Text></View>
        </View>

        {/* Approved change orders */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Approved Change Orders</Text>
          <View style={styles.tHead}>
            <Text style={[styles.th, { flex: 5 }]}>Title</Text>
            <Text style={[styles.th, { flex: 2 }]}>Date</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Price</Text>
          </View>
          {summary.change_orders.length === 0 ? (
            <View style={styles.tRow}><Text style={[styles.td, { flex: 9, color: "#6B7280" }]}>No approved change orders.</Text></View>
          ) : summary.change_orders.map((c, i) => (
            <View key={i} style={styles.tRow}>
              <Text style={[styles.td, { flex: 5 }]}>{c.title}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{pdfDate(c.date)}</Text>
              <Text style={[styles.td, styles.right, { flex: 2 }]}>{money(c.price)}</Text>
            </View>
          ))}
        </View>

        {/* Invoices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoices</Text>
          <View style={styles.tHead}>
            <Text style={[styles.th, { flex: 3 }]}>Invoice</Text>
            <Text style={[styles.th, { flex: 2 }]}>Date</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Amount</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Paid</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Balance</Text>
          </View>
          {summary.invoices.length === 0 ? (
            <View style={styles.tRow}><Text style={[styles.td, { flex: 11, color: "#6B7280" }]}>No invoices.</Text></View>
          ) : summary.invoices.map((inv, i) => (
            <View key={i} style={styles.tRow}>
              <Text style={[styles.td, { flex: 3 }]}>{inv.number}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{pdfDate(inv.date)}</Text>
              <Text style={[styles.td, styles.right, { flex: 2 }]}>{money(inv.amount)}</Text>
              <Text style={[styles.td, styles.right, { flex: 2 }]}>{money(inv.paid)}</Text>
              <Text style={[styles.td, styles.right, { flex: 2 }]}>{money(inv.balance)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}><Text>Approved Change Orders</Text><Text>{money(summary.approved_change_orders_total)}</Text></View>
          <View style={styles.grandRow}><Text style={styles.grandText}>Total Contract Value</Text><Text style={styles.grandText}>{money(summary.grand_total)}</Text></View>
        </View>

        <Footer note="Constructed Matter, Inc. — Price Summary" />
      </Page>
    </Document>
  );
}
