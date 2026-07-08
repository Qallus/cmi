"use client";

// Bolt AI voice call — connects the browser directly to the xAI Voice Agent
// realtime API using a short-lived ephemeral token minted by /api/voice-agent/token.
// Mic audio is streamed up as base64 PCM16 @ 24kHz (server VAD handles turn-taking);
// assistant audio comes back as base64 PCM16 and is played through Web Audio.
import * as React from "react";
import { Loader2, Mic, MicOff, PhoneOff, X } from "lucide-react";

const SAMPLE_RATE = 24000;

type Phase = "connecting" | "live" | "ended" | "error";
type Line = { role: "you" | "bolt"; text: string };

// ── base64 <-> PCM16 helpers ──
function floatToPcm16Base64(input: Float32Array): string {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}
// Linear downsample from the mic's native rate to 24kHz.
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = input[Math.floor(i * ratio)];
  return out;
}

export function BoltVoiceModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("connecting");
  const [error, setError] = React.useState<string | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [lines, setLines] = React.useState<Line[]>([]);

  const wsRef = React.useRef<WebSocket | null>(null);
  const micCtxRef = React.useRef<AudioContext | null>(null);
  const playCtxRef = React.useRef<AudioContext | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const mutedRef = React.useRef(false);
  const nextPlayRef = React.useRef(0);
  const boltLineRef = React.useRef<string>("");

  const cleanup = React.useCallback(() => {
    try { processorRef.current?.disconnect(); } catch { /* */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { micCtxRef.current?.close(); } catch { /* */ }
    try { playCtxRef.current?.close(); } catch { /* */ }
    try { wsRef.current?.close(); } catch { /* */ }
    processorRef.current = null; streamRef.current = null; micCtxRef.current = null; playCtxRef.current = null; wsRef.current = null;
  }, []);

  const end = React.useCallback(() => { cleanup(); setPhase("ended"); }, [cleanup]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Ephemeral token (server keeps the API key).
        const tokenRes = await fetch("/api/voice-agent/token", { method: "POST" });
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenJson.error ?? "Voice agent unavailable.");
        const token: string = tokenJson.token;
        const agentId: string = tokenJson.agent_id;
        const proto = token.startsWith("xai-client-secret.") ? token : `xai-client-secret.${token}`;

        // 2) Mic access.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        // 3) Connect to the xAI realtime endpoint with the ephemeral token subprotocol.
        const ws = new WebSocket(`wss://api.x.ai/v1/realtime?agent_id=${encodeURIComponent(agentId)}`, [proto]);
        wsRef.current = ws;

        const playCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
        playCtxRef.current = playCtx;

        ws.onopen = () => {
          if (cancelled) return;
          setPhase("live");
          // Let the agent's own config drive voice/instructions; just ensure server VAD.
          ws.send(JSON.stringify({ type: "session.update", session: { turn_detection: { type: "server_vad" } } }));

          // Start streaming mic audio.
          const micCtx = new AudioContext();
          micCtxRef.current = micCtx;
          const source = micCtx.createMediaStreamSource(stream);
          const processor = micCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (e) => {
            if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const ds = downsample(input, micCtx.sampleRate, SAMPLE_RATE);
            ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: floatToPcm16Base64(ds) }));
          };
          source.connect(processor);
          processor.connect(micCtx.destination);
        };

        ws.onmessage = (evt) => {
          let msg: { type?: string; delta?: string; transcript?: string };
          try { msg = JSON.parse(typeof evt.data === "string" ? evt.data : ""); } catch { return; }
          switch (msg.type) {
            case "response.output_audio.delta": {
              if (!msg.delta) break;
              setSpeaking(true);
              const f32 = base64ToFloat32(msg.delta);
              const buf = playCtx.createBuffer(1, f32.length, SAMPLE_RATE);
              buf.getChannelData(0).set(f32);
              const src = playCtx.createBufferSource();
              src.buffer = buf; src.connect(playCtx.destination);
              const now = playCtx.currentTime;
              const start = Math.max(now, nextPlayRef.current);
              src.start(start);
              nextPlayRef.current = start + buf.duration;
              break;
            }
            case "response.output_audio_transcript.delta":
              boltLineRef.current += msg.delta ?? "";
              setLines((l) => upsertLast(l, "bolt", boltLineRef.current));
              break;
            case "response.output_audio_transcript.done":
            case "response.done":
              boltLineRef.current = "";
              setSpeaking(false);
              break;
            case "conversation.item.input_audio_transcription.updated":
            case "conversation.item.input_audio_transcription.completed":
              if (msg.transcript) setLines((l) => upsertLast(l, "you", msg.transcript!));
              break;
            case "error":
              setError("The voice service reported an error.");
              break;
          }
        };
        ws.onerror = () => { if (!cancelled) { setError("Connection error. Please try again."); setPhase("error"); } };
        ws.onclose = () => { if (!cancelled && phase !== "ended") setPhase((p) => (p === "error" ? p : "ended")); };
      } catch (err) {
        if (!cancelled) {
          const m = err instanceof Error ? err.message : "Could not start the call.";
          setError(m.includes("Permission") || m.includes("denied") ? "Microphone access is required for the voice agent." : m);
          setPhase("error");
        }
      }
    })();
    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() { setMuted((m) => { mutedRef.current = !m; return !m; }); }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-full ${speaking ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent"}`}>
              <Mic className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold">Bolt AI</div>
              <div className="text-[11px] text-muted-foreground">Constructed Matter voice assistant</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-center">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              phase === "live" ? "bg-success/15 text-success" : phase === "error" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
            }`}>
              {phase === "connecting" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</>}
              {phase === "live" && <>{speaking ? "Bolt is speaking…" : muted ? "Muted" : "Listening…"}</>}
              {phase === "ended" && "Call ended"}
              {phase === "error" && (error ?? "Something went wrong")}
            </div>
          </div>

          {/* Transcript */}
          <div className="max-h-56 min-h-[7rem] space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
            {lines.length === 0 ? (
              <p className="pt-6 text-center text-xs text-muted-foreground">Say hello — ask about our services, portfolio, or booking a consultation.</p>
            ) : lines.map((l, i) => (
              <div key={i} className={l.role === "you" ? "text-right" : "text-left"}>
                <span className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${l.role === "you" ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{l.text}</span>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {phase === "live" && (
              <button type="button" onClick={toggleMute} className={`grid h-11 w-11 place-items-center rounded-full border ${muted ? "border-destructive text-destructive" : "border-border text-muted-foreground hover:text-foreground"}`} title={muted ? "Unmute" : "Mute"}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            {(phase === "live" || phase === "connecting") ? (
              <button type="button" onClick={end} className="grid h-11 w-11 place-items-center rounded-full bg-destructive text-white hover:opacity-90" title="End call"><PhoneOff className="h-5 w-5" /></button>
            ) : (
              <button type="button" onClick={onClose} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Replace the last line of `role` (streaming transcript), else append.
function upsertLast(lines: Line[], role: Line["role"], text: string): Line[] {
  const last = lines[lines.length - 1];
  if (last && last.role === role) return [...lines.slice(0, -1), { role, text }];
  return [...lines, { role, text }];
}
