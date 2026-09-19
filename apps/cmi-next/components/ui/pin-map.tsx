"use client";

import * as React from "react";

// Leaflet map of coloured pins with a popup "Open →" link. Leaflet loads
// client-side only; the page must import "leaflet/dist/leaflet.css".
export type MapPin = { id: string; lat: number; lng: number; title: string; lines?: string[]; color?: string };

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_CENTER: [number, number] = [33.4484, -112.074]; // Phoenix

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function PinMap({ pins, onOpen, openLabel = "Open", className }: { pins: MapPin[]; onOpen: (id: string) => void; openLabel?: string; className?: string }) {
  const mapEl = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("leaflet").Map | null>(null);
  const markersRef = React.useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = React.useState(false);
  const openRef = React.useRef(onOpen);
  React.useEffect(() => { openRef.current = onOpen; }, [onOpen]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { center: DEFAULT_CENTER, zoom: 10, scrollWheelZoom: true });
      L.tileLayer(OSM_URL, { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  React.useEffect(() => {
    if (!ready || !mapRef.current || !markersRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const group = markersRef.current!;
      group.clearLayers();
      const bounds: [number, number][] = [];
      for (const p of pins) {
        bounds.push([p.lat, p.lng]);
        const icon = L.divIcon({
          className: "cmi-pin",
          html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${p.color ?? "#c2410c"};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(group);
        const btnId = `pin-open-${p.id}`;
        m.bindPopup(`<strong>${esc(p.title)}</strong>${(p.lines ?? []).map((l) => `<br/>${esc(l)}`).join("")}<br/><a href="#" id="${btnId}">${esc(openLabel)} →</a>`);
        m.on("popupopen", () => { const el = document.getElementById(btnId); if (el) el.onclick = (e) => { e.preventDefault(); openRef.current(p.id); }; });
      }
      if (bounds.length) mapRef.current!.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    })();
  }, [pins, ready, openLabel]);

  return <div ref={mapEl} className={className ?? "h-[calc(100vh-320px)] min-h-[360px] w-full overflow-hidden rounded-lg border border-border"} />;
}
