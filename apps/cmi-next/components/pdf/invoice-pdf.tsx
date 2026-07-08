import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, BrandHeader, LabeledBlock, Footer, money, pdfDate } from "./cmi-theme";
import { invoiceBalance } from "@/lib/invoices/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Job } from "@/lib/jobs/types";

type Client = { name?: string; email?: string | null; phone?: string | null } | null;

export function InvoicePdf({ invoice, job, client, logo }: { invoice: Invoice; job: Job; client: Client; logo: string | null }) {
  const items = invoice.line_items ?? [];
  const balance = invoiceBalance(invoice);
  return (
    <Document title={`Invoice ${invoice.invoice_number ?? ""}`}>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={logo} title="INVOICE" meta={[
          `Invoice ${invoice.invoice_number ?? "—"}`,
          `Issued ${pdfDate(invoice.issue_date)}`,
          `Due ${pdfDate(invoice.due_date)}`,
        ]} />

        <View style={[styles.section, styles.twoCol]}>
          <LabeledBlock heading="Bill To" lines={[client?.name, client?.email, client?.phone]} />
          <LabeledBlock heading="Job" lines={[job.job_name, job.job_number, job.full_address]} />
        </View>

        {/* Line items */}
        <View style={styles.tHead}>
          <Text style={[styles.th, { flex: 5 }]}>Description</Text>
          <Text style={[styles.th, styles.right, { flex: 1 }]}>Qty</Text>
          <Text style={[styles.th, styles.right, { flex: 2 }]}>Unit</Text>
          <Text style={[styles.th, styles.right, { flex: 2 }]}>Amount</Text>
        </View>
        {items.length === 0 ? (
          <View style={styles.tRow}><Text style={[styles.td, { flex: 10, color: "#6B7280" }]}>No line items.</Text></View>
        ) : items.map((it) => (
          <View key={it.id} style={styles.tRow}>
            <Text style={[styles.td, { flex: 5 }]}>{it.description || "—"}</Text>
            <Text style={[styles.td, styles.right, { flex: 1 }]}>{it.quantity ?? 1}</Text>
            <Text style={[styles.td, styles.right, { flex: 2 }]}>{money(it.unit_price)}</Text>
            <Text style={[styles.td, styles.right, { flex: 2 }]}>{money(it.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>{money(invoice.amount)}</Text></View>
          <View style={styles.totalRow}><Text>Amount Paid</Text><Text>{money(invoice.amount_paid)}</Text></View>
          <View style={styles.grandRow}><Text style={styles.grandText}>Balance Due</Text><Text style={styles.grandText}>{money(balance)}</Text></View>
        </View>

        {invoice.notes ? (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>{invoice.notes}</Text>
          </View>
        ) : null}

        <Footer note="Thank you for your business — Constructed Matter, Inc." />
      </Page>
    </Document>
  );
}
