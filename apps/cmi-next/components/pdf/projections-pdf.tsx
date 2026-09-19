import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, BrandHeader, Footer, CMI, pdfDate } from "./cmi-theme";
import { monthLabel, type MonthTotal } from "@/lib/projections/calc";
import { PROJECTION_STATUS_META, type ProjectionRow, type ProjectionSummary } from "@/lib/projections/types";

// Whole-dollar, compact money for the dense month grid.
function m$(v: number): string {
  if (!v) return "—";
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `${sign}$${Math.round(abs)}`;
}
const usd = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

const cell = { fontSize: 6.5, paddingHorizontal: 2 };
const W = { name: 3.2, status: 1.2, team: 1.8, remaining: 1.3, month: 0.9, beyond: 0.95, total: 1.05 };

// Landscape management report: summary, the 12-month grid and monthly totals.
export function ProjectionsPdf({ rows, totals, window, summary, anyActuals, currentMonth, filterNote, logo }: {
  rows: ProjectionRow[];
  totals: MonthTotal[];
  window: string[];
  summary: ProjectionSummary;
  anyActuals: boolean;
  currentMonth: string;
  filterNote: string | null;
  logo: string | null;
}) {
  const range = `${monthLabel(window[0])} – ${monthLabel(window[window.length - 1])}`;
  // "Backlog Split" = contracted / potential.
  const tiles: [string, string][] = [
    ["12-Mo Projected", usd(summary.projected12)],
    ["12-Mo Actual", anyActuals ? usd(summary.actual12) : "—"],
    ["Variance to Date", summary.varianceToDate === null ? "—" : usd(summary.varianceToDate)],
    ["Remaining Backlog", usd(summary.remainingBacklog)],
    ["Backlog Split", `${m$(summary.contractedBacklog)} / ${m$(summary.potentialBacklog)}`],
    ["Beyond Window", usd(summary.beyondBacklog)],
  ];
  return (
    <Document title={`Projections ${range}`}>
      <Page size="LETTER" orientation="landscape" style={[styles.page, { paddingHorizontal: 30 }]}>
        <BrandHeader logo={logo} title="REVENUE PROJECTIONS" meta={[range, `Generated ${pdfDate(new Date().toISOString())}`, ...(filterNote ? [filterNote] : [])]} />

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
          {tiles.map(([label, value]) => (
            <View key={label} style={{ flex: 1, borderWidth: 1, borderColor: CMI.border, borderRadius: 3, padding: 6 }}>
              <Text style={styles.label}>{label}</Text>
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{value}</Text>
            </View>
          ))}
        </View>
        {!anyActuals && <Text style={{ fontSize: 7, color: CMI.muted, marginBottom: 6 }}>No billing recorded yet — actuals and variance are blank.</Text>}

        <View style={styles.tHead} fixed>
          <Text style={[styles.th, cell, { flex: W.name }]}>Project</Text>
          <Text style={[styles.th, cell, { flex: W.status }]}>Status</Text>
          <Text style={[styles.th, cell, { flex: W.team }]}>PM / Super</Text>
          <Text style={[styles.th, cell, styles.right, { flex: W.remaining }]}>Remaining</Text>
          {window.map((m) => <Text key={m} style={[styles.th, cell, styles.right, { flex: W.month }, m === currentMonth ? { color: CMI.accent } : {}]}>{monthLabel(m)}</Text>)}
          <Text style={[styles.th, cell, styles.right, { flex: W.beyond }]}>Beyond</Text>
          <Text style={[styles.th, cell, styles.right, { flex: W.total }]}>12-Mo</Text>
        </View>
        {rows.length === 0 && (
          <View style={styles.tRow}><Text style={[styles.td, { color: CMI.muted }]}>No projects match.</Text></View>
        )}
        {rows.map((r) => (
          <View key={r.id} style={[styles.tRow, { paddingVertical: 3 }, r.include ? {} : { opacity: 0.45 }]} wrap={false}>
            <View style={{ flex: W.name, paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>{r.name}{r.include ? "" : " (excluded)"}</Text>
              <Text style={{ fontSize: 6, color: CMI.muted }}>{[r.job_number, r.client_name].filter(Boolean).join(" · ") || "Anticipated"}</Text>
            </View>
            <Text style={[cell, { flex: W.status }]}>{PROJECTION_STATUS_META[r.status].label}</Text>
            <Text style={[cell, { flex: W.team }]}>{r.pms.join(", ") || "—"} / {r.supers.join(", ") || "—"}</Text>
            <Text style={[cell, styles.right, { flex: W.remaining }]}>{usd(r.remaining)}</Text>
            {window.map((m) => <Text key={m} style={[cell, styles.right, { flex: W.month }]}>{m$(r.months[m]?.projected ?? 0)}</Text>)}
            <Text style={[cell, styles.right, { flex: W.beyond }]}>{m$(Object.values(r.beyond).reduce((s, v) => s + v, 0))}</Text>
            <Text style={[cell, styles.right, { flex: W.total, fontFamily: "Helvetica-Bold" }]}>{m$(r.window_projected)}</Text>
          </View>
        ))}

        {([
          ["Projected", totals.map((t) => m$(t.projected)), m$(summary.projected12)],
          ["Actual", totals.map((t) => (anyActuals && (t.month <= currentMonth || t.actual) ? m$(t.actual) : "—")), anyActuals ? m$(summary.actual12) : "—"],
          ["Variance", totals.map((t) => (anyActuals && t.variance !== null ? m$(t.variance) : "—")), summary.varianceToDate === null ? "—" : m$(summary.varianceToDate)],
          ["Projects", totals.map((t) => (t.projects ? String(t.projects) : "—")), ""],
        ] as [string, string[], string][]).map(([label, cells, total]) => (
          <View key={label} style={[styles.tRow, { backgroundColor: "#F7F5F2", paddingVertical: 3 }]} wrap={false}>
            <Text style={[cell, { flex: W.name + W.status + W.team + W.remaining, fontFamily: "Helvetica-Bold" }]}>{label}</Text>
            {cells.map((c, i) => <Text key={window[i]} style={[cell, styles.right, { flex: W.month, fontFamily: label === "Projected" ? "Helvetica-Bold" : "Helvetica" }]}>{c}</Text>)}
            <Text style={[cell, styles.right, { flex: W.beyond }]}>{label === "Projected" ? m$(summary.beyondBacklog) : ""}</Text>
            <Text style={[cell, styles.right, { flex: W.total, fontFamily: "Helvetica-Bold" }]}>{total}</Text>
          </View>
        ))}

        <Footer note="Confidential — management forecast. Projections never change job, invoice or pipeline records." />
      </Page>
    </Document>
  );
}
