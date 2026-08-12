"use client";

// Browser softphone for the CMI Communications page — Twilio Voice SDK.
// Outbound + inbound calls, recording, transcription, per-call notes, cost,
// and a daily stats bar. Call history & cost come live from the Twilio REST API.

import * as React from "react";
import {
  ChevronDown, Circle, Clock, Disc, Download, FileText, Mic, MicOff, Pause,
  Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Play,
  RefreshCw, Sparkles, Trash2, Voicemail, X, MessageSquare,
  PhoneForwarded, Timer, Hash, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type TwilioCall = {
  sid: string; to: string; from: string; status: string; direction: string;
  duration: string; price: string | null; priceUnit: string;
  dateCreated: string; startTime: string | null; endTime: string | null;
};
type TwilioRecording = {
  sid: string; callSid: string; duration: string; status: string;
  source: string; dateCreated: string; audioUrl: string;
};
type CallNote = { id: string; note: string; created_at: string };
type CallStats = {
  outboundToday: number; inboundToday: number; totalCalls: number;
  avgTalkSeconds: number; totalCost: number;
};

type DeviceStatus = "unregistered" | "registering" | "registered" | "error";
type ActiveCallState = "idle" | "connecting" | "ringing" | "active" | "disconnecting";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}
function formatDuration(seconds: string | number): string {
  const s = Number(seconds);
  if (!s || isNaN(s)) return "--:--";
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function formatTalk(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}
function formatDateTime(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(date));
}
function formatDateShort(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}
function formatEstCost(price: string | null): string {
  if (!price) return "—";
  return `$${Math.abs(Number(price)).toFixed(4)}`;
}

// ─── Status sub-components ─────────────────────────────────────────────────────

function CallStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "in-progress": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "no-answer": "bg-red-500/15 text-red-600 dark:text-red-400",
    busy: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    ringing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  };
  const labels: Record<string, string> = { "no-answer": "No Answer", "in-progress": "In Progress" };
  return (
    <span className={cn("rounded px-1.5 py-0 text-[10px] font-medium", styles[status] ?? "bg-muted text-muted-foreground")}>
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
function CallDirectionIcon({ direction, status }: { direction: string; status: string }) {
  const missed = status === "no-answer" || status === "busy" || status === "failed";
  if (missed) return <PhoneMissed className="h-4 w-4 text-red-500" />;
  if (direction.startsWith("outbound")) return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
  return <PhoneIncoming className="h-4 w-4 text-emerald-500" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CallsWorkspace({ onSmsTo }: { onSmsTo?: (phone: string) => void }) {
  // Dialer state
  const [dialInput, setDialInput] = React.useState("");
  const [deviceStatus, setDeviceStatus] = React.useState<DeviceStatus>("unregistered");
  const [callState, setCallState] = React.useState<ActiveCallState>("idle");
  const [callDuration, setCallDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);
  const [deviceError, setDeviceError] = React.useState("");
  const [defaultNumber, setDefaultNumber] = React.useState("");
  const [availableNumbers, setAvailableNumbers] = React.useState<string[]>([]);
  const [selectedCallerId, setSelectedCallerId] = React.useState("");
  const [activeCallSid, setActiveCallSid] = React.useState("");
  const [isRecording, setIsRecording] = React.useState(false);

  // History state
  const [calls, setCalls] = React.useState<TwilioCall[]>([]);
  const [stats, setStats] = React.useState<CallStats | null>(null);
  const [callsLoading, setCallsLoading] = React.useState(false);
  const [historyTab, setHistoryTab] = React.useState<"calls" | "voicemail">("calls");
  const [expandedSid, setExpandedSid] = React.useState<string | null>(null);
  const [recordings, setRecordings] = React.useState<Record<string, TwilioRecording[]>>({});
  const [loadingRec, setLoadingRec] = React.useState<Record<string, boolean>>({});
  const [transcripts, setTranscripts] = React.useState<Record<string, string>>({});
  const [transcribing, setTranscribing] = React.useState<Record<string, boolean>>({});

  // Notes state
  const [notes, setNotes] = React.useState<Record<string, CallNote[]>>({});
  const [noteInput, setNoteInput] = React.useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = React.useState<Record<string, boolean>>({});

  // Twilio refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = React.useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeCallRef = React.useRef<any>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    initDevice();
    loadCalls(false);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      deviceRef.current?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initDevice() {
    setDeviceStatus("registering");
    setDeviceError("");
    try {
      const res = await fetch("/api/communications/token");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeviceError(data.error || "Could not get Twilio token.");
        setDeviceStatus("error");
        return;
      }
      const data = await res.json();
      if (data.defaultPhoneNumber) setDefaultNumber(data.defaultPhoneNumber);
      if (data.phoneNumbers?.length) {
        setAvailableNumbers(data.phoneNumbers);
        setSelectedCallerId((prev) => prev || data.defaultPhoneNumber || data.phoneNumbers[0]);
      }

      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(data.token, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        codecPreferences: ["opus", "pcmu"] as any,
      });
      device.on("registered", () => setDeviceStatus("registered"));
      device.on("error", (err: Error) => {
        setDeviceStatus("error");
        setDeviceError(err.message || "Twilio device error.");
      });
      device.on("incoming", (call: unknown) => handleIncoming(call));
      device.on("tokenWillExpire", () => initDevice());
      await device.register();
      deviceRef.current = device;
    } catch (err) {
      setDeviceStatus("error");
      setDeviceError(err instanceof Error ? err.message : "Could not initialize Twilio.");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleIncoming(call: any) {
    const from = call.parameters?.From || "Unknown";
    if (window.confirm(`Incoming call from ${formatPhone(from)}. Accept?`)) {
      call.accept();
      activeCallRef.current = call;
      setDialInput(from);
      setCallState("active");
      setActiveCallSid(call.parameters?.CallSid || "");
      startTimer();
      call.on("disconnect", endCall);
    } else {
      call.reject();
    }
  }

  function startTimer() {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  }
  function endCall() {
    if (timerRef.current) clearInterval(timerRef.current);
    activeCallRef.current = null;
    setCallState("idle");
    setIsMuted(false);
    setCallDuration(0);
    setActiveCallSid("");
    setIsRecording(false);
    setTimeout(() => loadCalls(historyTab === "voicemail"), 3000);
  }

  async function makeCall() {
    if (!deviceRef.current || !dialInput.trim()) return;
    setCallState("connecting");
    try {
      const call = await deviceRef.current.connect({
        params: { To: dialInput.trim(), callerId: selectedCallerId },
      });
      activeCallRef.current = call;
      call.on("ringing", () => setCallState("ringing"));
      call.on("accept", () => {
        setCallState("active");
        startTimer();
        setActiveCallSid(call.parameters?.CallSid || "");
      });
      call.on("disconnect", endCall);
      call.on("cancel", endCall);
      call.on("reject", endCall);
    } catch (err) {
      setCallState("idle");
      setDeviceError(err instanceof Error ? err.message : "Call failed.");
    }
  }

  async function startRecording() {
    if (!activeCallSid || isRecording) return;
    setIsRecording(true);
    try {
      await fetch("/api/communications/calls/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callSid: activeCallSid }),
      });
    } catch {
      setIsRecording(false);
    }
  }

  function hangUp() {
    activeCallRef.current?.disconnect?.();
    deviceRef.current?.disconnectAll?.();
    endCall();
  }
  function toggleMute() {
    if (!activeCallRef.current) return;
    const next = !isMuted;
    activeCallRef.current.mute(next);
    setIsMuted(next);
  }
  function pressKey(key: string) {
    if (callState === "active") activeCallRef.current?.sendDigits?.(key);
    else setDialInput((p) => p + key);
  }

  async function loadCalls(voicemail: boolean) {
    setCallsLoading(true);
    try {
      const url = voicemail
        ? "/api/communications/calls?voicemail=true"
        : "/api/communications/calls?limit=50";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
        if (data.stats) setStats(data.stats);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeviceError(data.error || "Could not load call history.");
      }
    } finally {
      setCallsLoading(false);
    }
  }

  async function toggleExpand(sid: string) {
    if (expandedSid === sid) { setExpandedSid(null); return; }
    setExpandedSid(sid);
    if (!recordings[sid] && !loadingRec[sid]) {
      setLoadingRec((p) => ({ ...p, [sid]: true }));
      try {
        const res = await fetch(`/api/communications/recordings?callSid=${encodeURIComponent(sid)}`);
        if (res.ok) {
          const data = await res.json();
          setRecordings((p) => ({ ...p, [sid]: data.recordings ?? [] }));
        }
      } finally {
        setLoadingRec((p) => ({ ...p, [sid]: false }));
      }
    }
    if (!notes[sid]) loadNotes(sid);
  }

  async function transcribe(recordingSid: string) {
    setTranscribing((p) => ({ ...p, [recordingSid]: true }));
    try {
      const res = await fetch("/api/communications/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recordingSid }),
      });
      const data = await res.json().catch(() => ({}));
      setTranscripts((p) => ({ ...p, [recordingSid]: res.ok ? data.transcript : (data.error || "Transcription failed.") }));
    } finally {
      setTranscribing((p) => ({ ...p, [recordingSid]: false }));
    }
  }

  async function loadNotes(callSid: string) {
    try {
      const res = await fetch(`/api/communications/calls/notes?callSid=${encodeURIComponent(callSid)}`);
      if (res.ok) {
        const data = await res.json();
        setNotes((p) => ({ ...p, [callSid]: data.notes ?? [] }));
      }
    } catch { /* silent */ }
  }
  async function saveNote(callSid: string) {
    const note = (noteInput[callSid] || "").trim();
    if (!note) return;
    setSavingNote((p) => ({ ...p, [callSid]: true }));
    try {
      await fetch("/api/communications/calls/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callSid, note }),
      });
      setNoteInput((p) => ({ ...p, [callSid]: "" }));
      await loadNotes(callSid);
    } finally {
      setSavingNote((p) => ({ ...p, [callSid]: false }));
    }
  }
  async function deleteNote(callSid: string, id: string) {
    try {
      await fetch(`/api/communications/calls/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadNotes(callSid);
    } catch { /* silent */ }
  }

  const visibleCalls = React.useMemo(() => {
    if (historyTab === "voicemail") {
      return calls.filter((c) => c.direction === "inbound" && ["no-answer", "completed"].includes(c.status));
    }
    return calls;
  }, [calls, historyTab]);

  const isCallActive = callState !== "idle";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      {/* Stats bar */}
      <div className="mb-5 flex snap-x gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 xl:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        <StatCard icon={PhoneOutgoing} label="Outbound today" value={stats ? String(stats.outboundToday) : "—"} tint="text-blue-500" />
        <StatCard icon={PhoneIncoming} label="Inbound today" value={stats ? String(stats.inboundToday) : "—"} tint="text-emerald-500" />
        <StatCard icon={Timer} label="Avg talk time" value={stats ? formatTalk(stats.avgTalkSeconds) : "—"} tint="text-purple-500" />
        <StatCard icon={Hash} label="Total calls" value={stats ? String(stats.totalCalls) : "—"} tint="text-foreground" />
        <StatCard icon={DollarSign} label="Est. cost" value={stats ? `$${stats.totalCost.toFixed(2)}` : "—"} tint="text-emerald-600" />
      </div>

      {/* Device error banner */}
      {deviceError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <span className="flex-1">{deviceError}</span>
          <button onClick={initDevice} className="shrink-0 rounded-md border px-2 py-0.5 text-xs hover:bg-red-100 dark:hover:bg-red-900/40">Retry</button>
          <button onClick={() => setDeviceError("")} className="shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* ── Dialpad ── */}
        <div className="h-fit rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-accent" />
            <h3 className="text-base font-semibold">Dialpad</h3>
          </div>

          <div className="relative mb-4">
            <input
              type="tel"
              value={dialInput}
              onChange={(e) => setDialInput(e.target.value)}
              placeholder="Enter phone number"
              disabled={isCallActive}
              className="h-11 w-full rounded-lg border border-border bg-muted/40 px-4 text-center font-mono text-base tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {dialInput && !isCallActive && (
              <button onClick={() => setDialInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {isCallActive && (
            <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 p-3 text-center">
              <div className="mb-1 text-xs text-muted-foreground">
                {callState === "connecting" && "Connecting…"}
                {callState === "ringing" && "Ringing…"}
                {callState === "active" && formatDuration(callDuration)}
                {callState === "disconnecting" && "Disconnecting…"}
              </div>
              <div className="text-sm font-semibold">{formatPhone(dialInput) || "Unknown"}</div>
            </div>
          )}

          {!isCallActive ? (
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", ""], ["#", ""]].map(([digit, letters]) => (
                <button key={digit} onClick={() => pressKey(digit)} className="flex h-14 flex-col items-center justify-center rounded-xl border border-border bg-muted/40 font-semibold transition hover:bg-accent/10 active:scale-95">
                  <span className="text-xl leading-none">{digit}</span>
                  {letters && <span className="mt-0.5 text-[9px] font-medium tracking-widest text-muted-foreground">{letters}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-3 gap-2">
              <button onClick={toggleMute} className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition", isMuted ? "border-red-400 bg-red-500/15 text-red-600" : "border-border bg-muted/40 hover:bg-accent/10")}>
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button onClick={startRecording} disabled={isRecording || !activeCallSid} className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition", isRecording ? "border-red-400 bg-red-500/15 text-red-600" : "border-border bg-muted/40 hover:bg-accent/10 disabled:opacity-40")}>
                {isRecording ? <Circle className="h-4 w-4 animate-pulse fill-red-500 text-red-500" /> : <Disc className="h-4 w-4" />}
                {isRecording ? "Recording" : "Record"}
              </button>
              <button className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted/40 text-xs font-medium hover:bg-accent/10">
                <Pause className="h-4 w-4" />
                Keypad
              </button>
            </div>
          )}

          {!isCallActive ? (
            <button onClick={makeCall} disabled={!dialInput.trim() || deviceStatus !== "registered"} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              <Phone className="h-5 w-5" /> Call
            </button>
          ) : (
            <button onClick={hangUp} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 font-semibold text-white transition hover:bg-red-600">
              <PhoneOff className="h-5 w-5" /> Hang up
            </button>
          )}

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", deviceStatus === "registered" ? "bg-emerald-500" : deviceStatus === "registering" ? "animate-pulse bg-yellow-500" : "bg-red-500")} />
            {deviceStatus === "registered" && "Ready to call"}
            {deviceStatus === "registering" && "Connecting…"}
            {deviceStatus === "unregistered" && "Not connected"}
            {deviceStatus === "error" && "Connection error"}
            {defaultNumber && <span className="ml-1 opacity-70">· {formatPhone(defaultNumber)}</span>}
          </div>
        </div>

        {/* ── Call history + detail ── */}
        <div>
          {availableNumbers.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dial out from</div>
              <div className="flex flex-wrap gap-2">
                {availableNumbers.map((num) => {
                  const selected = num === selectedCallerId;
                  return (
                    <button key={num} onClick={() => setSelectedCallerId(num)} disabled={isCallActive} className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50", selected ? "border-accent bg-accent/10 text-accent" : "border-border bg-muted/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground")}>
                      <PhoneForwarded className={cn("h-3 w-3", selected && "text-accent")} />
                      {formatPhone(num)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button onClick={() => { setHistoryTab("calls"); loadCalls(false); }} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition", historyTab === "calls" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Clock className="h-3.5 w-3.5" />Call History
              </button>
              <button onClick={() => { setHistoryTab("voicemail"); loadCalls(true); }} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition", historyTab === "voicemail" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Voicemail className="h-3.5 w-3.5" />Voicemail
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{visibleCalls.length} {historyTab === "voicemail" ? "messages" : "calls"}</span>
              <Button variant="outline" size="sm" onClick={() => loadCalls(historyTab === "voicemail")} disabled={callsLoading} className="h-7 gap-1.5 text-xs">
                <RefreshCw className={cn("h-3 w-3", callsLoading && "animate-spin")} />Refresh
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {callsLoading && !calls.length && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
            {!callsLoading && !visibleCalls.length && (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                {historyTab === "voicemail" ? "No voicemail messages." : "No call history yet."}
              </div>
            )}
            {visibleCalls.map((call) => {
              const isExpanded = expandedSid === call.sid;
              const recs = recordings[call.sid] ?? [];
              const displayNumber = call.direction.startsWith("outbound") ? call.to : call.from;
              return (
                <div key={call.sid} className={cn("overflow-hidden rounded-xl border border-border bg-card transition-shadow", isExpanded && "ring-1 ring-accent/30")}>
                  <button onClick={() => toggleExpand(call.sid)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted/40">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-muted/50">
                      <CallDirectionIcon direction={call.direction} status={call.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{formatPhone(displayNumber)}</span>
                        <CallStatusBadge status={call.status} />
                        {recs.length > 0 && (
                          <span className="rounded bg-purple-500/15 px-1.5 py-0 text-[10px] text-purple-700 dark:text-purple-300">
                            <Play className="mr-0.5 inline h-2.5 w-2.5" />Recorded
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /><span>{formatDuration(call.duration)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDateShort(call.dateCreated)}</span>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/10">
                      <div className="grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-4">
                        <Detail label="Direction" value={call.direction.startsWith("outbound") ? "Outbound" : "Inbound"} />
                        <Detail label="Duration" value={formatDuration(call.duration)} />
                        <Detail label="Date & Time" value={formatDateTime(call.dateCreated)} />
                        <Detail label="Est. Cost" value={formatEstCost(call.price)} valueClass="text-emerald-600 dark:text-emerald-400" />
                      </div>

                      <div className="flex items-center gap-2 px-4 pb-3">
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setDialInput(displayNumber)}>
                          <Phone className="h-3 w-3" />Call back
                        </Button>
                        {onSmsTo && (
                          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => onSmsTo(displayNumber)}>
                            <MessageSquare className="h-3 w-3" />SMS
                          </Button>
                        )}
                      </div>

                      {loadingRec[call.sid] && <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Loading recordings…</div>}
                      {!loadingRec[call.sid] && recs.length === 0 && (
                        <div className="border-t border-border px-4 py-2.5"><p className="text-xs italic text-muted-foreground">No recording for this call.</p></div>
                      )}
                      {!loadingRec[call.sid] && recs.map((rec) => (
                        <div key={rec.sid} className="border-t border-border bg-card/30">
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <Disc className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <audio controls src={rec.audioUrl} className="h-7 flex-1" />
                            <span className="text-xs text-muted-foreground">{formatDuration(rec.duration)}</span>
                            <a href={rec.audioUrl} download={`recording-${rec.sid}.mp3`} className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          <div className="border-t border-border px-4 py-2.5">
                            {transcripts[rec.sid] ? (
                              <div>
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI Transcript</span>
                                </div>
                                <p className="text-sm leading-5 text-foreground/80">{transcripts[rec.sid]}</p>
                              </div>
                            ) : (
                              <button onClick={() => transcribe(rec.sid)} disabled={transcribing[rec.sid]} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium hover:bg-accent/10 disabled:opacity-60">
                                <Sparkles className="h-3.5 w-3.5 text-accent" />
                                {transcribing[rec.sid] ? "Transcribing…" : "Transcribe with AI"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Notes */}
                      <div className="border-t border-border bg-card/20 px-4 py-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Call Notes</span>
                        </div>
                        {(notes[call.sid] ?? []).length > 0 && (
                          <div className="mb-2 space-y-1.5">
                            {(notes[call.sid] ?? []).map((n) => (
                              <div key={n.id} className="group flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                                <p className="flex-1 text-xs leading-5 text-foreground/90">{n.note}</p>
                                <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(n.created_at))}
                                  </span>
                                  <button onClick={() => deleteNote(call.sid, n.id)} className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:text-red-500">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <textarea
                            value={noteInput[call.sid] || ""}
                            onChange={(e) => setNoteInput((p) => ({ ...p, [call.sid]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(call.sid); }}
                            placeholder="Add a note… (⌘↵ to save)"
                            rows={2}
                            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          <button onClick={() => saveNote(call.sid)} disabled={savingNote[call.sid] || !(noteInput[call.sid] || "").trim()} className="shrink-0 self-end rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-40">
                            {savingNote[call.sid] ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small presentational helpers ─────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, tint }: { icon: React.ElementType; label: string; value: string; tint: string }) {
  return (
    <div className="min-w-[42%] shrink-0 snap-start rounded-xl border border-border bg-card px-4 py-3 sm:min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tint)} />{label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function Detail({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-medium", valueClass)}>{value}</div>
    </div>
  );
}
