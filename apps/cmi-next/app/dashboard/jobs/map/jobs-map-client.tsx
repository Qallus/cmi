"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, TileLayer, LayerGroup } from "leaflet";
import { Layers, MapPin, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobStatus } from "@/lib/jobs/types";
import { JobStatusBadge, JobColorDot } from "../job-ui";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEFAULT_CENTER: [number, number] = [33.4484, -112.074]; // Phoenix, AZ

export function JobsMapClient({ rows }: { rows: JobListRow[] }) {
  const router = useRouter();
  const mapEl = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const tileRef = React.useRef<TileLayer | null>(null);
  const markersRef = React.useRef<LayerGroup | null>(null);
  const [layer, setLayer] = React.useState<"map" | "satellite">("map");
  const [ready, setReady] = React.useState(false);

  const mapped = React.useMemo(() => rows.filter((r) => r.latitude != null && r.longitude != null), [rows]);
  const unmapped = React.useMemo(() => rows.filter((r) => r.latitude == null || r.longitude == null), [rows]);

  // Build the Leaflet map once, client-side only (dynamic import keeps SSR safe).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { center: DEFAULT_CENTER, zoom: 10, scrollWheelZoom: true });
      tileRef.current = L.tileLayer(OSM_URL, { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
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

  // (Re)draw pins whenever the mapped jobs change.
  React.useEffect(() => {
    if (!ready || !mapRef.current || !markersRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const group = markersRef.current!;
      group.clearLayers();
      const bounds: [number, number][] = [];
      for (const j of mapped) {
        const lat = j.latitude as number, lng = j.longitude as number;
        bounds.push([lat, lng]);
        const color = j.job_color || "#c2410c";
        const icon = L.divIcon({
          className: "cmi-job-pin",
          html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        const m = L.marker([lat, lng], { icon }).addTo(group);
        m.bindPopup(`<strong>${j.job_name}</strong><br/>${j.job_number ?? ""}<br/><a href="/dashboard/jobs/${j.id}/summary">View job →</a>`);
      }
      if (bounds.length) mapRef.current!.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    })();
  }, [mapped, ready]);

  function mapAll() {
    // "Map all" — fit every geocoded job into view.
    if (!mapRef.current || mapped.length === 0) return;
    mapRef.current.fitBounds(mapped.map((j) => [j.latitude as number, j.longitude as number]), { padding: [40, 40], maxZoom: 14 });
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
          <button type="button" onClick={mapAll} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Map All</button>
          {/* Clustering is a future enhancement */}
          <button type="button" disabled title="Clustering coming soon" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-50">Cluster</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left job list */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-card/40">
          {rows.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No jobs yet.</div>}
          {mapped.map((j) => (
            <div key={j.id} className="border-b border-border p-3">
              <div className="flex items-center gap-2"><JobColorDot color={j.job_color} /><span className="truncate text-sm font-medium">{j.job_name}</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{j.full_address ?? "—"}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <JobStatusBadge status={j.status as JobStatus} />
                <button type="button" onClick={() => router.push(`/dashboard/jobs/${j.id}/summary`)} className="text-xs font-medium text-accent hover:underline">View</button>
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
