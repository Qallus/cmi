"use client";

// Charts (Recharts): calls and texts by day, open deals by stage, jobs by
// status. CMI colours; axes and tooltips use the theme tokens. (From Echo.)
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData, DayPoint } from "@/lib/dashboard/data";
import { BLUE, BRONZE, Empty, Frame, ROSE, SAGE, SAND } from "../kit";

const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" }, cursor: { fill: "var(--muted)", opacity: 0.4 } };

function TwoSeries({ points, a, b, kind }: { points: DayPoint[]; a: string; b?: string; kind: "area" | "bar" }) {
  const data = points.map((p) => ({ day: short(p.day), [a]: p.a, ...(b ? { [b]: p.b } : {}) }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "area" ? (
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="dash-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.35} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient>
              <linearGradient id="dash-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRONZE} stopOpacity={0.35} /><stop offset="100%" stopColor={BRONZE} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tip} />
            <Area type="monotone" dataKey={a} stroke={BLUE} strokeWidth={2} fill="url(#dash-a)" />
            {b && <Area type="monotone" dataKey={b} stroke={BRONZE} strokeWidth={2} fill="url(#dash-b)" />}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tip} />
            <Bar dataKey={a} stackId="x" fill={BRONZE} radius={b ? [0, 0, 4, 4] : [4, 4, 4, 4]} />
            {b && <Bar dataKey={b} stackId="x" fill={SAGE} radius={[4, 4, 0, 0]} />}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartCard({ type, data }: { type: "chart_calls" | "chart_texts" | "chart_pipeline" | "chart_jobs"; data: DashboardData }) {
  const meta = CARDS[type];
  if (type === "chart_calls") {
    return <Frame title={meta.title} icon={meta.icon} href="/dashboard/communications?panel=dialer">
      {data.calls ? <TwoSeries points={data.calls.series} a="Inbound" b="Outbound" kind="area" /> : <Empty>Twilio isn&apos;t connected.</Empty>}
    </Frame>;
  }
  if (type === "chart_texts") {
    return <Frame title={meta.title} icon={meta.icon} href="/dashboard/communications?tab=sms">
      {data.texts ? <TwoSeries points={data.texts.series} a="Sent" b="Received" kind="bar" /> : <Empty>Couldn&apos;t load texts.</Empty>}
    </Frame>;
  }
  if (type === "chart_pipeline") {
    const rows = data.pipeline?.byStage ?? [];
    return (
      <Frame title={meta.title} icon={meta.icon} href="/dashboard/pipeline">
        {!rows.some((r) => r.value) ? <Empty>No open deals.</Empty> : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tip} />
                <Bar dataKey="value" name="Deals" fill={BRONZE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Frame>
    );
  }
  const slices = data.jobs?.byStatus ?? [];
  const colors = [BRONZE, BLUE, SAGE, SAND, ROSE];
  return (
    <Frame title={meta.title} icon={meta.icon} href="/dashboard/jobs">
      {!slices.length ? <Empty>No jobs yet.</Empty> : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="var(--card)">
                {slices.map((s, i) => <Cell key={s.name} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip {...tip} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Frame>
  );
}
