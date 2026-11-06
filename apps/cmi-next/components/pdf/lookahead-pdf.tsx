// Three-week lookahead PDF (react-pdf, Node runtime): one landscape Letter
// page, grouped by phase, with a 15-weekday strip (this week, next week, the
// week after). Internal shows trades and late flags; the client version
// doesn't (lookahead.ts decides what's in each).
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, CMI, BrandHeader, Footer, pdfDate } from "./cmi-theme";
import { LOOKAHEAD_STATUS_LABELS, type LookaheadRow } from "@/lib/schedules/lookahead";
import type { LookaheadData } from "@/lib/schedules/lookahead-data";

const W = { task: 140, trade: 92, start: 44, finish: 44, status: 56, waits: 100 };
const DAY_W = 16;
const short = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—");
const dow = (iso: string) => "MTWTF"[new Date(`${iso}T12:00:00Z`).getUTCDay() - 1] ?? "";

const STATUS_COLOR: Record<LookaheadRow["status"], string> = { done: "#047857", in_progress: CMI.accent, late: "#B91C1C", not_started: CMI.muted };

export function LookaheadPdf({ data, logo }: { data: LookaheadData; logo: string | null }) {
  const { lookahead: la, project, schedule, audience } = data;
  const client = audience === "client";
  const today = data.today;
  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={{ ...styles.page, paddingHorizontal: 32, paddingTop: 30 }}>
        <BrandHeader logo={logo} title="THREE-WEEK LOOKAHEAD" meta={[`${project.number && project.number !== project.name ? `${project.number} · ` : ""}${project.name}`, `${schedule.name} · ${pdfDate(la.from)} – ${pdfDate(la.to)}${client ? "" : " · Internal"}`]} />

        {/* Header row: columns, then the three weeks of weekdays. */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: CMI.ink, paddingBottom: 3 }}>
          <Text style={[styles.th, { width: W.task }]}>Task</Text>
          {!client ? <Text style={[styles.th, { width: W.trade }]}>Trade</Text> : null}
          <Text style={[styles.th, { width: W.start }]}>Start</Text>
          <Text style={[styles.th, { width: W.finish }]}>Finish</Text>
          <Text style={[styles.th, { width: W.status }]}>Status</Text>
          <Text style={[styles.th, { width: W.waits }]}>{client ? "Your decision" : "Waits on"}</Text>
          {la.weeks.map((w, n) => (
            <View key={w.start} style={{ width: DAY_W * 5, marginLeft: n ? 0 : 4 }}>
              <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", textAlign: "center", textTransform: "uppercase" }}>{w.label}</Text>
              <View style={{ flexDirection: "row" }}>
                {la.days.slice(n * 5, n * 5 + 5).map((d) => (
                  <Text key={d} style={{ width: DAY_W, fontSize: 6, textAlign: "center", color: d === today ? CMI.accent : CMI.muted, fontFamily: d === today ? "Helvetica-Bold" : "Helvetica" }}>{dow(d)}{"\n"}{Number(d.slice(8))}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        {la.groups.length === 0 ? <Text style={{ fontSize: 9, color: CMI.muted, marginTop: 16 }}>Nothing is scheduled in these three weeks.</Text> : null}
        {la.groups.map((g) => (
          <View key={g.phase} wrap={false}>
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CMI.accent, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 7, marginBottom: 1 }}>{g.phase}</Text>
            {g.rows.map((r) => (
              <View key={r.id} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: CMI.border, paddingVertical: 2.5 }}>
                <Text style={{ width: W.task, fontSize: 8, paddingRight: 4 }}>{r.milestone ? "» " : ""}{r.title}</Text>
                {!client ? <Text style={{ width: W.trade, fontSize: 7.5, color: CMI.muted, paddingRight: 4 }}>{r.trade ?? ""}</Text> : null}
                <Text style={{ width: W.start, fontSize: 7.5 }}>{short(r.start)}</Text>
                <Text style={{ width: W.finish, fontSize: 7.5 }}>{r.milestone ? "" : short(r.finish)}</Text>
                <Text style={{ width: W.status, fontSize: 7.5, color: STATUS_COLOR[r.status] }}>{LOOKAHEAD_STATUS_LABELS[r.status]}{r.status === "in_progress" && r.pct ? ` ${r.pct}%` : ""}</Text>
                <Text style={{ width: W.waits, fontSize: 7, paddingRight: 4, color: r.waitsOn?.late ? "#B91C1C" : CMI.ink }}>
                  {r.waitsOn ? `${r.waitsOn.name}${r.waitsOn.decided ? " (decided)" : r.waitsOn.due ? ` · by ${short(r.waitsOn.due)}` : ""}` : ""}
                </Text>
                <View style={{ flexDirection: "row", marginLeft: 4 }}>
                  {la.days.map((d, n) => {
                    const on = r.days.includes(n);
                    return (
                      <View key={d} style={{ width: DAY_W, height: 8, borderLeftWidth: n % 5 === 0 ? 0.75 : 0.25, borderLeftColor: n % 5 === 0 ? CMI.muted : CMI.border, justifyContent: "center", alignItems: "center" }}>
                        {on ? (r.milestone
                          ? <View style={{ width: 5, height: 5, backgroundColor: CMI.ink, transform: "rotate(45deg)" }} />
                          : <View style={{ width: DAY_W, height: 6, backgroundColor: r.status === "done" ? "#A7F3D0" : r.status === "late" ? "#FCA5A5" : CMI.accent, opacity: r.status === "not_started" ? 0.55 : 1 }} />) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={{ fontSize: 7, color: CMI.muted, marginTop: 10 }}>
          {client
            ? "Dates are our current plan and can move with weather, inspections and deliveries. Decisions listed are needed by the date shown to keep the work on schedule."
            : `${la.count} task${la.count === 1 ? "" : "s"}. Status as of ${pdfDate(schedule.status_date ?? today)}. Red: late start, or a selection not decided before the work starts.`}
        </Text>
        <Footer note={`Constructed Matter, Inc. — ${schedule.name} lookahead`} />
      </Page>
    </Document>
  );
}
