// 11×17 Gantt print (react-pdf, Node runtime). Tabloid landscape. A table on
// the left (ID, task, start, finish), bars on a week or month timeline, and on
// every sheet a drafting-style title block and a legend. What prints comes
// from lib/schedules/gantt-print.ts (full, lookahead, milestones or client).
/* eslint-disable jsx-a11y/alt-text -- <Image> here is react-pdf, not an HTML img */
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { CMI, pdfDate } from "./cmi-theme";
import { endX, xOf, type PrintRow, type Scale, type GanttPrintView } from "@/lib/schedules/gantt-print";

const PAGE_W = 1224, PAGE_H = 792, M = 28;
const TABLE_W = 330;
const CHART_W = PAGE_W - M * 2 - TABLE_W;
const ROW_H = 13;
const TOP = 96;     // header + timeline band
const BOTTOM = 92;  // legend + title block
const GREEN = "#2F855A", RED = "#B83A3A", GREY = "#9CA3AF";

const VIEW_TITLE: Record<GanttPrintView, string> = { full: "Schedule", lookahead: "Three-week lookahead", milestones: "Milestones", client: "Client schedule" };

export type GanttPdfProps = {
  logo: string | null; view: GanttPrintView; rows: PrintRow[]; scale: Scale;
  project: { name: string; number: string | null; address: string | null; client: string | null };
  schedule: { name: string; status_date: string | null; baseline: string | null; finish: string | null };
  showBaseline: boolean;
};

const short = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");

function Diamond({ color, size = 6 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, backgroundColor: color, transform: "rotate(45deg)" }} />;
}

export function GanttPdf({ logo, view, rows, scale, project, schedule, showBaseline }: GanttPdfProps) {
  const client = view === "client";
  const statusX = schedule.status_date ? xOf(scale, schedule.status_date) : null;
  const printed = pdfDate(new Date().toISOString());
  return (
    <Document>
      <Page size="TABLOID" orientation="landscape" style={{ paddingTop: TOP, paddingBottom: BOTTOM, paddingHorizontal: M, fontFamily: "Helvetica", color: CMI.ink, fontSize: 7 }}>
        {/* Header: brand + sheet title, then the timeline band (repeats on every sheet). */}
        <View fixed style={{ position: "absolute", top: M - 6, left: M, right: M }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 1.5, borderBottomColor: CMI.ink, paddingBottom: 5 }}>
            {logo ? <Image src={logo} style={{ width: 150, height: 28, objectFit: "contain" }} /> : <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold" }}>CONSTRUCTED MATTER, INC.</Text>}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>{VIEW_TITLE[view].toUpperCase()}</Text>
              <Text style={{ fontSize: 8, color: CMI.muted }}>{project.number && project.number !== project.name ? `${project.number} · ` : ""}{project.name} · {schedule.name}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 6, borderBottomWidth: 0.75, borderBottomColor: CMI.muted }}>
            <View style={{ width: TABLE_W, flexDirection: "row", alignItems: "flex-end", paddingBottom: 2 }}>
              {!client ? <Text style={{ width: 30, fontFamily: "Helvetica-Bold", fontSize: 6.5 }}>ID</Text> : null}
              <Text style={{ width: client ? 230 : 200, fontFamily: "Helvetica-Bold", fontSize: 6.5 }}>TASK</Text>
              <Text style={{ width: 50, fontFamily: "Helvetica-Bold", fontSize: 6.5 }}>START</Text>
              <Text style={{ width: 50, fontFamily: "Helvetica-Bold", fontSize: 6.5 }}>FINISH</Text>
            </View>
            <View style={{ width: CHART_W, height: 24, position: "relative" }}>
              {scale.ticks.map((t) => (
                <View key={t.at} style={{ position: "absolute", left: xOf(scale, t.at) * CHART_W, top: 0, bottom: 0, borderLeftWidth: t.major ? 0.75 : 0.25, borderLeftColor: t.major ? CMI.muted : CMI.border, paddingLeft: 1.5 }}>
                  {t.major ? <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold" }}>{t.major}</Text> : <Text style={{ fontSize: 6.5 }}> </Text>}
                  <Text style={{ fontSize: 5.5, color: CMI.muted, marginTop: 3 }}>{t.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Rows */}
        {rows.map((r, n) => r.kind === "phase" ? (
          <View key={`p-${n}`} wrap={false} style={{ height: ROW_H, flexDirection: "row", alignItems: "center", backgroundColor: CMI.accentSoft }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: CMI.accent, paddingLeft: 2, letterSpacing: 0.6 }}>{r.name.toUpperCase()}</Text>
          </View>
        ) : (
          <TaskRow key={r.item.id} row={r} n={n} scale={scale} client={client} statusX={statusX} showBaseline={showBaseline && !client} />
        ))}
        {!rows.some((r) => r.kind === "task") ? <Text style={{ fontSize: 9, color: CMI.muted, marginTop: 10 }}>Nothing to print for this option.</Text> : null}

        {/* Legend (bottom left) and title block (bottom right), on every sheet. */}
        <View fixed style={{ position: "absolute", left: M, bottom: M - 8, width: 560, borderWidth: 0.75, borderColor: CMI.ink, padding: 6 }}>
          <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>LEGEND</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Legend bar={GREEN} label="Complete" />
            <Legend bar={CMI.accent} label="In progress (darker = done)" />
            <Legend bar={`${CMI.accent}66`} label="Not started" />
            {!client ? <Legend bar={`${CMI.accent}66`} outline={RED} label="Critical path" /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Diamond color={CMI.ink} /><Text>Milestone</Text></View>
            {showBaseline && !client ? <Legend bar={GREY} thin label="Baseline" /> : null}
            {statusX != null ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 0, height: 9, borderLeftWidth: 1, borderLeftColor: RED, borderStyle: "dashed" }} /><Text>Status date {short(schedule.status_date)}</Text></View> : null}
          </View>
          <Text style={{ fontSize: 5.5, color: CMI.muted, marginTop: 4 }}>
            {client ? "Dates are our current plan and can move with weather, inspections, deliveries and decisions." : `Bars run start to finish on the ${scale.unit === "week" ? "weekly" : "monthly"} scale above. Printed from the CMI dashboard.`}
          </Text>
        </View>
        <View fixed style={{ position: "absolute", right: M, bottom: M - 8, width: 360, borderWidth: 1, borderColor: CMI.ink, flexDirection: "row" }}>
          <View style={{ width: 120, borderRightWidth: 0.75, borderRightColor: CMI.ink, padding: 5, justifyContent: "center", overflow: "hidden" }}>
            {/* The logo won't scale into a cell this small in react-pdf, so the name is set as type; the sheet header carries the logo. */}
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, lineHeight: 1.25 }}>CONSTRUCTED</Text>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, lineHeight: 1.25 }}>MATTER, INC.</Text>
            <Text style={{ fontSize: 5.5, color: CMI.muted, marginTop: 3 }}>AZ ROC KB-1 #343120</Text>
          </View>
          <View style={{ flexGrow: 1 }}>
            <Cell label="PROJECT" value={`${project.number && project.number !== project.name ? `${project.number} · ` : ""}${project.name}`} />
            {project.address ? <Cell label="ADDRESS" value={project.address} /> : null}
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: "50%" }}><Cell label="SCHEDULE" value={schedule.name} /></View>
              <View style={{ width: "50%", borderLeftWidth: 0.5, borderLeftColor: CMI.ink }}><Cell label="FORECAST FINISH" value={schedule.finish ? pdfDate(schedule.finish) : "—"} /></View>
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: "34%" }}><Cell label="STATUS DATE" value={schedule.status_date ? pdfDate(schedule.status_date) : "—"} /></View>
              <View style={{ width: "33%", borderLeftWidth: 0.5, borderLeftColor: CMI.ink }}><Cell label="PRINTED" value={printed} /></View>
              <View style={{ width: "33%", borderLeftWidth: 0.5, borderLeftColor: CMI.ink, padding: 3 }}>
                <Text style={{ fontSize: 5, color: CMI.muted }}>SHEET</Text>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }} render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
              </View>
            </View>
            {!client && schedule.baseline ? <Cell label="BASELINE" value={schedule.baseline} last /> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

function Cell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ padding: 3, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: CMI.ink }}>
      <Text style={{ fontSize: 5, color: CMI.muted }}>{label}</Text>
      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>{value}</Text>
    </View>
  );
}

function Legend({ bar, label, outline, thin }: { bar: string; label: string; outline?: string; thin?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 18, height: thin ? 2.5 : 6, backgroundColor: bar, borderWidth: outline ? 1 : 0, borderColor: outline ?? bar }} />
      <Text>{label}</Text>
    </View>
  );
}

function TaskRow({ row, n, scale, client, statusX, showBaseline }: { row: Extract<PrintRow, { kind: "task" }>; n: number; scale: Scale; client: boolean; statusX: number | null; showBaseline: boolean }) {
  const i = row.item;
  const milestone = i.kind === "milestone";
  const pct = i.status === "complete" ? 100 : Math.max(0, Math.min(100, i.percent_complete ?? 0));
  const x0 = xOf(scale, i.start_date!) * CHART_W;
  const x1 = endX(scale, i.end_date ?? i.start_date!) * CHART_W;
  const w = Math.max(2, x1 - x0);
  const fill = pct >= 100 ? GREEN : pct > 0 ? CMI.accent : `${CMI.accent}66`;
  const b0 = showBaseline && i.baseline_start ? xOf(scale, i.baseline_start) * CHART_W : null;
  const b1 = showBaseline && i.baseline_start ? endX(scale, i.baseline_end ?? i.baseline_start) * CHART_W : null;
  return (
    <View wrap={false} style={{ height: ROW_H, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.25, borderBottomColor: CMI.border, backgroundColor: n % 2 ? "#FAFAF9" : CMI.white }}>
      <View style={{ width: TABLE_W, flexDirection: "row", alignItems: "center" }}>
        {!client ? <Text style={{ width: 30, color: CMI.muted }}>{i.activity_id ?? ""}</Text> : null}
        <Text style={{ width: client ? 230 : 200, paddingRight: 4, fontFamily: milestone ? "Helvetica-Bold" : "Helvetica" }}>{i.title.length > 52 ? `${i.title.slice(0, 51)}…` : i.title}</Text>
        <Text style={{ width: 50 }}>{short(i.start_date)}</Text>
        <Text style={{ width: 50 }}>{milestone ? "" : short(i.end_date)}</Text>
      </View>
      <View style={{ width: CHART_W, height: ROW_H, position: "relative" }}>
        {b0 != null && b1 != null && !milestone ? <View style={{ position: "absolute", left: b0, width: Math.max(2, b1 - b0), top: ROW_H - 3.5, height: 2, backgroundColor: GREY }} /> : null}
        {milestone ? (
          <View style={{ position: "absolute", left: x0 - 3.5, top: ROW_H / 2 - 3.5 }}><Diamond color={!client && i.is_critical ? RED : CMI.ink} size={7} /></View>
        ) : (
          <View style={{ position: "absolute", left: x0, width: w, top: 3, height: 6, backgroundColor: fill, borderWidth: !client && i.is_critical ? 0.9 : 0, borderColor: RED }}>
            {pct > 0 && pct < 100 ? <View style={{ width: `${pct}%`, height: "100%", backgroundColor: "#7C3A12" }} /> : null}
          </View>
        )}
        {statusX != null ? <View style={{ position: "absolute", left: statusX * CHART_W, top: 0, height: ROW_H, borderLeftWidth: 0.75, borderLeftColor: RED, borderStyle: "dashed" }} /> : null}
      </View>
    </View>
  );
}
