// Server-rendered CMI-branded Schedule PDF (react-pdf, Node runtime).
import type { ReactNode } from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, CMI, BrandHeader, Footer, pdfDate } from "./cmi-theme";
import { SCHEDULE_TYPE_LABELS, ITEM_STATUS_LABELS } from "@/lib/schedules/types";
import type { JobSchedule, ScheduleItem, SchedulePhase } from "@/lib/schedules/types";

type JobLite = { job_number: string | null; job_name: string; full_address?: string | null };

const COLS = { title: "40%", phase: "22%", start: "12%", finish: "12%", status: "14%" };

const DAY = 86400000;
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime()) / DAY);
}

/** One key figure in the summary band (label over value, optional note). */
function Tile({ label, value, note, noteColor, children }: { label: string; value: string; note?: string; noteColor?: string; children?: ReactNode }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: CMI.border, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 7 }}>
      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: CMI.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 4 }}>{value}</Text>
      {children}
      {note ? <Text style={{ fontSize: 7.5, color: noteColor ?? CMI.muted, marginTop: 3 }}>{note}</Text> : null}
    </View>
  );
}

export function SchedulePdf({ schedule, items, phases, job, client, logo }: {
  schedule: JobSchedule; items: ScheduleItem[]; phases: SchedulePhase[]; job: JobLite; client?: string | null; logo: string | null;
}) {
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name ?? "" : "");
  const ordered = items.slice().sort((a, b) => (a.start_date ?? "") < (b.start_date ?? "") ? -1 : 1);
  const milestones = items.filter((i) => i.kind === "milestone").length;

  // Finish: the projected date when there is one, otherwise the last task's end.
  const lastEnd = items.reduce<string | null>((m, i) => { const e = i.end_date ?? i.start_date; return e && (!m || e > m) ? e : m; }, null);
  const finish = schedule.projected_completion ?? lastEnd;
  const target = schedule.target_completion;
  const late = finish && target ? daysBetween(target, finish) : null;
  const typeLabel = SCHEDULE_TYPE_LABELS[schedule.type] ?? schedule.type;
  const progress = Math.max(0, Math.min(100, Math.round(schedule.progress ?? 0)));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={logo} title="SCHEDULE" meta={[schedule.name, `${typeLabel} · Printed ${pdfDate(new Date().toISOString())}`]} />

        {/* Project on the left, the key dates on the right, both top-aligned. */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 16, alignItems: "flex-start" }}>
          <View style={{ width: "30%" }}>
            <Text style={styles.sectionTitle}>Project</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", lineHeight: 1.3 }}>{job.job_name}</Text>
            {job.job_number && job.job_number !== job.job_name ? <Text style={{ fontSize: 8.5, color: CMI.muted, marginTop: 2 }}>{job.job_number}</Text> : null}
            {job.full_address ? <Text style={{ fontSize: 9, marginTop: 5, lineHeight: 1.35 }}>{job.full_address}</Text> : null}
            {client ? <Text style={{ fontSize: 9, marginTop: 3 }}><Text style={{ color: CMI.muted }}>Client  </Text>{client}</Text> : null}
          </View>
          <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <View style={{ flexDirection: "row", gap: 5 }}>
              <Tile label="Start" value={pdfDate(schedule.start_date)} />
              <Tile label="Finish" value={pdfDate(finish)} note={schedule.projected_completion ? "Projected" : lastEnd ? "Last task" : undefined} />
              <Tile label="Target" value={target ? pdfDate(target) : "Not set"}
                note={late == null ? undefined : late > 0 ? `${late} day${late === 1 ? "" : "s"} late` : late < 0 ? `${-late} day${late === -1 ? "" : "s"} early` : "On target"}
                noteColor={late != null && late > 0 ? "#B83A3A" : late != null ? "#3F8A3A" : undefined} />
              <Tile label="Progress" value={`${progress}%`}>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: CMI.border, marginTop: 5 }}>
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: CMI.accent, width: `${progress}%` }} />
                </View>
              </Tile>
            </View>
            <Text style={{ fontSize: 8, color: CMI.muted, marginTop: 6, textAlign: "right" }}>
              {items.length - milestones} task{items.length - milestones === 1 ? "" : "s"} · {milestones} milestone{milestones === 1 ? "" : "s"}{phases.length ? ` · ${phases.length} phase${phases.length === 1 ? "" : "s"}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.tHead}>
          <Text style={[styles.th, { width: COLS.title }]}>Item</Text>
          <Text style={[styles.th, { width: COLS.phase }]}>Phase</Text>
          <Text style={[styles.th, { width: COLS.start }]}>Start</Text>
          <Text style={[styles.th, { width: COLS.finish }]}>Finish</Text>
          <Text style={[styles.th, { width: COLS.status }]}>Status</Text>
        </View>
        {ordered.map((i) => (
          <View key={i.id} style={styles.tRow} wrap={false}>
            <View style={{ width: COLS.title, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
              {/* Helvetica has no ◆, so milestones get a small drawn diamond. */}
              {i.kind === "milestone" ? <View style={{ width: 5, height: 5, backgroundColor: CMI.accent, transform: "rotate(45deg)", marginRight: 6 }} /> : null}
              <Text style={{ fontSize: 9, flexShrink: 1 }}>{i.title}</Text>
            </View>
            <Text style={[styles.td, { width: COLS.phase, color: CMI.muted }]}>{phaseName(i.phase_id)}</Text>
            <Text style={[styles.td, { width: COLS.start }]}>{pdfDate(i.start_date)}</Text>
            <Text style={[styles.td, { width: COLS.finish }]}>{i.kind === "milestone" ? "—" : pdfDate(i.end_date)}</Text>
            <Text style={[styles.td, { width: COLS.status }]}>{ITEM_STATUS_LABELS[i.status] ?? i.status}</Text>
          </View>
        ))}
        {!ordered.length ? <Text style={[styles.value, { marginTop: 12, color: CMI.muted }]}>No schedule items.</Text> : null}

        <Footer note={`Constructed Matter, Inc. — ${schedule.name}`} />
      </Page>
    </Document>
  );
}
