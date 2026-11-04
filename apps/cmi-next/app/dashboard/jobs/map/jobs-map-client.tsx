"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, TileLayer, LayerGroup, Marker } from "leaflet";
import { Layers, MapPin, Table as TableIcon, Maximize, Group } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobStatus } from "@/lib/jobs/types";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import { JobStatusBadge, JobColorDot } from "../job-ui";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEFAULT_CENTER: [number, number] = [33.4484, -112.074]; // Phoenix, AZ
const PIN_DEFAULT = "#c2410c";
const CLUSTER_PX = 44; // pins closer than this on screen group into one bubble
const CLUSTER_KEY = "cmi.jobsmap.cluster";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** The short label inside a pin: the job's sequence ("26_027_…" → "027"). */
function pinLabel(j: JobListRow): string {
  const m = /^\d{2}_(\d{2,4})/.exec(j.job_number ?? "");
  if (m) return m[1];
  return (j.job_name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

function pinHtml(j: JobListRow, state: "idle" | "hot") {
  const color = j.job_color || PIN_DEFAULT;
  const hot = state === "hot";
  const w = hot ? 38 : 30, h = hot ? 50 : 40;
  return `<div class="cmi-pin" style="width:${w}px;height:${h}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:transform .15s">
    <svg width="${w}" height="${h}" viewBox="0 0 30 40" aria-hidden="true">
      <path d="M15 39C15 39 28 24.5 28 14.5C28 7 22.2 1 15 1S2 7 2 14.5C2 24.5 15 39 15 39Z" fill="${esc(color)}" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="14.5" r="9" fill="white"/>
      <text x="15" y="18" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${pinLabel(j).length > 3 ? 6.5 : 8}" font-weight="700" fill="#2f2b28">${esc(pinLabel(j))}</text>
    </svg></div>`;
}

function pinIcon(L: typeof import("leaflet"), j: JobListRow, on: boolean) {
  return L.divIcon({
    className: "cmi-job-pin", html: pinHtml(j, on ? "hot" : "idle"),
    iconSize: on ? [38, 50] : [30, 40], iconAnchor: on ? [19, 49] : [15, 39],
    popupAnchor: [0, on ? -45 : -36], tooltipAnchor: [0, on ? -48 : -38],
  });
}

function popupHtml(j: JobListRow) {
  const status = JOB_STATUS_META[j.status as JobStatus]?.label ?? "";
  const directions = j.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${j.latitude},${j.longitude}` : null;
  return `<div style="min-width:220px;font-family:inherit">
    <div style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:9999px;background:${esc(j.job_color || PIN_DEFAULT)};flex-shrink:0"></span>
      <strong style="font-size:14px;line-height:1.25">${esc(j.job_name)}</strong></div>
    ${j.job_number ? `<div style="margin-top:2px;font-size:11px;color:#6b6560;font-family:ui-monospace,monospace">${esc(j.job_number)}</div>` : ""}
    ${status ? `<div style="margin-top:6px;display:inline-block;border-radius:9999px;background:#9e6f2e1f;color:#7a5520;padding:1px 8px;font-size:11px;font-weight:600">${esc(status)}</div>` : ""}
    ${j.full_address ? `<div style="margin-top:6px;font-size:12px;color:#4a4541">${esc(j.full_address)}</div>` : ""}
    <div style="margin-top:10px;display:flex;gap:12px;font-size:12px;font-weight:600">
      <a href="/dashboard/jobs/${esc(j.id)}/summary" style="color:#9e6f2e">View job →</a>
      ${directions ? `<a href="${directions}" target="_blank" rel="noopener noreferrer" style="color:#6b6560">Directions</a>` : ""}
    </div></div>`;
}

export function JobsMapClient({ rows }: { rows: JobListRow[] }) {
  const router = useRouter();
  const mapEl = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const tileRef = React.useRef<TileLayer | null>(null);
  const markersRef = React.useRef<LayerGroup | null>(null);
  const pinsById = React.useRef(new Map<string, Marker>());
  const listRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [layer, setLayer] = React.useState<"map" | "satellite">("map");
  const [ready, setReady] = React.useState(false);
  const [cluster, setCluster] = React.useState(true);
  const [hot, setHot] = React.useState<string | null>(null); // hovered in the list
  const [selected, setSelected] = React.useState<string | null>(null);
  const [zoomTick, setZoomTick] = React.useState(0);
  // Read by the async redraw so pins drawn after a zoom keep their highlight.
  const litRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => { litRef.current = new Set([hot, selected].filter(Boolean) as string[]); }, [hot, selected]);

  const mapped = React.useMemo(() => rows.filter((r) => r.latitude != null && r.longitude != null), [rows]);
  const unmapped = React.useMemo(() => rows.filter((r) => r.latitude == null || r.longitude == null), [rows]);

  React.useEffect(() => {
    try { if (localStorage.getItem(CLUSTER_KEY) === "0") setCluster(false); } catch { /* storage blocked */ }
  }, []);
  const toggleCluster = () => setCluster((v) => { try { localStorage.setItem(CLUSTER_KEY, v ? "0" : "1"); } catch { /* storage blocked */ } return !v; });

  // Build the Leaflet map once, client-side only (dynamic import keeps SSR safe).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { center: DEFAULT_CENTER, zoom: 10, scrollWheelZoom: true });
      tileRef.current = L.tileLayer(OSM_URL, { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      map.on("zoomend", () => setZoomTick((t) => t + 1));
      mapRef.current = map;
      setReady(true);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Swap tile layer when the Map/Satellite toggle changes.
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      if (tileRef.current) tileRef.current.remove();
      tileRef.current = L.tileLayer(layer === "map" ? OSM_URL : SAT_URL, {
        attribution: layer === "map" ? "© OpenStreetMap" : "© Esri", maxZoom: 19,
      }).addTo(mapRef.current!);
    })();
  }, [layer, ready]);

  // Fit every job into view when the list of mapped jobs changes.
  React.useEffect(() => {
    if (!ready || !mapRef.current || !mapped.length) return;
    mapRef.current.fitBounds(mapped.map((j) => [j.latitude as number, j.longitude as number]), { padding: [50, 50], maxZoom: 14 });
  }, [mapped, ready]);

  // (Re)draw pins and cluster bubbles for the current zoom.
  React.useEffect(() => {
    if (!ready || !mapRef.current || !markersRef.current) return;
    let live = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!live) return;
      const map = mapRef.current!;
      const group = markersRef.current!;
      group.clearLayers();
      pinsById.current.clear();

      // Greedy screen-space grouping: each job joins the first bubble within CLUSTER_PX.
      const groups: { jobs: JobListRow[]; pt: { x: number; y: number } }[] = [];
      for (const j of mapped) {
        const pt = map.latLngToLayerPoint([j.latitude as number, j.longitude as number]);
        const near = cluster ? groups.find((g) => Math.hypot(g.pt.x - pt.x, g.pt.y - pt.y) < CLUSTER_PX) : undefined;
        if (near) near.jobs.push(j); else groups.push({ jobs: [j], pt });
      }

      for (const g of groups) {
        if (g.jobs.length > 1) {
          const lat = g.jobs.reduce((s, j) => s + (j.latitude as number), 0) / g.jobs.length;
          const lng = g.jobs.reduce((s, j) => s + (j.longitude as number), 0) / g.jobs.length;
          const n = g.jobs.length, size = n > 9 ? 44 : 38;
          const icon = L.divIcon({
            className: "cmi-job-cluster",
            html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#9e6f2e;color:white;display:flex;align-items:center;justify-content:center;font:700 14px ui-sans-serif,system-ui,sans-serif;border:3px solid white;box-shadow:0 0 0 4px rgba(158,111,46,.3),0 2px 6px rgba(0,0,0,.35)">${n}</div>`,
            iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          });
          const m = L.marker([lat, lng], { icon, zIndexOffset: 500 }).addTo(group);
          m.bindTooltip(g.jobs.map((j) => esc(j.job_name)).join("<br/>"), { direction: "top", offset: [0, -size / 2] });
          m.on("click", () => map.fitBounds(g.jobs.map((j) => [j.latitude as number, j.longitude as number]), { padding: [80, 80], maxZoom: 17 }));
          for (const j of g.jobs) pinsById.current.set(j.id, m);
          continue;
        }
        const j = g.jobs[0];
        const m = L.marker([j.latitude as number, j.longitude as number], { icon: pinIcon(L, j, litRef.current.has(j.id)), riseOnHover: true, zIndexOffset: litRef.current.has(j.id) ? 1000 : 0 }).addTo(group);
        m.bindTooltip(esc(j.job_name), { direction: "top", offset: [0, 0] });
        m.bindPopup(popupHtml(j), { closeButton: true, offset: [0, 0], minWidth: 220 });
        m.on("click", () => { setSelected(j.id); listRefs.current.get(j.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
        m.on("popupclose", () => setSelected((s) => (s === j.id ? null : s)));
        pinsById.current.set(j.id, m);
      }
    })();
    return () => { live = false; };
  }, [mapped, ready, cluster, zoomTick]);

  // Grow the hovered / selected pin and bring it to the front.
  React.useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = (await import("leaflet")).default;
      for (const j of mapped) {
        const m = pinsById.current.get(j.id);
        if (!m || (m.options.icon?.options.className ?? "") !== "cmi-job-pin") continue;
        const on = hot === j.id || selected === j.id;
        m.setIcon(pinIcon(L, j, on));
        m.setZIndexOffset(on ? 1000 : 0);
      }
    })();
  }, [hot, selected, mapped, ready, zoomTick, cluster]);

  function focusJob(j: JobListRow) {
    const map = mapRef.current;
    if (!map) return;
    setSelected(j.id);
    map.once("moveend", () => { const m = pinsById.current.get(j.id); if (m && m.getPopup()) m.openPopup(); });
    map.flyTo([j.latitude as number, j.longitude as number], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }

  function mapAll() {
    // "Map all" — fit every geocoded job into view.
    if (!mapRef.current || mapped.length === 0) return;
    mapRef.current.closePopup();
    setSelected(null);
    mapRef.current.fitBounds(mapped.map((j) => [j.latitude as number, j.longitude as number]), { padding: [50, 50], maxZoom: 14 });
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Management</div>
          <h1 className="mt-0.5 font-display text-xl font-semibold tracking-tight">Jobs Map</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            <Link href="/dashboard/jobs" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><TableIcon className="h-3.5 w-3.5" /> List</Link>
            <span className="flex items-center gap-1.5 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent"><MapPin className="h-3.5 w-3.5" /> Map</span>
          </div>
          <button type="button" onClick={() => setLayer((l) => (l === "map" ? "satellite" : "map"))} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Layers className="h-3.5 w-3.5" /> {layer === "map" ? "Satellite" : "Map"}
          </button>
          <button type="button" onClick={mapAll} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><Maximize className="h-3.5 w-3.5" /> Map All</button>
          <button type="button" onClick={toggleCluster} aria-pressed={cluster} title="Group jobs that sit close together into a numbered bubble; click a bubble to zoom in"
            className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium", cluster ? "border-accent/40 bg-accent/15 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>
            <Group className="h-3.5 w-3.5" /> Cluster
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left job list: hover highlights the pin, click flies to it */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-card/40">
          {rows.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No jobs yet.</div>}
          {mapped.map((j) => (
            <div key={j.id} ref={(el) => { if (el) listRefs.current.set(j.id, el); else listRefs.current.delete(j.id); }}
              role="button" tabIndex={0} onClick={() => focusJob(j)} onKeyDown={(e) => { if (e.key === "Enter") focusJob(j); }}
              onMouseEnter={() => setHot(j.id)} onMouseLeave={() => setHot((h) => (h === j.id ? null : h))}
              className={cn("cursor-pointer border-b border-l-2 border-b-border p-3 transition-colors", selected === j.id ? "border-l-accent bg-accent/10" : hot === j.id ? "border-l-accent/50 bg-muted/50" : "border-l-transparent hover:bg-muted/40")}>
              <div className="flex items-center gap-2"><JobColorDot color={j.job_color} /><span className="truncate text-sm font-medium">{j.job_name}</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{j.full_address ?? "—"}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <JobStatusBadge status={j.status as JobStatus} />
                <button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/jobs/${j.id}/summary`); }} className="text-xs font-medium text-accent hover:underline">View</button>
              </div>
            </div>
          ))}
          {unmapped.length > 0 && (
            <div className="p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Not on map (no coordinates)</div>
              {unmapped.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="truncate text-muted-foreground">{j.job_name}</span>
                  <button type="button" onClick={() => router.push(`/dashboard/jobs/${j.id}/summary`)} className="shrink-0 text-accent hover:underline">View</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative min-w-0 flex-1">
          <div ref={mapEl} className="h-full w-full" />
          {mapped.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-border bg-card/90 px-4 py-3 text-center text-sm text-muted-foreground">
                No geocoded jobs yet. Add an address to a job and it will appear here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
