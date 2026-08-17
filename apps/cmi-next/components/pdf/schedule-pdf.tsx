// Server-rendered CMI-branded Schedule PDF (react-pdf, Node runtime).
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, CMI, BrandHeader, LabeledBlock, Footer, pdfDate } from "./cmi-theme";
import { SCHEDULE_TYPE_LABELS, ITEM_STATUS_LABELS } from "@/lib/schedules/types";
import type { JobSchedule, ScheduleItem, SchedulePhase } from "@/lib/schedules/types";

type JobLite = { job_number: string | null; job_name: string; full_address?: string | null };

const COLS = { title: "42%", phase: "18%", start: "12%", finish: "12%", status: "16%" };

export function SchedulePdf({ schedule, items, phases, job, client, logo }: {
  schedule: JobSchedule; items: ScheduleItem[]; phases: SchedulePhase[]; job: JobLite; client?: string | null; logo: string | null;
}) {
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name ?? "" : "");
  const ordered = items.slice().sort((a, b) => (a.start_date ?? "") < (b.start_date ?? "") ? -1 : 1);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader logo={logo} title="Schedule" meta={[schedule.name, SCHEDULE_TYPE_LABELS[schedule.type] ?? schedule.type]} />

        <View style={[styles.twoCol, styles.section]}>
          <LabeledBlock heading="Job" lines={[[job.job_number, job.job_name].filter(Boolean).join(" · "), job.full_address ?? undefined, client ? `Client: ${client}` : undefined]} />
          <LabeledBlock heading="Schedule" lines={[`Start: ${pdfDate(schedule.start_date)}`, `Target: ${pdfDate(schedule.target_completion)}`, `Projected: ${pdfDate(schedule.projected_completion)}`, `Progress: ${schedule.progress}%`]} />
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
            <Text style={[styles.td, { width: COLS.title }]}>{i.kind === "milestone" ? "◆ " : ""}{i.title}</Text>
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
